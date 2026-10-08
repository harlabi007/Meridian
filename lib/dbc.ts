import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import {
  ActivationType,
  BaseFeeMode,
  CollectFeeMode,
  DynamicBondingCurveClient,
  MigrationFeeOption,
  MigrationOption,
  SwapMode,
  TokenAuthorityOption,
  TokenDecimal,
  TokenType,
  buildCurveWithMarketCap,
  deriveDbcPoolAddress,
  getCurrentPoint,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { NATIVE_SOL_MINT, getConnection } from "./solana";
import type { CreatePoolInput } from "./types";

const Q64 = Math.pow(2, 64);

export const BASE_DECIMALS = 6;
export const QUOTE_DECIMALS = 9;

/**
 * DBC stores price as a Q64.64 fixed-point sqrt(price).
 * Actual price = (sqrtPrice / 2^64)^2 * 10^(baseDecimals - quoteDecimals)
 */
export function sqrtPriceToPrice(
  sqrtPrice: BN | string,
  baseDecimals: number,
  quoteDecimals: number
): number {
  const ratio = Number(sqrtPrice.toString()) / Q64;
  return ratio * ratio * Math.pow(10, baseDecimals - quoteDecimals);
}

export function getDbcClient(connection: Connection = getConnection()) {
  return DynamicBondingCurveClient.create(connection, "confirmed");
}

/**
 * Some VirtualPool/PoolConfig account shapes nest fields under a `poolState`/`configState`
 * wrapper depending on SDK version; others expose them directly. Try both rather than
 * guess one and break on a version that uses the other.
 */
function unwrap<T>(obj: any): T {
  return (obj?.poolState ?? obj?.configState ?? obj) as T;
}

/** Curve settings that are shared by Curve Studio's preview and the real launch. */
export interface CurveSettings {
  totalSupply: number;
  initialMarketCapQuote: number;
  migrationMarketCapQuote: number;
  /** Fee at launch in basis points; decays linearly to 100 bps over the first hour. */
  startingFeeBps: number;
}

/**
 * The single source of truth for what a Meridian launch looks like on-chain.
 * Both the launch transaction and Curve Studio's preview call this, so what you
 * preview is exactly what you deploy.
 */
export function buildCurveConfig(s: CurveSettings) {
  // TokenType has been named SPL and SPLToken across SDK versions; SPLToken = 0 per
  // the current published reference, with a numeric fallback if neither is exported.
  const tokenTypeSpl = (TokenType as any)?.SPL ?? (TokenType as any)?.SPLToken ?? 0;
  // TokenAuthorityOption.Immutable = 1 per Meteora's docs, used as a fallback if the
  // named export isn't available in the installed SDK version.
  const tokenAuthorityImmutable = (TokenAuthorityOption as any)?.Immutable ?? 1;

  return buildCurveWithMarketCap({
    token: {
      tokenType: tokenTypeSpl,
      tokenBaseDecimal: TokenDecimal.SIX,
      tokenQuoteDecimal: TokenDecimal.NINE,
      tokenAuthorityOption: tokenAuthorityImmutable,
      totalTokenSupply: s.totalSupply,
      leftover: 0,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: {
          startingFeeBps: Math.max(s.startingFeeBps, 100),
          endingFeeBps: 100,
          numberOfPeriod: 10,
          totalDuration: 3600,
        },
      },
      dynamicFeeEnabled: true,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: 0,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: MigrationFeeOption.FixedBps100,
      migrationFee: { feePercentage: 0, creatorFeePercentage: 0 },
    },
    liquidityDistribution: {
      partnerLiquidityPercentage: 0,
      partnerPermanentLockedLiquidityPercentage: 0,
      creatorLiquidityPercentage: 0,
      creatorPermanentLockedLiquidityPercentage: 100,
    },
    lockedVesting: {
      totalLockedVestingAmount: 0,
      numberOfVestingPeriod: 0,
      cliffUnlockAmount: 0,
      totalVestingDuration: 0,
      cliffDurationFromMigrationTime: 0,
    },
    activationType: ActivationType.Timestamp,
    initialMarketCap: s.initialMarketCapQuote,
    migrationMarketCap: s.migrationMarketCapQuote,
  } as Parameters<typeof buildCurveWithMarketCap>[0]);
}

/**
 * Builds the launch transaction. Defaults: SPL token, 6 base / 9 quote decimals, migrates to
 * DAMM v2, creator LP permanently locked, immutable token metadata authority.
 *
 * Per Meteora's SDK reference, createConfigAndPool lives on the PARTNER service (it builds
 * one transaction that both creates the config and initializes the pool in a single step) —
 * not on the pool service, which only handles swaps.
 */
