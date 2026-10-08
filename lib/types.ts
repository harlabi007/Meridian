export interface PoolSummary {
  address: string;
  baseMint: string;
  quoteMint: string;
  name: string;
  symbol: string;
  imageUrl: string | null;
  creator: string;
  createdAt: string; // ISO timestamp
  progressPct: number; // 0-100, curve progress toward migration threshold
  priceQuote: number; // current price in quote token
  marketCapQuote: number;
  quoteReserve: number;
  migrationThresholdQuote: number;
  volume24hQuote: number;
  migrated: boolean;
  migratedTo: "damm_v1" | "damm_v2" | null;
  priceChangePct24h: number | null;
}

export interface PoolDetail extends PoolSummary {
  baseDecimals: number;
  quoteDecimals: number;
  totalSupply: number;
  circulatingSupply: number;
  curvePoints: CurvePoint[];
  holderCount: number;
}

export interface CurvePoint {
  progressPct: number;
  priceQuote: number;
}

export interface TradeEvent {
  id: string;
  poolAddress: string;
  signature: string;
  side: "buy" | "sell";
  trader: string;
  baseAmount: number;
  quoteAmount: number;
  priceQuote: number;
  timestamp: string; // ISO
}

export interface CreatePoolInput {
  name: string;
  symbol: string;
  imageUrl?: string;
  description?: string;
  initialMarketCapQuote: number;
  migrationMarketCapQuote: number;
  totalSupply: number;
  quoteMint: "SOL" | "USDC";
  feeSchemeBps: number;
  creator: string;
}

export interface PlatformStats {
  totalPools: number;
  migratedCount: number;
  totalMarketCapQuote: number;
  totalRaisedQuote: number;
}

export interface SnapshotRow {
  priceQuote: number;
  progressPct: number;
  takenAt: string;
}

export interface ActivityResponse {
  source: "events" | "snapshots";
  trades?: TradeEvent[];
  snapshots?: SnapshotRow[];
}
