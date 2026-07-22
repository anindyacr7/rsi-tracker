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

  const { activeAlerts, archivedAlertsByDate } = useMemo(() => {
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    
    const active: Alert[] = [];
    const archived: Record<string, Alert[]> = {};

    data.forEach(item => {
      if (now - item.created_at <= ONE_DAY) {
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

  const handleBin = async (ids: number[], e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Move ${ids.length} alert(s) to the bin?`)) return;
    try {
      const scanApiUrl = import.meta.env.VITE_API_URL || '/api/scan';
      const apiUrl = scanApiUrl.replace('/scan', '/alerts/bin');
      const res = await fetch(apiUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      if (!res.ok) {
        let errMsg = 'Failed to move to bin';
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
      alert(err.message || 'Failed to move to bin');
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

  const renderAlertRows = (alerts: Alert[]) => (
    <div className="flex-1 overflow-x-auto hide-scrollbar w-full relative px-2 mb-4">
      <table className="text-left border-collapse w-full">
        <thead className="border-b border-outline-variant/30 text-on-surface-variant font-label-caps text-[10px] sm:text-xs uppercase sticky top-0 bg-[#1E1E22] z-10 shadow-sm">
          <tr>
            <th className="py-2 px-1 font-semibold">Asset</th>
            <th className="py-2 px-1 text-center">Max RSI</th>
            <th className="py-2 px-1 text-right">24h Move</th>
            <th className="py-2 px-1 text-right">Rank</th>
            <th className="py-2 px-1 text-center w-8"></th>
          </tr>
        </thead>
        
        <tbody className="font-data-tabular text-[13px] sm:text-sm text-on-surface divide-y divide-outline-variant/30">
          {alerts.map((item) => {
            const changeColorClass = item.percent_move_24h >= 0 ? 'text-secondary' : 'text-error';
            const changeSign = item.percent_move_24h >= 0 ? '+' : '';
            
            return (
              <tr 
                key={item.id} 
                className="border-b border-outline-variant/30 hover:bg-surface-container-highest/30 transition-colors cursor-pointer"
                onClick={() => onRowClick?.(item.symbol)}
              >
                <td className="py-2 px-1 font-semibold text-on-surface">
                  {item.symbol.replace('USDT', '')}
                </td>
                
                <td className="py-2 px-1 text-center">
                  <span className={clsx("inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs font-semibold", getRsiClass(item.max_rsi_value))}>
                    {item.max_rsi_value.toFixed(1)}
                  </span>
                </td>
                
                <td className={clsx("py-2 px-1 text-right font-semibold", changeColorClass)}>
                  {changeSign}{item.percent_move_24h.toFixed(1)}%
                </td>

                <td className="py-2 px-1 text-right text-on-surface-variant font-semibold">
                  {item.mcap_rank ? `#${item.mcap_rank}` : '-'}
                </td>

                <td className="py-2 px-1 text-center text-on-surface-variant">
                  <button 
                    onClick={(e) => handleBin([item.id], e)}
                    className="p-1 hover:text-error hover:bg-error/10 rounded-full transition-colors flex items-center justify-center"
                    title="Move to Bin"
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
      
      {/* Archives Section */}
      {Object.keys(archivedAlertsByDate).length > 0 && (
        <div className="flex flex-col gap-3">
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
                      title="Move all to Bin"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                  
                  {isExpanded && (
                    <div className="px-2 pb-2 bg-surface-container-lowest/50 border-t border-white/5">
                      {renderAlertRows(alerts)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Alerts Section */}
      <div className="flex flex-col gap-3 mt-4">
        <h2 className="text-lg font-semibold text-primary px-2">Active Alerts (Last 24h)</h2>
        {activeAlerts.length > 0 ? (
          <div className="bg-[#1e1e22]/40 backdrop-blur-md border border-white/10 rounded-xl p-2">
            {renderAlertRows(activeAlerts)}
          </div>
        ) : (
          <div className="px-4 py-6 bg-[#1e1e22]/40 border border-white/10 rounded-xl text-center text-on-surface-variant text-sm">
            No active alerts in the last 24 hours.
          </div>
        )}
      </div>

    </div>
  );
}
