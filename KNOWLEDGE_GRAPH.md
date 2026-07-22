# RSI Tracker Knowledge Graph

```mermaid
graph TD
    %% Frontend Components
    subgraph Frontend [Frontend (React + Vite)]
        App[App.tsx]
        AlertsTab[AlertsTable.tsx]
        Settings[SettingsTab.tsx]
        DataTbl[DataTable.tsx]
        TokenDetails[TokenDetailsSheet.tsx]
        BottomNav[BottomNavBar.tsx]
        TopApp[TopAppBar.tsx]

        App --> AlertsTab
        App --> Settings
        App --> DataTbl
        App --> TokenDetails
        App --> BottomNav
        App --> TopApp
    end

    %% Backend Services
    subgraph Backend [Backend (Cloudflare Worker)]
        Router[index.ts API Router]
        Cron[Cron Trigger * * * * *]
        Binance[Binance API Fetcher]
        MarketCap[CoinMarketCap/Coinlore]
        RSI[RSI Calculator]
        Push[Web Push Service]
        Telegram[Telegram Bot]
        
        Cron --> Binance
        Cron --> MarketCap
        Cron --> RSI
        RSI --> Push
        RSI --> Telegram
        
        Router --> |GET /alerts| FetchAlerts[Fetch Active Alerts]
        Router --> |PUT /alerts/bin| BinAlerts[Bin Alerts]
        Router --> |PUT /alerts/restore| RestoreAlerts[Restore Alerts]
        Router --> |GET /alerts/bin| FetchBin[Fetch Bin]
        Router --> |DELETE /alerts/bin| DeleteBin[Empty Bin]
    end

    %% Database
    subgraph Database [Cloudflare D1 SQLite]
        RsiAlerts[(rsi_alerts)]
        PushSubs[(push_subscriptions)]
        McapCache[(mcap_cache)]
        GlobalSettings[(global_settings)]
    end

    %% Interactions
    AlertsTab --> |Fetch & Bin| Router
    Settings --> |Fetch & Restore| Router
    DataTbl --> Router
    
    FetchAlerts --> RsiAlerts
    BinAlerts --> RsiAlerts
    RestoreAlerts --> RsiAlerts
    FetchBin --> RsiAlerts
    DeleteBin --> RsiAlerts
    
    Cron --> RsiAlerts
    Push --> PushSubs
    MarketCap --> McapCache
```
