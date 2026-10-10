"use client";

import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useQuery } from "@tanstack/react-query";
import { PoolCard } from "@/components/PoolCard";
import { StatPill } from "@/components/StatPill";
import { ErrorPanel, EmptyPanel, Skeleton } from "@/components/DataState";
import { ApiError, fetchPools } from "@/lib/api";
import { fmtCompact, fmtQuote } from "@/lib/format";
import { useWatchlist } from "@/lib/watchlist";

export default function PortfolioPage() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { list: watchlist } = useWatchlist();
  const owner = publicKey?.toBase58();

  const { data: allPools, isLoading: poolsLoading, isError: poolsError, error: poolsErr, refetch: refetchPools } = useQuery({
    queryKey: ["portfolio-pools"],
    queryFn: () => fetchPools({ sort: "marketcap" }),
    enabled: Boolean(publicKey),
  });

  const { data: balances, isError: balancesError, error: balancesErr, refetch: refetchBalances } = useQuery({
    queryKey: ["portfolio-balances", owner],
    enabled: Boolean(publicKey),
    refetchInterval: 30_000,
    retry: 1,
    queryFn: async () => {
      const res = await connection.getParsedTokenAccountsByOwner(publicKey!, { programId: TOKEN_PROGRAM_ID });
      const map = new Map<string, number>();
      for (const acc of res.value) {
        const info = (acc.account.data as any)?.parsed?.info;
        const amount = Number(info?.tokenAmount?.uiAmount ?? 0);
        if (info?.mint && amount > 0) map.set(info.mint, (map.get(info.mint) ?? 0) + amount);
      }
      return map;
    },
  });

  const holdings = (allPools ?? [])
    .map((p) => ({ pool: p, amount: balances?.get(p.baseMint) ?? 0 }))
    .filter((h) => h.amount > 0)
    .map((h) => ({ ...h, value: h.amount * h.pool.priceQuote }))
    .sort((a, b) => b.value - a.value);

  const created = (allPools ?? []).filter((p) => p.creator === owner);
  const watched = (allPools ?? []).filter((p) => watchlist.includes(p.address));
  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);

  if (!publicKey) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-16">
        <div className="max-w-md border border-border rounded bg-panel p-8">
          <h1 className="text-xl font-semibold tracking-tight mb-2">Your portfolio</h1>
          <p className="text-sm text-muted leading-relaxed mb-5">Connect your wallet to see your holdings, the pools you&apos;ve launched, and your watchlist in one place.</p>
          <button onClick={() => setVisible(true)} className="px-4 py-2 bg-amber text-white text-sm font-semibold rounded hover:bg-amberHi transition-colors">Connect wallet</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Portfolio</h1>
        <p className="text-xs text-faint font-mono break-all">{owner}</p>
      </div>

      {poolsError && (
        <div className="mb-6">
          <ErrorPanel error={poolsErr} onRetry={() => refetchPools()} compact title="Couldn't load pool data" />
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        <StatPill label="Holdings value" value={fmtQuote(totalValue)} />
        <StatPill label="Tokens held" value={String(holdings.length)} />
        <StatPill label="Pools launched" value={String(created.length)} />
        <StatPill label="Watching" value={String(watched.length)} />
      </div>

      <Section title="Your holdings">
        {poolsLoading ? (
          <Skeleton className="h-24" />
        ) : balancesError ? (
          <ErrorPanel compact onRetry={() => refetchBalances()} title="Couldn't read this wallet's tokens" error={balancesErr instanceof Error ? balancesErr : new ApiError("The wallet's token accounts couldn't be read from the RPC.", "NETWORK", 0)} />
        ) : holdings.length === 0 ? (
          <EmptyPanel title="No Meridian tokens yet" body="Tokens launched on Meridian that you hold will show up here." />
        ) : (
          <div className="border border-border rounded overflow-x-auto">
            <div className="grid grid-cols-4 text-xs text-muted px-3 py-2 bg-panel2 border-b border-border min-w-[640px]">
              <span>Token</span><span>Balance</span><span>Price</span><span className="text-right">Value</span>
            </div>
            {holdings.map(({ pool, amount, value }) => (
              <Link key={pool.address} href={`/pool/${pool.address}`} className="grid grid-cols-4 items-center text-xs px-3 py-3 border-b border-border last:border-0 hover:bg-panel2 transition-colors min-w-[640px]">
                <span><span className="text-sm font-medium">{pool.name}</span>{" "}<span className="font-mono text-muted">${pool.symbol}</span></span>
                <span className="font-mono">{fmtCompact(amount)}</span>
                <span className="font-mono">{fmtQuote(pool.priceQuote)}</span>
                <span className="font-mono text-right">{fmtQuote(value)}</span>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section title="Pools you launched" id="launched">
        {poolsLoading ? <Skeleton className="h-24" /> : created.length === 0 ? (
          <EmptyPanel title="You haven't launched a pool yet" body="Launch a token to see it here." action={<Link href="/create" className="px-4 py-2 bg-amber text-white text-sm font-semibold rounded hover:bg-amberHi transition-colors">Launch a token</Link>} />
        ) : (
          <Grid>{created.map((p) => <PoolCard key={p.address} pool={p} />)}</Grid>
        )}
      </Section>

      <Section title="Watchlist" id="watchlist">
        {poolsLoading ? <Skeleton className="h-24" /> : watched.length === 0 ? (
          <EmptyPanel title="Nothing starred yet" body="Star a pool on the explorer to track it here." />
        ) : (
          <Grid>{watched.map((p) => <PoolCard key={p.address} pool={p} />)}</Grid>
        )}
      </Section>
    </div>
  );
}

function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-10 scroll-mt-20">
      <h2 className="text-sm font-medium mb-3">{title}</h2>
      {children}
    </section>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>;
}
