import clsx from 'clsx';
import { useState, useEffect } from 'react';
import type { Alert } from '../types';
import { getRsiClass } from '../utils/formatters';

const urlB64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

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
  
  const [testNotificationLoading, setTestNotificationLoading] = useState(false);
  const [clearAlertsLoading, setClearAlertsLoading] = useState(false);
  const [forceRunLoading, setForceRunLoading] = useState(false);
  const [rsiThreshold, setRsiThreshold] = useState(75);
  const [isSavingThreshold, setIsSavingThreshold] = useState(false);
  
  const [pushStatus, setPushStatus] = useState<'default' | 'granted' | 'denied'>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);

  const [binData, setBinData] = useState<Alert[]>([]);
  const [binLoading, setBinLoading] = useState(false);
  const [selectedBinItems, setSelectedBinItems] = useState<number[]>([]);
  const [binActionLoading, setBinActionLoading] = useState(false);

  const fetchBin = async () => {
    setBinLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '/api/scan';
      const binUrl = apiUrl.replace('/scan', '/alerts/bin');
      const res = await fetch(binUrl);
      if (res.ok) {
        const json = await res.json();
        setBinData(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBinLoading(false);
    }
  };

  useEffect(() => {
    fetchBin();
  }, []);

  useEffect(() => {
    if ('Notification' in window) {
      setPushStatus(Notification.permission);
    }
    
    // Check if there is an active subscription
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(registration => {
        registration.pushManager.getSubscription().then(subscription => {
          setIsSubscribed(subscription !== null);
        });
      });
    }
  }, []);

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

  const handleSubscribe = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Push messaging is not supported.');
      return;
    }

    const permission = await Notification.requestPermission();
    setPushStatus(permission);

    if (permission === 'granted') {
      try {
        const registration = await navigator.serviceWorker.ready;
        const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        
        if (!vapidPublicKey) {
          console.error('VAPID public key not found in env');
          return;
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(vapidPublicKey)
        });

        const apiUrl = import.meta.env.VITE_API_URL || '/api/scan';
        const subscribeUrl = apiUrl.replace('/scan', '/subscribe');

        await fetch(subscribeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription)
        });

        setIsSubscribed(true);
        alert('Subscribed to notifications successfully!');
      } catch (err) {
        console.error('Failed to subscribe the user: ', err);
      }
    }
  };

  const handleUnsubscribe = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        const apiUrl = import.meta.env.VITE_API_URL || '/api/scan';
        const unsubscribeUrl = apiUrl.replace('/scan', '/unsubscribe');

        await fetch(unsubscribeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        });

        await subscription.unsubscribe();
        setIsSubscribed(false);
        alert('Unsubscribed from notifications successfully.');
      }
    } catch (err) {
      console.error('Failed to unsubscribe', err);
    }
  };

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

  const handleForceRun = async () => {
    try {
      setForceRunLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || '/api/scan';
      const forceUrl = apiUrl.replace('/scan', '/force-run');
      
      const res = await fetch(forceUrl, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to force run cron');
      alert('Cron job successfully triggered! Check your notifications in a few moments.');
    } catch (err: any) {
      console.error(err);
      alert('Error triggering cron job');
    } finally {
      setForceRunLoading(false);
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
        // success
      }
    } catch (err) {
      console.error("Failed to save threshold", err);
      alert('Error saving threshold');
    } finally {
      setIsSavingThreshold(false);
    }
  };

  const handleRestore = async (ids: number[]) => {
    if (!ids.length) return;
    setBinActionLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '/api/scan';
      const restoreUrl = apiUrl.replace('/scan', '/alerts/restore');
      await fetch(restoreUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      setSelectedBinItems([]);
      fetchBin();
    } catch (err) {
      console.error(err);
      alert('Error restoring items');
    } finally {
      setBinActionLoading(false);
    }
  };

  const handleEmptyBin = async (ids?: number[]) => {
    const msg = ids ? `Permanently delete ${ids.length} selected items?` : 'Permanently empty the entire bin?';
    if (!window.confirm(msg)) return;
    setBinActionLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || '/api/scan';
      const binUrl = apiUrl.replace('/scan', '/alerts/bin');
      await fetch(binUrl, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      setSelectedBinItems([]);
      fetchBin();
    } catch (err) {
      console.error(err);
      alert('Error deleting items');
    } finally {
      setBinActionLoading(false);
    }
  };

  const toggleBinSelection = (id: number) => {
    setSelectedBinItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="w-full max-w-lg mx-auto pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      
      {/* Notifications Card */}
      <div className="mb-6">
        <h3 className="text-primary font-semibold mb-4 px-1">Notifications</h3>
        <div className="bg-[#1e1e22]/40 backdrop-blur-md border border-white/10 rounded-xl p-4 space-y-6">
          
          {/* Push Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-4">
              <span className={clsx("material-symbols-outlined mt-0.5", isSubscribed ? "text-secondary" : "text-on-surface-variant")} style={isSubscribed ? { fontVariationSettings: "'FILL' 1" } : {}}>
                notifications
              </span>
              <div>
                <p className="font-medium text-on-surface">Push Notifications</p>
                <p className="text-sm text-on-surface-variant">
                  {isSubscribed ? 'Subscribed' : pushStatus === 'denied' ? 'Blocked' : 'Disabled'}
                </p>
              </div>
            </div>
            <button
              onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
              disabled={pushStatus === 'denied'}
              className="bg-[#2d3142] text-on-surface px-6 py-2 rounded-xl text-sm font-semibold hover:bg-surface-bright transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubscribed ? 'Disable' : pushStatus === 'denied' ? 'Blocked' : 'Enable'}
            </button>
          </div>

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
        </div>
      </div>

      {/* Recycle Bin Card */}
      <div className="mb-6">
        <h3 className="text-primary font-semibold mb-4 px-1 flex items-center justify-between">
          Recycle Bin
          {binLoading && <span className="material-symbols-outlined animate-spin text-lg">refresh</span>}
        </h3>
        <div className="bg-[#1e1e22]/40 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden flex flex-col">
          {binData.length === 0 ? (
            <div className="p-6 text-center text-on-surface-variant text-sm">
              The bin is currently empty.
            </div>
          ) : (
            <>
              <div className="max-h-[300px] overflow-y-auto hide-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-[#1e1e22] z-10 border-b border-white/10 text-on-surface-variant text-xs uppercase font-label-caps">
                    <tr>
                      <th className="py-2 px-3 w-10">
                        <input 
                          type="checkbox"
                          className="rounded border-outline-variant text-primary bg-transparent focus:ring-0 cursor-pointer"
                          checked={selectedBinItems.length === binData.length && binData.length > 0}
                          onChange={(e) => setSelectedBinItems(e.target.checked ? binData.map(d => d.id) : [])}
                        />
                      </th>
                      <th className="py-2 px-2 font-semibold">Asset</th>
                      <th className="py-2 px-2 text-center">RSI</th>
                      <th className="py-2 px-2 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-on-surface divide-y divide-white/5">
                    {binData.map(item => (
                      <tr key={item.id} className="hover:bg-surface-variant/30 transition-colors">
                        <td className="py-2 px-3">
                          <input 
                            type="checkbox"
                            className="rounded border-outline-variant text-primary bg-transparent focus:ring-0 cursor-pointer"
                            checked={selectedBinItems.includes(item.id)}
                            onChange={() => toggleBinSelection(item.id)}
                          />
                        </td>
                        <td className="py-2 px-2 font-semibold">{item.symbol.replace('USDT', '')}</td>
                        <td className="py-2 px-2 text-center">
                          <span className={clsx("inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs font-semibold", getRsiClass(item.max_rsi_value))}>
                            {item.max_rsi_value.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right text-xs text-on-surface-variant">
                          {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-3 border-t border-white/10 flex items-center justify-between gap-2 bg-surface-container-lowest/30">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRestore(selectedBinItems.length ? selectedBinItems : binData.map(d => d.id))}
                    disabled={binActionLoading || (selectedBinItems.length === 0 && binData.length === 0)}
                    className="px-3 py-1.5 bg-surface-variant hover:bg-surface-container-highest rounded-lg text-sm font-medium transition-colors disabled:opacity-50 text-on-surface"
                  >
                    {selectedBinItems.length ? `Restore (${selectedBinItems.length})` : 'Restore All'}
                  </button>
                  {selectedBinItems.length > 0 && (
                    <button
                      onClick={() => handleEmptyBin(selectedBinItems)}
                      disabled={binActionLoading}
                      className="px-3 py-1.5 border border-error/50 hover:bg-error/10 text-error rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      Delete ({selectedBinItems.length})
                    </button>
                  )}
                </div>
                
                <button
                  onClick={() => handleEmptyBin()}
                  disabled={binActionLoading || binData.length === 0}
                  className="px-3 py-1.5 bg-error/20 hover:bg-error/30 text-error rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Empty Bin
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 mb-8">
        <button
          onClick={handleTestNotification}
          disabled={testNotificationLoading}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-outline-variant hover:bg-surface-variant transition-colors text-on-surface font-medium disabled:opacity-50"
        >
          <span className={clsx("material-symbols-outlined text-xl", testNotificationLoading ? "animate-spin" : "transform -rotate-45")}>
            {testNotificationLoading ? 'sync' : 'send'}
          </span>
          Send Test Notification (BTC RSI)
        </button>

        <button
          onClick={handleClearAlerts}
          disabled={clearAlertsLoading}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-outline-variant hover:bg-surface-variant transition-colors text-on-surface font-medium disabled:opacity-50"
        >
          <span className={clsx("material-symbols-outlined text-xl", clearAlertsLoading && "animate-spin")}>
            {clearAlertsLoading ? 'sync' : 'delete'}
          </span>
          Clear Alerts History
        </button>

        <button
          onClick={handleForceRun}
          disabled={forceRunLoading}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-secondary text-on-secondary-container font-bold hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50"
        >
          <span className={clsx("material-symbols-outlined", forceRunLoading && "animate-spin")}>
            {forceRunLoading ? 'sync' : 'bolt'}
          </span>
          Force Run Scan Now
        </button>
      </div>

      {/* API Providers */}
      <div className="space-y-8">
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
