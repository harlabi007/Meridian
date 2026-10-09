export function shortAddr(addr: string, chars = 4): string {
  if (!addr || addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`;
}

export function fmtQuote(value: number, symbol = "SOL"): string {
  if (!value || !Number.isFinite(value)) return `0 ${symbol}`;
  // Token prices on a bonding curve are often tiny (e.g. 0.000000005 SOL), so show them in scientific form
  if (value < 0.001) return `${value.toExponential(2)} ${symbol}`;
  const decimals = value < 1 ? 4 : value < 1000 ? 3 : 2;
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} ${symbol}`;
}

export function fmtCompact(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function fmtPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function fmtTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
