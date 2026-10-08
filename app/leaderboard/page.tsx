"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchPools } from "@/lib/api";
import { ErrorPanel, EmptyPanel, Skeleton } from "@/components/DataState";
import { TokenAvatar } from "@/components/TokenAvatar";
import { fmtPct, fmtQuote, shortAddr } from "@/lib/format";
import { PriceDelta } from "@/components/PriceDelta";
import type { PoolSummary } from "@/lib/types";

type Tab = "volume" | "closest" | "graduated" | "creators";
const TABS: { key: Tab; label: string; blurb: string }[] = [
  { key: "volume", label: "Top volume", blurb: "Most 24h trading volume right now." },
  { key: "closest", label: "Closest to graduating", blurb: "Pools nearest their migration goal." },
  { key: "graduated", label: "Graduated", blurb: "Pools that completed their curve and migrated." },
  { key: "creators", label: "Top creators", blurb: "Launchers ranked by combined market cap." },
];
interface CreatorRow { creator: string; launches: number; graduated: number; mcap: number; }

export default function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>("volume");
  const { data: pools, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => fetchPools({ sort: "marketcap" }),
    refetchInterval: 20_000,
  });

  const poolRows: PoolSummary[] = useMemo(() => {
    if (!pools) return [];
    if (tab === "volume") return pools.filter((p) => p.volume24hQuote > 0).sort((a, b) => b.volume24hQuote - a.volume24hQuote).slice(0, 25);
    if (tab === "closest") return pools.filter((p) => !p.migrated).sort((a, b) => b.progressPct - a.progressPct).slice(0, 25);
    if (tab === "graduated") return pools.filter((p) => p.migrated).sort((a, b) => b.marketCapQuote - a.marketCapQuote).slice(0, 25);
    return [];
  }, [pools, tab]);

  const creatorRows: CreatorRow[] = useMemo(() => {
    if (!pools) return [];
    const map = new Map<string, CreatorRow>();
    for (const p of pools) {
      const row = map.get(p.creator) ?? { creator: p.creator, launches: 0, graduated: 0, mcap: 0 };
      row.launches += 1; row.graduated += p.migrated ? 1 : 0; row.mcap += p.marketCapQuote;
      map.set(p.creator, row);
    }
    return [...map.values()].sort((a, b) => b.mcap - a.mcap).slice(0, 25);
  }, [pools]);

  const active = TABS.find((t) => t.key === tab)!;
  const rowsEmpty = tab === "creators" ? creatorRows.length === 0 : poolRows.length === 0;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight mb-2">Leaderboard</h1>
        <p className="text-muted text-sm">{active.blurb}</p>
      </div>

      <div className="flex gap-1 mb-5 flex-wrap text-xs">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-1.5 rounded border transition-colors ${tab === t.key ? "border-amber text-amber" : "border-border text-muted hover:text-text"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && <Skeleton className="h-64" />}
      {isError && <ErrorPanel error={error} onRetry={() => refetch()} title="Couldn't load the leaderboard" />}
      {pools && rowsEmpty && <EmptyPanel title="Nothing here yet" body={tab === "graduated" ? "No pools have graduated yet." : "Rankings appear as pools launch and trade."} />}

      {pools && !rowsEmpty && tab !== "creators" && (
        <div className="border border-border rounded overflow-x-auto">
          <div className="grid grid-cols-[40px_1.6fr_1fr_0.8fr_1fr_1fr] text-xs text-muted px-3 py-2 bg-panel2 border-b border-border min-w-[680px]">
            <span>#</span><span>Token</span><span>Market cap</span><span>24h</span><span>24h volume</span><span className="text-right">To graduation</span>
          </div>
          {poolRows.map((p, i) => (
            <Link key={p.address} href={`/pool/${p.address}`} className="grid grid-cols-[40px_1.6fr_1fr_0.8fr_1fr_1fr] items-center text-xs px-3 py-3 border-b border-border last:border-0 hover:bg-panel2 transition-colors min-w-[680px]">
              <span className="font-mono text-faint">{i + 1}</span>
              <span className="min-w-0 flex items-center gap-2">
                <TokenAvatar symbol={p.symbol} imageUrl={p.imageUrl} size={22} />
                <span className="truncate"><span className="text-sm font-medium">{p.name}</span>{" "}<span className="font-mono text-muted">${p.symbol}</span></span>
              </span>
              <span className="font-mono">{fmtQuote(p.marketCapQuote)}</span>
              <PriceDelta pct={p.priceChangePct24h} />
              <span className="font-mono">{fmtQuote(p.volume24hQuote)}</span>
              <span className="font-mono text-right">{p.migrated ? "Graduated" : fmtPct(p.progressPct)}</span>
            </Link>
          ))}
        </div>
      )}

      {pools && !rowsEmpty && tab === "creators" && (
        <div className="border border-border rounded overflow-x-auto">
          <div className="grid grid-cols-[40px_1.6fr_1fr_1fr_1fr] text-xs text-muted px-3 py-2 bg-panel2 border-b border-border min-w-[620px]">
            <span>#</span><span>Creator</span><span>Launches</span><span>Graduated</span><span className="text-right">Combined market cap</span>
          </div>
          {creatorRows.map((c, i) => (
            <Link key={c.creator} href={`/creator/${c.creator}`} className="grid grid-cols-[40px_1.6fr_1fr_1fr_1fr] items-center text-xs px-3 py-3 border-b border-border last:border-0 hover:bg-panel2 transition-colors min-w-[620px]">
              <span className="font-mono text-faint">{i + 1}</span>
              <span className="font-mono">{shortAddr(c.creator, 6)}</span>
              <span className="font-mono">{c.launches}</span>
              <span className="font-mono">{c.graduated}</span>
              <span className="font-mono text-right">{fmtQuote(c.mcap)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
