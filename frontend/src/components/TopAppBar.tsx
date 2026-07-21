import clsx from 'clsx';

interface TopAppBarProps {
  loading: boolean;
  onRefresh: () => void;
  onSettingsClick: () => void;
  onLogoClick?: () => void;
}

export function TopAppBar({ loading, onRefresh, onSettingsClick, onLogoClick }: TopAppBarProps) {
  return (
    <header className="fixed top-0 w-full z-50 bg-surface-container/80 dark:bg-surface-container/80 backdrop-blur-md border-b border-outline-variant/30 flex justify-between items-center px-margin-mobile md:px-margin-desktop h-16 transition-colors">
      <div 
        className="flex items-center gap-stack-sm hover:bg-surface-container-highest/50 transition-colors p-2 rounded-lg cursor-pointer active:scale-95"
        onClick={onLogoClick}
      >
        <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="FoxLedger Logo" className="w-8 h-8 rounded-md object-contain" />
        <h1 className="font-headline-md-mobile md:font-headline-md text-headline-md-mobile md:text-headline-md text-white font-extrabold tracking-tight">FoxLedger - Screener</h1>
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={onSettingsClick}
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
  );
}
