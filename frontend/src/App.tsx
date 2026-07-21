import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ScanResult, SortField, SortDirection, Alert } from './types';
import { TopAppBar } from './components/TopAppBar';
import { BottomNavBar } from './components/BottomNavBar';
import { DataTable } from './components/DataTable';
import { AlertsTable } from './components/AlertsTable';

import { fetchValidUSDTPairs, fetchKlines } from './utils/binance';
import { calculateRSI } from './utils/rsi';

export default function App() {
  const [data, setData] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [mcapSource, setMcapSource] = useState<'cmc' | 'coinlore' | null>(null);

  // Load initial state from URL or localStorage
  const getInitialState = () => {
    const params = new URLSearchParams(window.location.search);
    const tab = (params.get('tab') || localStorage.getItem('activeTab') || 'rsi') as 'rsi' | 'movers' | 'alerts';
    
    let initialRsiSort = { field: null, dir: 'desc' as SortDirection };
    try { initialRsiSort = JSON.parse(localStorage.getItem('rsiSort') || '') || initialRsiSort; } catch {}
    
    let initialMoversSort = { field: 'percentMove24h' as SortField, dir: 'desc' as SortDirection };
    try { initialMoversSort = JSON.parse(localStorage.getItem('moversSort') || '') || initialMoversSort; } catch {}

    return { tab, initialRsiSort, initialMoversSort };
  };

  const initialState = useMemo(getInitialState, []);

  const [activeTab, setActiveTab] = useState<'rsi' | 'movers' | 'alerts'>(initialState.tab);
  const [alertsData, setAlertsData] = useState<Alert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  // Sort state
  const [rsiSort, setRsiSort] = useState<{ field: SortField, dir: SortDirection }>(initialState.initialRsiSort);
  const [moversSort, setMoversSort] = useState<{ field: SortField, dir: SortDirection }>(initialState.initialMoversSort);

  // Sync to localStorage and URL
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', activeTab);
    window.history.replaceState({}, '', url);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('rsiSort', JSON.stringify(rsiSort));
  }, [rsiSort]);

  useEffect(() => {
    localStorage.setItem('moversSort', JSON.stringify(moversSort));
  }, [moversSort]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSecondsElapsed(0);
    const interval = setInterval(() => setSecondsElapsed(s => s + 1), 1000);
    try {
      let apiUrl = import.meta.env.VITE_API_URL || '/api/scan';
      const mcapProvider = localStorage.getItem('mcapProvider');
      if (mcapProvider) {
        apiUrl += `?mcapProvider=${mcapProvider}`;
      }

      // 1 & 2. Fetch CMC Data AND Binance Tickers concurrently to save ~0.5s - 1s
      const [mcapRes, allTickers] = await Promise.all([
        fetch(apiUrl),
        fetchValidUSDTPairs()
      ]);
      
      if (!mcapRes.ok) throw new Error(`Worker HTTP ${mcapRes.status}`);
      const mcapJson = await mcapRes.json();
      const mcapData: { base: string; mcap: number; rank: number }[] = mcapJson.data || [];
      const mcapMap = new Map(mcapData.map(d => [d.base, d]));
      setMcapSource(mcapJson.meta?.mcapSource || null);

      // 3. Filter tickers by CMC Top 200
      const tickers = allTickers.filter(t => mcapMap.has(t.symbol.replace('USDT', '')));

      // 4. Fetch Klines for Top 250 only
      const rsiSymbols = tickers
        .filter(t => {
          const rank = mcapMap.get(t.symbol.replace('USDT', ''))?.rank;
          return rank && rank <= 250;
        })
        .map(t => t.symbol);

      const timeframes = ['15m', '4h', '1d'] as const;
      const klineMap = new Map<string, Map<string, number[]>>();

      // Batch requests locally in the browser to avoid blocking
      const CHUNK_SIZE = 50; // 150 subrequests per chunk
      for (let i = 0; i < rsiSymbols.length; i += CHUNK_SIZE) {
        const chunk = rsiSymbols.slice(i, i + CHUNK_SIZE);
        const promises = chunk.flatMap(symbol =>
          timeframes.map(async tf => {
            const closes = await fetchKlines(symbol, tf);
            return { symbol, tf, closes };
          })
        );

        const results = await Promise.all(promises);

        for (const { symbol, tf, closes } of results) {
          if (!klineMap.has(symbol)) klineMap.set(symbol, new Map());
          klineMap.get(symbol)!.set(tf, closes);
        }
      }

      // 5. Build Final Data
      const combinedData: ScanResult[] = tickers.map(ticker => {
        const base = ticker.symbol.replace('USDT', '');
        const mcapInfo = mcapMap.get(base);
        const klines = klineMap.get(ticker.symbol);

        return {
          symbol: ticker.symbol,
          price: parseFloat(ticker.lastPrice),
          percentMove24h: parseFloat(ticker.priceChangePercent),
          volume24h: parseFloat(ticker.quoteVolume),
          mcap: mcapInfo?.mcap ?? null,
          cmcRank: mcapInfo?.rank ?? null,
          rsi15m: klines?.get('15m') && klines.get('15m')!.length > 14 ? calculateRSI(klines.get('15m')!) : null,
          rsi4h: klines?.get('4h') && klines.get('4h')!.length > 14 ? calculateRSI(klines.get('4h')!) : null,
          rsi24h: klines?.get('1d') && klines.get('1d')!.length > 14 ? calculateRSI(klines.get('1d')!) : null,
        };
      });

      setData(combinedData);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data.');
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const scanApiUrl = import.meta.env.VITE_API_URL || '/api/scan';
      const alertsApiUrl = scanApiUrl.replace('/scan', '/alerts');
      const res = await fetch(alertsApiUrl);
      if (res.ok) {
        const json = await res.json();
        setAlertsData(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'alerts') {
      fetchAlerts();
    }
  }, [activeTab, fetchAlerts]);

  // Sorting and Filtering logic
  const processData = (tabData: ScanResult[], tab: 'rsi' | 'movers' | 'alerts') => {
    let processed = [...tabData];

    // Hard cap RSI scanner to top 250 coins by rank
    if (tab === 'rsi') {
      processed = processed.filter(item => item.cmcRank && item.cmcRank <= 250);
    }

    const sortConfig = tab === 'rsi' ? rsiSort : moversSort;
    if (sortConfig.field) {
      processed = [...processed].sort((a, b) => {
        const aVal = a[sortConfig.field!];
        const bVal = b[sortConfig.field!];

        if (aVal === null) return 1;
        if (bVal === null) return -1;

        if (aVal < bVal) return sortConfig.dir === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.dir === 'asc' ? 1 : -1;
        
        // Secondary sort by percentMove24h
        const aMove = a.percentMove24h;
        const bMove = b.percentMove24h;
        if (aMove !== bMove) return aMove > bMove ? -1 : 1;

        // Tertiary sort by mcap
        const aMcap = a.mcap || 0;
        const bMcap = b.mcap || 0;
        return aMcap > bMcap ? -1 : 1;
      });
    }

    return processed;
  };

  const displayedData = useMemo(() => {
    return processData(data, activeTab);
  }, [data, activeTab, rsiSort, moversSort]);

  // Sorting handlers
  const handleSort = (field: SortField) => {
    if (activeTab === 'rsi') {
      setRsiSort(prev => ({
        field,
        dir: prev.field === field && prev.dir === 'desc' ? 'asc' : 'desc'
      }));
    } else {
      setMoversSort(prev => ({
        field,
        dir: prev.field === field && prev.dir === 'desc' ? 'asc' : 'desc'
      }));
    }
  };

  const currentSort = activeTab === 'rsi' ? rsiSort : moversSort;

  return (
    <div className="font-body-base text-body-base bg-background min-h-screen flex flex-col overflow-hidden pb-[64px] md:pb-0 pt-[64px] text-on-background">

      <TopAppBar loading={loading} onRefresh={fetchData} />

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto w-full relative">
        <div className="max-w-container-max mx-auto h-full flex flex-col px-margin-mobile md:px-margin-desktop py-stack-md mt-4">

          {error && !loading && (
            <div className="mb-4 bg-tertiary-container/10 border border-tertiary-container/30 text-tertiary p-4 rounded-lg text-sm">
              {error}
            </div>
          )}

          {mcapSource === 'coinlore' && !loading && (
            <div className="mb-4 bg-error/10 border border-error/30 text-error px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">warning</span>
              API limit reached: Market Cap data fetched via fallback (Coinlore)
            </div>
          )}

          {activeTab === 'alerts' ? (
            <AlertsTable data={alertsData} loading={alertsLoading} />
          ) : (
            <DataTable
              activeTab={activeTab as 'rsi' | 'movers'}
              data={displayedData}
              loading={loading}
              secondsElapsed={secondsElapsed}
              currentSort={currentSort}
              onSort={handleSort}
            />
          )}

        </div>
      </main>

      <BottomNavBar activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab)} />

      <style>{`
        .pb-safe { padding-bottom: max(env(safe-area-inset-bottom), 0.5rem); }
      `}</style>
    </div>
  );
}
