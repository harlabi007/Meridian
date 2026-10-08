import type { ActivityResponse, PlatformStats, PoolDetail, PoolSummary } from "./types";

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

async function request<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    throw new ApiError(
      "Couldn't reach the Meridian server. If you're running locally, check that `npm run dev` is still running.",
      "NETWORK",
      0
    );
  }
  if (!res.ok) {
    let code = `HTTP_${res.status}`;
    let message = `The request failed (${res.status}).`;
    try {
      const body = await res.json();
      if (body?.error?.code) {
        code = body.error.code;
        message = body.error.message ?? message;
      }
    } catch {
      // non-JSON error body
    }
    throw new ApiError(message, code, res.status);
  }
  return res.json() as Promise<T>;
}

export async function fetchPools(
  opts: { sort?: "recent" | "progress" | "marketcap"; creator?: string } = {}
): Promise<PoolSummary[]> {
  const qs = new URLSearchParams({ sort: opts.sort ?? "recent" });
  if (opts.creator) qs.set("creator", opts.creator);
  return (await request<{ pools: PoolSummary[] }>(`/api/pools?${qs.toString()}`)).pools;
}

export async function fetchStats(): Promise<PlatformStats> {
  return request<PlatformStats>("/api/stats");
}

export async function fetchPool(address: string): Promise<PoolDetail> {
  return (await request<{ pool: PoolDetail }>(`/api/pools/${address}`)).pool;
}

export async function fetchActivity(address: string): Promise<ActivityResponse> {
  return request<ActivityResponse>(`/api/trades?pool=${address}`);
}
