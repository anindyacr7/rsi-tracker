# Crypto RSI Tracker

This project is a Crypto RSI (Relative Strength Index) tracker built with a React frontend and a Cloudflare Worker backend. It scans the top cryptocurrency pairs across multiple exchanges (Binance, Bybit, KuCoin) utilizing a dynamic API Provider Discovery Pattern, and sends alerts via Telegram and Web Push when the 15-minute RSI exceeds 75.

## Architecture Overview
See [ARCHITECTURE.md](ARCHITECTURE.md) for a detailed Low-Level Design (LLD).

## Handy Endpoints

The backend API is deployed at: `https://crypto-rsi-worker.foxledger.workers.dev`

### 1. Test Notification
Use this endpoint to verify that Telegram and Web Push notifications are properly configured.
```bash
curl https://crypto-rsi-worker.foxledger.workers.dev/api/test-notification
```

### 2. Health Check
Basic health check to ensure the worker is responsive.
```bash
curl https://crypto-rsi-worker.foxledger.workers.dev/api/health
```

### 3. Fetch Alerts
Retrieves recent RSI alerts from the database.
```bash
curl https://crypto-rsi-worker.foxledger.workers.dev/api/alerts
```

### 4. Fetch Market Scan
Returns the current market cap data and rankings.
```bash
curl https://crypto-rsi-worker.foxledger.workers.dev/api/scan
```

## Setup & Deployment

### Frontend (React/Vite)
1. `cd frontend`
2. `npm install`
3. `npm run dev`

### Backend (Cloudflare Worker)
1. `cd worker`
2. `npm install`
3. Configure your secrets (e.g., Telegram Bot Token) using `npx wrangler secret put <SECRET_NAME>`.
4. Deploy the worker:
```bash
npx wrangler deploy
```
