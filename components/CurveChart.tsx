"use client";

import type { CurvePoint } from "@/lib/types";
import { fmtQuote } from "@/lib/format";

const WIDTH = 640;
const HEIGHT = 220;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 12;
const PAD_B = 24;

export function CurveChart({
  points,
  currentProgressPct,
}: {
  points: CurvePoint[];
  currentProgressPct: number;
}) {
  if (points.length < 2) {
    return (
      <div className="h-[220px] flex items-center justify-center text-sm text-faint border border-border rounded bg-panel2">
        Curve data unavailable
      </div>
    );
  }

  const maxPrice = Math.max(...points.map((p) => p.priceQuote));
  const minPrice = Math.min(...points.map((p) => p.priceQuote));
  const range = maxPrice - minPrice || 1;

  const innerW = WIDTH - PAD_L - PAD_R;
  const innerH = HEIGHT - PAD_T - PAD_B;

  const toXY = (p: CurvePoint) => {
    const x = PAD_L + (p.progressPct / 100) * innerW;
    const y = PAD_T + innerH - ((p.priceQuote - minPrice) / range) * innerH;
    return [x, y] as const;
  };

  const linePath = points
    .map((p, i) => {
      const [x, y] = toXY(p);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const areaPath = `${linePath} L${PAD_L + innerW},${PAD_T + innerH} L${PAD_L},${PAD_T + innerH} Z`;

  const markerProgress = Math.min(100, Math.max(0, currentProgressPct));
  const markerPoint =
    points.find((p) => p.progressPct >= markerProgress) ?? points[points.length - 1]!;
  const [markerX, markerY] = toXY(markerPoint);

  return (
    <div className="border border-border rounded bg-panel2 p-3">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto"
        role="img"
        aria-label="Bonding curve price by progress toward migration"
      >
        <defs>
          <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* horizontal gridlines */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PAD_L}
            x2={PAD_L + innerW}
            y1={PAD_T + innerH * f}
            y2={PAD_T + innerH * f}
            stroke="var(--color-border)"
            strokeWidth={1}
          />
        ))}

        <path d={areaPath} fill="url(#curveFill)" />
        <path d={linePath} fill="none" stroke="var(--color-accent)" strokeWidth={1.75} />

        {/* progress marker */}
        <line
          x1={markerX}
          x2={markerX}
          y1={PAD_T}
          y2={PAD_T + innerH}
          stroke="var(--color-text)"
          strokeOpacity={0.25}
          strokeDasharray="3 3"
        />
        <circle cx={markerX} cy={markerY} r={4} fill="var(--color-text)" />

        {/* axis labels */}
        <text x={PAD_L} y={HEIGHT - 6} fontSize="10" fill="var(--color-faint)" fontFamily="IBM Plex Mono">
          0%
        </text>
        <text
          x={PAD_L + innerW}
          y={HEIGHT - 6}
          fontSize="10"
          fill="var(--color-faint)"
          fontFamily="IBM Plex Mono"
          textAnchor="end"
        >
          Migration
        </text>
      </svg>
      <div className="flex justify-between text-xs text-faint mt-1 font-mono px-1">
        <span>{fmtQuote(minPrice)}</span>
        <span>{fmtQuote(maxPrice)}</span>
      </div>
    </div>
  );
}
