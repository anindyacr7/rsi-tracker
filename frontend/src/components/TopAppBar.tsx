import clsx from 'clsx';
import { useState, useEffect } from 'react';
import { SettingsSheet } from './SettingsSheet';

interface TopAppBarProps {
  loading: boolean;
  onRefresh: () => void;
}

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

export function TopAppBar({ loading, onRefresh }: TopAppBarProps) {
  const [pushStatus, setPushStatus] = useState<'default' | 'granted' | 'denied'>('default');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPushStatus(Notification.permission);
    }
  }, []);

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

        alert('Subscribed to notifications successfully!');
      } catch (err) {
        console.error('Failed to subscribe the user: ', err);
      }
    }
  };

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-surface-container/80 dark:bg-surface-container/80 backdrop-blur-md border-b border-outline-variant/30 flex justify-between items-center px-margin-mobile md:px-margin-desktop h-16 transition-colors">
        <div className="flex items-center gap-stack-sm hover:bg-surface-container-highest/50 transition-colors p-2 rounded-lg cursor-pointer">
          <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="FoxLedger Logo" className="w-8 h-8 rounded-md object-contain" />
          <h1 className="font-headline-md-mobile md:font-headline-md text-headline-md-mobile md:text-headline-md text-white font-extrabold tracking-tight">FoxLedger - Screener</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSettingsOpen(true)}
            title="Settings"
            className="flex items-center justify-center p-2 rounded-full hover:bg-surface-container-highest/50 text-on-surface-variant transition-colors active:scale-95"
          >
            <span className="material-symbols-outlined">
              settings
            </span>
          </button>

          <button 
            onClick={onRefresh} 
            aria-label="Refresh Data" 
            className="flex items-center justify-center p-2 rounded-full hover:bg-surface-container-highest/50 text-on-surface-variant transition-colors active:scale-95"
          >
            <span className={clsx("material-symbols-outlined", loading && "animate-spin")}>refresh</span>
          </button>
        </div>
      </header>

      <SettingsSheet 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        pushStatus={pushStatus} 
        onSubscribe={handleSubscribe} 
      />
    </>
  );
}
