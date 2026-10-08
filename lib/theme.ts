"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";
const EVENT = "theme-change";

export function readTheme(): Theme {
  try {
    return localStorage.getItem("theme") === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function setTheme(t: Theme) {
  document.documentElement.setAttribute("data-theme", t);
  try {
    localStorage.setItem("theme", t);
  } catch {
    // theme just won't persist
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Theme state shared across every component that shows or changes it. */
export function useTheme(): [Theme, (t: Theme) => void, boolean] {
  const [theme, setLocal] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setLocal(readTheme());
    setMounted(true);
    const on = () => setLocal(readTheme());
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const set = useCallback((t: Theme) => setTheme(t), []);
  return [theme, set, mounted];
}
