"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "./Icon";
import { useWatchlist } from "@/lib/watchlist";
import { usePrefs } from "@/lib/prefs";
import { CLUSTER, explorerAddressUrl } from "@/lib/solana";
import { fmtQuote, shortAddr } from "@/lib/format";

/** Deterministic two-colour avatar so each wallet looks distinct without any image. */
function addressGradient(addr: string) {
  let h = 0;
  for (let i = 0; i < addr.length; i++) h = (h * 31 + addr.charCodeAt(i)) >>> 0;
  return `linear-gradient(135deg, hsl(${h % 360} 70% 55%), hsl(${(h >> 8) % 360} 70% 40%))`;
}

export function WalletButton() {
  const { publicKey, wallet, connected, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const [open, setOpen] = useState(false);

  if (!connected || !publicKey) {
    return (
      <button
        onClick={() => setVisible(true)}
        disabled={connecting}
        className="h-[34px] px-4 rounded bg-amber text-white text-[13px] font-semibold hover:bg-amberHi transition-colors disabled:opacity-60"
      >
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  const addr = publicKey.toBase58();
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="h-[34px] pl-1.5 pr-3 rounded border border-border bg-panel hover:border-borderHi transition-colors flex items-center gap-2 text-[13px]"
      >
        {wallet?.adapter.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={wallet.adapter.icon} alt="" className="w-5 h-5 rounded-sm" />
        ) : (
          <span className="w-5 h-5 rounded-full" style={{ background: addressGradient(addr) }} />
        )}
        <span className="font-mono">{shortAddr(addr, 4)}</span>
      </button>
      {open && <AccountDrawer address={addr} onClose={() => setOpen(false)} />}
    </>
  );
}

function AccountDrawer({ address, onClose }: { address: string; onClose: () => void }) {
  const { connection } = useConnection();
  const { publicKey, wallet, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const { list: watchlist } = useWatchlist();
  const [prefs] = usePrefs();
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: lamports } = useQuery({
    queryKey: ["sol-balance", address],
    enabled: Boolean(publicKey),
    refetchInterval: 20_000,
    queryFn: () => connection.getBalance(publicKey!),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked
    }
  }

  const items: { href: string; label: string; icon: string; hint?: string }[] = [
    { href: "/account?tab=profile", label: "Profile", icon: "user" },
    { href: "/portfolio", label: "Portfolio", icon: "briefcase" },
    { href: "/account?tab=wallet", label: "Wallet", icon: "wallet" },
    { href: "/account?tab=history", label: "Transaction history", icon: "clock" },
    { href: "/account?tab=notifications", label: "Notifications", icon: "bell" },
    { href: "/account?tab=settings", label: "Settings", icon: "gear" },
    { href: "/account?tab=security", label: "Security", icon: "shield" },
  ];
  const quick: { href: string; label: string; icon: string; hint?: string }[] = [
    { href: `/creator/${address}`, label: "My launches", icon: "rocket" },
    { href: "/portfolio#watchlist", label: "Watchlist", icon: "star", hint: watchlist.length ? String(watchlist.length) : undefined },
  ];

  const row = "flex items-center gap-3 px-3 py-2.5 rounded text-sm text-muted hover:text-text hover:bg-panel2 transition-colors";

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Account">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="drawer-in absolute right-0 top-0 h-full w-[340px] max-w-[92vw] bg-panel border-l border-border flex flex-col outline-none"
      >
        <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
          <span className="text-sm font-medium">Account</span>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-text p-1">
            <Icon name="close" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-11 h-11 rounded-full shrink-0" style={{ background: addressGradient(address) }} />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{prefs.displayName || "Your wallet"}</p>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className="font-mono">{shortAddr(address, 5)}</span>
                  <button onClick={copy} className="hover:text-text inline-flex items-center gap-1" aria-label="Copy address">
                    <Icon name="copy" size={12} />
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="border border-border rounded bg-panel2 px-3 py-2">
                <p className="text-muted mb-0.5">Balance</p>
                <p className="font-mono text-sm">{lamports === undefined ? "…" : fmtQuote(lamports / 1e9)}</p>
              </div>
              <div className="border border-border rounded bg-panel2 px-3 py-2">
                <p className="text-muted mb-0.5">Network</p>
                <p className="font-mono text-sm capitalize">{CLUSTER === "devnet" ? "Devnet" : "Mainnet"}</p>
              </div>
            </div>
            <p className="text-[11px] text-faint mt-3">Connected with {wallet?.adapter.name ?? "wallet"}</p>
          </div>

          <nav className="p-2" aria-label="Account menu">
            {items.map((it) => (
              <Link key={it.label} href={it.href} onClick={onClose} className={row}>
                <Icon name={it.icon} />
                <span className="flex-1">{it.label}</span>
              </Link>
            ))}
            <div className="h-px bg-border my-2 mx-3" />
            {quick.map((it) => (
              <Link key={it.label} href={it.href} onClick={onClose} className={row}>
                <Icon name={it.icon} />
                <span className="flex-1">{it.label}</span>
                {it.hint && <span className="text-xs font-mono text-faint">{it.hint}</span>}
              </Link>
            ))}
            <a href={explorerAddressUrl(address)} target="_blank" rel="noreferrer" className={row}>
              <Icon name="external" />
              <span className="flex-1">View on Solscan</span>
            </a>
          </nav>
        </div>

        <div className="p-3 border-t border-border space-y-2 shrink-0">
          <button
            onClick={() => {
              onClose();
              setVisible(true);
            }}
            className="w-full flex items-center justify-center gap-2 py-2 border border-border rounded text-sm text-muted hover:text-text hover:border-borderHi transition-colors"
          >
            <Icon name="swap" />
            Switch wallet
          </button>
          <button
            onClick={async () => {
              onClose();
              await disconnect();
            }}
            className="w-full flex items-center justify-center gap-2 py-2 border border-sell/40 rounded text-sm text-sell hover:bg-sell/10 transition-colors"
          >
            <Icon name="logout" />
            Disconnect wallet
          </button>
        </div>
      </div>
    </div>
  );
}
