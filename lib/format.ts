export function shortAddr(addr: string, chars = 4): string {
  if (!addr || addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`;
}

/** Removes trailing zeros (and a dangling decimal point) from a plain decimal string. */
function trimZeros(s: string): string {
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

const withCommas = (n: number, maxFractionDigits: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: maxFractionDigits });

/**
 * The one place numbers become display text. Never produces scientific notation.
 *   >= 1,000        -> thousands separators, up to 2 decimals     1,234.56
 *   1 to 1,000      -> up to 3 decimals                           5.397
 *   0.01 to 1       -> up to 4 decimals                           0.0123
 *   below 0.01      -> 3 significant digits, in full decimal      0.00000000624
 * Trailing zeros are dropped. This only builds display strings — it never feeds back into
 * any calculation, so the underlying values stay exactly as computed.
 */
export function fmtDecimal(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "0";
  const sign = value < 0 ? "-" : "";
  const v = Math.abs(value);

  if (v >= 1000) return sign + withCommas(v, 2);

  if (v >= 1) {
    const s = v.toFixed(3);
    return sign + (Number(s) >= 1000 ? withCommas(Number(s), 2) : trimZeros(s));
  }

  if (v >= 0.01) return sign + trimZeros(v.toFixed(4));

  // Very small values (typical token prices): keep 3 significant digits without an exponent.
  const exponent = Number(v.toExponential(2).split("e")[1]); // 6.24e-9 -> -9
  const decimals = Math.min(100, 2 - exponent);
  return sign + trimZeros(v.toFixed(decimals));
}

export function fmtQuote(value: number, symbol = "SOL"): string {
  return `${fmtDecimal(value)} ${symbol}`;
}

const COMPACT_UNITS: [number, string][] = [
  [1e12, "T"],
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "K"],
];

/** Token quantities and counts: 800M, 421.05M, 1.5K, 128. */
export function fmtCompact(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const abs = Math.abs(value);
  if (abs < 1000) return fmtDecimal(value);
  const sign = value < 0 ? "-" : "";
  for (let i = 0; i < COMPACT_UNITS.length; i++) {
    const [divisor, suffix] = COMPACT_UNITS[i]!;
    if (abs >= divisor) {
      const scaled = trimZeros((abs / divisor).toFixed(2));
      // 999.999M rounds up to "1000M" — show it as 1B instead
      if (Number(scaled) >= 1000 && i > 0) {
        const [bigger, biggerSuffix] = COMPACT_UNITS[i - 1]!;
        return `${sign}${trimZeros((abs / bigger).toFixed(2))}${biggerSuffix}`;
      }
      return `${sign}${scaled}${suffix}`;
    }
  }
  return fmtDecimal(value);
}

/** Percentages: 60%, 46.7%, 0.6%, <0.1%. */
export function fmtPct(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  if (value > 0 && value < 0.1) return "<0.1%";
  const s = trimZeros(value.toFixed(1));
  return `${s === "-0" ? "0" : s}%`;
}

/** Price-range multiples: 60x, 166.7x, 1,234x. */
export function fmtMultiple(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1000) return `${withCommas(value, 0)}x`;
  return `${trimZeros(value.toFixed(1))}x`;
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
