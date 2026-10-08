"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TokenAvatar } from "./TokenAvatar";
import { fmtQuote, fmtTimeAgo } from "@/lib/format";
import type { ActivityItem } from "@/app/api/activity/route";

async function fetchActivityFeed(): Promise<ActivityItem[]> {
  const res = await fetch("/api/activity", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load activity");
  return (await res.json()).items;
}

export function ActivityFeed() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["activity-feed"],
    queryFn: fetchActivityFeed,
    refetchInterval: 10_000,
  });

  if (isError) return null; // Non-critical widget — fail quietly rather than block the homepage

  return (
    <div className="border border-border rounded-lg bg-panel shadow-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-panel2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-buy opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-buy" />
        </span>
        <span className="text-xs font-medium text-text">Live activity</span>
        <span className="text-xs text-faint">across every pool</span>
      </div>

      <div className="max-h-[280px] overflow-y-auto divide-y divide-border">
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-4 py-3 h-[52px] bg-panel2/40 animate-pulse" />
          ))}
        {data && data.length === 0 && (
          <p className="px-4 py-6 text-sm text-faint text-center">No activity yet — launches and trades will appear here live.</p>
        )}
        {data?.map((item) => (
          <Link
            key={item.id}
            href={`/pool/${item.poolAddress}`}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-panel2 transition-colors"
          >
            <TokenAvatar symbol={item.symbol} imageUrl={item.imageUrl} size={28} />
            <div className="min-w-0 flex-1">
              <p className="text-xs truncate">
                {item.kind === "launch" ? (
                  <span className="text-amber font-medium">New launch</span>
                ) : (
                  <span className="text-muted">Trade</span>
                )}{" "}
                <span className="font-medium">{item.name}</span>{" "}
                <span className="font-mono text-muted">${item.symbol}</span>
              </p>
              <p className="text-xs font-mono text-faint">{fmtQuote(item.priceQuote)}</p>
            </div>
            <span className="text-xs text-faint shrink-0">{fmtTimeAgo(item.at)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
