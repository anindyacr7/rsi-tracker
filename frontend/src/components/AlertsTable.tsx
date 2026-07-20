import clsx from 'clsx';
import type { Alert } from '../types';
import { getRsiClass } from '../utils/formatters';

interface AlertsTableProps {
  data: Alert[];
  loading: boolean;
}

export function AlertsTable({ data, loading }: AlertsTableProps) {
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
        No active alerts in the last 24 hours.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-x-auto hide-scrollbar w-full relative">
      <table className="text-left border-collapse w-full min-w-[800px]">
        <thead className="border-b border-outline-variant/30 text-on-surface-variant font-label-caps text-label-caps uppercase sticky top-0 bg-[#1E1E22] z-10 shadow-sm">
          <tr>
            <th className="py-2 px-2 font-semibold">Asset</th>
            <th className="py-2 px-2 text-center">First Hit</th>
            <th className="py-2 px-2 text-center">First RSI</th>
            <th className="py-2 px-2 text-center">Max RSI</th>
            <th className="py-2 px-2 text-right">24h % Move</th>
            <th className="py-2 px-2 text-center">Mcap Rank</th>
          </tr>
        </thead>
        
        <tbody className="font-data-tabular text-data-tabular text-on-surface divide-y divide-outline-variant/30">
          {data.map((item) => {
            const changeColorClass = item.percent_move_24h >= 0 ? 'text-secondary' : 'text-error';
            const changeSign = item.percent_move_24h >= 0 ? '+' : '';
            
            return (
              <tr key={item.symbol} className="border-b border-outline-variant/30 hover:bg-surface-container-highest/30 transition-colors">
                <td className="py-2 px-2 font-semibold flex items-center gap-2 text-on-surface">
                  {item.symbol.replace('USDT', '')} <span className="text-on-surface-variant font-normal text-xs ml-1">USDT</span>
                </td>
                
                <td className="py-2 px-2 text-center text-on-surface-variant">
                  {new Date(item.first_hit_time).toLocaleString()}
                </td>
                
                <td className="py-2 px-2 text-center">
                  <span className={clsx("inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold", getRsiClass(item.first_rsi_value))}>
                    {item.first_rsi_value.toFixed(1)}
                  </span>
                </td>
                
                <td className="py-2 px-2 text-center">
                  <span className={clsx("inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold", getRsiClass(item.max_rsi_value))}>
                    {item.max_rsi_value.toFixed(1)}
                  </span>
                </td>
                
                <td className={clsx("py-2 px-2 text-right font-semibold", changeColorClass)}>
                  {changeSign}{item.percent_move_24h.toFixed(2)}%
                </td>

                <td className="py-2 px-2 text-center text-on-surface-variant font-semibold">
                  {item.mcap_rank ? `#${item.mcap_rank}` : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
