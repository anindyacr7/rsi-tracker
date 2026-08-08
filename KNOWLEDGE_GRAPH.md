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
        Router --> |DELETE /alerts| DeleteAlerts[Delete Alerts to Backup]
        Router --> |POST /alerts/restore| RestoreAlerts[Restore Alerts from Backup]
    end

    %% Database
    subgraph Database [Cloudflare D1 SQLite]
        RsiAlerts[(rsi_alerts)]
        RsiAlertsBackup[(rsi_alerts_backup)]
        RsiAlertsUnder[(rsi_alerts_under)]
        RsiAlertsUnderBackup[(rsi_alerts_under_backup)]
        PushSubs[(push_subscriptions)]
        McapCache[(mcap_cache)]
        GlobalSettings[(global_settings)]
        ScanLogs[(scan_logs)]
    end

    %% Interactions
    AlertsTab --> |Fetch & Delete| Router
    Settings --> |Fetch & Restore & Settings| Router
    DataTbl --> Router
    
    FetchAlerts --> RsiAlerts
    FetchAlerts --> RsiAlertsUnder
    DeleteAlerts --> RsiAlerts
    DeleteAlerts --> RsiAlertsBackup
    DeleteAlerts --> RsiAlertsUnder
    DeleteAlerts --> RsiAlertsUnderBackup
    RestoreAlerts --> RsiAlerts
    RestoreAlerts --> RsiAlertsBackup
    RestoreAlerts --> RsiAlertsUnder
    RestoreAlerts --> RsiAlertsUnderBackup
    
    Cron --> RsiAlerts
    Cron --> RsiAlertsUnder
    Cron --> ScanLogs
    Push --> PushSubs
    MarketCap --> McapCache
```
