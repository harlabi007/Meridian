"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { fetchPools } from "@/lib/api";
import { usePrefs, useAlertLog, clearAlertLog } from "@/lib/prefs";
import { explorerAddressUrl, CLUSTER } from "@/lib/solana";
import { fmtTimeAgo, shortAddr } from "@/lib/format";
import { Icon } from "@/components/Icon";

const TABS = [
  { key: "profile", label: "Profile", icon: "user" },
  { key: "wallet", label: "Wallet", icon: "wallet" },
  { key: "history", label: "Transaction history", icon: "clock" },
  { key: "notifications", label: "Notifications", icon: "bell" },
  { key: "settings", label: "Settings", icon: "gear" },
  { key: "security", label: "Security", icon: "shield" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountInner />
    </Suspense>
  );
}

function AccountInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { publicKey } = useWallet();
  const tab = (TABS.find((t) => t.key === params.get("tab"))?.key ?? "profile") as Tab;

  if (!publicKey) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-16">
        <div className="max-w-md border border-border rounded bg-panel p-8">
          <h1 className="text-xl font-semibold tracking-tight mb-2">Account</h1>
          <p className="text-sm text-muted leading-relaxed">Connect your wallet from the header to manage your Meridian account.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Account</h1>
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
        <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible" aria-label="Account sections">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => router.replace(`/account?tab=${t.key}`, { scroll: false })}
              aria-current={tab === t.key ? "page" : undefined}
              className={`flex items-center gap-2.5 px-3 py-2 rounded text-sm whitespace-nowrap transition-colors text-left ${tab === t.key ? "bg-panel2 text-text" : "text-muted hover:text-text"}`}
            >
              <Icon name={t.icon} /> {t.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0">
          {tab === "profile" && <ProfilePanel address={publicKey.toBase58()} />}
          {tab === "wallet" && <WalletPanel address={publicKey.toBase58()} />}
          {tab === "history" && <HistoryPanel address={publicKey.toBase58()} />}
          {tab === "notifications" && <NotificationsPanel />}
          {tab === "settings" && <SettingsPanel />}
          {tab === "security" && <SecurityPanel address={publicKey.toBase58()} />}
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded bg-panel p-5 mb-5">
      <h2 className="text-sm font-medium mb-4">{title}</h2>
      {children}
    </div>
  );
}

function ProfilePanel({ address }: { address: string }) {
  const [prefs, update] = usePrefs();
  const [name, setName] = useState(prefs.displayName);
  const { data: pools } = useQuery({ queryKey: ["creator-pools", address], queryFn: () => fetchPools({ creator: address }) });

  return (
    <>
      <Card title="Display name">
        <p className="text-xs text-muted mb-3">Shown only to you, on this device. Meridian has no user accounts — everything here is tied to your wallet address.</p>
        <div className="flex gap-2 max-w-sm">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" className="input" maxLength={40} />
          <button onClick={() => update({ displayName: name.trim() })} className="px-3 py-2 bg-amber text-white text-sm font-semibold rounded hover:bg-amberHi transition-colors shrink-0">Save</button>
        </div>
      </Card>
      <Card title="Snapshot">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <Stat label="Pools launched" value={pools ? String(pools.length) : "…"} />
          <Stat label="Graduated" value={pools ? String(pools.filter((p) => p.migrated).length) : "…"} />
        </div>
        <Link href={`/creator/${address}`} className="inline-block mt-4 text-xs text-amber hover:underline">View public creator profile →</Link>
      </Card>
    </>
  );
}

function WalletPanel({ address }: { address: string }) {
  const { connection } = useConnection();
  const { wallet, disconnect } = useWallet();
  const { data: lamports } = useQuery({ queryKey: ["sol-balance-acct", address], queryFn: () => connection.getBalance((wallet as any)?.adapter?.publicKey ?? undefined).catch(() => null) });

  return (
    <Card title="Wallet">
      <div className="grid grid-cols-2 gap-3 text-xs mb-4">
        <Stat label="Connected wallet" value={wallet?.adapter.name ?? "—"} />
        <Stat label="Network" value={CLUSTER === "devnet" ? "Devnet" : "Mainnet"} />
        <Stat label="Address" value={shortAddr(address, 6)} mono />
        <Stat label="Balance" value={lamports === undefined || lamports === null ? "…" : `${(lamports / 1e9).toFixed(3)} SOL`} mono />
      </div>
      <div className="flex gap-2 flex-wrap">
        <a href={explorerAddressUrl(address)} target="_blank" rel="noreferrer" className="px-3 py-1.5 border border-border rounded text-xs text-muted hover:text-text hover:border-borderHi transition-colors">View on Solscan</a>
        <button onClick={() => disconnect()} className="px-3 py-1.5 border border-sell/40 rounded text-xs text-sell hover:bg-sell/10 transition-colors">Disconnect</button>
      </div>
    </Card>
  );
}

