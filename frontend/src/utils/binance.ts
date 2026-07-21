export interface Ticker24h {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
}


export async function fetchValidUSDTPairs(): Promise<Ticker24h[]> {
  const bases = [
    'https://api.binance.com',
    'https://api1.binance.com',
    'https://api2.binance.com',
    'https://api3.binance.com',
    'https://api4.binance.com'
  ];
  
  let res;
  try {
    const provider = localStorage.getItem('apiProvider') || 'binanceApi';
    if (provider === 'binanceData') {
      res = await fetch('https://data-api.binance.vision/api/v3/ticker/24hr');
    } else {
      const base = bases[Math.floor(Math.random() * bases.length)];
      res = await fetch(`${base}/api/v3/ticker/24hr`);
    }
    if (!res.ok) throw new Error(`Status ${res.status}`);
  } catch (err) {
    console.warn(`Primary Binance API failed, falling back to data-api...`, err);
    res = await fetch('https://data-api.binance.vision/api/v3/ticker/24hr');
  }
  
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
  const bases = [
    'https://api.binance.com',
    'https://api1.binance.com',
    'https://api2.binance.com',
    'https://api3.binance.com',
    'https://api4.binance.com'
  ];
  
  let res;
  try {
    const provider = localStorage.getItem('apiProvider') || 'binanceApi';
    if (provider === 'binanceData') {
      res = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    } else {
      const base = bases[Math.floor(Math.random() * bases.length)];
      res = await fetch(`${base}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    }
    if (!res.ok) throw new Error(`Status ${res.status}`);
  } catch (err) {
    // console.warn(`Kline fetch failed for ${symbol}, falling back...`);
    res = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  }

  if (!res.ok) {
    console.error(`Kline fetch completely failed for ${symbol} ${interval}: ${res.status}`);
    return [];
  }

  const data: any[][] = await res.json() as any[][];
  return data.map((k) => parseFloat(k[4]));
}

export interface KlineOHLC {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  value?: number; // for volume
}

export async function fetchKlinesOHLC(
  symbol: string,
  interval: string,
  limit: number = 100
): Promise<{ candles: KlineOHLC[], volume: KlineOHLC[] }> {
  const bases = [
    'https://api.binance.com',
    'https://api1.binance.com',
    'https://api2.binance.com',
    'https://api3.binance.com',
    'https://api4.binance.com'
  ];
  
  let res;
  try {
    const provider = localStorage.getItem('apiProvider') || 'binanceApi';
    if (provider === 'binanceData') {
      res = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    } else {
      const base = bases[Math.floor(Math.random() * bases.length)];
      res = await fetch(`${base}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    }
    if (!res.ok) throw new Error(`Status ${res.status}`);
  } catch (err) {
    res = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  }

  if (!res.ok) {
    console.error(`OHLC fetch failed for ${symbol} ${interval}: ${res.status}`);
    return { candles: [], volume: [] };
  }

  const data: any[][] = await res.json() as any[][];
  
  const candles: KlineOHLC[] = [];
  const volume: KlineOHLC[] = [];
  
  data.forEach(k => {
    // Binance time is ms. lightweight-charts expects Unix timestamp in seconds (if not daily)
    const time = Math.floor(k[0] / 1000); 
    candles.push({
      time,
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
    });
    volume.push({
      time,
      value: parseFloat(k[5]), // volume
      open: 0, high: 0, low: 0, close: parseFloat(k[4]) // satisfy type
    });
  });
  
  return { candles, volume };
}
