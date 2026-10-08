import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";
import { getDbcClient } from "./dbc";
import { getConnection } from "./solana";

/**
 * Builds the transaction to claim accrued creator trading fees for a pool.
 *
 * Uses `claimCreatorTradingFeeToReceiver` — per Meteora's docs, the "2" suffix
 * methods (`claimCreatorTradingFee2`) are for transfer-hook (Token2022) pools,
 * while standard SPL pools with an explicit receiver use the "ToReceiver"
 * variant. This app only creates standard SPL pools (see lib/dbc.ts), so
 * that's the correct method here.
 */
export async function buildClaimFeesTransaction(params: {
  poolAddress: string;
  creator: string;
  connection?: Connection;
}) {
  const connection = params.connection ?? getConnection();
  const client = getDbcClient(connection);
  const creatorPk = new PublicKey(params.creator);
  const MAX_U64 = new BN("18446744073709551615");

  return client.creator.claimCreatorTradingFeeToReceiver({
    creator: creatorPk,
    payer: creatorPk,
    pool: new PublicKey(params.poolAddress),
    maxBaseAmount: MAX_U64,
    maxQuoteAmount: MAX_U64,
    receiver: creatorPk,
  });
}

/**
 * Estimates holder count by scanning SPL token accounts for the mint with a
 * nonzero balance. This does a full getParsedProgramAccounts scan filtered
 * by mint — fine for a hackathon-scale token, but on a high-holder-count
 * mint this should move to an indexed source (e.g. Helius DAS API) instead.
 */
const holderCache = new Map<string, { at: number; count: number }>();
const HOLDER_TTL_MS = 60_000;

export async function estimateHolderCount(
  mint: string,
  connection: Connection = getConnection()
): Promise<number> {
  const hit = holderCache.get(mint);
  if (hit && Date.now() - hit.at < HOLDER_TTL_MS) return hit.count;
  const accounts = await connection.getParsedProgramAccounts(TOKEN_PROGRAM_ID, {
    filters: [
      { dataSize: 165 },
      { memcmp: { offset: 0, bytes: mint } },
    ],
  });

  let holders = 0;
  for (const acc of accounts) {
    const parsed = (acc.account.data as any)?.parsed;
    const amount = parsed?.info?.tokenAmount?.uiAmount ?? 0;
    if (amount > 0) holders++;
  }
  holderCache.set(mint, { at: Date.now(), count: holders });
  return holders;
}
