import { Connection, PublicKey } from "@solana/web3.js";
import { BorshCoder, EventParser } from "@coral-xyz/anchor";
import * as dbcSdk from "@meteora-ag/dynamic-bonding-curve-sdk";
import { DBC_PROGRAM_ID } from "./solana";
import type { TradeEvent } from "./types";

let parser: EventParser | null | undefined;

function getParser(): EventParser | null {
  if (parser !== undefined) return parser;
  // The SDK bundles the program's Anchor IDL; reading it off the namespace keeps this
  // working (and degrades gracefully) whichever SDK version is installed.
  const idl = (dbcSdk as any).DynamicBondingCurveIdl;
  if (!idl) {
    console.warn("[events] DynamicBondingCurveIdl not exported by the installed SDK; trade feed falls back to snapshots.");
    parser = null;
  } else {
    parser = new EventParser(new PublicKey(DBC_PROGRAM_ID), new BorshCoder(idl));
  }
  return parser;
}

const cache = new Map<string, { at: number; trades: TradeEvent[] }>();
const TTL_MS = 15_000;

/**
 * Decodes real swap events for a pool from transaction logs. Transactions are fetched in
 * batches (not one by one) and results are cached briefly so polling doesn't hammer the RPC.
 */
export async function fetchPoolTrades(
  poolAddress: string,
  connection: Connection,
  limit = 20
): Promise<TradeEvent[]> {
  const hit = cache.get(poolAddress);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.trades;

  const p = getParser();
  if (!p) return [];

  const sigInfos = (await connection.getSignaturesForAddress(new PublicKey(poolAddress), { limit })).filter(
    (s) => !s.err
  );
  const trades: TradeEvent[] = [];

  for (let i = 0; i < sigInfos.length; i += 10) {
    const chunk = sigInfos.slice(i, i + 10);
    const txs = await connection.getTransactions(
      chunk.map((s) => s.signature),
      { maxSupportedTransactionVersion: 0, commitment: "confirmed" }
    );
    txs.forEach((tx, idx) => {
      const info = chunk[idx]!;
      const logs = tx?.meta?.logMessages;
      if (!tx || !logs) return;
      const msg: any = tx.transaction.message;
      const trader: string = (msg.staticAccountKeys ?? msg.accountKeys)?.[0]?.toBase58?.() ?? "unknown";

      for (const evt of p.parseLogs(logs)) {
        if (evt.name !== "EvtSwap" && evt.name !== "evtSwap") continue;
        const data = evt.data as Record<string, any>;
        const eventPool = data.pool?.toBase58?.();
        if (eventPool && eventPool !== poolAddress) continue;

        const side: TradeEvent["side"] = Number(data.tradeDirection) === 1 ? "sell" : "buy";
        const rawIn = Number(data.amountIn?.toString?.() ?? data.params?.amountIn?.toString?.() ?? 0);
        const rawOut = Number(
          data.swapResult?.outputAmount?.toString?.() ?? data.swapResult?.amountOut?.toString?.() ?? 0
        );
        // buy: SOL in (9 dec) -> token out (6 dec); sell: token in (6 dec) -> SOL out (9 dec)
        const quoteAmount = side === "buy" ? rawIn / 1e9 : rawOut / 1e9;
        const baseAmount = side === "buy" ? rawOut / 1e6 : rawIn / 1e6;

        trades.push({
          id: `${info.signature}:${trades.length}`,
          poolAddress,
          signature: info.signature,
          side,
          trader,
          baseAmount,
          quoteAmount,
          priceQuote: baseAmount > 0 ? quoteAmount / baseAmount : 0,
          timestamp: info.blockTime ? new Date(info.blockTime * 1000).toISOString() : new Date().toISOString(),
        });
      }
    });
  }

  cache.set(poolAddress, { at: Date.now(), trades });
  return trades;
}
