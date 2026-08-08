# Troubleshooting History & Lessons Learned

This document serves as an iterative log of errors encountered, mistakes made, and final solutions implemented during development. It should be referenced in future sessions to avoid repeating past mistakes.

## 1. Binance API "Invalid Symbol" Global Rejection
- **Problem**: Tried passing `symbols=["BTCUSDT", ..., "KASUSDT"]` to the Binance `/api/v3/ticker/24hr` endpoint to save bandwidth.
- **Mistake**: Our token list comes from CoinMarketCap, which includes coins not listed on Binance Spot (e.g., KAS, BGB). Binance responds with an HTTP 400 (`-1121 Invalid symbol`) if **even one** symbol is invalid, which crashes the entire fetch request.
- **Final Solution**: Do not filter by specific symbols on the Binance side. Instead, fetch the entire ticker array (2.5MB). Vercel compresses this automatically via gzip to ~300KB, which is well within Cloudflare Worker limits, completely bypassing the `-1121` error.

## 2. Unrecognized Query Params on Binance API
- **Problem**: Attempted to pass a custom `filterSymbols` query param to the Vercel Proxy so it would filter the results before sending them back to Cloudflare.
- **Mistake**: The Vercel deployment didn't update immediately, so the old Vercel Proxy blindly forwarded the `filterSymbols` query param to Binance. Binance expects zero parameters on that endpoint and crashed with `-1104 Not all sent parameters were read`.
- **Lesson**: Be extremely careful about passing custom query parameters through a proxy if they aren't explicitly caught and removed before forwarding to Binance. 

## 3. Cloudflare Worker Subrequest Limits (Max 50)
- **Problem**: Calculating RSI for 200 tokens requires fetching 150 klines per token. Cloudflare Workers have a hard limit of 50 subrequests per execution.
- **Solution**: Built a custom `/batch-klines` endpoint on the Vercel Proxy. The Cloudflare worker makes a single request with a comma-separated list of symbols. Vercel performs the individual fetches concurrently, extracts only the closing prices to save bandwidth, and returns a single JSON object back to Cloudflare.

## 4. Fallback API Provider Resiliency
- **Problem**: KuCoin API frequently returns `429 Too Many Requests` due to strict unauthenticated rate limits. Bybit returns `403` for unsupported spot endpoints. 
- **Mistake**: During code refactoring, the KuCoin fallback logic was accidentally overwritten by Bybit logic, causing a single point of failure.
- **Lesson**: Always maintain a robust, multi-layered fallback strategy (`Binance Proxy -> Binance Data API -> Binance Subdomains -> Bybit -> KuCoin`). When replacing code chunks, explicitly verify that fallback blocks are preserved.

## 5. React Modal "Click Outside to Close" Bug
- **Problem**: Modal wouldn't close reliably when clicking the backdrop.
- **Mistake**: Used `onClick` on the backdrop wrapper. In React, if a user mouses down *inside* the modal, drags their mouse slightly, and mouses up *outside*, the `onClick` event bubbles unpredictably.
- **Solution**: Changed the backdrop wrapper to use `onMouseDown={() => setModalOpen(false)}`. This guarantees that an explicit click down on the backdrop immediately triggers the close action without bubbling issues.
