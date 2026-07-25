import clsx from 'clsx';
import { useState, useMemo } from 'react';
import type { Alert } from '../types';
import { getRsiClass } from '../utils/formatters';

interface AlertsTableProps {
  data: Alert[];
  loading: boolean;
  onRowClick?: (symbol: string) => void;
  onRefresh?: () => void;
}

export function AlertsTable({ data, loading, onRowClick, onRefresh }: AlertsTableProps) {
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [forceRunLoading, setForceRunLoading] = useState(false);
  const [testNotificationLoading, setTestNotificationLoading] = useState(false);
  const [restoreAlertsLoading, setRestoreAlertsLoading] = useState(false);

  const { activeAlerts, archivedAlertsByDate } = useMemo(() => {
    const now = Date.now();
    const TWO_DAYS = 48 * 60 * 60 * 1000;
    
    const active: Alert[] = [];
    const archived: Record<string, Alert[]> = {};

    data.forEach(item => {
      if (now - item.created_at <= TWO_DAYS) {
        active.push(item);
      } else {
        const dateStr = new Date(item.created_at).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        if (!archived[dateStr]) archived[dateStr] = [];
        archived[dateStr].push(item);
      }
    });

    return { activeAlerts: active, archivedAlertsByDate: archived };
  }, [data]);

  const handleBin = async (symbols: string[], e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Permanently delete ${symbols.length} alert(s)?`)) return;
    try {
      const scanApiUrl = import.meta.env.VITE_API_URL || '/api/scan';
      const apiUrl = scanApiUrl.replace('/scan', '/alerts');
      const res = await fetch(apiUrl, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols })
      });
      if (!res.ok) {
        let errMsg = 'Failed to delete alert(s)';
        try {
          const errJson = await res.json();
          if (errJson.message) errMsg += `: ${errJson.message}`;
          else if (errJson.error) errMsg += `: ${errJson.error}`;
        } catch (_) {
          errMsg += ` (HTTP ${res.status})`;
        }
        throw new Error(errMsg);
      }
      onRefresh?.();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to delete alert(s)');
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

  const handleTestNotification = async () => {
    try {
      setTestNotificationLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || '/api/scan';
      const testUrl = apiUrl.replace('/scan', '/test-notification');
      
      const res = await fetch(testUrl);
      if (!res.ok) {
        let errMsg = 'Failed to send test notification';
        try {
          const errJson = await res.json();
          if (errJson.message) errMsg += `: ${errJson.message}`;
          else if (errJson.error) errMsg += `: ${errJson.error}`;
        } catch (_) {}
        throw new Error(errMsg);
      }
      alert('Test notification sent successfully!');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error sending test notification');
    } finally {
      setTestNotificationLoading(false);
    }
  };

  const handleRestoreAlerts = async () => {
    if (!window.confirm('Are you sure you want to restore alerts from the backup? This will bring back previously deleted alerts.')) return;
    try {
      setRestoreAlertsLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || '/api/scan';
      const restoreUrl = apiUrl.replace('/scan', '/alerts/restore');
      
      const res = await fetch(restoreUrl, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to restore alerts data');
      alert('Alerts restored successfully! Refresh the page to see changes.');
      onRefresh?.();
    } catch (err: any) {
      console.error(err);
      alert('Error restoring alerts data');
    } finally {
      setRestoreAlertsLoading(false);
    }
  };

  const toggleDate = (dateStr: string) => {
    setExpandedDates(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-10">
        <span className="material-symbols-outlined text-[32px] animate-spin text-primary">refresh</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex justify-center items-center py-10 text-on-surface-variant text-sm">
        No active or archived alerts found.
      </div>
    );
  }

  const renderAlertRows = (alerts: Alert[], isArchive: boolean = false) => (
    <div className="flex-1 overflow-x-auto hide-scrollbar w-full relative">
      <table className={clsx("text-left border-collapse", isArchive ? "w-full" : "w-full max-w-3xl mx-auto")}>
        <thead className="border-b border-outline-variant/30 text-on-surface-variant font-label-caps text-label-caps uppercase sticky top-0 bg-[#1E1E22] z-10 shadow-sm">
          <tr>
            <th className="py-2 px-2 font-semibold w-12 text-center">#</th>
            <th className="py-2 px-2 font-semibold">Asset</th>
            <th className="py-2 px-2 text-center">Max RSI</th>
            <th className="py-2 px-2 text-right">24h Move</th>
            <th className="py-2 px-2 text-center text-right">Rank</th>
            <th className="py-2 px-2 text-center w-10"></th>
          </tr>
        </thead>
        
        <tbody className="font-data-tabular text-data-tabular text-on-surface divide-y divide-outline-variant/30">
          {alerts.map((item, idx) => {
            const changeColorClass = item.percent_move_24h >= 0 ? 'text-secondary' : 'text-error';
            const changeSign = item.percent_move_24h >= 0 ? '+' : '';
            
            return (
              <tr 
                key={item.symbol} 
                className="border-b border-outline-variant/30 hover:bg-surface-container-highest/30 transition-colors cursor-pointer group"
                onClick={() => onRowClick?.(item.symbol)}
              >
                <td className="py-2 px-2 text-center text-on-surface-variant group-hover:text-on-surface transition-colors">
                  {idx + 1}
                </td>
                
                <td className="py-2 px-2 font-semibold flex items-center gap-2 text-on-surface">
                  {item.symbol.replace('USDT', '')} <span className="text-on-surface-variant font-normal text-xs ml-1 hidden sm:inline">USDT</span>
                </td>
                
                <td className="py-2 px-2 text-center">
                  <span className={clsx("inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold", getRsiClass(item.max_rsi_value))}>
                    {item.max_rsi_value.toFixed(1)}
                  </span>
                </td>
                
                <td className={clsx("py-2 px-2 text-right font-semibold", changeColorClass)}>
                  {changeSign}{item.percent_move_24h.toFixed(2)}%
                </td>

                <td className="py-2 px-2 text-right text-on-surface-variant font-semibold">
                  {item.mcap_rank ? `#${item.mcap_rank}` : '-'}
                </td>

                <td className="py-2 px-2 text-center text-on-surface-variant">
                  <button 
                    onClick={(e) => handleBin([item.symbol], e)}
                    className="p-1 hover:text-error hover:bg-error/10 rounded-full transition-colors flex items-center justify-center ml-auto"
                    title="Delete"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300">
      
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-end gap-3 max-w-3xl mx-auto w-full px-2">
        <button
          onClick={handleTestNotification}
          disabled={testNotificationLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant hover:bg-surface-variant transition-colors text-on-surface font-medium text-sm disabled:opacity-50"
        >
          <span className={clsx("material-symbols-outlined text-[18px]", testNotificationLoading ? "animate-spin" : "transform -rotate-45")}>
            {testNotificationLoading ? 'sync' : 'send'}
          </span>
          Test Alert
        </button>
        
        <button
          onClick={handleRestoreAlerts}
          disabled={restoreAlertsLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant hover:bg-surface-variant transition-colors text-on-surface font-medium text-sm disabled:opacity-50"
        >
          <span className={clsx("material-symbols-outlined text-[18px]", restoreAlertsLoading && "animate-spin")}>
            {restoreAlertsLoading ? 'sync' : 'restore'}
          </span>
          Restore
        </button>
        
        <button
          onClick={handleForceRun}
          disabled={forceRunLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant bg-surface-container-highest hover:bg-surface-variant transition-colors text-on-surface font-medium text-sm disabled:opacity-50"
        >
          <span className={clsx("material-symbols-outlined text-[18px]", forceRunLoading && "animate-spin")}>
            {forceRunLoading ? 'sync' : 'bolt'}
          </span>
          Force Scan
        </button>
      </div>

      {/* Active Alerts Section */}
      <div className="w-full flex flex-col">
        {activeAlerts.length > 0 ? (
          renderAlertRows(activeAlerts, false)
        ) : (
          <div className="flex justify-center items-center py-10 text-on-surface-variant text-sm">
            No active alerts in the last 48 hours.
          </div>
        )}
      </div>

      {/* Archives Section */}
      {Object.keys(archivedAlertsByDate).length > 0 && (
        <div className="flex flex-col gap-3 max-w-3xl mx-auto w-full">
          <h2 className="text-lg font-semibold text-primary px-2">Archives</h2>
          <div className="flex flex-col gap-2">
            {Object.entries(archivedAlertsByDate).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()).map(([dateStr, alerts]) => {
              const isExpanded = expandedDates[dateStr];
              return (
                <div key={dateStr} className="bg-[#1e1e22]/40 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden">
                  <div 
                    className="flex justify-between items-center p-3 cursor-pointer hover:bg-surface-variant/30 transition-colors"
                    onClick={() => toggleDate(dateStr)}
                  >
                    <div className="flex items-center gap-2">
                      <span className={clsx("material-symbols-outlined transition-transform duration-300", isExpanded ? "rotate-180" : "")}>
                        expand_more
                      </span>
                      <span className="font-medium text-on-surface">{dateStr}</span>
                      <span className="text-xs bg-surface-container-highest px-2 py-0.5 rounded-full text-on-surface-variant">
                        {alerts.length}
                      </span>
                    </div>
                    <button 
                      onClick={(e) => handleBin(alerts.map(a => a.id), e)}
                      className="p-1.5 hover:text-error hover:bg-error/10 rounded-full transition-colors flex items-center justify-center text-on-surface-variant"
                      title="Delete all"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                  
                  {isExpanded && (
                    <div className="px-0 pb-2 bg-surface-container-lowest/50 border-t border-white/5">
                      {renderAlertRows(alerts, true)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

