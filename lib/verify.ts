import { createPublicKey, verify } from "crypto";
import { PublicKey } from "@solana/web3.js";

const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/** Verifies a Solana wallet's ed25519 signature over a message, server-side. */
export function verifyWalletSignature(publicKey: PublicKey, message: string, signatureB64: string): boolean {
  try {
    const key = createPublicKey({
      key: Buffer.concat([SPKI_ED25519_PREFIX, Buffer.from(publicKey.toBytes())]),
      format: "der",
      type: "spki",
    });
    return verify(null, Buffer.from(message), key, Buffer.from(signatureB64, "base64"));
  } catch {
    return false;
  }
}
