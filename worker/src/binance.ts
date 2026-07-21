export interface Ticker24h {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
}

const fetchOptions = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
};

export async function fetchValidUSDTPairs(): Promise<Ticker24h[]> {
  let res;

  try {
    res = await fetch('https://data-api.binance.vision/api/v3/ticker/24hr', fetchOptions);
  } catch (e) {}

  if (!res || !res.ok) {
    const bases = [
      'https://api.binance.com',
      'https://api1.binance.com',
      'https://api2.binance.com',
      'https://api3.binance.com',
      'https://api4.binance.com'
    ];
    
    for (const base of bases) {
      try {
        res = await fetch(`${base}/api/v3/ticker/24hr`, fetchOptions);
        if (res.ok) break;
      } catch (e) {
        continue;
      }
    }
  }

  if (!res || !res.ok) {
    throw new Error(`Binance ticker API error: ${res ? res.status : 'Network Error'}`);
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
  let res;
  let lastError = 'Network Error';

  // Try data-api first as it is less sensitive
  try {
    res = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`, fetchOptions);
    if (!res.ok) lastError = `data-api: ${res.status}`;
  } catch (e: any) {
    lastError = `data-api network error: ${e.message}`;
  }

  if (!res || !res.ok) {
    const bases = [
      'https://api.binance.com',
      'https://api1.binance.com',
      'https://api2.binance.com',
      'https://api3.binance.com',
      'https://api4.binance.com'
    ];
    
    for (const base of bases) {
      try {
        res = await fetch(`${base}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`, fetchOptions);
        if (res.ok) break;
        lastError = `${base}: ${res.status}`;
      } catch (e: any) {
        lastError = `${base} network error: ${e.message}`;
        continue;
      }
    }
  }

  if (!res || !res.ok) {
    throw new Error(`Kline fetch failed for ${symbol} ${interval}. Last Error: ${lastError}`);
  }

  const data: any[][] = await res.json() as any[][];
  return data.map((k) => parseFloat(k[4]));
}
