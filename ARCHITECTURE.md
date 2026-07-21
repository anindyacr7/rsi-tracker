# Crypto RSI Tracker - Architecture & LLD

This document outlines the Low-Level Design (LLD) and architecture of the Crypto RSI Tracker.

## System Components

The system is composed of two primary layers:
1. **Frontend UI:** Built with React, TypeScript, and Vite.
2. **Backend Services:** A serverless Cloudflare Worker (`crypto-rsi-worker`) interacting with a Cloudflare D1 database.

### Cloudflare Worker (Backend)

The worker has two primary modes of execution:

#### 1. Scheduled Execution (Cron)
- **Trigger:** Runs every minute (`* * * * *`) via Cloudflare Cron Triggers.
- **Process:** 
  1. Fetches market capitalization data (CoinMarketCap rankings) from D1 Cache / External APIs.
  2. Retrieves a list of valid USDT trading pairs from the **Binance Data API** (`https://data-api.binance.vision`).
  3. Filters pairs to only include the Top 150 by Market Cap.
  4. Fetches the latest 15m Klines (candlestick data) for each valid symbol in batches (chunks of 5, with a 1-second delay to avoid rate limits).
  5. Calculates the RSI (period 14).
  6. If RSI > 75, it triggers `processAlert`.

#### 2. HTTP Requests (API)
- **`/api/test-notification`**: Endpoint to send a test message to Telegram and Web Push.
- **`/api/health`**: Simple uptime check.
- **`/api/alerts`**: Fetches the last 24h of RSI alerts from the D1 Database.
- **`/api/scan`**: Fetches current market cap rankings.
- **`/api/subscribe`**: Handles Web Push subscription registration.
- **`/api/unsubscribe`**: Removes a Web Push subscription.

### Database (Cloudflare D1)

The system uses Cloudflare D1 (SQLite) to store alerts, subscriptions, and caching data.

- **`rsi_alerts`**: Stores alerts with `symbol`, `rsi_value`, `percent_move_24h`, and timestamps to prevent spamming notifications for the same coin repeatedly (1 hour cooldown).
- **`push_subscriptions`**: Stores client endpoints and keys for Web Push notifications.

### External Services & Integrations

- **API Provider Discovery Pattern**: Because Cloudflare Worker IPs are often blocked by crypto exchanges (specifically Binance), the worker implements a "Provider Discovery Pattern". At the start of every execution, it sequentially tests:
  1. Binance Data API (`data-api.binance.vision`)
  2. Binance Main API (`api.binance.com`, `api1` through `api4`)
  3. Bybit API (`api.bybit.com`)
  4. KuCoin API (`api.kucoin.com`)
  
  Once a working provider is discovered during the initial 24h ticker fetch, the worker passes this `provider` flag directly to all subsequent chunked Kline (candlestick) fetches. This prevents hundreds of failed requests per run and ensures high performance.
- **CoinMarketCap / Coinlore**: Provides Market Cap data for filtering the top N tokens.
- **Telegram Bot API**: Used to send Markdown-formatted messages to a configured Chat ID.
- **Web Push**: Sends native browser notifications to subscribed clients.

## Rate Limiting & Optimization

- **Chunking**: Binance API requests are batched to avoid IP bans.
- **Database Caching**: Market cap data is cached to reduce external API requests.
- **Alert Throttling**: A 1-hour cooldown is applied per token to prevent alert fatigue, although new RSI highs within that period trigger a silent database update.
