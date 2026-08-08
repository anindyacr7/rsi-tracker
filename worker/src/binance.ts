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
  errors?: string[];
}

const fetchOptions = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
};

export async function fetchValidUSDTPairs(proxyUrl?: string, dataSource: string = 'binance', targetSymbols?: string[]): Promise<TickerDiscoveryResult> {
  let tickers: Ticker24h[] = [];
  let provider: PriceProvider = dataSource === 'bybit' ? 'bybit' : 'binance-data';

  let errors: string[] = [];

  // 1. Try Binance Proxy if provided (only if binance data source)
  if (dataSource === 'binance' && proxyUrl) {
    try {
      const urlPath = `/api/v3/ticker/24hr`;
      const res = await fetch(`${proxyUrl}/api/binance?path=${encodeURIComponent(urlPath)}`, fetchOptions);
      if (res.ok) {
        tickers = await res.json() as Ticker24h[];
        provider = 'binance-api';
      } else {
        errors.push(`Proxy API Status: ${res.status}`);
      }
    } catch (e: any) {
      errors.push(`Proxy API Error: ${e.message}`);
    }
  }

  // 2. Try Binance Data API (Downloads all symbols if filter fails)
  if (tickers.length === 0 && dataSource === 'binance') {
    try {
      const res = await fetch('https://data-api.binance.vision/api/v3/ticker/24hr', fetchOptions);
      if (res.ok) {
        tickers = await res.json() as Ticker24h[];
        provider = 'binance-data';
      } else {
        errors.push(`Data API Status: ${res.status}`);
      }
    } catch (e: any) {
      errors.push(`Data API Error: ${e.message}`);
    }
  }

  // 3. Try Binance API (rotating subdomains)
  if (tickers.length === 0 && dataSource === 'binance') {
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
        } else {
          errors.push(`Binance API ${base} Status: ${res.status}`);
        }
      } catch (e: any) {
        errors.push(`Binance API ${base} Error: ${e.message}`);
        continue;
      }
    }
  }

  // 3. Fallback to KuCoin
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

  // 4. Try Bybit (if data source is bybit, or as a last fallback)
  if (tickers.length === 0 && (dataSource === 'bybit' || provider === 'binance-data')) {
    try {
      // Use spot category for Bybit as requested in the plan
      const res = await fetch('https://api.bybit.com/v5/market/tickers?category=spot');
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
      } else {
        errors.push(`Bybit API Status: ${res.status}`);
      }
    } catch (e: any) {
      errors.push(`Bybit API Error: ${e.message}`);
    }
  }

  // 5. Try KuCoin
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
      } else {
        errors.push(`Kucoin API Status: ${res.status}`);
      }
    } catch (e: any) {
      errors.push(`Kucoin API Error: ${e.message}`);
    }
  }

  if (tickers.length === 0) {
    console.error('Ticker Fetch Errors:', JSON.stringify(errors));
    throw new Error('All Ticker APIs (Binance, Bybit, Kucoin) are failing or blocked. Check console for details.');
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

  return { provider, tickers: usdtPairs, errors };
}

export async function fetchKlines(
  symbol: string,
  interval: string,
  limit: number = 150,
  provider: PriceProvider = 'binance-data',
  proxyUrl?: string
): Promise<number[]> {
  if (provider === 'binance-data') {
    let res = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`, fetchOptions);
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 1000));
      res = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`, fetchOptions);
    }
    if (!res.ok) throw new Error(`Binance Data API error: ${res.status}`);
    const data: any[][] = await res.json() as any[][];
    return data.map((k) => parseFloat(k[4]));
  }

  if (provider === 'binance-api') {
    if (proxyUrl) {
      const res = await fetch(`${proxyUrl}/api/binance?path=/api/v3/klines&symbol=${symbol}&interval=${interval}&limit=${limit}`, fetchOptions);
      if (res.ok) {
        const data: any[][] = await res.json() as any[][];
        return data.map((k) => parseFloat(k[4]));
      }
      
      // PER-TOKEN FALLBACK: If Binance Proxy fails (e.g. token not on Binance anymore), try KuCoin
      console.warn(`[Proxy Fallback] Binance Proxy failed for ${symbol} with status ${res.status}, falling back to KuCoin...`);
      try {
        const kucoinSymbol = symbol.replace('USDT', '-USDT');
        const fallbackRes = await fetch(`https://api.kucoin.com/api/v1/market/candles?type=${interval}in&symbol=${kucoinSymbol}`);
        if (fallbackRes.ok) {
          const json: any = await fallbackRes.json();
          if (json.code === "200000" && json.data) {
            return json.data.slice(0, limit).map((k: any) => parseFloat(k[2])).reverse();
          }
        }
      } catch(e) {}
      
      throw new Error(`Binance Proxy error: ${res.status} and KuCoin fallback failed.`);
    }

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
    
    // PER-TOKEN FALLBACK: Try KuCoin
    console.warn(`[API Fallback] Binance API failed for ${symbol}, falling back to KuCoin...`);
    try {
      const kucoinSymbol = symbol.replace('USDT', '-USDT');
      const fallbackRes = await fetch(`https://api.kucoin.com/api/v1/market/candles?type=${interval}in&symbol=${kucoinSymbol}`);
      if (fallbackRes.ok) {
        const json: any = await fallbackRes.json();
        if (json.code === "200000" && json.data) {
          return json.data.slice(0, limit).map((k: any) => parseFloat(k[2])).reverse();
        }
      }
    } catch(e) {}

    throw new Error(`Binance API error: ${lastErr} and KuCoin fallback failed.`);
  }

  if (provider === 'bybit') {
    const bybitInterval = interval.replace('m', '');
    const res = await fetch(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${bybitInterval}&limit=${limit}`);
    if (!res.ok) throw new Error(`Bybit API error: ${res.status}`);
    const json: any = await res.json();
    if (json.retCode === 0 && json.result && json.result.list) {
      const data = json.result.list;
      // Bybit returns newest first, so we reverse it to match Binance's oldest-first format
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

export async function fetchKlinesBatch(
  symbols: string[],
  interval: string,
  limit: number = 150,
  provider: PriceProvider,
  proxyUrl?: string
): Promise<Record<string, number[]>> {
  const results: Record<string, number[]> = {};
  
  if (proxyUrl && (provider === 'binance-api' || provider === 'binance-data')) {
    try {
      const symStr = symbols.join(',');
      const res = await fetch(`${proxyUrl}/api/binance?path=/batch-klines&symbols=${symStr}&interval=${interval}&limit=${limit}`, fetchOptions);
      if (res.ok) {
        const json: Record<string, any[][]> = await res.json() as Record<string, any[][]>;
        for (const sym of Object.keys(json)) {
          if (json[sym] && json[sym].length > 0) {
            results[sym] = json[sym].map((k) => {
              if (Array.isArray(k)) {
                return parseFloat(k[4]);
              }
              return parseFloat(k as unknown as string);
            });
          }
        }
        return results;
      }
    } catch (e) {
      console.warn(`[Batch Proxy] failed, falling back to individual fetching...`, e);
    }
  }

  // Fallback to individual fetching with throttling (5 concurrent)
  for (let i = 0; i < symbols.length; i += 5) {
    const chunk = symbols.slice(i, i + 5);
    const promises = chunk.map(async (symbol) => {
      try {
        results[symbol] = await fetchKlines(symbol, interval, limit, provider, proxyUrl);
      } catch (e) {}
    });
    await Promise.all(promises);
    if (i + 5 < symbols.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  
  return results;
}
