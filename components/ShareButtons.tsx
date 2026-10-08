"use client";

import { useState } from "react";

export function ShareButtons({ name, symbol }: { name: string; symbol: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context / permissions) — fail quietly
    }
  }

  function shareOnX() {
    const text = `${name} ($${symbol}) is live on a bonding curve via Meridian`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(
      window.location.href
    )}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const btn =
    "px-3 py-1.5 text-xs border border-border rounded text-muted hover:text-text hover:border-borderHi transition-colors";

  return (
    <div className="flex items-center gap-2">
      <button onClick={copyLink} className={btn}>
        {copied ? "Link copied" : "Copy link"}
      </button>
      <button onClick={shareOnX} className={btn}>
        Share on X
      </button>
    </div>
  );
}
