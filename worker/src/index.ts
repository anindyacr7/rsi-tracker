import { fetchMarketCaps } from './marketcap';
import { fetchValidUSDTPairs, fetchKlines } from './binance';
import { calculateRSI } from './rsi';
import webpush from 'web-push';

export const APP_VERSION = 'v1.0.1';

export interface Env {
  DB: any; // D1Database
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
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
      ctx.waitUntil(handleCron(env));
      return jsonResponse({ status: 'ok', message: 'Cron job manually triggered in the background' });
    }
    
    if (url.pathname === '/api/alerts') {
      if (request.method === 'GET') return handleAlerts(env);
      if (request.method === 'DELETE') return handleClearAlerts(env); // This will clear all active alerts (optional, or we can remove it)
    }

    if (url.pathname === '/api/alerts/bin') {
      if (request.method === 'GET') return handleGetBin(env);
      if (request.method === 'PUT') return handleMoveToBin(request, env);
      if (request.method === 'DELETE') return handleEmptyBin(request, env);
    }

    if (url.pathname === '/api/alerts/restore') {
      if (request.method === 'PUT') return handleRestoreFromBin(request, env);
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
        const rsiThreshold = thresholdRecord ? parseFloat(thresholdRecord.value) : 75;

        let rsiText = 'N/A';
        let errorText = '';
        let activeProvider = 'Unknown';
        try {
          const { provider } = await fetchValidUSDTPairs();
          activeProvider = provider;
          const closes = await fetchKlines('BTCUSDT', '15m', 150, provider);
          if (closes.length > 14) {
            const rsi = calculateRSI(closes, 14);
            rsiText = rsi !== null ? rsi.toFixed(2) : 'N/A';
          } else {
            errorText = 'Not enough data points returned.';
          }
        } catch (e: any) {
          errorText = e.message;
        }
        
        let text = `🚨 *TEST RSI ALERT* 🚨\nToken: #BTCUSDT\nRSI (15m): ${rsiText}\nThreshold: ${rsiThreshold}\nProvider: ${activeProvider}\nWorker: ${APP_VERSION}`;
        let webPushText = `[TEST] #BTCUSDT | RSI: ${rsiText} (>${rsiThreshold}) | Src: ${activeProvider} (v${APP_VERSION})`;

        if (errorText) {
          text += `\n⚠️ *Error:* ${errorText}`;
          webPushText += ` | Error: ${errorText}`;
        }
        
        await sendTelegramMessage(env, text);
        await sendWebPush(env, webPushText);
        return jsonResponse({ status: 'ok', message: 'Test notification sent successfully.', version: APP_VERSION });
      } catch (err: any) {
        return jsonResponse({ status: 'error', message: err.message }, 500);
      }
    }

    return jsonResponse({ error: 'Not Found' }, 404);
  },

  async scheduled(event: any, env: Env, ctx: any) {
    ctx.waitUntil(handleCron(env));
  }
};

async function handleCron(env: Env) {
  try {
    const thresholdRecord = await env.DB.prepare("SELECT value FROM global_settings WHERE key = 'rsi_threshold'").first();
    const rsiThreshold = thresholdRecord ? parseFloat(thresholdRecord.value) : 75;

    const { mcapMap } = await fetchMarketCaps(1, env.DB); // Use CMC key 1 and pass D1 DB for caching
    const { provider, tickers: allTickers } = await fetchValidUSDTPairs();

    // Filter tickers by CMC Top 250
    const tickers = allTickers.filter(t => {
      const rank = mcapMap.get(t.symbol.replace('USDT', ''))?.rank;
      return rank && rank <= 250;
    });

    const CHUNK_SIZE = 25;
    for (let i = 0; i < tickers.length; i += CHUNK_SIZE) {
      const chunk = tickers.slice(i, i + CHUNK_SIZE);
      const promises = chunk.map(async (ticker) => {
        const symbol = ticker.symbol;
        try {
          const closes = await fetchKlines(symbol, '15m', 150, provider);
          if (closes.length > 14) {
            const rsi = calculateRSI(closes, 14);
            if (rsi !== null && rsi >= rsiThreshold) {
              await processAlert(env, ticker, rsi, mcapMap.get(symbol.replace('USDT', ''))?.rank);
            }
          }
        } catch (e) {
          console.warn(`Cron fetch failed for ${symbol}:`, e);
        }
      });
      await Promise.all(promises);
      
      if (i + CHUNK_SIZE < tickers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
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
  const existing = await env.DB.prepare('SELECT * FROM rsi_alerts WHERE symbol = ? AND is_deleted = 0 ORDER BY created_at DESC LIMIT 1').bind(symbol).first();
  
  const percentMove24h = parseFloat(ticker.priceChangePercent);
  
  if (!existing || now - (existing.created_at as number) > 24 * 60 * 60 * 1000) {
    // New or expired, insert new
    await env.DB.prepare(`
      INSERT INTO rsi_alerts (symbol, first_hit_time, first_rsi_value, max_rsi_value, percent_move_24h, mcap_rank, last_notified_at, created_at, is_deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).bind(symbol, now, rsi, rsi, percentMove24h, rank || null, now, now).run();
    
    await sendTelegramMessage(env, `🚨 *RSI ALERT* 🚨\nToken: #${symbol}\nRSI (15m): ${rsi}\n24h Move: ${percentMove24h}%\nRank: ${rank || 'N/A'}`);
  } else {
    // Exists within 24h
    let maxRsi = (existing.max_rsi_value as number);
    let shouldUpdateMax = false;
    
    if (rsi > maxRsi) {
      maxRsi = rsi;
      shouldUpdateMax = true;
    }
    
    const lastNotified = existing.last_notified_at as number;
    let shouldNotify = false;
    
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
        await sendTelegramMessage(env, `🚨 *RSI ALERT (Update)* 🚨\nToken: #${symbol}\nNew RSI (15m): ${rsi}\nMax RSI: ${maxRsi}\n24h Move: ${percentMove24h}%\nRank: ${rank || 'N/A'}`);
      }
    }
  }
  
  if (!existing || now - (existing.created_at as number) > 24 * 60 * 60 * 1000 || shouldUpdateMax || shouldNotify) {
    const text = `Token: #${symbol}\nRSI (15m): ${rsi}\n24h Move: ${percentMove24h}%\nRank: ${rank || 'N/A'}`;
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
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.warn('Telegram credentials not configured');
    return;
  }
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: 'Markdown'
      })
    });
  } catch (err) {
    console.error('Telegram error:', err);
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
    const result = await env.DB.prepare('SELECT * FROM rsi_alerts WHERE is_deleted = 0 ORDER BY created_at DESC').all();
    return jsonResponse({ data: result.results });
  } catch (err: any) {
    console.error('Alerts error:', err);
    return jsonResponse({ error: 'Failed to fetch alerts', message: err?.message ?? 'Unknown error' }, 500);
  }
}

