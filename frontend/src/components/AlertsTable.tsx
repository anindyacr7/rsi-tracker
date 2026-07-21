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
    <div className="flex-1 overflow-x-auto hide-scrollbar w-full relative px-2">
      <table className="text-left border-collapse w-full">
        <thead className="border-b border-outline-variant/30 text-on-surface-variant font-label-caps text-[10px] sm:text-xs uppercase sticky top-0 bg-[#1E1E22] z-10 shadow-sm">
          <tr>
            <th className="py-2 px-1 font-semibold">Asset</th>
            <th className="py-2 px-1 text-center">Max RSI</th>
            <th className="py-2 px-1 text-right">24h Move</th>
            <th className="py-2 px-1 text-right">Rank</th>
          </tr>
        </thead>
        
        <tbody className="font-data-tabular text-[13px] sm:text-sm text-on-surface divide-y divide-outline-variant/30">
          {data.map((item) => {
            const changeColorClass = item.percent_move_24h >= 0 ? 'text-secondary' : 'text-error';
            const changeSign = item.percent_move_24h >= 0 ? '+' : '';
            
            return (
              <tr key={item.symbol} className="border-b border-outline-variant/30 hover:bg-surface-container-highest/30 transition-colors">
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
