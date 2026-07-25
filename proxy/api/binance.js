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
    const { path, symbols, ...query } = req.query;
    
    // CUSTOM BATCH ENDPOINT to bypass CF 50 subrequest limit
    if (path === '/batch-klines' && symbols) {
      const symbolArray = symbols.split(',');
      const results = {};
      const { interval = '15m', limit = 150 } = query;
      
      const promises = symbolArray.map(async (sym) => {
        const url = `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${interval}&limit=${limit}`;
        try {
          const fetchRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          if (fetchRes.ok) {
            results[sym] = await fetchRes.json();
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
      },
    });

    const data = await fetchRes.json();
    return res.status(fetchRes.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
