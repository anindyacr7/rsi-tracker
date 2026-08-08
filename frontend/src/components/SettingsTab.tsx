import clsx from 'clsx';
import { useState, useEffect } from 'react';


export function SettingsTab() {
  const [apiProvider, setApiProvider] = useState(() => {
    return localStorage.getItem('apiProvider') || 'binanceApi';
  });

  const [mcapProvider, setMcapProvider] = useState(() => {
    return localStorage.getItem('mcapProvider') || 'cmc';
  });

  const [chartInterval, setChartInterval] = useState(() => {
    return localStorage.getItem('chartInterval') || '15m';
  });
  
  const [rsiThreshold, setRsiThreshold] = useState(75);
  const [isSavingThreshold, setIsSavingThreshold] = useState(false);
  
  const [rsiThresholdUnder, setRsiThresholdUnder] = useState(25);
  const [isSavingThresholdUnder, setIsSavingThresholdUnder] = useState(false);
  
  const [cronInterval, setCronInterval] = useState(1);
  const [isSavingInterval, setIsSavingInterval] = useState(false);
  
  const [dataSource, setDataSource] = useState('binance');
  const [isSavingDataSource, setIsSavingDataSource] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || '/api/scan';
        const settingsUrl = apiUrl.replace('/scan', '/settings');
        const res = await fetch(settingsUrl);
        if (res.ok) {
          const data = await res.json();
          if (data.settings && data.settings['rsi_threshold']) {
            setRsiThreshold(parseFloat(data.settings['rsi_threshold']));
          }
          if (data.settings && data.settings['rsi_threshold_under']) {
            setRsiThresholdUnder(parseFloat(data.settings['rsi_threshold_under']));
          }
          if (data.settings && data.settings['cron_interval']) {
            setCronInterval(parseInt(data.settings['cron_interval'], 10));
          }
          if (data.settings && data.settings['data_source']) {
            setDataSource(data.settings['data_source']);
          }
        }
      } catch (err) {
        console.error("Failed to fetch settings", err);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    localStorage.setItem('apiProvider', apiProvider);
  }, [apiProvider]);

  useEffect(() => {
    localStorage.setItem('mcapProvider', mcapProvider);
  }, [mcapProvider]);

  useEffect(() => {
    localStorage.setItem('chartInterval', chartInterval);
  }, [chartInterval]);

  const handleSaveThreshold = async (val: number) => {
    try {
      setIsSavingThreshold(true);
      const apiUrl = import.meta.env.VITE_API_URL || '/api/scan';
      const settingsUrl = apiUrl.replace('/scan', '/settings');
      const res = await fetch(settingsUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'rsi_threshold', value: val })
      });
      if (res.ok) {
        // success
      }
    } catch (err) {
      console.error("Failed to save threshold", err);
      alert('Error saving threshold');
    } finally {
      setIsSavingThreshold(false);
    }
  };

  const handleSaveThresholdUnder = async (val: number) => {
    try {
      setIsSavingThresholdUnder(true);
      const apiUrl = import.meta.env.VITE_API_URL || '/api/scan';
      const settingsUrl = apiUrl.replace('/scan', '/settings');
      const res = await fetch(settingsUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'rsi_threshold_under', value: val })
      });
      if (res.ok) {
        // success
      }
    } catch (err) {
      console.error("Failed to save undershoot threshold", err);
      alert('Error saving undershoot threshold');
    } finally {
      setIsSavingThresholdUnder(false);
    }
  };

  const handleSaveInterval = async (val: number) => {
    try {
      setIsSavingInterval(true);
      const apiUrl = import.meta.env.VITE_API_URL || '/api/scan';
      const settingsUrl = apiUrl.replace('/scan', '/settings');
      const res = await fetch(settingsUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'cron_interval', value: val })
      });
      if (res.ok) {
        // success
      }
    } catch (err) {
      console.error("Failed to save interval", err);
      alert('Error saving interval');
    } finally {
      setIsSavingInterval(false);
    }
  };

  const handleSaveDataSource = async (val: string) => {
    try {
      setIsSavingDataSource(true);
      setDataSource(val);
      const apiUrl = import.meta.env.VITE_API_URL || '/api/scan';
      const settingsUrl = apiUrl.replace('/scan', '/settings');
      const res = await fetch(settingsUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'data_source', value: val })
      });
      if (res.ok) {
        // success
      }
    } catch (err) {
      console.error("Failed to save data source", err);
      alert('Error saving data source');
    } finally {
      setIsSavingDataSource(false);
    }
  };




  return (
    <div className="w-full max-w-lg mx-auto pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      
      {/* Notifications Card */}
      <div className="mb-6">
        <h3 className="text-primary font-semibold mb-4 px-1">Alerts Configuration</h3>
        <div className="bg-[#1e1e22]/40 backdrop-blur-md border border-white/10 rounded-xl p-4 space-y-6">
          
          {/* Global RSI */}
          <div className="pt-2">
            <p className="font-medium text-on-surface mb-1">Global RSI Threshold</p>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-on-surface-variant">Minimum RSI for alerts</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="50"
                  max="95"
                  value={rsiThreshold}
                  onChange={(e) => setRsiThreshold(parseInt(e.target.value) || 75)}
                  className="w-16 h-12 bg-surface-container-lowest border border-outline-variant rounded-lg text-center font-data-tabular focus:ring-1 focus:ring-primary focus:border-primary text-on-surface"
                />
                <button
                  onClick={() => handleSaveThreshold(rsiThreshold)}
                  disabled={isSavingThreshold}
                  className="w-12 h-12 bg-surface-container-highest border border-outline-variant rounded-lg flex items-center justify-center text-primary-fixed hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  <span className={clsx("material-symbols-outlined", isSavingThreshold && "animate-spin")}>
                    {isSavingThreshold ? 'sync' : 'save'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Undershoot RSI */}
          <div className="pt-2 border-t border-white/5">
            <p className="font-medium text-on-surface mb-1">Undershoot RSI Threshold</p>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-on-surface-variant">Maximum RSI for undershoot alerts</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="5"
                  max="50"
                  value={rsiThresholdUnder}
                  onChange={(e) => setRsiThresholdUnder(parseInt(e.target.value) || 25)}
                  className="w-16 h-12 bg-surface-container-lowest border border-outline-variant rounded-lg text-center font-data-tabular focus:ring-1 focus:ring-primary focus:border-primary text-on-surface"
                />
                <button
                  onClick={() => handleSaveThresholdUnder(rsiThresholdUnder)}
                  disabled={isSavingThresholdUnder}
                  className="w-12 h-12 bg-surface-container-highest border border-outline-variant rounded-lg flex items-center justify-center text-primary-fixed hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  <span className={clsx("material-symbols-outlined", isSavingThresholdUnder && "animate-spin")}>
                    {isSavingThresholdUnder ? 'sync' : 'save'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Cron Interval */}
          <div className="pt-2 border-t border-white/5">
            <p className="font-medium text-on-surface mb-1">Scan Interval (Minutes)</p>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-on-surface-variant">How often the cron job executes</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={cronInterval}
                  onChange={(e) => setCronInterval(parseInt(e.target.value) || 1)}
                  className="w-16 h-12 bg-surface-container-lowest border border-outline-variant rounded-lg text-center font-data-tabular focus:ring-1 focus:ring-primary focus:border-primary text-on-surface"
                />
                <button
                  onClick={() => handleSaveInterval(cronInterval)}
                  disabled={isSavingInterval}
                  className="w-12 h-12 bg-surface-container-highest border border-outline-variant rounded-lg flex items-center justify-center text-primary-fixed hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  <span className={clsx("material-symbols-outlined", isSavingInterval && "animate-spin")}>
                    {isSavingInterval ? 'sync' : 'save'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>



      {/* API Providers */}
      <div className="space-y-8">
        <div>
          <h3 className="text-primary font-semibold mb-4 px-1">Data Source & Engine</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-4 bg-[#1e1e22]/40 backdrop-blur-md p-4 rounded-xl border border-outline-variant cursor-pointer group hover:bg-surface-variant/30 transition-colors">
              <input
                type="radio"
                name="data_source"
                value="binance"
                checked={dataSource === 'binance'}
                onChange={(e) => handleSaveDataSource(e.target.value)}
                className="w-5 h-5 text-primary bg-transparent border-outline-variant focus:ring-0 focus:ring-offset-0"
              />
              <div className="flex-1">
                <p className="font-medium text-on-surface">Binance (Vercel Proxy)</p>
                <p className="text-sm text-on-surface-variant">Scans 150 tokens. Uses Vercel bandwidth.</p>
              </div>
              {isSavingDataSource && dataSource === 'binance' && <span className="material-symbols-outlined animate-spin text-primary">sync</span>}
            </label>
            <label className="flex items-center gap-4 bg-[#1e1e22]/40 backdrop-blur-md p-4 rounded-xl border border-outline-variant cursor-pointer group hover:bg-surface-variant/30 transition-colors">
              <input
                type="radio"
                name="data_source"
                value="bybit"
                checked={dataSource === 'bybit'}
                onChange={(e) => handleSaveDataSource(e.target.value)}
                className="w-5 h-5 text-primary bg-transparent border-outline-variant focus:ring-0 focus:ring-offset-0"
              />
              <div className="flex-1">
                <p className="font-medium text-on-surface">Bybit (Pure Cloudflare)</p>
                <p className="text-sm text-on-surface-variant">Scans 100 tokens. Uses 0 Vercel bandwidth (chunks 35 tokens/min).</p>
              </div>
              {isSavingDataSource && dataSource === 'bybit' && <span className="material-symbols-outlined animate-spin text-primary">sync</span>}
            </label>
          </div>
        </div>

        <div>
          <h3 className="text-primary font-semibold mb-4 px-1">API Provider</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-4 bg-[#1e1e22]/40 backdrop-blur-md p-4 rounded-xl border border-outline-variant cursor-pointer group hover:bg-surface-variant/30 transition-colors">
              <input
                type="radio"
                name="api_provider"
                value="binanceApi"
                checked={apiProvider === 'binanceApi'}
                onChange={(e) => setApiProvider(e.target.value)}
                className="w-5 h-5 text-primary bg-transparent border-outline-variant focus:ring-0 focus:ring-offset-0"
              />
              <div>
                <p className="font-medium text-on-surface">Binance API</p>
                <p className="text-sm text-on-surface-variant">Default endpoints (api.binance.com)</p>
              </div>
            </label>
            <label className="flex items-center gap-4 bg-[#1e1e22]/40 backdrop-blur-md p-4 rounded-xl border border-outline-variant cursor-pointer group hover:bg-surface-variant/30 transition-colors">
              <input
                type="radio"
                name="api_provider"
                value="binanceData"
                checked={apiProvider === 'binanceData'}
                onChange={(e) => setApiProvider(e.target.value)}
                className="w-5 h-5 text-primary bg-transparent border-outline-variant focus:ring-0 focus:ring-offset-0"
              />
              <div>
                <p className="font-medium text-on-surface">Binance Data API</p>
                <p className="text-sm text-on-surface-variant">Fallback endpoints (data-api.binance.vision)</p>
              </div>
            </label>
          </div>
        </div>

        <div>
          <h3 className="text-primary font-semibold mb-4 px-1">Market Cap Provider</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-4 bg-[#1e1e22]/40 backdrop-blur-md p-4 rounded-xl border border-outline-variant cursor-pointer group hover:bg-surface-variant/30 transition-colors">
              <input
                type="radio"
                name="mcap_provider"
                value="cmc"
                checked={mcapProvider === 'cmc'}
                onChange={(e) => setMcapProvider(e.target.value)}
                className="w-5 h-5 text-primary bg-transparent border-outline-variant focus:ring-0 focus:ring-offset-0"
              />
              <div>
                <p className="font-medium text-on-surface">CoinMarketCap</p>
                <p className="text-sm text-on-surface-variant">Default endpoints (pro-api.coinmarketcap.com)</p>
              </div>
            </label>
            <label className="flex items-center gap-4 bg-[#1e1e22]/40 backdrop-blur-md p-4 rounded-xl border border-outline-variant cursor-pointer group hover:bg-surface-variant/30 transition-colors">
              <input
                type="radio"
                name="mcap_provider"
                value="coinlore"
                checked={mcapProvider === 'coinlore'}
                onChange={(e) => setMcapProvider(e.target.value)}
                className="w-5 h-5 text-primary bg-transparent border-outline-variant focus:ring-0 focus:ring-offset-0"
              />
              <div>
                <p className="font-medium text-on-surface">Coinlore</p>
                <p className="text-sm text-on-surface-variant">Fallback endpoints (api.coinlore.net)</p>
              </div>
            </label>
          </div>
        </div>

        <div>
          <h3 className="text-primary font-semibold mb-4 px-1">Default Chart Interval</h3>
          <div className="grid grid-cols-2 gap-2">
            {['5m', '15m', '1h', '4h', '1d'].map((iv) => (
              <label key={iv} className="flex items-center gap-4 bg-[#1e1e22]/40 backdrop-blur-md p-4 rounded-xl border border-outline-variant cursor-pointer group hover:bg-surface-variant/30 transition-colors">
                <input
                  type="radio"
                  name="chart_interval"
                  value={iv}
                  checked={chartInterval === iv}
                  onChange={(e) => setChartInterval(e.target.value)}
                  className="w-5 h-5 text-primary bg-transparent border-outline-variant focus:ring-0 focus:ring-offset-0"
                />
                <span className="font-medium text-on-surface uppercase">{iv}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="mt-8 mb-4 border-t border-outline-variant pt-6 text-center">
        <p className="text-sm text-on-surface-variant mb-4">Changes to the configuration require a refresh to take effect.</p>
        <p className="text-xs text-on-surface-variant font-medium tracking-wide uppercase opacity-60">FoxLedger Screener • v1.0.1</p>
      </div>

      {/* Visual Atmosphere */}
      <div className="fixed inset-0 pointer-events-none z-[-1] opacity-30 overflow-hidden">
        <div className="absolute top-[10%] right-[-10%] w-[60%] h-[60%] bg-primary/10 blur-[150px] rounded-full"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-secondary/5 blur-[120px] rounded-full"></div>
      </div>

      <style>{`
        input[type="radio"]:checked {
            background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3ccircle cx='8' cy='8' r='3'/%3e%3c/svg%3e");
            background-color: #3772ff;
            border-color: #3772ff;
        }
      `}</style>
    </div>
  );
}
