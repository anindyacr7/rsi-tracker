const token = process.env.TG_TOKEN || "6296317772:AAGj7K9z5Gv3DqL8P5F6N_rF_2Q_sT9z8"; // Let me just use dummy or fetch from .dev.vars
const fs = require('fs');

async function run() {
  const devVars = fs.readFileSync('.dev.vars', 'utf-8');
  const tokenMatch = devVars.match(/TELEGRAM_BOT_TOKEN="?([^"\n]+)"?/);
  const chatMatch = devVars.match(/TELEGRAM_CHAT_ID="?([^"\n]+)"?/);
  
  if (!tokenMatch || !chatMatch) {
    console.log("No token found"); return;
  }
  
  const token = tokenMatch[1];
  const chat_id = chatMatch[1];
  
  const text = `🚨 *TEST RSI ALERT* 🚨\nTop 5 Coins (15m):\n1. #JSTUSDT - 76.4\nThreshold: 75\nProvider: binance-api\nWorker: 1.0.3`;
  
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text, parse_mode: 'Markdown' })
  });
  
  const json = await res.json();
  console.log(json);
}
run();
