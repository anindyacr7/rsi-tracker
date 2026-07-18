// Helper for RSI Colors using the exact CSS classes from original mockups
export const getRsiClass = (value: number | null) => {
  if (value === null) return 'rsi-chip-neutral';
  if (value < 30) return 'rsi-chip-extreme-low';
  if (value < 40) return 'rsi-chip-low';
  if (value < 60) return 'rsi-chip-neutral';
  if (value < 70) return 'rsi-chip-high';
  return 'rsi-chip-extreme-high';
};

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD', 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 4 
  }).format(value);
};

export const formatCompactCurrency = (value: number) => {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};
