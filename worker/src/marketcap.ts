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

export async function fetchMarketCaps(): Promise<MarketCapResult> {

  let mcapMap = new Map<string, { mcap: number, rank: number }>();

  // 1. Try CoinMarketCap API keys
  for (const key of CMC_KEYS) {
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
  }
}
}
