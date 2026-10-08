import type { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";

export class TxError extends Error {
  signature?: string;
  constructor(message: string, signature?: string) {
    super(message);
    this.name = "TxError";
    this.signature = signature;
  }
}

/** Maps wallet / RPC / program failures to something a person can act on. */
export function friendlyTxMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/user rejected|rejected the request|declined|cancell?ed/i.test(raw)) {
    return "You cancelled the request in your wallet.";
  }
  if (/insufficient (funds|lamports)|0x1\b|attempt to debit an account but found no record/i.test(raw)) {
    return "Not enough SOL in this wallet to cover the amount plus network fees.";
  }
  if (/blockhash not found|block height exceeded|expired/i.test(raw)) {
    return "The transaction expired before it was confirmed. Please try again.";
  }
  if (/simulation failed/i.test(raw)) {
    const line = raw.split("\n").find((l) => /Error|failed/i.test(l) && !/^Simulation failed/i.test(l));
    return `The network rejected this transaction${line ? `: ${line.trim().slice(0, 160)}` : "."}`;
  }
  return raw.length > 220 ? `${raw.slice(0, 220)}…` : raw;
}

/**
 * Signs, sends and CONFIRMS a transaction, and throws if it fails on-chain.
 * (Previously the app skipped preflight and never checked the confirmation result, so a
 * failed transaction could look like a success.)
 */
export async function sendAndConfirm(opts: {
  connection: Connection;
  transaction: Transaction;
  feePayer: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  extraSigners?: Keypair[];
}): Promise<string> {
  const { connection, transaction: tx, feePayer, signTransaction, extraSigners = [] } = opts;
  try {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    tx.feePayer = feePayer;
    tx.recentBlockhash = blockhash;
    if (extraSigners.length) tx.partialSign(...extraSigners);

    const signed = await signTransaction(tx);
    const signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 3,
    });
    const res = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
    if (res.value.err) {
      throw new TxError(`The transaction failed on-chain (${JSON.stringify(res.value.err)}).`, signature);
    }
    return signature;
  } catch (err) {
    if (err instanceof TxError) throw err;
    throw new TxError(friendlyTxMessage(err));
  }
}