async function handleClearAlerts(env: Env): Promise<Response> {
  try {
    await env.DB.prepare('UPDATE rsi_alerts SET is_deleted = 1 WHERE is_deleted = 0').run();
    return jsonResponse({ status: 'ok' });
  } catch (err: any) {
    console.error('Clear alerts error:', err);
    return jsonResponse({ error: 'Failed to clear alerts', message: err?.message ?? 'Unknown error' }, 500);
  }
}

async function handleGetBin(env: Env): Promise<Response> {
  try {
    const result = await env.DB.prepare('SELECT * FROM rsi_alerts WHERE is_deleted = 1 ORDER BY created_at DESC').all();
    return jsonResponse({ data: result.results });
  } catch (err: any) {
    console.error('Get bin error:', err);
    return jsonResponse({ error: 'Failed to fetch bin', message: err?.message ?? 'Unknown error' }, 500);
  }
}

async function handleMoveToBin(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as { ids: number[] };
    if (!body.ids || !Array.isArray(body.ids)) {
      return jsonResponse({ error: 'Invalid payload, expected array of ids' }, 400);
    }
    if (body.ids.length === 0) return jsonResponse({ status: 'ok' });
    
    const placeholders = body.ids.map(() => '?').join(',');
    await env.DB.prepare(`UPDATE rsi_alerts SET is_deleted = 1 WHERE id IN (${placeholders})`).bind(...body.ids).run();
    return jsonResponse({ status: 'ok' });
  } catch (err: any) {
    console.error('Move to bin error:', err);
    return jsonResponse({ error: 'Failed to move to bin', message: err?.message ?? 'Unknown error' }, 500);
  }
}

async function handleRestoreFromBin(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as { ids: number[] };
    if (!body.ids || !Array.isArray(body.ids)) {
      return jsonResponse({ error: 'Invalid payload, expected array of ids' }, 400);
    }
    if (body.ids.length === 0) return jsonResponse({ status: 'ok' });
    
    const placeholders = body.ids.map(() => '?').join(',');
    await env.DB.prepare(`UPDATE rsi_alerts SET is_deleted = 0 WHERE id IN (${placeholders})`).bind(...body.ids).run();
    return jsonResponse({ status: 'ok' });
  } catch (err: any) {
    console.error('Restore error:', err);
    return jsonResponse({ error: 'Failed to restore', message: err?.message ?? 'Unknown error' }, 500);
  }
}

async function handleEmptyBin(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({})) as { ids?: number[] };
    if (body.ids && Array.isArray(body.ids) && body.ids.length > 0) {
      const placeholders = body.ids.map(() => '?').join(',');
      await env.DB.prepare(`DELETE FROM rsi_alerts WHERE is_deleted = 1 AND id IN (${placeholders})`).bind(...body.ids).run();
    } else {
      await env.DB.prepare('DELETE FROM rsi_alerts WHERE is_deleted = 1').run();
    }
    return jsonResponse({ status: 'ok' });
  } catch (err: any) {
    console.error('Empty bin error:', err);
    return jsonResponse({ error: 'Failed to empty bin', message: err?.message ?? 'Unknown error' }, 500);
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
