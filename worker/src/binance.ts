export interface Ticker24h {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
}

export async function fetchValidUSDTPairs(): Promise<Ticker24h[]> {
  const base = 'https://data-api.binance.vision';

  const res = await fetch(`${base}/api/v3/ticker/24hr`);

  if (!res.ok) {
    throw new Error(`Binance ticker API error: ${res.status}`);
  }

  const tickers: Ticker24h[] = await res.json() as Ticker24h[];

  // Filter USDT pairs, exclude leveraged/down tokens and stablecoins
  const usdtPairs = tickers.filter((t) => {
    if (!t.symbol.endsWith('USDT')) return false;
    const baseAsset = t.symbol.replace('USDT', '');
    if (baseAsset.includes('UP') || baseAsset.includes('DOWN') || baseAsset.includes('BEAR') || baseAsset.includes('BULL')) return false;

    const stablecoins = ['USDC', 'FDUSD', 'TUSD', 'DAI', 'EUR', 'AEUR', 'USDP', 'BUSD', 'USDD', 'PYUSD'];
    if (stablecoins.includes(baseAsset)) return false;

    const price = parseFloat(t.lastPrice);
    const change = Math.abs(parseFloat(t.priceChangePercent));
    if (price >= 0.95 && price <= 1.05 && change < 0.2) return false;

    return true;
  });

  usdtPairs.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));

  return usdtPairs;
}

export async function fetchKlines(
  symbol: string,
  interval: string,
  limit: number = 150
): Promise<number[]> {
  const base = 'https://data-api.binance.vision';
  const url = `${base}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

  const res = await fetch(url);

  if (!res.ok) {
    console.error(`Kline fetch failed for ${symbol} ${interval}: ${res.status}`);
    return [];
  }

  const data: any[][] = await res.json() as any[][];
  return data.map((k) => parseFloat(k[4]));
}
