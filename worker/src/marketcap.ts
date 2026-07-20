/**
 * Market Cap API helper using CoinMarketCap with Coinlore fallback.
 */

export interface CoinloreData {
  data: Array<{
    symbol: string;
    market_cap_usd: string;
    rank: number;
  }>;
}

export interface CmcData {
  data: Array<{
    symbol: string;
    cmc_rank: number;
    quote: {
      USD: {
        market_cap: number;
      }
    }
  }>;
}

export interface MarketCapResult {
  mcapMap: Map<string, { mcap: number, rank: number }>;
  source: 'cmc' | 'coinlore';
}

const CMC_KEYS = [
  '254083ec6bda45168fd4cbdd7f4a10bd',
  'e138e806ea0d479d93efb9dae20b2a86'
];

export async function fetchMarketCaps(keyIndex?: 0 | 1 | -1, db?: any): Promise<MarketCapResult> {

  let mcapMap = new Map<string, { mcap: number, rank: number }>();

  // Check D1 cache first if db is provided
  if (db) {
    try {
      const cacheRow = await db.prepare('SELECT data, updated_at FROM mcap_cache WHERE id = 1').first();
      const now = Date.now();
      // If cache exists and is less than 15 minutes old
      if (cacheRow && (now - cacheRow.updated_at) < 15 * 60 * 1000) {
        const cachedArray = JSON.parse(cacheRow.data);
        for (const coin of cachedArray) {
          mcapMap.set(coin.symbol, { mcap: coin.mcap, rank: coin.rank });
        }
        return { mcapMap, source: 'cmc' };
      }
    } catch (e) {
      console.error('Failed to read from D1 cache:', e);
    }
  }

  // 1. Try CoinMarketCap API keys (skip if keyIndex is -1)
  const keysToTry = keyIndex === -1 ? [] : (keyIndex !== undefined ? [CMC_KEYS[keyIndex]] : CMC_KEYS);
  for (const key of keysToTry) {
    try {
      const url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?limit=200';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'X-CMC_PRO_API_KEY': key
        }
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json() as CmcData;
        if (json && json.data) {
          for (const coin of json.data) {
            if (coin.quote?.USD?.market_cap != null) {
              mcapMap.set(coin.symbol.toUpperCase(), {
                mcap: coin.quote.USD.market_cap,
                rank: coin.cmc_rank
              });
            }
          }

          // Alias handling for mismatched tickers
          if (mcapMap.has('TON')) mcapMap.set('GRAM', mcapMap.get('TON')!);
          if (mcapMap.has('MIOTA')) mcapMap.set('IOTA', mcapMap.get('MIOTA')!);

          // Save to D1 cache
          if (db) {
            try {
              const arrayToCache = Array.from(mcapMap.entries()).map(([sym, data]) => ({
                symbol: sym,
                mcap: data.mcap,
                rank: data.rank
              }));
              await db.prepare('INSERT OR REPLACE INTO mcap_cache (id, data, updated_at) VALUES (1, ?, ?)')
                .bind(JSON.stringify(arrayToCache), Date.now())
                .run();
            } catch (e) {
              console.error('Failed to write to D1 cache:', e);
            }
          }

          return { mcapMap, source: 'cmc' };
        }
      } else {
        console.warn(`CMC API error with key ${key.substring(0, 5)}...: ${res.status}`);
      }
    } catch (err) {
      console.warn(`Failed to fetch from CMC with key ${key.substring(0, 5)}...:`, err);
    }
  }

  // 2. Fallback to Coinlore if both keys fail or are exhausted
  try {
    const pages = [0, 100]; // covers top 200 to safely extract 130

    await Promise.all(pages.map(async (start) => {
      const url = `https://api.coinlore.net/api/tickers/?start=${start}&limit=100`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json() as CoinloreData;
        if (json && json.data) {
          for (const coin of json.data) {
            mcapMap.set(coin.symbol.toUpperCase(), {
              mcap: parseFloat(coin.market_cap_usd),
              rank: coin.rank
            });
          }
        }
      }
    }));

    // Alias handling for fallback
    if (mcapMap.has('TON')) mcapMap.set('GRAM', mcapMap.get('TON')!);
    if (mcapMap.has('MIOTA')) mcapMap.set('IOTA', mcapMap.get('MIOTA')!);

    return { mcapMap, source: 'coinlore' };
  } catch (err) {
    console.warn('Failed to fetch from Coinlore:', err);
    // Even on error, return the empty map to avoid throwing unhandled exceptions
    return { mcapMap, source: 'coinlore' };
  }}
