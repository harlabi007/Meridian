"use client";

import { useCallback, useEffect, useState } from "react";

export interface Prefs {
  slippageBps: number;
  displayName: string;
  alerts: { p80: boolean; p95: boolean; graduated: boolean };
}

export const DEFAULT_PREFS: Prefs = {
  slippageBps: 100,
  displayName: "",
  alerts: { p80: true, p95: true, graduated: true },
};

const KEY = "meridian-prefs";
const EVENT = "prefs-change";

export function readPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return {
      ...DEFAULT_PREFS,
      ...raw,
      alerts: { ...DEFAULT_PREFS.alerts, ...(raw.alerts ?? {}) },
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function usePrefs(): [Prefs, (patch: Partial<Prefs>) => void] {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  useEffect(() => {
    setPrefs(readPrefs());
    const on = () => setPrefs(readPrefs());
    window.addEventListener(EVENT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(EVENT, on);
      window.removeEventListener("storage", on);
    };
  }, []);
  const update = useCallback((patch: Partial<Prefs>) => {
    const next = { ...readPrefs(), ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // preferences just won't persist
    }
    window.dispatchEvent(new CustomEvent(EVENT));
  }, []);
  return [prefs, update];
}

/* ---- alert history (what the notification bell has told you) ---- */
export interface AlertLogEntry {
  id: string;
  title: string;
  body: string;
  href: string;
  at: number;
}
const LOG_KEY = "meridian-alert-log";
const LOG_EVENT = "alert-log-change";

export function readAlertLog(): AlertLogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]") as AlertLogEntry[];
  } catch {
    return [];
  }
}
export function appendAlertLog(entries: AlertLogEntry[]) {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify([...entries, ...readAlertLog()].slice(0, 50)));
    window.dispatchEvent(new CustomEvent(LOG_EVENT));
  } catch {
    // log unavailable
  }
}
export function clearAlertLog() {
  try {
    localStorage.removeItem(LOG_KEY);
    window.dispatchEvent(new CustomEvent(LOG_EVENT));
  } catch {
    // ignore
  }
}
export function useAlertLog(): AlertLogEntry[] {
  const [log, setLog] = useState<AlertLogEntry[]>([]);
  useEffect(() => {
    setLog(readAlertLog());
    const on = () => setLog(readAlertLog());
    window.addEventListener(LOG_EVENT, on);
    return () => window.removeEventListener(LOG_EVENT, on);
  }, []);
  return log;
}
