import clsx from 'clsx';
import type { ScanResult, SortField, SortDirection } from '../types';
import { SortableTh } from './SortableTh';
import { SkeletonRow } from './SkeletonRow';
import { getRsiClass, formatCurrency, formatCompactCurrency } from '../utils/formatters';

interface DataTableProps {
  activeTab: 'rsi' | 'movers';
  data: ScanResult[];
  loading: boolean;
  secondsElapsed?: number;
  currentSort: { field: SortField; dir: SortDirection };
  onSort: (field: SortField) => void;
}

const SKELETON_ROWS = 15;

export function DataTable({ activeTab, data, loading, secondsElapsed = 0, currentSort, onSort }: DataTableProps) {
  return (
    <div className="flex-1 overflow-x-auto hide-scrollbar w-full relative">
      {loading && activeTab === 'rsi' && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-primary text-on-primary px-4 py-2 rounded-full shadow-lg font-semibold text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
          Scanning markets... {secondsElapsed}s
        </div>
      )}
      <table className={clsx(
        "text-left border-collapse",
        activeTab === 'rsi' ? "w-full min-w-[800px]" : "w-full max-w-3xl mx-auto"
      )}>
        <thead className="border-b border-outline-variant/30 text-on-surface-variant font-label-caps text-label-caps uppercase sticky top-0 bg-[#1E1E22] z-10 shadow-sm">
          <tr>
            <th className="py-2 px-2 font-semibold w-12 text-center">#</th>
            
            <SortableTh field="symbol" currentSort={currentSort} onSort={onSort} className="py-2 px-2">Asset</SortableTh>
            <SortableTh field="cmcRank" currentSort={currentSort} onSort={onSort} align="center" className="py-2 px-2 text-center">Rank</SortableTh>
            
            {activeTab === 'movers' && (
              <SortableTh field="price" currentSort={currentSort} onSort={onSort} align="right" iconAlign="right" className="py-2 px-2">Price</SortableTh>
            )}
            
            <SortableTh field="percentMove24h" currentSort={currentSort} onSort={onSort} align="right" iconAlign="right" className="py-2 px-2">24h %</SortableTh>
            
            {activeTab === 'rsi' ? (
              <>
                <SortableTh field="rsi15m" currentSort={currentSort} onSort={onSort} align="center" className="py-2 px-2 text-center">15m RSI</SortableTh>
                <SortableTh field="rsi4h" currentSort={currentSort} onSort={onSort} align="center" className="py-2 px-2 text-center">4h RSI</SortableTh>
                <SortableTh field="rsi24h" currentSort={currentSort} onSort={onSort} align="center" className="py-2 px-2 text-center">24h RSI</SortableTh>
                <SortableTh field="mcap" currentSort={currentSort} onSort={onSort} align="right" iconAlign="right" className="py-2 px-2">Mcap</SortableTh>
                <SortableTh field="volume24h" currentSort={currentSort} onSort={onSort} align="right" iconAlign="right" className="py-2 px-2">Vol(24h)</SortableTh>
                <SortableTh field="price" currentSort={currentSort} onSort={onSort} align="right" iconAlign="right" className="py-2 px-2">Price</SortableTh>
              </>
            ) : (
              <>
                <SortableTh field="volume24h" currentSort={currentSort} onSort={onSort} align="right" iconAlign="right" className="py-2 px-2">Vol(24h)</SortableTh>
              </>
            )}
          </tr>
        </thead>
        
        <tbody className="font-data-tabular text-data-tabular text-on-surface divide-y divide-outline-variant/30">
          {loading ? (
            Array(SKELETON_ROWS).fill(0).map((_, i) => (
              <SkeletonRow key={`skel-${i}`} activeTab={activeTab} />
            ))
          ) : (
            data.map((item, idx) => {
              const changeColorClass = item.percentMove24h >= 0 ? 'text-secondary' : 'text-error';
              const changeSign = item.percentMove24h >= 0 ? '+' : '';
              
              return (
                <tr key={item.symbol} className="border-b border-outline-variant/30 hover:bg-surface-container-highest/30 transition-colors cursor-pointer group">
                  <td className="py-2 px-2 text-center text-on-surface-variant group-hover:text-on-surface transition-colors">
                    {idx + 1}
                  </td>
                  
                  <td className="py-2 px-2 font-semibold flex items-center gap-2 text-on-surface">
                    {item.symbol.replace('USDT', '')} <span className="text-on-surface-variant font-normal text-xs ml-1 hidden sm:inline">USDT</span>
                  </td>

                  <td className="py-2 px-2 text-center text-on-surface-variant font-semibold">
                    {item.cmcRank ? `#${item.cmcRank}` : '-'}
                  </td>
                  
                  {activeTab === 'movers' && (
                    <td className="py-2 px-2 text-right text-on-surface">
                      {formatCurrency(item.price)}
                    </td>
                  )}
                  
                  <td className={clsx("py-2 px-2 text-right font-semibold", changeColorClass)}>
                    {changeSign}{item.percentMove24h.toFixed(2)}%
                  </td>
                  
                  {activeTab === 'rsi' ? (
                    <>
                      <td className="py-2 px-2 text-center"><span className={clsx("inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold", getRsiClass(item.rsi15m))}>{item.rsi15m?.toFixed(1) || '-'}</span></td>
                      <td className="py-2 px-2 text-center"><span className={clsx("inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold", getRsiClass(item.rsi4h))}>{item.rsi4h?.toFixed(1) || '-'}</span></td>
                      <td className="py-2 px-2 text-center"><span className={clsx("inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold", getRsiClass(item.rsi24h))}>{item.rsi24h?.toFixed(1) || '-'}</span></td>
                      <td className="py-2 px-2 text-right text-on-surface-variant">{item.mcap ? formatCompactCurrency(item.mcap) : '-'}</td>
                      <td className="py-2 px-2 text-right text-on-surface-variant">{formatCompactCurrency(item.volume24h)}</td>
                      <td className="py-2 px-2 text-right text-on-surface">{formatCurrency(item.price)}</td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 px-2 text-right text-on-surface-variant">{formatCompactCurrency(item.volume24h)}</td>
                    </>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
