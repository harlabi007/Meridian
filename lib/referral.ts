import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  NATIVE_MINT,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

const REF_PARAM = "ref";

export function getReferrerFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get(REF_PARAM);
  if (!v) return null;
  try {
    new PublicKey(v); // validate
    return v;
  } catch {
    return null;
  }
}

export function buildReferralLink(poolAddress: string, referrer: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/pool/${poolAddress}?${REF_PARAM}=${referrer}`;
}

/**
 * Fee collection is set to QuoteToken (see lib/dbc.ts), so the referral fee is paid in
 * wrapped SOL. This derives the referrer's wSOL associated token account and, if it doesn't
 * exist yet, prepends a create-idempotent instruction to `tx` so the swap doesn't fail.
 *
 * BETA: this hasn't been exercised on a live devnet swap. It's written defensively — if
 * anything here throws, callers should catch it and fall back to a swap with no referral
 * rather than blocking the trade. See SwapWidget for that fallback.
 */
export async function attachReferral(
  tx: Transaction,
  referrer: PublicKey,
  connection: Connection
): Promise<PublicKey> {
  const ata = await getAssociatedTokenAddress(NATIVE_MINT, referrer);
  const info = await connection.getAccountInfo(ata);
  if (!info) {
    // payer is whoever will sign/pay for this tx — the trader, set as feePayer before this runs
    const payer = tx.feePayer;
    if (!payer) throw new Error("Set feePayer before attaching a referral.");
    tx.instructions.unshift(createAssociatedTokenAccountIdempotentInstruction(payer, ata, referrer, NATIVE_MINT));
  }
  return ata;
}