export async function buildCreatePoolTransaction(
  input: CreatePoolInput,
  connection: Connection = getConnection()
) {
  const client = getDbcClient(connection);
  const payer = new PublicKey(input.creator);
  const configKeypair = Keypair.generate();
  const baseMintKeypair = Keypair.generate();

  const curveConfig = buildCurveConfig({
    totalSupply: input.totalSupply,
    initialMarketCapQuote: input.initialMarketCapQuote,
    migrationMarketCapQuote: input.migrationMarketCapQuote,
    startingFeeBps: input.feeSchemeBps,
  });

  const quoteMint = new PublicKey(NATIVE_SOL_MINT);

  const createPoolTx = await (client as any).partner.createConfigAndPool({
    payer,
    config: configKeypair.publicKey,
    feeClaimer: payer,
    leftoverReceiver: payer,
    quoteMint,
    ...curveConfig,
    preCreatePoolParam: {
      baseMint: baseMintKeypair.publicKey,
      name: input.name,
      symbol: input.symbol,
      uri: input.imageUrl ?? "",
      poolCreator: payer,
    },
  });

  const poolAddress = deriveDbcPoolAddress(quoteMint, baseMintKeypair.publicKey, configKeypair.publicKey);
  const quoteThreshold =
    Number((curveConfig as any).migrationQuoteThreshold?.toString?.() ?? 0) / 10 ** QUOTE_DECIMALS;

  return { configKeypair, baseMintKeypair, poolAddress, createPoolTx, quoteThreshold };
}

export async function fetchPoolState(poolAddress: string, connection: Connection = getConnection()) {
  const client = getDbcClient(connection);
  const poolRaw = await client.state.getPool(new PublicKey(poolAddress));
  if (!poolRaw) return null;
  const pool = unwrap<any>(poolRaw);
  const configRaw = await client.state.getPoolConfig(pool.config);
  if (!configRaw) return null;
  const config = unwrap<any>(configRaw);
  return { pool, config };
}

/** Converts a human amount to raw units without floating-point drift. */
export function toRawAmount(amount: number, decimals: number): BN {
  return new BN(BigInt(Math.round(amount * 10 ** decimals)).toString());
}

export interface SwapQuoteResult {
  amountIn: BN;
  expectedOut: BN;
  minimumOut: BN;
  outDecimals: number;
}

/**
 * Quotes a swap using swap2/swapQuote2 — per Meteora's SDK reference, this is the "preferred"
 * pair over the legacy swap()/swapQuote() (which don't support SwapMode and have a less
 * clearly documented shape). NOTE: the input amount is converted using the decimals of the
 * token being SOLD (base = 6 decimals when selling the token, quote = 9 when buying with SOL).
 */
export async function buildSwapQuote(params: {
  poolAddress: string;
  amountIn: number; // human units
  swapBaseForQuote: boolean; // true = selling the token
  slippageBps: number;
  referralTokenAccount?: PublicKey | null;
  connection?: Connection;
}): Promise<SwapQuoteResult> {
  const connection = params.connection ?? getConnection();
  const client = getDbcClient(connection);
  const poolRaw = await client.state.getPool(new PublicKey(params.poolAddress));
  if (!poolRaw) throw new Error("Pool not found on-chain.");
  const virtualPool = unwrap<any>(poolRaw);
  const configRaw = await client.state.getPoolConfig(virtualPool.config);
  if (!configRaw) throw new Error("Pool config not found on-chain.");
  const config = unwrap<any>(configRaw);
  const currentPoint = await getCurrentPoint(connection, config.activationType);

  const baseDecimals = Number(config.tokenDecimal ?? BASE_DECIMALS);
  const inDecimals = params.swapBaseForQuote ? baseDecimals : QUOTE_DECIMALS;
  const outDecimals = params.swapBaseForQuote ? QUOTE_DECIMALS : baseDecimals;
  const amountIn = toRawAmount(params.amountIn, inDecimals);

  // IMPORTANT: swapQuote2 expects the RAW shapes exactly as getPool()/getPoolConfig() return
  // them (e.g. { poolState: {...} }), not the flattened versions above — those are only for
  // this function's own field reads (activationType, tokenDecimal). Passing the flattened
  // version here was the actual cause of "Cannot read properties of undefined (reading
  // 'quoteReserve')": the SDK internally expects virtualPool.poolState.quoteReserve.
  const quote: any = (client as any).pool.swapQuote2({
    virtualPool: poolRaw,
    config: configRaw,
    swapBaseForQuote: params.swapBaseForQuote,
    hasReferral: Boolean(params.referralTokenAccount),
    eligibleForFirstSwapWithMinFee: false,
    currentPoint,
    slippageBps: params.slippageBps,
    swapMode: SwapMode.ExactIn,
    amountIn,
  });

  const expectedOut: BN = quote.amountOut ?? quote.outputAmount ?? quote.swapOutAmount;
  const minimumOut: BN =
    quote.minimumAmountOut ?? expectedOut.mul(new BN(10_000 - params.slippageBps)).div(new BN(10_000));
  return { amountIn, expectedOut, minimumOut, outDecimals };
}

export async function buildSwapTransaction(params: {
  poolAddress: string;
  owner: string;
  amountIn: BN;
  minimumAmountOut: BN;
  swapBaseForQuote: boolean;
  referralTokenAccount?: PublicKey | null;
  connection?: Connection;
}) {
  const connection = params.connection ?? getConnection();
  const client = getDbcClient(connection);
  return (client as any).pool.swap2({
    owner: new PublicKey(params.owner),
    pool: new PublicKey(params.poolAddress),
    swapBaseForQuote: params.swapBaseForQuote,
    amountIn: params.amountIn,
    minimumAmountOut: params.minimumAmountOut,
    swapMode: SwapMode.ExactIn,
    referralTokenAccount: params.referralTokenAccount ?? null,
  });
}
