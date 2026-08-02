import { calculateRSI } from './src/rsi';

async function test() {
  const fetchKlines = async (sym: string) => {
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=15m&limit=150`);
    const data = await res.json();
    return data.map((k: any) => parseFloat(k[4]));
  };

  for (const sym of ['CAKEUSDT', 'SUNUSDT']) {
    const closes = await fetchKlines(sym);
    const rsi = calculateRSI(closes, 14);
    console.log(`${sym} RSI: ${rsi}`);
  }
}
test();
