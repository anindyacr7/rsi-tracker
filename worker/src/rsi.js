"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateRSI = calculateRSI;
function calculateRSI(closingPrices, period) {
    if (period === void 0) { period = 14; }
    if (closingPrices.length < period + 1) {
        return null;
    }
    // Calculate price changes
    var changes = [];
    for (var i = 1; i < closingPrices.length; i++) {
        changes.push(closingPrices[i] - closingPrices[i - 1]);
    }
    // First average gain/loss (simple average of first `period` changes)
    var avgGain = 0;
    var avgLoss = 0;
    for (var i = 0; i < period; i++) {
        if (changes[i] >= 0) {
            avgGain += changes[i];
        }
        else {
            avgLoss += Math.abs(changes[i]);
        }
    }
    avgGain /= period;
    avgLoss /= period;
    // Wilder smoothing for remaining changes
    for (var i = period; i < changes.length; i++) {
        var change = changes[i];
        if (change >= 0) {
            avgGain = (avgGain * (period - 1) + change) / period;
            avgLoss = (avgLoss * (period - 1)) / period;
        }
        else {
            avgGain = (avgGain * (period - 1)) / period;
            avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
        }
    }
    if (avgLoss === 0) {
        return 100;
    }
    var rs = avgGain / avgLoss;
    var rsi = 100 - 100 / (1 + rs);
    return Math.round(rsi * 100) / 100; // 2 decimal precision
}
