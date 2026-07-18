const start = Date.now();
const symbols = ['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','ADAUSDT'].map(s => Array(30).fill(s)).flat(); 
// 150 requests total
async function test() {
  const tasks = symbols.map(s => fetch(`https://api.binance.com/api/v3/klines?symbol=${s}&interval=15m&limit=100`).then(r => r.json()));
  await Promise.all(tasks);
  console.log(`Took ${Date.now() - start}ms`);
}
test();
