"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Icon } from "./Icon";
import { buildReferralLink } from "@/lib/referral";

export function ReferralLinkButton({ poolAddress }: { poolAddress: string }) {
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleClick() {
    if (!publicKey) {
      setVisible(true);
      return;
    }
    setOpen((o) => !o);
  }

  const link = publicKey ? buildReferralLink(poolAddress, publicKey.toBase58()) : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked
    }
  }

  return (
    <div className="relative">
      <button onClick={handleClick} className="px-3 py-1.5 text-xs border border-border rounded text-muted hover:text-text hover:border-borderHi transition-colors">
        Refer &amp; earn
      </button>
      {open && publicKey && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 mt-2 w-80 border border-border bg-panel rounded-lg shadow-elevated p-4 text-xs z-40">
            <p className="text-sm font-medium mb-1">Earn a share of trading fees</p>
            <p className="text-muted leading-relaxed mb-3">Share this link. Anyone who trades this token through it routes a small referral fee to your wallet automatically — no extra step for them.</p>
            <div className="border border-border rounded bg-panel2 p-2 flex items-start gap-2">
              <code className="font-mono text-[10px] text-muted break-all flex-1 leading-relaxed">{link}</code>
              <button onClick={copy} aria-label="Copy referral link" className="text-faint hover:text-text shrink-0"><Icon name="copy" size={14} /></button>
            </div>
            {copied && <p className="text-buy mt-1">Copied.</p>}
            <p className="text-[10px] text-faint mt-3">Beta: referral fees use Meteora&apos;s built-in DBC mechanism. If a trader&apos;s wallet can&apos;t support it for any reason, their trade still goes through as normal — you just won&apos;t earn on that one.</p>
          </div>
        </>
      )}
    </div>
  );
}