function HistoryPanel({ address }: { address: string }) {
  const { connection } = useConnection();
  const { data, isLoading } = useQuery({
    queryKey: ["wallet-history", address],
    queryFn: async () => {
      const { PublicKey } = await import("@solana/web3.js");
      const sigs = await connection.getSignaturesForAddress(new PublicKey(address), { limit: 20 });
      return sigs;
    },
  });

  return (
    <Card title="Recent transactions">
      {isLoading && <div className="h-24 bg-panel2 border border-border rounded animate-pulse" />}
      {data && data.length === 0 && <p className="text-sm text-muted">No transactions found for this wallet yet.</p>}
      {data && data.length > 0 && (
        <div className="border border-border rounded overflow-x-auto">
          <div className="grid grid-cols-3 text-xs text-muted px-3 py-2 bg-panel2 border-b border-border min-w-[420px]">
            <span>Signature</span><span>Status</span><span className="text-right">Time</span>
          </div>
          {data.map((s) => (
            <a key={s.signature} href={`https://solscan.io/tx/${s.signature}${CLUSTER === "devnet" ? "?cluster=devnet" : ""}`} target="_blank" rel="noreferrer" className="grid grid-cols-3 text-xs px-3 py-2 border-b border-border last:border-0 font-mono hover:bg-panel2 transition-colors min-w-[420px]">
              <span className="truncate">{s.signature.slice(0, 20)}…</span>
              <span className={s.err ? "text-sell" : "text-buy"}>{s.err ? "Failed" : "Success"}</span>
              <span className="text-right text-faint">{s.blockTime ? fmtTimeAgo(new Date(s.blockTime * 1000).toISOString()) : "—"}</span>
            </a>
          ))}
        </div>
      )}
    </Card>
  );
}

function NotificationsPanel() {
  const [prefs, update] = usePrefs();
  const log = useAlertLog();
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  useEffect(() => setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission), []);

  const Toggle = ({ k, label }: { k: keyof typeof prefs.alerts; label: string }) => (
    <label className="flex items-center justify-between py-2 text-sm">
      <span className="text-muted">{label}</span>
      <input type="checkbox" checked={prefs.alerts[k]} onChange={(e) => update({ alerts: { ...prefs.alerts, [k]: e.target.checked } })} className="w-4 h-4 accent-[var(--color-accent)]" />
    </label>
  );

  return (
    <>
      <Card title="Graduation alerts">
        <Toggle k="p80" label="Notify at 80% to migration" />
        <Toggle k="p95" label="Notify at 95% to migration" />
        <Toggle k="graduated" label="Notify when a pool graduates" />
        <p className="text-xs text-faint mt-3">Applies to pools on your watchlist. Alerts run while Meridian is open in a tab.</p>
        {perm !== "granted" && perm !== "unsupported" && (
          <button onClick={async () => setPerm(await Notification.requestPermission())} className="mt-3 px-3 py-1.5 bg-amber text-white text-xs font-semibold rounded hover:bg-amberHi transition-colors">Enable browser notifications</button>
        )}
      </Card>
      <Card title="Alert history">
        {log.length === 0 ? (
          <p className="text-sm text-muted">No alerts yet.</p>
        ) : (
          <>
            <ul className="space-y-2 mb-3">
              {log.slice(0, 10).map((e) => (
                <li key={e.id + e.at}>
                  <Link href={e.href} className="text-xs block hover:bg-panel2 -mx-2 px-2 py-1.5 rounded transition-colors">
                    <span className="text-text">{e.title}</span> <span className="text-faint">· {fmtTimeAgo(new Date(e.at).toISOString())}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <button onClick={clearAlertLog} className="text-xs text-muted hover:text-text underline decoration-dotted">Clear history</button>
          </>
        )}
      </Card>
    </>
  );
}

function SettingsPanel() {
  const [prefs, update] = usePrefs();
  return (
    <Card title="Trading">
      <label className="block max-w-xs">
        <span className="block text-xs text-muted mb-1.5">Max slippage: {(prefs.slippageBps / 100).toFixed(1)}%</span>
        <input type="range" min="10" max="500" step="10" value={prefs.slippageBps} onChange={(e) => update({ slippageBps: Number(e.target.value) })} className="w-full accent-[var(--color-accent)]" />
      </label>
      <p className="text-xs text-faint mt-2 max-w-xs">Applied to every swap you make on Meridian. Higher slippage means your trade is less likely to fail, but you may receive a worse price.</p>
    </Card>
  );
}

function SecurityPanel({ address }: { address: string }) {
  return (
    <Card title="Security">
      <ul className="space-y-3 text-sm text-muted">
        <li className="flex gap-2"><Icon name="shield" /><span>Meridian never asks for your seed phrase or private key. Every action opens your wallet extension for approval.</span></li>
        <li className="flex gap-2"><Icon name="shield" /><span>Preferences and your watchlist are stored only in this browser, never on a server tied to your identity.</span></li>
        <li className="flex gap-2"><Icon name="shield" /><span>Creator edits (like changing a pool&apos;s image) require signing a message with your wallet — Meridian can&apos;t make that change without your approval.</span></li>
      </ul>
      <p className="text-xs text-faint mt-4 font-mono break-all">Connected address: {address}</p>
    </Card>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border border-border rounded bg-panel2 px-3 py-2">
      <p className="text-muted mb-0.5">{label}</p>
      <p className={mono ? "font-mono text-sm" : "text-sm"}>{value}</p>
    </div>
  );
}
