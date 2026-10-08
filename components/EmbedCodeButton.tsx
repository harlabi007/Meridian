"use client";

import { useState } from "react";
import { Icon } from "./Icon";

export function EmbedCodeButton({ poolAddress }: { poolAddress: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const src = `${origin}/embed/${poolAddress}`;
  const snippet = `<iframe src="${src}" width="320" height="220" style="border:none;border-radius:8px;overflow:hidden" title="Meridian pool widget"></iframe>`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="px-3 py-1.5 text-xs border border-border rounded text-muted hover:text-text hover:border-borderHi transition-colors"
      >
        Embed
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 mt-2 w-80 border border-border bg-panel rounded-lg shadow-elevated p-4 text-xs z-40">
            <p className="text-sm font-medium mb-1">Embed this token</p>
            <p className="text-muted leading-relaxed mb-3">Paste this on any site to show live price and progress, with a link back here to trade.</p>
            <div className="border border-border rounded bg-panel2 p-2 mb-2 flex items-start gap-2">
              <code className="font-mono text-[10px] text-muted break-all flex-1 leading-relaxed">{snippet}</code>
              <button onClick={copy} aria-label="Copy embed code" className="text-faint hover:text-text shrink-0">
                <Icon name="copy" size={14} />
              </button>
            </div>
            {copied && <p className="text-buy">Copied.</p>}
            <p className="text-[10px] text-faint mt-3 mb-1.5">Live preview — its button opens the real page in a new tab, same as it will on another site.</p>
            <div className="border border-border rounded overflow-hidden" style={{ width: 220, height: 180 }}>
              <iframe src={src} width={220} height={180} style={{ border: "none" }} title="Preview" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
