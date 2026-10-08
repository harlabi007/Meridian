import { imageEditMessage } from "./messages";

const MAX_DIMENSION = 256;
const JPEG_QUALITY = 0.82;

/**
 * Resizes/compresses a selected image file into a small base64 data URL, entirely in the
 * browser (no upload service needed — the result is stored directly as a pool's imageUrl).
 * Capped at MAX_DIMENSION so the result stays small (typically well under 50KB), since this
 * gets stored as text in the database, not a dedicated file store.
 */
export function fileToResizedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file."));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error("That image is too large (max 8MB before compression)."));
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Couldn't process that image."));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image file."));
    };
    img.src = url;
  });
}

/**
 * Saves a pool's display image via the signed off-chain update endpoint — the same trust
 * model whether the image came from a pasted URL or an uploaded file: the creator's wallet
 * signs a message proving it's really them, and the server verifies that signature.
 */
export async function submitImageUpdate(params: {
  poolAddress: string;
  creator: string;
  imageUrl: string;
  signMessage: (msg: Uint8Array) => Promise<Uint8Array>;
}): Promise<void> {
  const timestamp = Date.now();
  const sig = await params.signMessage(
    new TextEncoder().encode(imageEditMessage(params.poolAddress, params.imageUrl, timestamp))
  );
  let bin = "";
  sig.forEach((b) => (bin += String.fromCharCode(b)));
  const res = await fetch(`/api/pools/${params.poolAddress}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      creator: params.creator,
      imageUrl: params.imageUrl,
      timestamp,
      signature: btoa(bin),
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Couldn't save the image.");
  }
}
