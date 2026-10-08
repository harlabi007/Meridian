"use client";

import { usePathname } from "next/navigation";

export function Footer() {
  const pathname = usePathname();
  if (pathname?.startsWith("/embed")) return null; // embeds are chrome-free by design

  return (
    <footer className="border-t border-border mt-16">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-faint">
        <span>© {new Date().getFullYear()} Meridian</span>
        <span>
          Powered by{" "}
          <a href="https://docs.meteora.ag/developer-guides/dbc" target="_blank" rel="noreferrer" className="text-muted hover:text-text underline decoration-dotted">
            Meteora&apos;s Dynamic Bonding Curve
          </a>{" "}
          on Solana
        </span>
      </div>
    </footer>
  );
}
