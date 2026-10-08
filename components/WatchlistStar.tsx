"use client";

import { useWatchlist } from "@/lib/watchlist";

export function WatchlistStar({
  address,
  size = "sm",
}: {
  address: string;
  size?: "sm" | "md";
}) {
  const { isWatched, toggle } = useWatchlist();
  const watched = isWatched(address);
  const dim = size === "sm" ? 14 : 18;

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(address);
      }}
      aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
      aria-pressed={watched}
      className="shrink-0 text-muted hover:text-amber transition-colors"
    >
      <svg
        width={dim}
        height={dim}
        viewBox="0 0 24 24"
        fill={watched ? "currentColor" : "none"}
        className={watched ? "text-amber" : ""}
      >
        <path
          d="M12 2.5l2.9 6.4 6.9.7-5.2 4.7 1.5 6.9-6.1-3.6-6.1 3.6 1.5-6.9-5.2-4.7 6.9-.7L12 2.5z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
