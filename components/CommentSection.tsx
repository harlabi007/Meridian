"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { commentMessage } from "@/lib/messages";
import { fmtTimeAgo, shortAddr } from "@/lib/format";

interface CommentRow {
  id: string;
  author: string;
  body: string;
  createdAt: string;
}

async function fetchComments(address: string): Promise<CommentRow[]> {
  const res = await fetch(`/api/pools/${address}/comments`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load comments");
  return (await res.json()).comments;
}

export function CommentSection({ poolAddress }: { poolAddress: string }) {
  const { publicKey, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: comments, isLoading, isError } = useQuery({
    queryKey: ["comments", poolAddress],
    queryFn: () => fetchComments(poolAddress),
    refetchInterval: 20_000,
  });

  async function submit() {
    setError(null);
    const body = draft.trim();
    if (!body) return;
    if (!publicKey || !signMessage) {
      setVisible(true);
      return;
    }
    setPosting(true);
    try {
      const author = publicKey.toBase58();
      const timestamp = Date.now();
      const sig = await signMessage(new TextEncoder().encode(commentMessage(poolAddress, body, timestamp)));
      let bin = "";
      sig.forEach((b) => (bin += String.fromCharCode(b)));
      const res = await fetch(`/api/pools/${poolAddress}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, body, timestamp, signature: btoa(bin) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error?.message ?? "Couldn't post your comment.");
      }
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["comments", poolAddress] });
    } catch (err) {
      setError(err instanceof Error && /reject|cancel/i.test(err.message) ? "You cancelled the signature." : err instanceof Error ? err.message : "Couldn't post your comment.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="border border-border rounded-lg bg-panel p-4">
      <h2 className="text-sm font-medium mb-3">Discussion</h2>

      <div className="flex gap-2 mb-4">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !posting && submit()}
          placeholder={publicKey ? "Share your take…" : "Connect your wallet to comment"}
          maxLength={500}
          className="input flex-1"
        />
        <button
          onClick={submit}
          disabled={posting || !draft.trim()}
          className="px-4 py-2 bg-amber text-white text-sm font-semibold rounded hover:bg-amberHi transition-colors disabled:opacity-50 shrink-0"
        >
          {posting ? "Signing…" : "Post"}
        </button>
      </div>
      {error && <p className="text-xs text-sell mb-3">{error}</p>}
      <p className="text-[11px] text-faint mb-4">Posting asks your wallet to sign a message (no fee, no transaction) so comments can&apos;t be spoofed as someone else&apos;s wallet.</p>

      {isLoading && <div className="h-16 bg-panel2 rounded animate-pulse" />}
      {isError && <p className="text-sm text-muted">Couldn&apos;t load the discussion.</p>}
      {comments && comments.length === 0 && <p className="text-sm text-faint">No comments yet — be the first to say something.</p>}
      {comments && comments.length > 0 && (
        <ul className="space-y-3 max-h-80 overflow-y-auto">
          {comments.map((c) => (
            <li key={c.id} className="text-sm">
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="font-mono text-xs text-muted">{shortAddr(c.author, 4)}</span>
                <span className="text-[11px] text-faint">{fmtTimeAgo(c.createdAt)}</span>
              </div>
              <p className="text-text leading-relaxed break-words">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
