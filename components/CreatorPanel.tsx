"use client";

import { useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { buildClaimFeesTransaction } from "@/lib/creator";
import { fileToResizedDataUrl, submitImageUpdate } from "@/lib/imageUpload";
import { explorerTxUrl } from "@/lib/solana";
import { sendAndConfirm, TxError } from "@/lib/tx";

export function CreatorPanel({ poolAddress, creator, imageUrl, onImageUpdated }: { poolAddress: string; creator: string; imageUrl: string | null; onImageUpdated: (url: string) => void }) {
  const { connection } = useConnection();
  const { publicKey, signTransaction, signMessage } = useWallet();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState<{ ok: boolean; text: string; sig?: string } | null>(null);
  const [imageDraft, setImageDraft] = useState(imageUrl ?? "");
  const [savingImage, setSavingImage] = useState(false);
  const [imageMsg, setImageMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (publicKey?.toBase58() !== creator) return null;

  async function handleClaim() {
    if (!publicKey || !signTransaction) return;
    setClaiming(true);
    setClaimMsg(null);
    try {
      const tx = await buildClaimFeesTransaction({ poolAddress, creator, connection });
      const sig = await sendAndConfirm({ connection, transaction: tx, feePayer: publicKey, signTransaction });
      setClaimMsg({ ok: true, text: "Fees claimed to your wallet.", sig });
    } catch (err) {
      setClaimMsg({ ok: false, text: err instanceof TxError || err instanceof Error ? err.message : "Claim failed. There may be no fees to claim yet." });
    } finally {
      setClaiming(false);
    }
  }

  async function saveImage(url: string) {
    setImageMsg(null);
    if (!signMessage) {
      setImageMsg({ ok: false, text: "This wallet can't sign messages, so it can't authorise the change." });
      return;
    }
    setSavingImage(true);
    try {
      await submitImageUpdate({ poolAddress, creator, imageUrl: url, signMessage });
      onImageUpdated(url);
      setImageDraft(url.startsWith("data:") ? "" : url);
      setImageMsg({ ok: true, text: "Image updated." });
    } catch (err) {
      setImageMsg({ ok: false, text: err instanceof Error && /reject|cancel/i.test(err.message) ? "You cancelled the signature." : err instanceof Error ? err.message : "Couldn't save the image." });
    } finally {
      setSavingImage(false);
    }
  }

  async function handleSaveLink() {
    const url = imageDraft.trim();
    if (!/^https:\/\/\S+$/i.test(url)) {
      setImageMsg({ ok: false, text: "Use an image link that starts with https://" });
      return;
    }
    await saveImage(url);
  }

  async function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again later
    if (!file) return;
    setImageMsg(null);
    setSavingImage(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      await saveImage(dataUrl);
    } catch (err) {
      setImageMsg({ ok: false, text: err instanceof Error ? err.message : "Couldn't process that image." });
      setSavingImage(false);
    }
  }

  return (
    <div className="border border-amber/30 bg-amber/5 rounded p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-amber" />
        <span className="text-xs font-medium text-amber">Creator tools</span>
      </div>

      <button onClick={handleClaim} disabled={claiming} className="px-4 py-2 bg-amber text-white text-sm font-semibold rounded hover:bg-amberHi transition-colors disabled:opacity-50">
        {claiming ? "Claiming…" : "Claim trading fees"}
      </button>
      {claimMsg && (
        <p role="status" className={`text-xs mt-2 ${claimMsg.ok ? "text-buy" : "text-sell"}`}>
          {claimMsg.text}{" "}
          {claimMsg.sig && <a href={explorerTxUrl(claimMsg.sig)} target="_blank" rel="noreferrer" className="underline">View transaction</a>}
        </p>
      )}

      <p className="text-xs text-muted mt-4 mb-1.5">Token image</p>
      <div className="flex gap-2">
        <input value={imageDraft} onChange={(e) => setImageDraft(e.target.value)} placeholder="https://image link" aria-label="Image URL" className="input flex-1" />
        <button onClick={handleSaveLink} disabled={savingImage} className="px-3 py-2 border border-border text-sm rounded text-muted hover:text-text hover:border-borderHi transition-colors disabled:opacity-50 shrink-0">
          {savingImage ? "Saving…" : "Save link"}
        </button>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <div className="h-px bg-border flex-1" />
        <span className="text-[10px] text-faint">or</span>
        <div className="h-px bg-border flex-1" />
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFilePicked} className="hidden" />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={savingImage}
        className="w-full mt-2 py-2 border border-dashed border-border rounded text-xs text-muted hover:text-text hover:border-borderHi transition-colors disabled:opacity-50"
      >
        {savingImage ? "Uploading…" : "Upload an image from your device"}
      </button>

      {imageMsg && <p role="status" className={`text-xs mt-2 ${imageMsg.ok ? "text-buy" : "text-sell"}`}>{imageMsg.text}</p>}
      <p className="text-xs text-faint mt-2">Changing the image asks your wallet to sign a message (no fee, no transaction). It only changes how the token looks in Meridian; the on-chain token itself is immutable.</p>
    </div>
  );
}
