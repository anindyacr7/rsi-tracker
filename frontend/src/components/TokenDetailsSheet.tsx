import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';
import type { IChartApi } from 'lightweight-charts';
import { fetchKlinesOHLC, type KlineOHLC } from '../utils/binance';
import type { ScanResult } from '../types';

interface TokenDetailsSheetProps {
  token: ScanResult | null;
  onClose: () => void;
  tokenRsi?: number;
}

export function TokenDetailsSheet({ token, onClose, tokenRsi }: TokenDetailsSheetProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [interval, setInterval] = useState<'15m' | '1h' | '4h' | '1d'>('1h');
  const [chartData, setChartData] = useState<KlineOHLC[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [token]);

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      const data = await fetchKlinesOHLC(token.symbol, interval, 200);
      if (isMounted) {
        setChartData(data.candles);
        setLoading(false);
      }
    };

    loadData();

    return () => { isMounted = false; };
  }, [token, interval]);

  useEffect(() => {
    if (!chartContainerRef.current || chartData.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8d90a1',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      rightPriceScale: {
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#42e091',
      downColor: '#ff5352',
      borderVisible: false,
      wickUpColor: '#42e091',
      wickDownColor: '#ff5352',
    });

    // Ensure data is sorted by time and strictly typed
    const formattedData = chartData
      .sort((a, b) => a.time - b.time)
      .map(d => ({
        time: d.time as any, // lightweight-charts expects UTCTimestamp
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));

    candlestickSeries.setData(formattedData);
    chart.timeScale().fitContent();
    chartRef.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [chartData]);

  if (!token) return null;

  const price = token.price || 0;
  const change = token.percentMove24h || 0;
  const isPositive = change >= 0;
  const baseAsset = token.symbol.replace('USDT', '');

  // Estimate some stats based on available data
  const vol = token.volume24h || 0;
  const volFormatted = vol > 1e9 ? `$${(vol / 1e9).toFixed(2)}B` : `$${(vol / 1e6).toFixed(2)}M`;

  return (
    <div className="fixed inset-0 z-[100] bottom-sheet-overlay transition-opacity duration-300">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="bottom-sheet fixed bottom-0 left-0 right-0 max-w-[600px] mx-auto bg-surface-dim rounded-t-[2rem] h-[92vh] flex flex-col shadow-2xl border-t border-outline-variant/20 animate-in slide-in-from-bottom-full duration-300">

        {/* Handle Indicator */}
        <div className="w-full flex justify-center py-4 cursor-pointer" onClick={onClose}>
          <div className="w-12 h-1.5 bg-outline-variant rounded-full opacity-40"></div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-24 md:px-8 hide-scrollbar">

          {/* Token Header */}
          <div className="flex flex-col items-center text-center mt-4 mb-8">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="font-headline-md text-[24px] text-on-surface font-semibold tracking-tight">{baseAsset}/USDT</h2>
              <span className="font-label-caps text-[10px] text-outline bg-surface-container-highest px-2 py-0.5 rounded">{baseAsset}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-display-lg text-[40px] text-on-surface font-bold">
                ${price < 0.1 ? price.toFixed(4) : price < 10 ? price.toFixed(3) : price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <div className={clsx("flex items-center gap-1 px-2 py-1 rounded-lg", isPositive ? "bg-secondary/10 text-secondary" : "bg-error/10 text-error")}>
                <span className="material-symbols-outlined text-[16px]">
                  {isPositive ? 'trending_up' : 'trending_down'}
                </span>
                <span className="font-label-caps text-[12px] font-bold">{isPositive ? '+' : ''}{change.toFixed(2)}%</span>
              </div>
            </div>
          </div>

          {/* Chart Card Section */}
          <div className="bg-[#1e1e22]/40 backdrop-blur-md border border-white/10 rounded-xl p-4 mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="font-label-caps text-[12px] text-outline font-semibold uppercase">Market Trend</span>
              <div className="flex bg-surface-container-lowest rounded-full p-1 border border-outline-variant/20">
                {(['15m', '1h', '4h', '1d'] as const).map(i => (
                  <button
                    key={i}
                    onClick={() => setInterval(i)}
                    className={clsx(
                      "px-3 py-1 rounded-full font-label-caps text-[10px] transition-colors uppercase font-bold",
                      interval === i ? "bg-primary text-on-primary-container shadow-sm" : "text-outline hover:text-on-surface"
                    )}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-64 w-full relative">
              {loading && chartData.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-transparent z-10">
                  <span className="material-symbols-outlined text-[32px] animate-spin text-primary">refresh</span>
                </div>
              )}
              <div ref={chartContainerRef} className="w-full h-full" />
            </div>
          </div>

          {/* Stats Grid (2x2 Bento Style) */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* RSI Card */}
            <div className="bg-[#1e1e22]/40 backdrop-blur-md border border-white/10 rounded-xl p-4 flex flex-col justify-between h-32">
              <div className="flex justify-between items-start">
                <span className="font-label-caps text-[12px] text-outline font-semibold">RSI (4h)</span>
                <span className="material-symbols-outlined text-outline text-[18px]">info</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-headline-md text-[24px] text-on-surface font-data-tabular font-bold">
                  {tokenRsi !== undefined ? tokenRsi.toFixed(1) : '--'}
                </span>
                {tokenRsi !== undefined && (
                  <span className={clsx("px-2 py-0.5 rounded-full text-[10px] font-label-caps font-bold",
                    tokenRsi >= 75 ? "bg-error/20 text-error" :
                      tokenRsi <= 30 ? "bg-secondary/20 text-secondary" :
                        "bg-primary/20 text-primary")}>
                    {tokenRsi >= 75 ? 'OVERBOUGHT' : tokenRsi <= 30 ? 'OVERSOLD' : 'NEUTRAL'}
                  </span>
                )}
              </div>
            </div>

            {/* Volume Card */}
            <div className="bg-[#1e1e22]/40 backdrop-blur-md border border-white/10 rounded-xl p-4 flex flex-col justify-between h-32">
              <div className="flex justify-between items-start">
                <span className="font-label-caps text-[12px] text-outline font-semibold">24H VOL</span>
                <span className="material-symbols-outlined text-outline text-[18px]">equalizer</span>
              </div>
              <span className="font-headline-md text-[24px] text-on-surface font-data-tabular font-bold">{volFormatted}</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
