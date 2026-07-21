export interface Ticker24h {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
}

export type PriceProvider = 'binance-data' | 'binance-api' | 'bybit' | 'kucoin';

export interface TickerDiscoveryResult {
  provider: PriceProvider;
  tickers: Ticker24h[];
}

const fetchOptions = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
};

export async function fetchValidUSDTPairs(): Promise<TickerDiscoveryResult> {
  let tickers: Ticker24h[] = [];
  let provider: PriceProvider = 'binance-data';

  // 1. Try Binance Data API
  try {
    const res = await fetch('https://data-api.binance.vision/api/v3/ticker/24hr', fetchOptions);
    if (res.ok) {
      tickers = await res.json() as Ticker24h[];
      provider = 'binance-data';
    }
  } catch (e) {}

  // 2. Try Binance API (rotating subdomains)
  if (tickers.length === 0) {
    const bases = [
      'https://api.binance.com',
      'https://api1.binance.com',
      'https://api2.binance.com',
      'https://api3.binance.com',
      'https://api4.binance.com'
    ];
    for (const base of bases) {
      try {
        const res = await fetch(`${base}/api/v3/ticker/24hr`, fetchOptions);
        if (res.ok) {
          tickers = await res.json() as Ticker24h[];
          provider = 'binance-api';
          break;
        }
      } catch (e) {
        continue;
      }
    }
  }

  // 3. Fallback to Bybit
  if (tickers.length === 0) {
    try {
      const res = await fetch('https://api.bybit.com/v5/market/tickers?category=linear');
      if (res.ok) {
        const json: any = await res.json();
        if (json.retCode === 0 && json.result && json.result.list) {
          tickers = json.result.list.map((t: any) => ({
            symbol: t.symbol,
            lastPrice: t.lastPrice,
            priceChangePercent: (parseFloat(t.price24hPcnt) * 100).toString(),
            quoteVolume: t.turnover24h
          }));
          provider = 'bybit';
        }
      }
    } catch (e) {}
  }

  // 4. Fallback to KuCoin
  if (tickers.length === 0) {
    try {
      const res = await fetch('https://api.kucoin.com/api/v1/market/allTickers');
      if (res.ok) {
        const json: any = await res.json();
        if (json.code === "200000" && json.data && json.data.ticker) {
          tickers = json.data.ticker.map((t: any) => ({
            symbol: t.symbol.replace('-', ''),
            lastPrice: t.last,
            priceChangePercent: (parseFloat(t.changeRate) * 100).toString(),
            quoteVolume: t.volValue
          }));
          provider = 'kucoin';
        }
      }
    } catch (e) {}
  }

  if (tickers.length === 0) {
    throw new Error('All Ticker APIs (Binance, Bybit, Kucoin) are failing or blocked.');
  }

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

  return { provider, tickers: usdtPairs };
}

export async function fetchKlines(
  symbol: string,
  interval: string,
  limit: number = 150,
  provider: PriceProvider = 'binance-data'
): Promise<number[]> {
  if (provider === 'binance-data') {
    const res = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`, fetchOptions);
    if (!res.ok) throw new Error(`Binance Data API error: ${res.status}`);
    const data: any[][] = await res.json() as any[][];
    return data.map((k) => parseFloat(k[4]));
  }

  if (provider === 'binance-api') {
    const bases = [
      'https://api.binance.com',
      'https://api1.binance.com',
      'https://api2.binance.com',
      'https://api3.binance.com',
      'https://api4.binance.com'
    ];
    let lastErr = 'Network Error';
    for (const base of bases) {
      try {
        const res = await fetch(`${base}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`, fetchOptions);
        if (res.ok) {
          const data: any[][] = await res.json() as any[][];
          return data.map((k) => parseFloat(k[4]));
        }
        lastErr = `${res.status}`;
      } catch (e: any) {
        lastErr = e.message;
      }
    }
    throw new Error(`Binance API error: ${lastErr}`);
  }

  if (provider === 'bybit') {
    const bybitInterval = interval.replace('m', '');
    const res = await fetch(`https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=${bybitInterval}&limit=${limit}`);
    if (!res.ok) throw new Error(`Bybit API error: ${res.status}`);
    const json: any = await res.json();
    if (json.retCode === 0 && json.result && json.result.list) {
      const data = json.result.list;
      return data.map((k: any) => parseFloat(k[4])).reverse();
    }
    throw new Error(`Bybit API malformed data: ${JSON.stringify(json)}`);
  }

  if (provider === 'kucoin') {
    const kucoinSymbol = symbol.replace('USDT', '-USDT');
    const res = await fetch(`https://api.kucoin.com/api/v1/market/candles?type=${interval}in&symbol=${kucoinSymbol}`);
    if (!res.ok) throw new Error(`Kucoin API error: ${res.status}`);
    const json: any = await res.json();
    if (json.code === "200000" && json.data) {
      // KuCoin returns [time, open, close, high, low, volume, turnover]
      // Newest first. We want close price (index 2).
      const data = json.data;
      return data.slice(0, limit).map((k: any) => parseFloat(k[2])).reverse();
    }
    throw new Error(`Kucoin API malformed data: ${JSON.stringify(json)}`);
  }

  throw new Error(`Unsupported provider: ${provider}`);
}
