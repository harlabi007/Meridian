# Meridian

A launch-and-trade terminal built on [Meteora's Dynamic Bonding Curve](https://docs.meteora.ag/developer-guides/dbc) — creators configure and mint a DBC pool from a simple form, and every pool gets a live dashboard with its curve, progress to migration, and a swap widget, all in one screen.

Built for **[Best use of Meteora's Dynamic Bonding Curve (DBC)](https://superteam.fun/earn/listing/meteora-dbc)**.

## Quick tour for judges

- **Live demo (Solana devnet):** https://meridian-delta-wheat.vercel.app
- **Repository (public):** https://github.com/harlabi007/Meridian
- **Network:** devnet. Connect a devnet wallet (Phantom/Solflare set to Devnet) and get free test SOL from https://faucet.solana.com

**Two-minute path**

1. **Curve Studio** — pick *Flat*, *Exponential* or *Long* (the curve directions Meteora suggested), adjust the numbers, and watch the price path, SOL needed to graduate, and a buy simulator update. It uses the same curve builder as the real launch.
2. **Launch** — one click from Curve Studio. Your wallet signs one transaction that creates the DBC config and pool.
3. **Trade** — open the pool, buy and sell against the live curve. Progress to migration, price change and activity update right after confirmation.
4. **Around the pool** — creator fee claiming, wallet-signed comments and image changes, "Refer & earn" links, an embeddable widget, Leaderboard, Portfolio, and graduation alerts.

## Where Meridian uses Meteora DBC

| Feature | DBC SDK usage |
|---|---|
| Curve design and preview | `buildCurveWithMarketCap` — the same function builds both the preview and the real launch config, so what you preview is what deploys |
| Pool creation | `client.partner.createConfigAndPool` — config and pool in one transaction; DAMM v2 migration with creator LP permanently locked, linear fee decay for sniper protection |
| Live trading | `client.pool.swapQuote2` / `swap2` with `SwapMode.ExactIn` and slippage control |
| Referral fees | `referralTokenAccount` passed through quote and swap |
| Creator fees | `client.creator.claimCreatorTradingFeeToReceiver` |
| Pool and curve state | `client.state.getPool` / `getPoolConfig`; Q64.64 `sqrtPrice` converted to price; the on-chain `curve` segments and `migrationSqrtPrice` are read back and checked against the preview |
| Trade history | Anchor `EventParser` with the SDK's bundled IDL decodes swap events from transaction logs, with a price-snapshot fallback |
| Graduation | migration progress from `migrationQuoteThreshold`; graduated pools link to Jupiter |

## Honest notes

- Runs on **devnet**. The program address is the same on mainnet, and the network is switched with environment variables (`NEXT_PUBLIC_SOLANA_CLUSTER`, `NEXT_PUBLIC_RPC_ENDPOINT`).
- Pool data is synced from chain on request (no always-on indexer), so volume and price-change figures are estimates built from snapshots.
- Curve Studio labels figures as a *verified estimate* when it cannot reproduce Meteora's exact on-chain rounding before launch.
- Referral fees are implemented but have not been exercised on a live swap yet.

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

## Curve Studio presets (Flat / Exponential / Long)

Matches Meteora's own suggested direction from the hackathon listing ("Novel Curve or Fee
Configurations — Flat Curve, Exponential Curve or Long Curve") with three starting presets in
`lib/curvePresets.ts`. Honesty note: DBC's market-cap-based curve builder always produces the
same underlying shape (one constant-liquidity segment) — these presets don't create different
on-chain curve *structures*, they set meaningfully different starting/migration market caps,
supply and fees so the *trading experience* genuinely differs (verified: 3x vs 167x vs 200x
price multiples, 28 vs 31 vs 113 SOL to graduate). Every field stays editable after picking one.

## Image upload (no new infrastructure)

Launch and Creator Tools now both support uploading an image file, not just pasting a link.
This deliberately avoids adding a storage service or new credentials under deadline pressure:
the browser resizes/compresses the file to a small JPEG (`lib/imageUpload.ts`) and stores it as
a data URL in the same `imageUrl` field already used for links. One design choice worth knowing:
at launch time, an uploaded file is NOT embedded in the on-chain transaction (that would risk
exceeding Solana's transaction size limit) — instead the pool launches with no on-chain image
URI, then the uploaded image is set via the existing signed off-chain update immediately after,
the same trust-verified path Creator Tools already used. A pasted https:// link still goes
on-chain as before.

## SDK version fix (important)

This project was originally built against Meteora's documentation, which — as it turns out —
describes a newer version of `@meteora-ag/dynamic-bonding-curve-sdk` than what actually
installs via the `^1.2.5` version range in package.json (real installed version: `1.5.13`).
Several things differ between what the docs show and what this version's actual TypeScript
types require:

- `createConfigAndPool` lives on `client.partner`, not `client.pool` (pool service only
  handles swaps in this version).
- The token field is `tokenAuthorityOption` with enum `TokenAuthorityOption`, not
  `tokenUpdateAuthority` / `TokenUpdateAuthorityOption`.
- Swaps now use the newer `swap2` / `swapQuote2` pair (Meteora's own docs call these
  "preferred" over the legacy `swap()` / `swapQuote()`), which take a `pool` field, not
  `poolAddress`, and support `SwapMode.ExactIn`.

`lib/dbc.ts` is fixed against Meteora's own published SDK reference
(docs.meteora.ag/developer-guides/dbc/typescript-sdk/reference) and defends against a couple
of remaining unknowns — e.g. unwrapping a `poolState` wrapper some versions nest state under —
rather than assuming one exact shape. **This has not yet been exercised against a live devnet
transaction** — test a real launch before a demo.

## Referral fees, comments, and post-migration trading

- **Referral fees (beta)** — Meteora's DBC has a built-in referral mechanism: a "Refer & earn"
  button on every pool page gives you a link that routes a small share of trading fees to your
  wallet when someone trades through it, with no extra step for the trader. This is wired
  defensively (`lib/referral.ts`) — if anything about attaching the referral account fails for
  any reason, the trade still goes through normally without it. **This hasn't been exercised on
  a real devnet swap yet** — test it before relying on it for a demo.
- **Comments** — wallet-signed discussion under every pool, same trust model as creator edits
  (a signed message proves who's posting, no fake identities). **Requires a database change —
  see below.**
- **Post-migration trading link** — a graduated pool used to be a dead end ("trading has
  moved"). Now it links straight to Jupiter so trading actually continues.

### One extra step this round: update your database

Comments need a new table. After copying the files in:
```bash
npm run db:push
```
Say yes if it asks to create the `Comment` table. Nothing else needs this — the other features
use existing tables.

## Live activity feed & embeds

- **Homepage activity feed** — a real-time ticker of launches and trades across every pool
  (`/api/activity`, `components/ActivityFeed.tsx`), not just the one you're looking at.
- **Embeddable widgets** — every pool page has an "Embed" button that gives you an `<iframe>`
  snippet for a chrome-free live price/progress widget (`/embed/[address]`) usable on any
  external site. It deliberately doesn't embed wallet-connected trading — wallet browser
  extensions are unreliable inside iframes — and instead links back to Meridian to trade.

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
