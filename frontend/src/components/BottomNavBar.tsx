import clsx from 'clsx';

interface BottomNavBarProps {
  activeTab: 'rsi' | 'movers' | 'alerts';
  onTabChange: (tab: 'rsi' | 'movers' | 'alerts') => void;
}

export function BottomNavBar({ activeTab, onTabChange }: BottomNavBarProps) {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center h-16 pb-safe bg-surface-container dark:bg-surface-container border-t border-outline-variant/30">
      <button
        onClick={() => onTabChange('rsi')}
        className={clsx(
          "flex flex-col items-center justify-center w-full h-full active:scale-90 transition-transform relative",
          activeTab === 'rsi'
            ? "text-secondary dark:text-secondary-fixed-dim after:content-[''] after:absolute after:top-0 after:w-12 after:h-0.5 after:bg-secondary"
            : "text-outline dark:text-outline hover:text-on-surface transition-colors"
        )}
      >
        <span className="material-symbols-outlined mb-1" style={activeTab === 'rsi' ? { fontVariationSettings: "'FILL' 1" } : {}}>query_stats</span>
        <span className="font-label-caps text-label-caps">RSI Scanner</span>
      </button>

      <button
        onClick={() => onTabChange('movers')}
        className={clsx(
          "flex flex-col items-center justify-center w-full h-full active:scale-90 transition-transform relative",
          activeTab === 'movers'
            ? "text-secondary dark:text-secondary-fixed-dim after:content-[''] after:absolute after:top-0 after:w-12 after:h-0.5 after:bg-secondary"
            : "text-outline dark:text-outline hover:text-on-surface transition-colors"
        )}
      >
        <span className="material-symbols-outlined mb-1" style={activeTab === 'movers' ? { fontVariationSettings: "'FILL' 1" } : {}}>trending_up</span>
        <span className="font-label-caps text-label-caps">Top Movers</span>
      </button>

      <button
        onClick={() => onTabChange('alerts')}
        className={clsx(
          "flex flex-col items-center justify-center w-full h-full active:scale-90 transition-transform relative",
          activeTab === 'alerts'
            ? "text-secondary dark:text-secondary-fixed-dim after:content-[''] after:absolute after:top-0 after:w-12 after:h-0.5 after:bg-secondary"
            : "text-outline dark:text-outline hover:text-on-surface transition-colors"
        )}
      >
        <span className="material-symbols-outlined mb-1" style={activeTab === 'alerts' ? { fontVariationSettings: "'FILL' 1" } : {}}>notifications</span>
        <span className="font-label-caps text-label-caps">Alerts</span>
      </button>
    </nav>
  );
}
