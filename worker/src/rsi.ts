export function calculateRSI(closingPrices: number[], period: number = 14): number | null {
  if (closingPrices.length < period + 1) {
    return null;
  }

  // Calculate price changes
  const changes: number[] = [];
  for (let i = 1; i < closingPrices.length; i++) {
    changes.push(closingPrices[i] - closingPrices[i - 1]);
  }

  // First average gain/loss (simple average of first `period` changes)
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < period; i++) {
    if (changes[i] >= 0) {
      avgGain += changes[i];
    } else {
      avgLoss += Math.abs(changes[i]);
    }
  }

  avgGain /= period;
  avgLoss /= period;

  // Wilder smoothing for remaining changes
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    if (change >= 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
  }

  if (avgLoss === 0) {
    return 100;
  }

  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  return Math.round(rsi * 100) / 100; // 2 decimal precision
}
