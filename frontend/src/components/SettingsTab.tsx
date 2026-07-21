import clsx from 'clsx';
import { useState, useEffect } from 'react';

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
  
  const [testNotificationLoading, setTestNotificationLoading] = useState(false);
  const [clearAlertsLoading, setClearAlertsLoading] = useState(false);
  const [forceRunLoading, setForceRunLoading] = useState(false);
  const [rsiThreshold, setRsiThreshold] = useState(75);
  const [isSavingThreshold, setIsSavingThreshold] = useState(false);
  
  const [pushStatus, setPushStatus] = useState<'default' | 'granted' | 'denied'>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);

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
        // Optional: show a small success indication
      }
    } catch (err) {
      console.error("Failed to save threshold", err);
      alert('Error saving threshold');
    } finally {
      setIsSavingThreshold(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 p-1 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
              onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
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
          
          <button
            onClick={handleForceRun}
            disabled={forceRunLoading}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-secondary text-on-secondary hover:bg-secondary/90 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className={clsx("material-symbols-outlined", forceRunLoading && "animate-spin")}>
              {forceRunLoading ? 'sync' : 'bolt'}
            </span>
            Force Run Scan Now
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
  );
}
