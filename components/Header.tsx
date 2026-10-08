"use client";

import { useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { AlertCenter } from "./AlertCenter";
import { flushPendingRegistrations } from "@/lib/registration";

// The wallet UI reads browser-only state, so it renders client-side only.
const WalletButton = dynamic(() => import("./AccountDrawer").then((m) => m.WalletButton), {
  ssr: false,
  loading: () => <div className="h-[34px] w-[132px] rounded bg-panel2 border border-border animate-pulse" aria-hidden />,
});

const NAV = [
  { href: "/", label: "Explore" },
  { href: "/create", label: "Launch" },
  { href: "/studio", label: "Curve Studio" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/portfolio", label: "Portfolio" },
];

export function Header() {
  const pathname = usePathname();
  if (pathname?.startsWith("/embed")) return null; // embeds are chrome-free by design
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  // Retry any launch that confirmed on-chain but couldn't be saved at the time
  useEffect(() => {
    flushPendingRegistrations().catch(() => {});
  }, []);

  const linkClass = (href: string) =>
    `px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
      isActive(href) ? "text-text" : "text-muted hover:text-text"
    }`;

  return (
    <header className="border-b border-border bg-bg sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6 min-w-0">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Logo />
            <span className="font-semibold tracking-tight text-[15px]">Meridian</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1" aria-label="Main">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={linkClass(n.href)} aria-current={isActive(n.href) ? "page" : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <AlertCenter />
          <ThemeToggle />
          <WalletButton />
        </div>
      </div>
      <nav className="md:hidden border-t border-border overflow-x-auto" aria-label="Main">
        <div className="flex px-3 py-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={linkClass(n.href)} aria-current={isActive(n.href) ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
