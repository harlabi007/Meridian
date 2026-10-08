import { Connection, clusterApiUrl } from "@solana/web3.js";

export const CLUSTER = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet") as
  | "devnet"
  | "mainnet-beta";

export const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_RPC_ENDPOINT ?? clusterApiUrl(CLUSTER);

// Meteora DBC program is deployed at the same address on both mainnet-beta and devnet.
export const DBC_PROGRAM_ID = "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN";

// Native SOL mint — the default quote token for pools created in this app.
export const NATIVE_SOL_MINT = "So11111111111111111111111111111111111111112";

let _connection: Connection | null = null;

export function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(RPC_ENDPOINT, "confirmed");
  }
  return _connection;
}

export function explorerTxUrl(signature: string): string {
  const suffix = CLUSTER === "devnet" ? "?cluster=devnet" : "";
  return `https://solscan.io/tx/${signature}${suffix}`;
}

export function explorerAddressUrl(address: string): string {
  const suffix = CLUSTER === "devnet" ? "?cluster=devnet" : "";
  return `https://solscan.io/account/${address}${suffix}`;
}
