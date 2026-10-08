"use client";

import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, NATIVE_MINT } from "@solana/spl-token";
import { buildSwapQuote, buildSwapTransaction } from "@/lib/dbc";
import { attachReferral, getReferrerFromUrl } from "@/lib/referral";
import { sendAndConfirm, TxError } from "@/lib/tx";
import { explorerTxUrl } from "@/lib/solana";
import { usePrefs } from "@/lib/prefs";
import { fmtCompact } from "@/lib/format";

type Side = "buy" | "sell";
type Status = "idle" | "quoting" | "signing" | "done" | "error";

export function SwapWidget({ poolAddress, symbol, migrated, baseMint }: { poolAddress: string; symbol: string; migrated: boolean; baseMint?: string }) {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const [prefs] = usePrefs();
  const [side, setSide] = useState<Side>("buy");
  const [amount, setAmount] = useState("0.1");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [expected, setExpected] = useState<string | null>(null);

  const amt = Number(amount);
  const validAmount = Number.isFinite(amt) && amt > 0;

  // Live quote as the amount or side changes
  useEffect(() => {
    setExpected(null);
    if (migrated || !validAmount) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const referralTokenAccount = await resolveReferralAccount(connection);
        const q = await buildSwapQuote({ poolAddress, amountIn: amt, swapBaseForQuote: side === "sell", slippageBps: prefs.slippageBps, referralTokenAccount, connection });
        if (!cancelled) setExpected(fmtCompact(Number(q.expectedOut.toString()) / 10 ** q.outDecimals));
      } catch {
        if (!cancelled) setExpected(null);
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [amt, validAmount, side, poolAddress, prefs.slippageBps, connection, migrated]);

  /** Best-effort referral resolution: any failure here means "no referral," never a blocked trade. */
  async function resolveReferralAccount(conn: typeof connection): Promise<PublicKey | null> {
    try {
      const referrer = getReferrerFromUrl();
      if (!referrer) return null;
      return await getAssociatedTokenAddress(NATIVE_MINT, new PublicKey(referrer));
    } catch {
      return null;
    }
  }

  async function handleSwap() {
    setError(null);
    setReceipt(null);
    if (!publicKey || !signTransaction) {
      setVisible(true);
      return;
    }
    if (!validAmount) {
      setError("Enter an amount greater than zero.");
      return;
    }
    try {
      setStatus("quoting");
      const referralTokenAccount = await resolveReferralAccount(connection);
      const q = await buildSwapQuote({ poolAddress, amountIn: amt, swapBaseForQuote: side === "sell", slippageBps: prefs.slippageBps, referralTokenAccount, connection });
      const tx = await buildSwapTransaction({
        poolAddress,
        owner: publicKey.toBase58(),
        amountIn: q.amountIn,
        minimumAmountOut: q.minimumOut,
        swapBaseForQuote: side === "sell",
        referralTokenAccount,
        connection,
      });

      // Attach the referral's fee account (creating it if needed). Any failure here is
      // swallowed on purpose: a referral hiccup should never stop the trader's swap.
      if (referralTokenAccount) {
        try {
          const referrer = getReferrerFromUrl();
          if (referrer) {
            tx.feePayer = publicKey;
            await attachReferral(tx, new PublicKey(referrer), connection);
          }
        } catch (refErr) {
          console.warn("[referral] couldn't attach, continuing without it:", refErr);
        }
      }

      setStatus("signing");
      const sig = await sendAndConfirm({ connection, transaction: tx, feePayer: publicKey, signTransaction });
      setReceipt(sig);
      setStatus("done");
    } catch (err) {
      console.error(err);
      setError(err instanceof TxError || err instanceof Error ? err.message : "Swap failed.");
      setStatus("error");
    }
  }

  if (migrated) {
    return (
      <div className="border border-border rounded-lg bg-panel p-4">
        <p className="text-sm font-medium mb-1">This pool has graduated</p>
        <p className="text-sm text-muted leading-relaxed mb-4">{`Trading has moved from the bonding curve to a DEX pool, so swaps aren't available here anymore — but you can keep trading $${symbol} on Jupiter.`}</p>
        {baseMint ? (
          <a
            href={`https://jup.ag/swap/SOL-${baseMint}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center w-full py-2.5 bg-amber text-white text-sm font-semibold rounded hover:bg-amberHi transition-colors"
          >
            {`Trade $${symbol} on Jupiter`}
          </a>
        ) : (
          <a
            href="https://jup.ag"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center w-full py-2.5 border border-border text-sm rounded text-muted hover:text-text hover:border-borderHi transition-colors"
          >
            Open Jupiter
          </a>
        )}
      </div>
    );
  }

  const busy = status === "quoting" || status === "signing";
  return (
    <div className="border border-border rounded bg-panel p-4">
      <div className="flex gap-1 mb-4" role="tablist" aria-label="Trade side">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={side === s}
            onClick={() => { setSide(s); setError(null); setReceipt(null); }}
            className={`flex-1 py-1.5 text-sm rounded font-medium transition-colors border ${
              side === s ? (s === "buy" ? "bg-buy/15 text-buy border-buy/40" : "bg-sell/15 text-sell border-sell/40") : "text-muted border-border hover:text-text"
            }`}
          >
            {s === "buy" ? "Buy" : "Sell"}
          </button>
        ))}
      </div>

      <label className="block mb-1.5 text-xs text-muted" htmlFor="swap-amount">
        {side === "buy" ? "You pay (SOL)" : `You sell (${symbol})`}
      </label>
      <input id="swap-amount" value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="any" inputMode="decimal" className={`input font-mono mb-3 ${amount !== "" && !validAmount ? "border-sell" : ""}`} />

      <div className="flex justify-between text-xs mb-1 px-0.5">
        <span className="text-faint">You receive (est.)</span>
        <span className="font-mono text-muted">{expected ? `${expected} ${side === "buy" ? symbol : "SOL"}` : "—"}</span>
      </div>
      <div className="flex justify-between text-xs mb-4 px-0.5">
        <span className="text-faint">Max slippage</span>
        <span className="font-mono text-muted">{(prefs.slippageBps / 100).toFixed(1)}%</span>
      </div>

      {error && <div role="alert" className="mb-3 px-3 py-2 border border-sell/40 bg-sell/10 text-sell text-xs rounded">{error}</div>}
      {receipt && (
        <div role="status" className="mb-3 px-3 py-2 border border-buy/40 bg-buy/10 text-buy text-xs rounded">
          Swap confirmed.{" "}
          <a href={explorerTxUrl(receipt)} target="_blank" rel="noreferrer" className="underline">View transaction</a>
        </div>
      )}

      <button
        onClick={handleSwap}
        disabled={busy}
        className={`w-full py-2.5 text-sm font-semibold rounded transition-colors disabled:opacity-50 text-white ${side === "buy" ? "bg-buy hover:brightness-110" : "bg-sell hover:brightness-110"}`}
      >
        {!publicKey ? "Connect wallet" : busy ? (status === "quoting" ? "Preparing…" : "Approve in wallet, then confirming…") : side === "buy" ? `Buy ${symbol}` : `Sell ${symbol}`}
      </button>
    </div>
  );
}
