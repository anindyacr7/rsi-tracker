import { fetchMarketCaps } from './marketcap';
import { fetchValidUSDTPairs, fetchKlines, fetchKlinesBatch } from './binance';
import { calculateRSI } from './rsi';
import * as webpush from 'web-push';

export const APP_VERSION = 'v1.0.1';

export interface Env {
  DB: any; // D1Database
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  BINANCE_PROXY_URL?: string;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === '/api/subscribe' && request.method === 'POST') {
      return handleSubscribe(request, env);
    }

    if (url.pathname === '/api/unsubscribe' && request.method === 'POST') {
      return handleUnsubscribe(request, env);
    }

    if (url.pathname === '/api/scan' && request.method === 'GET') {
      return handleScan(request);
    }

    if (url.pathname === '/api/force-run' && request.method === 'POST') {
      ctx.waitUntil(handleCron(env, true));
      return jsonResponse({ status: 'ok', message: 'Cron job manually triggered in the background' });
    }

    if (url.pathname === '/api/alerts') {
      if (request.method === 'GET') return handleAlerts(env);
      if (request.method === 'DELETE') return handleClearAlerts(request, env);
    }

    if (url.pathname === '/api/alerts/restore' && request.method === 'POST') {
      return handleRestoreAlerts(env);
    }

    if (url.pathname === '/api/settings') {
      if (request.method === 'GET') return handleGetSettings(env);
      if (request.method === 'PUT') return handlePutSettings(request, env);
    }

    if (url.pathname === '/api/test-binance' && request.method === 'GET') {
      try {
        const { provider } = await fetchValidUSDTPairs();
        const closes = await fetchKlines('BTCUSDT', '15m', 150, provider);
        return jsonResponse({ status: 'ok', data: closes, length: closes.length, provider });
      } catch (err: any) {
        return jsonResponse({ status: 'error', message: err.message }, 500);
      }
    }

    if (url.pathname === '/api/health') {
      return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
    }

    if (url.pathname === '/api/test-notification' && request.method === 'GET') {
      try {
        const thresholdRecord = await env.DB.prepare("SELECT value FROM global_settings WHERE key = 'rsi_threshold'").first();
        const rsiThreshold = thresholdRecord ? parseFloat(thresholdRecord.value as string) : 75;

        let activeProvider = 'Unknown';
        let top5: { symbol: string, rsi: number }[] = [];

        try {
          const { mcapMap } = await fetchMarketCaps(undefined, env.DB);
          const { provider, tickers: allTickers } = await fetchValidUSDTPairs(env.BINANCE_PROXY_URL);
          activeProvider = provider;

          const tickers = allTickers.filter(t => {
            const rank = mcapMap.get(t.symbol.replace('USDT', ''))?.rank;
            return rank && rank <= 200;
          });

          const results: { symbol: string, rsi: number }[] = [];
          const CHUNK_SIZE = 20;
          for (let i = 0; i < tickers.length; i += CHUNK_SIZE) {
            const chunk = tickers.slice(i, i + CHUNK_SIZE);
            const chunkSymbols = chunk.map(t => t.symbol);

            const batchResults = await fetchKlinesBatch(chunkSymbols, '15m', 150, provider, env.BINANCE_PROXY_URL);

            for (const sym of Object.keys(batchResults)) {
              const closes = batchResults[sym];
              if (closes && closes.length > 14) {
                const rsi = calculateRSI(closes, 14);
                if (rsi !== null) {
                  results.push({ symbol: sym, rsi });
                }
              }
            }
            if (i + CHUNK_SIZE < tickers.length) {
              await new Promise(r => setTimeout(r, 200));
            }
          }

          results.sort((a, b) => b.rsi - a.rsi);
          top5 = results.slice(0, 5);
        } catch (e: any) {
          console.error(e);
        }

        let rsiTextList = top5.length > 0
          ? top5.map((t, idx) => `${idx + 1}. #${t.symbol} - ${t.rsi.toFixed(1)}`).join('\n')
          : 'No data fetched.';

        let text = `🚨 <b>TEST RSI ALERT</b> 🚨\nTop 5 Coins (15m):\n${rsiTextList}\nThreshold: ${rsiThreshold}\nProvider: ${activeProvider}\nWorker: ${APP_VERSION}`;
        let webPushText = `[TEST] Top 5: ${top5.map(t => t.symbol.replace('USDT', '')).join(', ')} | Src: ${activeProvider} (v${APP_VERSION})`;

        if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
          await sendTelegramMessage(env, text);
        }
        await sendWebPush(env, webPushText);

        return jsonResponse({ status: 'ok', message: 'Test notification sent.' });
      } catch (err: any) {
        return jsonResponse({ status: 'error', message: err.message }, 500);
      }
    }

    return jsonResponse({ error: 'Not Found' }, 404);
  },

  async scheduled(event: any, env: Env, ctx: any) {
    await handleCron(env);
  }
};

