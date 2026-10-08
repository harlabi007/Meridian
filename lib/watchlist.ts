"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "watchlist";
const EVENT_NAME = "watchlist-change";

function readWatchlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeWatchlist(list: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    // localStorage unavailable — watchlist just won't persist this session
  }
}

/** Reactive watchlist state, kept in sync across every component using it. */
export function useWatchlist() {
  const [list, setList] = useState<string[]>([]);

  useEffect(() => {
    setList(readWatchlist());
    const onChange = () => setList(readWatchlist());
    window.addEventListener(EVENT_NAME, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT_NAME, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const isWatched = useCallback((address: string) => list.includes(address), [list]);

  const toggle = useCallback((address: string) => {
    const current = readWatchlist();
    const next = current.includes(address)
      ? current.filter((a) => a !== address)
      : [...current, address];
    writeWatchlist(next);
  }, []);

  return { list, isWatched, toggle };
}
