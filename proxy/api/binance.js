let klinesCache = {};

export default async function handler(req, res) {
  // CORS Headers for browser access if needed (though CF worker will call it)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { path, symbols, filterSymbols, ...query } = req.query;
    
    // CUSTOM BATCH ENDPOINT to bypass CF 50 subrequest limit
    if (path === '/batch-klines' && symbols) {
      const symbolArray = symbols.split(',');
      const results = {};
      const { interval = '15m', limit = 150 } = query;
      
      const promises = symbolArray.map(async (sym) => {
        const cacheKey = `${sym}-${interval}`;
        let cached = klinesCache[cacheKey];
        let url = `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${interval}&limit=${limit}`;
        
        // If we have a recent cache (less than 1 hour old), just fetch the latest 2 candles to save Origin bandwidth
        if (cached && Date.now() - cached.timestamp < 60 * 60 * 1000) {
          url = `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${interval}&limit=2`;
        }

        try {
          const fetchRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Encoding': 'gzip, deflate, br' } });
          if (fetchRes.ok) {
            const data = await fetchRes.json();
            let finalData = data;

            if (cached && Date.now() - cached.timestamp < 60 * 60 * 1000) {
              const lastCachedTime = cached.klines[cached.klines.length - 1][0];
              const firstNewTime = data[0][0];
              const intervalMs = interval === '15m' ? 15 * 60 * 1000 : 60 * 60 * 1000;
              
              // Ensure there is no missing gap of candles
              if (firstNewTime > lastCachedTime + intervalMs) {
                // Gap detected! Re-fetch full history.
                const fullRes = await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${interval}&limit=${limit}`, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Encoding': 'gzip, deflate, br' } });
                if (fullRes.ok) {
                  const fullData = await fullRes.json();
                  klinesCache[cacheKey] = { timestamp: Date.now(), klines: fullData };
                  finalData = fullData;
                }
              } else {
                for (const newCandle of data) {
                  const newTime = newCandle[0];
                  const existingIndex = cached.klines.findIndex(c => c[0] === newTime);
                  if (existingIndex !== -1) {
                    cached.klines[existingIndex] = newCandle;
                  } else {
                    cached.klines.push(newCandle);
                  }
                }
                if (cached.klines.length > limit) {
                  cached.klines = cached.klines.slice(-limit);
                }
                finalData = cached.klines;
                cached.timestamp = Date.now();
              }
            } else {
              klinesCache[cacheKey] = {
                timestamp: Date.now(),
                klines: finalData
              };
            }

            // Optimize payload: only return close prices (index 4) to save Vercel bandwidth
            results[sym] = finalData.map(k => k[4]);
          }
        } catch(e) {}
      });
      
      await Promise.all(promises);
      return res.status(200).json(results);
    }

    if (!path) {
      return res.status(400).json({ error: 'Missing path parameter' });
    }

    // Reconstruct the query string
    const queryString = new URLSearchParams(query).toString();
    const targetUrl = `https://api.binance.com${path}${queryString ? '?' + queryString : ''}`;

    const fetchRes = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept-Encoding': 'gzip, deflate, br'
      },
    });

    let data = await fetchRes.json();
    
    // BANDWIDTH OPTIMIZATION: If this is the 24hr ticker, strip out all unused fields!
    // The Binance payload is 2.5MB, but we only need 4 fields. This brings it down to ~40KB compressed!
    if (path === '/api/v3/ticker/24hr' && Array.isArray(data)) {
      data = data.map((t) => ({
        symbol: t.symbol,
        lastPrice: t.lastPrice,
        priceChangePercent: t.priceChangePercent,
        quoteVolume: t.quoteVolume
      }));
    }

    return res.status(fetchRes.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