async function handleCron(env: Env, fullScan: boolean = false) {
  try {
    const thresholdRecord = await env.DB.prepare("SELECT value FROM global_settings WHERE key = 'rsi_threshold'").first();
    const rsiThreshold = thresholdRecord ? parseFloat(thresholdRecord.value) : 75;

    // Use keyIndex 0 to match frontend or try both if one fails (undefined tries 0 then 1)
    const { mcapMap } = await fetchMarketCaps(undefined, env.DB);
    const { provider, tickers: allTickers } = await fetchValidUSDTPairs(env.BINANCE_PROXY_URL);

    // Filter tickers by CMC Top 200 to match frontend
    const tickers = allTickers.filter(t => {
      const rank = mcapMap.get(t.symbol.replace('USDT', ''))?.rank;
      return rank && rank <= 200;
    });

    // Check ALL 200 tokens every minute to catch intra-candle spikes!
    // To avoid CPU time limits on Cloudflare Workers, we chunk the promises
    // 200 tokens / 20 chunk size = 10 batches. 10 batches * 0.5s delay = 5 seconds execution time.
    const CHUNK_SIZE = 20;
    for (let i = 0; i < tickers.length; i += CHUNK_SIZE) {
      const chunk = tickers.slice(i, i + CHUNK_SIZE);
      const chunkSymbols = chunk.map(t => t.symbol);

      const batchResults = await fetchKlinesBatch(chunkSymbols, '15m', 150, provider, env.BINANCE_PROXY_URL);

      for (const ticker of chunk) {
        const symbol = ticker.symbol;
        try {
          const closes = batchResults[symbol];
          if (closes && closes.length > 14) {
            const rsi = calculateRSI(closes, 14);
            if (symbol === 'WIFUSDT' || symbol === 'PENGUUSDT' || symbol === 'GRAMUSDT') {
              console.log(`[DEBUG] ${symbol} RSI: ${rsi}`);
            }
            if (rsi !== null && rsi >= rsiThreshold) {
              const rank = mcapMap.get(symbol.replace('USDT', ''))?.rank;
              await processAlert(env, ticker, rsi, rank);
            }
          }
        } catch (e) {
          console.error(`Error processing ${symbol}:`, e);
        }
      }

      if (i + CHUNK_SIZE < tickers.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  } catch (err) {
    console.error('Cron error:', err);
  }
}

async function processAlert(env: Env, ticker: any, rsi: number, rank?: number) {
  const symbol = ticker.symbol;
  const now = Date.now();

  // Check existing record
  const existing = await env.DB.prepare('SELECT * FROM rsi_alerts WHERE symbol = ? ORDER BY created_at DESC LIMIT 1').bind(symbol).first();

  const percentMove24h = parseFloat(ticker.priceChangePercent);

  let shouldUpdateMax = false;
  let shouldNotify = false;

  if (!existing || now - (existing.created_at as number) > 48 * 60 * 60 * 1000) {
    // New or expired, insert new
    await env.DB.prepare(`
      INSERT INTO rsi_alerts (symbol, first_hit_time, first_rsi_value, max_rsi_value, percent_move_24h, mcap_rank, last_notified_at, created_at, is_deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).bind(symbol, now, rsi, rsi, percentMove24h, rank || null, now, now).run();

    await sendTelegramMessage(env, `${symbol}: ${rsi}\n${percentMove24h}% - #${rank || 'N/A'}`);
  } else {
    // Exists within 24h
    let maxRsi = (existing.max_rsi_value as number);

    if (rsi > maxRsi) {
      maxRsi = rsi;
      shouldUpdateMax = true;
    }

    const lastNotified = existing.last_notified_at as number;

    if (now - lastNotified > 60 * 60 * 1000) {
      // Cooldown of 1 hour passed
      shouldNotify = true;
    }

    if (shouldUpdateMax || shouldNotify) {
      await env.DB.prepare(`
        UPDATE rsi_alerts 
        SET max_rsi_value = ?, percent_move_24h = ?, mcap_rank = ?${shouldNotify ? ', last_notified_at = ?' : ''}
        WHERE id = ?
      `).bind(
        maxRsi,
        percentMove24h,
        rank || null,
        ...(shouldNotify ? [now, existing.id] : [existing.id])
      ).run();

      if (shouldNotify) {
        await sendTelegramMessage(env, `${symbol}: ${rsi}\n${percentMove24h}% - #${rank || 'N/A'}`);
      }
    }
  }

  if (!existing || now - (existing.created_at as number) > 48 * 60 * 60 * 1000 || shouldUpdateMax || shouldNotify) {
    const text = `${symbol}: ${rsi}\n${percentMove24h}% - #${rank || 'N/A'}`;
    await sendWebPush(env, text);
  }
}

async function sendWebPush(env: Env, text: string) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;

  webpush.setVapidDetails(
    env.VAPID_SUBJECT || 'mailto:admin@example.com',
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  );

  try {
    const subs = await env.DB.prepare('SELECT * FROM push_subscriptions').all();
    if (subs.results.length === 0) return;

    const payload = JSON.stringify({ title: '🚨 RSI Alert 🚨', body: text });

    const pushPromises = subs.results.map(async (sub: any) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      };
      try {
        await webpush.sendNotification(pushSubscription, payload);
      } catch (e: any) {
        if (e.statusCode === 410 || e.statusCode === 404) {
          await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(sub.endpoint).run();
        } else {
          console.error('Push error:', e);
        }
      }
    });
    await Promise.all(pushPromises);
  } catch (e) {
    console.error('Failed to fetch subscriptions', e);
  }
}

