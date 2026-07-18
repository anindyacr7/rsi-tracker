/**
 * Crypto RSI Scanner — Cloudflare Worker
 *
 * GET /api/scan → Fetches top Market Caps from CoinMarketCap/Coinlore.
 * Binance logic is now handled in the frontend to bypass Worker limits.
 */

import { fetchMarketCaps } from './marketcap';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === '/api/scan' && request.method === 'GET') {
      return handleScan();
    }

    // Health check
    if (url.pathname === '/api/health') {
      return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
    }

    return jsonResponse({ error: 'Not Found' }, 404);
  },
};

async function handleScan(): Promise<Response> {
  try {
    const { mcapMap, source } = await fetchMarketCaps();

    // Convert Map to an array of objects
    const results = Array.from(mcapMap.entries()).map(([base, data]) => ({
      base,
      mcap: data.mcap,
      rank: data.rank,
    }));

    return jsonResponse({ data: results, meta: { mcapSource: source } });
  } catch (err: any) {
    console.error('Scan error:', err);
    return jsonResponse(
      { error: 'Failed to fetch data', message: err?.message ?? 'Unknown error' },
      500
    );
  }
}

function jsonResponse(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
  });
}
