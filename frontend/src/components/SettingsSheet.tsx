import clsx from 'clsx';
import { useState, useEffect } from 'react';

interface SettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  pushStatus: 'default' | 'granted' | 'denied';
  isSubscribed: boolean;
  onSubscribe: () => void;
  onUnsubscribe: () => void;
}

export function SettingsSheet({ isOpen, onClose, pushStatus, isSubscribed, onSubscribe, onUnsubscribe }: SettingsSheetProps) {
  const [apiProvider, setApiProvider] = useState(() => {
    return localStorage.getItem('apiProvider') || 'binanceApi';
  });

  const [mcapProvider, setMcapProvider] = useState(() => {
    return localStorage.getItem('mcapProvider') || 'cmc';
  });
  
  const [testNotificationLoading, setTestNotificationLoading] = useState(false);
  const [clearAlertsLoading, setClearAlertsLoading] = useState(false);
  const [rsiThreshold, setRsiThreshold] = useState(75);
  const [isSavingThreshold, setIsSavingThreshold] = useState(false);

  useEffect(() => {
    if (isOpen) {
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
          }
        } catch (err) {
          console.error("Failed to fetch settings", err);
        }
      };
      fetchSettings();
    }
  }, [isOpen]);

  useEffect(() => {
    localStorage.setItem('apiProvider', apiProvider);
  }, [apiProvider]);

  useEffect(() => {
    localStorage.setItem('mcapProvider', mcapProvider);
  }, [mcapProvider]);

  const handleTestNotification = async () => {
    try {
      setTestNotificationLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || '/api/scan';
      const testUrl = apiUrl.replace('/scan', '/test-notification');
      
      const res = await fetch(testUrl);
      if (!res.ok) throw new Error('Failed to send test notification');
      alert('Test notification sent successfully!');
    } catch (err: any) {
      console.error(err);
      alert('Error sending test notification');
    } finally {
      setTestNotificationLoading(false);
    }
  };

  const handleClearAlerts = async () => {
    if (!window.confirm('Are you sure you want to clear all RSI alerts data? This will empty the feed in the UI.')) return;
    try {
      setClearAlertsLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || '/api/scan';
      const clearUrl = apiUrl.replace('/scan', '/alerts');
      
      const res = await fetch(clearUrl, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to clear alerts data');
      alert('Alerts data cleared successfully! Refresh the page to see changes.');
    } catch (err: any) {
      console.error(err);
      alert('Error clearing alerts data');
    } finally {
      setClearAlertsLoading(false);
    }
  };

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
        // Optional: show a small success indication
      }
    } catch (err) {
      console.error("Failed to save threshold", err);
      alert('Error saving threshold');
    } finally {
      setIsSavingThreshold(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      <div 
        className={clsx(
          "fixed bottom-0 left-0 right-0 z-[70] bg-surface-container dark:bg-surface-container rounded-t-2xl p-6 shadow-xl border-t border-outline-variant/30 transform transition-transform duration-300 md:bottom-auto md:top-1/2 md:left-1/2 md:right-auto md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:w-full md:max-w-md",
          isOpen ? "translate-y-0" : "translate-y-full md:scale-95 md:opacity-0"
        )}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-title-lg font-bold text-on-surface">Settings</h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-container-highest/50 text-on-surface-variant transition-colors active:scale-95"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-6">
          {/* Notifications Section */}
          <section className="space-y-4">
            <h3 className="text-label-lg font-medium text-primary">Notifications</h3>
            
            <div className="flex items-center justify-between p-4 rounded-xl bg-surface-container-highest/30 border border-outline-variant/20">
              <div className="flex items-center gap-3">
                <span className={clsx("material-symbols-outlined", isSubscribed ? "text-secondary" : "text-on-surface-variant")} 
                      style={isSubscribed ? { fontVariationSettings: "'FILL' 1" } : {}}>
                  notifications
                </span>
                <div>
                  <p className="text-body-lg font-medium text-on-surface">Push Notifications</p>
                  <p className="text-body-sm text-on-surface-variant">
                    {isSubscribed ? 'Subscribed' : pushStatus === 'denied' ? 'Blocked' : 'Disabled'}
                  </p>
                </div>
              </div>
              <button
                onClick={isSubscribed ? onUnsubscribe : onSubscribe}
                disabled={pushStatus === 'denied'}
                className={clsx(
                  "px-4 py-2 rounded-full font-medium text-sm transition-colors",
                  isSubscribed 
                    ? "bg-error/20 text-error hover:bg-error/30 active:scale-95" 
                    : pushStatus === 'denied'
                    ? "bg-error/20 text-error cursor-not-allowed"
                    : "bg-primary text-on-primary hover:bg-primary/90 active:scale-95"
                )}
              >
                {isSubscribed ? 'Unsubscribe' : pushStatus === 'denied' ? 'Blocked' : 'Enable'}
              </button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-surface-container-highest/30 border border-outline-variant/20">
              <div className="flex flex-col">
                <span className="text-body-md font-medium text-on-surface">Global RSI Threshold</span>
                <span className="text-body-sm text-on-surface-variant">Minimum RSI for alerts</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="50"
                  max="95"
                  value={rsiThreshold}
                  onChange={(e) => setRsiThreshold(parseInt(e.target.value) || 75)}
                  className="w-16 p-2 text-center rounded-lg bg-surface-container border border-outline-variant text-on-surface focus:outline-none focus:border-primary"
                />
                <button
                  onClick={() => handleSaveThreshold(rsiThreshold)}
                  disabled={isSavingThreshold}
                  className="flex items-center justify-center p-2 rounded-lg bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  <span className={clsx("material-symbols-outlined text-[20px]", isSavingThreshold && "animate-spin")}>
                    {isSavingThreshold ? 'sync' : 'save'}
                  </span>
                </button>
              </div>
            </div>

            <button
              onClick={handleTestNotification}
              disabled={testNotificationLoading}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-outline-variant/30 text-on-surface hover:bg-surface-container-highest/50 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className={clsx("material-symbols-outlined", testNotificationLoading && "animate-spin")}>
                {testNotificationLoading ? 'sync' : 'send'}
              </span>
              Send Test Notification (BTC RSI)
            </button>

            <button
              onClick={handleClearAlerts}
              disabled={clearAlertsLoading}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-error/30 text-error hover:bg-error/10 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className={clsx("material-symbols-outlined", clearAlertsLoading && "animate-spin")}>
                {clearAlertsLoading ? 'sync' : 'delete_sweep'}
              </span>
              Clear Alerts History
            </button>
          </section>

          {/* API Provider Section */}
          <section className="space-y-4">
            <h3 className="text-label-lg font-medium text-primary">API Provider</h3>
            
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant/30 cursor-pointer hover:bg-surface-container-highest/30 transition-colors">
                <input
                  type="radio"
                  name="apiProvider"
                  value="binanceApi"
                  checked={apiProvider === 'binanceApi'}
                  onChange={(e) => setApiProvider(e.target.value)}
                  className="w-4 h-4 text-primary bg-surface-container border-outline-variant focus:ring-primary focus:ring-2"
                />
                <div className="flex flex-col">
                  <span className="text-body-md font-medium text-on-surface">Binance API</span>
                  <span className="text-body-sm text-on-surface-variant">Default endpoints (api.binance.com)</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant/30 cursor-pointer hover:bg-surface-container-highest/30 transition-colors">
                <input
                  type="radio"
                  name="apiProvider"
                  value="binanceData"
                  checked={apiProvider === 'binanceData'}
                  onChange={(e) => setApiProvider(e.target.value)}
                  className="w-4 h-4 text-primary bg-surface-container border-outline-variant focus:ring-primary focus:ring-2"
                />
                <div className="flex flex-col">
                  <span className="text-body-md font-medium text-on-surface">Binance Data API</span>
                  <span className="text-body-sm text-on-surface-variant">Fallback endpoints (data-api.binance.vision)</span>
                </div>
              </label>
            </div>
          </section>

          {/* Market Cap Provider Section */}
          <section className="space-y-4">
            <h3 className="text-label-lg font-medium text-primary">Market Cap Provider</h3>
            
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant/30 cursor-pointer hover:bg-surface-container-highest/30 transition-colors">
                <input
                  type="radio"
                  name="mcapProvider"
                  value="cmc"
                  checked={mcapProvider === 'cmc'}
                  onChange={(e) => setMcapProvider(e.target.value)}
                  className="w-4 h-4 text-primary bg-surface-container border-outline-variant focus:ring-primary focus:ring-2"
                />
                <div className="flex flex-col">
                  <span className="text-body-md font-medium text-on-surface">CoinMarketCap</span>
                  <span className="text-body-sm text-on-surface-variant">Default endpoints (pro-api.coinmarketcap.com)</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant/30 cursor-pointer hover:bg-surface-container-highest/30 transition-colors">
                <input
                  type="radio"
                  name="mcapProvider"
                  value="coinlore"
                  checked={mcapProvider === 'coinlore'}
                  onChange={(e) => setMcapProvider(e.target.value)}
                  className="w-4 h-4 text-primary bg-surface-container border-outline-variant focus:ring-primary focus:ring-2"
                />
                <div className="flex flex-col">
                  <span className="text-body-md font-medium text-on-surface">Coinlore</span>
                  <span className="text-body-sm text-on-surface-variant">Fallback endpoints (api.coinlore.net)</span>
                </div>
              </label>
            </div>
            <p className="text-body-sm text-on-surface-variant">
              Changes to the configuration require a refresh to take effect.
            </p>
          </section>

          <div className="pt-4 border-t border-outline-variant/30 text-center">
            <p className="text-body-sm text-on-surface-variant/70">
              FoxLedger Screener • v1.0.1
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
