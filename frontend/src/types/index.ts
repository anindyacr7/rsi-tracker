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

export interface Alert {
  symbol: string;
  first_hit_time: number;
  first_rsi_value: number;
  max_rsi_value: number;
  percent_move_24h: number;
  mcap_rank: number | null;
  last_notified_at: number;
  created_at: number;
}
