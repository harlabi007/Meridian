"use client";

import { useTheme } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setTheme, mounted] = useTheme();
  if (!mounted) return <div className="w-8 h-8" aria-hidden />;
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="w-8 h-8 flex items-center justify-center rounded border border-border text-muted hover:text-text hover:border-borderHi transition-colors shrink-0"
    >
      {theme === "dark" ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 2.5V5M12 19V21.5M4.6 4.6L6.4 6.4M17.6 17.6L19.4 19.4M2.5 12H5M19 12H21.5M4.6 19.4L6.4 17.6M17.6 6.4L19.4 4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 6.8 6.8 0 0 0 20 14.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