async function sendTelegramMessage(env: Env, text: string) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' })
    });
    if (!res.ok) {
      console.error("Telegram API Error:", await res.text());
    }
  } catch (e) {
    console.error("Telegram error:", e);
  }
}

async function handleScan(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const mcapProvider = url.searchParams.get('mcapProvider');
    const keyIndex = mcapProvider === 'coinlore' ? -1 : 0;

    const { mcapMap, source } = await fetchMarketCaps(keyIndex);

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

async function handleAlerts(env: Env): Promise<Response> {
  try {
    const result = await env.DB.prepare('SELECT * FROM rsi_alerts ORDER BY created_at DESC').all();
    return jsonResponse({ data: result.results });
  } catch (err: any) {
    console.error('Alerts error:', err);
    return jsonResponse({ error: 'Failed to fetch alerts', message: err?.message ?? 'Unknown error' }, 500);
  }
}

async function handleClearAlerts(request: Request, env: Env): Promise<Response> {
  try {
    let body: any = {};
    if (request.headers.get('content-type')?.includes('application/json')) {
      body = await request.json().catch(() => ({}));
    }

    const columns = 'symbol, first_hit_time, first_rsi_value, max_rsi_value, percent_move_24h, mcap_rank, last_notified_at, created_at, is_deleted';
    if (body.symbols && Array.isArray(body.symbols) && body.symbols.length > 0) {
      const placeholders = body.symbols.map(() => '?').join(',');
      await env.DB.prepare(`INSERT OR REPLACE INTO rsi_alerts_backup (${columns}) SELECT ${columns} FROM rsi_alerts WHERE symbol IN (${placeholders})`).bind(...body.symbols).run();
      await env.DB.prepare(`DELETE FROM rsi_alerts WHERE symbol IN (${placeholders})`).bind(...body.symbols).run();
    } else if (body.clearAll === true) {
      await env.DB.prepare(`INSERT OR REPLACE INTO rsi_alerts_backup (${columns}) SELECT ${columns} FROM rsi_alerts`).run();
      await env.DB.prepare('DELETE FROM rsi_alerts').run();
    } else {
      return jsonResponse({ error: 'Invalid request: must provide symbols array or clearAll flag' }, 400);
    }
    return jsonResponse({ status: 'ok' });
  } catch (err: any) {
    console.error('Clear alerts error:', err);
    return jsonResponse({ error: 'Failed to clear alerts', message: err?.message ?? 'Unknown error' }, 500);
  }
}

async function handleRestoreAlerts(env: Env): Promise<Response> {
  try {
    const columns = 'symbol, first_hit_time, first_rsi_value, max_rsi_value, percent_move_24h, mcap_rank, last_notified_at, created_at, is_deleted';
    await env.DB.prepare(`INSERT OR IGNORE INTO rsi_alerts (${columns}) SELECT ${columns} FROM rsi_alerts_backup`).run();
    return jsonResponse({ status: 'ok' });
  } catch (err: any) {
    console.error('Restore alerts error:', err);
    return jsonResponse({ error: 'Failed to restore alerts', message: err?.message ?? 'Unknown error' }, 500);
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

async function handleSubscribe(request: Request, env: Env) {
  try {
    const body = await request.json() as any;
    const { endpoint, keys } = body;
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return jsonResponse({ error: 'Invalid subscription object' }, 400);
    }
    await env.DB.prepare('INSERT OR REPLACE INTO push_subscriptions (endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?)')
      .bind(endpoint, keys.p256dh, keys.auth, Date.now())
      .run();
    return jsonResponse({ status: 'ok' });
  } catch (err: any) {
    return jsonResponse({ error: 'Failed to subscribe', message: err.message }, 500);
  }
}

async function handleUnsubscribe(request: Request, env: Env) {
  try {
    const body = await request.json() as any;
    const { endpoint } = body;
    if (!endpoint) {
      return jsonResponse({ error: 'Invalid unsubscribe object' }, 400);
    }
    await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')
      .bind(endpoint)
      .run();
    return jsonResponse({ status: 'ok' });
  } catch (err: any) {
    return jsonResponse({ error: 'Failed to unsubscribe', message: err.message }, 500);
  }
}

async function handleGetSettings(env: Env) {
  try {
    const result = await env.DB.prepare("SELECT key, value FROM global_settings").all();
    const settings: Record<string, string> = {};
    for (const row of result.results) {
      settings[row.key as string] = row.value as string;
    }
    return jsonResponse({ settings });
  } catch (err: any) {
    return jsonResponse({ error: 'Failed to fetch settings', message: err.message }, 500);
  }
}

async function handlePutSettings(request: Request, env: Env) {
  try {
    const body = await request.json() as any;
    const { key, value } = body;
    if (!key || value === undefined) {
      return jsonResponse({ error: 'Invalid settings object' }, 400);
    }
    await env.DB.prepare('INSERT OR REPLACE INTO global_settings (key, value, updated_at) VALUES (?, ?, ?)')
      .bind(key, value.toString(), Date.now())
      .run();
    return jsonResponse({ status: 'ok' });
  } catch (err: any) {
    return jsonResponse({ error: 'Failed to update settings', message: err.message }, 500);
  }
}
