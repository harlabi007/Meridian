"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PoolCard } from "@/components/PoolCard";
import { StatPill } from "@/components/StatPill";
import { ErrorPanel, EmptyPanel, Skeleton } from "@/components/DataState";
import { fetchPools } from "@/lib/api";
import { fmtQuote, shortAddr } from "@/lib/format";
import { explorerAddressUrl } from "@/lib/solana";

export default function CreatorPage() {
  const { address } = useParams<{ address: string }>();
  const { data: pools, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["creator-pools", address],
    queryFn: () => fetchPools({ creator: address, sort: "recent" }),
  });

  const graduated = pools?.filter((p) => p.migrated).length ?? 0;
  const mcap = pools?.reduce((sum, p) => sum + p.marketCapQuote, 0) ?? 0;
  const volume = pools?.reduce((sum, p) => sum + p.volume24hQuote, 0) ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-10">
      <div className="mb-8">
        <p className="text-xs text-muted mb-1">Creator</p>
        <h1 className="text-2xl font-semibold tracking-tight font-mono mb-1">{shortAddr(address, 6)}</h1>
        <a href={explorerAddressUrl(address)} target="_blank" rel="noreferrer" className="text-xs text-faint hover:text-text underline decoration-dotted break-all">{address}</a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatPill label="Launches" value={pools ? String(pools.length) : "—"} />
        <StatPill label="Graduated" value={pools ? String(graduated) : "—"} tone="buy" />
        <StatPill label="Combined market cap" value={pools ? fmtQuote(mcap) : "—"} />
        <StatPill label="24h volume" value={pools ? fmtQuote(volume) : "—"} />
      </div>

      {isLoading && <Skeleton className="h-40" />}
      {isError && <ErrorPanel error={error} onRetry={() => refetch()} title="Couldn't load this creator" />}
      {pools && pools.length === 0 && <EmptyPanel title="No launches from this wallet" body="Pools this address creates on Meridian will appear here." />}
      {pools && pools.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pools.map((p) => <PoolCard key={p.address} pool={p} />)}
        </div>
      )}
    </div>
  );
}
