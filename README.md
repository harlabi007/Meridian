# Meridian

A launch-and-trade terminal built on [Meteora's Dynamic Bonding Curve](https://docs.meteora.ag/developer-guides/dbc) — creators configure and mint a DBC pool from a simple form, and every pool gets a live dashboard with its curve, progress to migration, and a swap widget, all in one screen.

Built for **[Best use of Meteora's Dynamic Bonding Curve (DBC)](https://superteam.fun/earn/listing/meteora-dbc)**.

## Why this project

DBC gives builders a fair, configurable bonding curve primitive, but today using it means either integrating the SDK yourself or trusting a black-box launchpad UI. Meridian is a reference-quality, open implementation of the full loop — **create → trade → watch it graduate** — with the curve math, progress tracking, and swap execution all visible and inspectable.

## Architecture

```
app/
  page.tsx                 Explorer — live grid of pools, sortable
  create/page.tsx           Pool creation wizard
  pool/[address]/page.tsx    Pool dashboard — curve chart, stats, swap, creator tools
  api/pools/                 List + register pools (backed by Postgres)
  api/pools/[address]/       Pool detail (live curve + holder count) + creator PATCH
  api/trades/                Real trade history (event-parsed) with snapshot fallback
components/                 UI: PoolCard, CurveChart (SVG), SwapWidget, CreatePoolForm,
                             CreatorPanel (claim fees + edit image), ...
lib/
  dbc.ts                     Wrapper around @meteora-ag/dynamic-bonding-curve-sdk:
                             pool creation, swap quotes/execution, sqrt-price -> price math
  events.ts                  Parses real EvtSwap events from transaction logs via Anchor's
                             EventParser + the SDK's bundled IDL
  creator.ts                 Creator-only actions: claim trading fees, estimate holder count
  solana.ts                  Connection/cluster config
  types.ts, format.ts        Shared types + formatting helpers
prisma/schema.prisma        Pool + Snapshot tables
scripts/indexer.ts          Polling indexer that keeps the DB in sync with on-chain state
```

**Client-side by design:** pool creation, swaps, and fee claims all build the
transaction in the browser (via `lib/dbc.ts` / `lib/creator.ts`) and the
connected wallet signs it directly — there is no custodial backend and no
private key ever touches the server. The backend's only job is indexing
public on-chain state for fast reads.

## Pages

- **Explore** — live pool grid with search, sorting, watchlist filter and trending badges
- **Launch** — pool creation wizard (can be pre-filled from the Designer)
- **Designer** — model a curve and simulate buys before spending anything
- **Leaderboard** — top volume, closest to graduating, graduated, top creators
- **Portfolio** — your holdings, launches and watchlist
- **Creator profiles** — every launch from a wallet, with its track record

## Community features

- **Light / dark theme** with a header toggle (remembers your choice, no flash on load)
- **Watchlist** — star any pool to track it; filter the explorer to just your picks (stored locally, no account needed)
- **Trending badge** on the top 3 pools by 24h volume
- **Graduation alerts** — in-page and browser notifications when a starred pool hits 80% / 95% or graduates (while Meridian is open)
- **Share** — copy link or post a pool to X in one click
- **Platform stats bar** and **search** on the explorer

## What changed in the production-readiness pass

Root causes found and fixed, not just the symptoms:

- **Leaderboard/Portfolio "Couldn't load" errors**: the API returned a generic error with no way
  to tell "database not configured" apart from "database wrong password" apart from "tables not
  created". `lib/apiError.ts` now classifies the real Prisma/Postgres error and every panel tells
  you exactly which of the three it is, with the fix. `/api/health` checks all of it in one place.
- **Portfolio never showing wallet data**: it depended on the same pools query as everything
  else, so any pool-loading error blocked holdings, launches and watchlist together, and wallet
  token-account failures were swallowed silently. These are now three independent queries with
  their own error and empty states.
- **Trade quotes/swaps used the wrong decimals** for the token being sold vs. bought, and the app
  never checked whether a submitted transaction actually succeeded on-chain (`skipPreflight: true`
  with no confirmation-result check) — a failed swap could have looked like a success. Rewritten
  in `lib/tx.ts` / `lib/dbc.ts` with real confirmation checking and decimal-correct quoting.
- **New pools were skipped by the site if the database call failed right after minting** (the
  token existed on-chain with nobody knowing). Registration now verifies the pool on-chain,
  checks the creator matches, and queues + auto-retries on failure instead of losing it.
  Anyone can still list a *real* pool for anyone — Meridian is permissionless by design — but a
  submission has to correspond to an actual on-chain pool.
- **Anyone could overwrite anyone else's pool image** by POSTing a matching wallet address with
  no proof of ownership. Editing now requires a signed wallet message, verified server-side.
- **Curve Studio's numbers could quietly drift from what actually launches**, since the preview
  and the real transaction used separate math. Both now call the same `buildCurveConfig()`, and
  the preview cross-checks its derived numbers against the config's own on-chain threshold before
  showing them — falling back to a clearly-labelled estimate if they don't line up.
- **24h volume was measured start-vs-end of the day**, which nets buys and sells against each
  other. Switched to summing absolute reserve deltas between snapshots (`lib/volume.ts`).
- Small number formatting bug: tiny token prices displayed as "<0.001 SOL" for every token.

## Diagnosing setup problems

Visit `/api/health` (e.g. http://localhost:3000/api/health) any time. It reports exactly which
part isn't working — DATABASE_URL missing, database unreachable, tables not created, or the
Solana RPC unreachable — with the fix for each. Every "Couldn't load…" panel in the app links to
this page.

## Setup

```bash
npm install
cp .env.example .env         # fill in DATABASE_URL (Supabase "Session pooler" string works best) — must be named .env, not .env.local, since `prisma db push` only reads .env
npm run db:push              # creates the Pool/Snapshot tables
npm run dev                  # http://localhost:3000
```

In a second terminal, run the indexer so pools show live price/progress data:

```bash
npm run indexer
```

Get devnet SOL from the [devnet faucet](https://faucet.raccoons.dev/) to test pool creation and swaps.

## Design decisions & known simplifications

Being upfront about these, since a judge will look:

- **Trade history is real, with a fallback.** `lib/events.ts` decodes actual `EvtSwap` events from transaction logs using Anchor's `EventParser` against the SDK's bundled IDL — so side, trader, and amounts are exact, not estimated. If parsing ever fails (SDK field-name drift, RPC hiccup) or a pool has no swaps yet, the UI falls back to the price-snapshot feed from the poller in `scripts/indexer.ts`. The event field names (`tradeDirection`, `swapResult.outputAmount`) are Anchor's camelCase rendering of the Rust struct — worth a quick console check against your installed SDK version before a live demo.
- **Fee claiming uses `claimCreatorTradingFeeToReceiver`.** Per Meteora's docs, the "2"-suffixed methods are for Token2022 transfer-hook pools; this app only creates standard SPL pools, so the "ToReceiver" variant is correct.
- **Holder count is a live scan, not indexed.** `lib/creator.ts` does a `getParsedProgramAccounts` scan filtered by mint to count nonzero token accounts. Fine at hackathon scale; a high-holder-count token should move this to an indexed source (e.g. Helius DAS API).
- **Off-chain vs on-chain edits.** The creator can update the pool's display image through the app (stored in Postgres) — but on-chain token metadata is immutable once minted (`tokenUpdateAuthority: Immutable` in `lib/dbc.ts`), so name/symbol/URI can't change after launch. The creator-ownership check on that edit endpoint compares wallet addresses, not a signed message — fine for a non-financial display field, but call this out if you extend it to anything sensitive.
- **New pool config per launch.** Each launch creates its own DBC config via `createConfigAndPool` rather than reusing a shared partner config. Simpler for a permissionless multi-creator app; a real launchpad might create one partner config upfront and have creators mint pools against it.
- **Fixed defaults**: SPL token (not Token2022), 6 base / 9 quote decimals, DAMM v2 migration, fixed 100bps migration fee, creator's LP permanently locked at migration (no vesting) — chosen to keep the creation form to the handful of inputs that actually matter (starting cap, migration cap, supply, fee) rather than exposing all ~40 raw config fields.
- **Price math**: `price = (sqrtPrice / 2^64)^2 * 10^(baseDecimals - quoteDecimals)`, per the [DBC bonding curve docs](https://docs.meteora.ag/developer-guides/dbc/bonding-curve-configs). Implemented via string-based BN conversion since curve prices can exceed `Number.MAX_SAFE_INTEGER`.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · `@meteora-ag/dynamic-bonding-curve-sdk` · `@coral-xyz/anchor` (event parsing) · `@solana/wallet-adapter-react` · Prisma + Postgres · TanStack Query

## Not yet tested against a live cluster

This was built in an environment without network access to run `npm install` or a devnet transaction end-to-end. Everything is written directly against Meteora's published SDK reference (method names, param shapes, and the price formula were pulled from `docs.meteora.ag` while building), but budget an hour to shake out any SDK version drift before demo day — start with `npm run dev` and the pool creation flow on devnet.
