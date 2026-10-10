"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchPools } from "@/lib/api";
import { fmtPct } from "@/lib/format";
import { appendAlertLog, usePrefs } from "@/lib/prefs";
import { useWatchlist } from "@/lib/watchlist";

const SENT_KEY = "alerts-sent";

interface Toast {
  id: string;
  title: string;
  body: string;
  href: string;
}
type Perm = "default" | "granted" | "denied" | "unsupported";

function readSent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}
function writeSent(v: string[]) {
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify(v));
  } catch {
    // alerts may repeat after a reload, which is harmless
  }
}

/**
 * Watches the pools on your watchlist and alerts you when one reaches 80% / 95% of its
 * migration goal or graduates. Which alerts fire is controlled in Account > Notifications.
 */
export function AlertCenter() {
  const { list } = useWatchlist();
  const [prefs] = usePrefs();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [perm, setPerm] = useState<Perm>("default");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  const { data } = useQuery({
    queryKey: ["alerts-pools"],
    queryFn: () => fetchPools({ sort: "progress" }),
    enabled: list.length > 0,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!data || list.length === 0) return;
    const thresholds = [prefs.alerts.p80 ? 80 : null, prefs.alerts.p95 ? 95 : null].filter((t): t is number => t !== null);
    const sent = new Set(readSent());
    const fresh: Toast[] = [];

    for (const p of data) {
      if (!list.includes(p.address)) continue;
      if (p.migrated) {
        const key = `${p.address}:migrated`;
        if (prefs.alerts.graduated && !sent.has(key)) {
          fresh.push({ id: key, title: `${p.name} graduated`, body: `$${p.symbol} completed its curve and migrated to a DEX pool.`, href: `/pool/${p.address}` });
        }
        sent.add(key);
        continue;
      }
      const crossed = thresholds.filter((t) => p.progressPct >= t);
      const highest = crossed[crossed.length - 1];
      if (highest === undefined) continue;
      const isNew = !sent.has(`${p.address}:${highest}`);
      crossed.forEach((t) => sent.add(`${p.address}:${t}`)); // don't replay lower thresholds
      if (isNew) {
        fresh.push({ id: `${p.address}:${highest}`, title: `${p.name} is ${highest}% to graduating`, body: `$${p.symbol} is at ${fmtPct(p.progressPct)} of its migration goal.`, href: `/pool/${p.address}` });
      }
    }

    if (fresh.length === 0) return;
    writeSent([...sent]);
    appendAlertLog(fresh.map((f) => ({ ...f, at: Date.now() })));
    setToasts((t) => [...t, ...fresh]);
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      fresh.forEach((f) => new Notification(f.title, { body: f.body }));
    }
    fresh.forEach((f) => setTimeout(() => setToasts((t) => t.filter((x) => x.id !== f.id)), 12_000));
  }, [data, list, prefs.alerts]);

  async function enableBrowserAlerts() {
    if (typeof Notification === "undefined") return;
    setPerm(await Notification.requestPermission());
  }

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Graduation alerts"
          aria-expanded={open}
          className="relative w-8 h-8 flex items-center justify-center rounded border border-border text-muted hover:text-text hover:border-borderHi transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          {list.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber" />}
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
            <div className="absolute right-0 mt-2 w-72 border border-border bg-panel rounded p-4 text-xs z-40">
              <p className="text-sm font-medium mb-1">Graduation alerts</p>
              <p className="text-muted leading-relaxed mb-3">
                Get notified when a starred pool reaches 80% and 95% of its migration goal, and when it graduates. Alerts run while Meridian is open in a tab.
              </p>
              <p className="text-faint mb-3">
                Watching {list.length} pool{list.length === 1 ? "" : "s"}
                {list.length === 0 ? " — tap the star on any pool to start." : "."}
              </p>
              {perm === "default" && (
                <button onClick={enableBrowserAlerts} className="w-full py-2 mb-2 bg-amber text-white font-semibold rounded hover:bg-amberHi transition-colors">
                  Enable browser notifications
                </button>
              )}
              {perm === "granted" && <p className="text-buy mb-2">Browser notifications are on.</p>}
              {perm === "denied" && <p className="text-muted mb-2">Browser notifications are blocked. In-page alerts still work.</p>}
              <Link href="/account?tab=notifications" onClick={() => setOpen(false)} className="text-muted hover:text-text underline decoration-dotted">
                Notification settings
              </Link>
            </div>
          </>
        )}
      </div>

      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-72" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="border border-borderHi bg-panel rounded p-3 flex gap-3">
            <Link href={t.href} onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="flex-1 min-w-0">
              <p className="text-sm font-medium mb-0.5">{t.title}</p>
              <p className="text-xs text-muted">{t.body}</p>
            </Link>
            <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} aria-label="Dismiss" className="text-faint hover:text-text text-sm leading-none self-start">
              ×
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
