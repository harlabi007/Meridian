"use client";

import { useMemo, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { RPC_ENDPOINT } from "@/lib/solana";
import { ApiError } from "@/lib/api";

// Wallet adapter's default styles — required for the connect modal to render correctly.
import "@solana/wallet-adapter-react-ui/styles.css";

export function Providers({ children }: { children: ReactNode }) {
  // Empty on purpose: Phantom, Solflare, and other modern wallets register
  // themselves automatically via the Wallet Standard, so no explicit adapter
  // packages are needed (avoids @solana/wallet-adapter-wallets, whose bundled
  // adapters pull in an unrelated, broken transitive dependency).
  const wallets = useMemo(() => [], []);
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5_000,
            // Deterministic server errors (database not set up, 404, ...) won't fix themselves on retry
            retry: (count: number, err: unknown) => !(err instanceof ApiError) && count < 1,
          },
        },
      }),
    []
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* @ts-ignore — known type-def mismatch between wallet-adapter-react and React 18.3, harmless at runtime */}
      <ConnectionProvider endpoint={RPC_ENDPOINT}>
        {/* @ts-ignore — same known type-def mismatch */}
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>{children}</WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  );
}
