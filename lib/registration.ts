export interface PoolRegistration {
  address: string;
  configAddress: string;
  baseMint: string;
  quoteMint: string;
  name: string;
  symbol: string;
  imageUrl: string | null;
  creator: string;
  baseDecimals: number;
  quoteDecimals: number;
  totalSupply: number;
  migrationThresholdQuote: number;
}

const KEY = "pending-registrations";

function readQueue(): PoolRegistration[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as PoolRegistration[];
  } catch {
    return [];
  }
}
function writeQueue(q: PoolRegistration[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(q));
  } catch {
    // storage unavailable
  }
}

/** Returns "ok", "retry" (temporary problem, keep trying) or "rejected" (will never succeed). */
export async function registerPool(p: PoolRegistration): Promise<"ok" | "retry" | "rejected"> {
  try {
    const res = await fetch("/api/pools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    if (res.ok) return "ok";
    return res.status === 400 || res.status === 403 ? "rejected" : "retry";
  } catch {
    return "retry";
  }
}

/** A launch that confirmed on-chain but couldn't be saved yet is kept and retried later. */
export function queueRegistration(p: PoolRegistration) {
  const q = readQueue().filter((x) => x.address !== p.address);
  writeQueue([...q, p]);
}

export async function flushPendingRegistrations() {
  const q = readQueue();
  if (q.length === 0) return;
  const remaining: PoolRegistration[] = [];
  for (const p of q) {
    if ((await registerPool(p)) === "retry") remaining.push(p);
  }
  writeQueue(remaining);
}
