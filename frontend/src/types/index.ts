export interface ScanResult {
  symbol: string;
  price: number;
  percentMove24h: number;
  volume24h: number;
  mcap: number | null;
  cmcRank: number | null;
  rsi15m: number | null;
  rsi4h: number | null;
  rsi24h: number | null;
}

export type SortField = keyof ScanResult | null;
export type SortDirection = 'asc' | 'desc';
