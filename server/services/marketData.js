// Single dispatch point for "get this coin's price/candle data from ITS
// pinned source exchange" — the fix for the XPL discrepancy: a coin that
// qualifies on Bybit's numbers must have its entire indicator pipeline
// (EMA/RSI/ATR/cascade/smart-levels/breakout) computed from Bybit candles
// too, never a silent switch to Binance mid-pipeline. Delta stays separate
// and uniform for OI/funding — see oiSpike.js / poller.js, those are
// intentionally NOT routed through here.

const binance = require('./exchanges/binanceClient');
const bybit = require('./exchanges/bybitClient');

// Fetches and normalizes 24hr tickers from every exchange we have coins
// pinned to, once per poll cycle — callers look up by coin.sourceSymbol.
async function fetchAllTickers() {
  const [binanceTickers, bybitTickers] = await Promise.all([
    binance.get24hrTickers().catch((e) => { console.error('Binance tickers failed:', e.message); return []; }),
    bybit.get24hrTickers().catch((e) => { console.error('Bybit tickers failed:', e.message); return []; }),
  ]);

  const binanceBySymbol = new Map(binanceTickers.map((t) => [t.symbol, {
    price: Number(t.lastPrice), changePct24h: Number(t.priceChangePercent), volumeUsd24h: Number(t.quoteVolume),
  }]));
  const bybitBySymbol = new Map(bybitTickers.map((t) => [t.symbol, {
    price: Number(t.lastPrice), changePct24h: Number(t.price24hPcnt) * 100, volumeUsd24h: Number(t.turnover24h),
  }]));

  return { binanceBySymbol, bybitBySymbol };
}

function getTickerForCoin(coin, tickers) {
  const map = coin.sourceExchange === 'bybit' ? tickers.bybitBySymbol : tickers.binanceBySymbol;
  return map.get(coin.sourceSymbol) ?? null;
}

// Candle fetch, routed to the coin's pinned exchange. Both clients return
// the same [time, open, high, low, close, volume, ...] index shape, so
// callers (indicatorEngine's toCandle) don't need to know which exchange
// answered.
async function getKlinesForCoin(coin, interval, limit = 300, endTime) {
  if (coin.sourceExchange === 'bybit') {
    return bybit.getKlines(coin.sourceSymbol, interval, limit, endTime);
  }
  return binance.getKlines(coin.sourceSymbol, interval, limit, endTime);
}

module.exports = { fetchAllTickers, getTickerForCoin, getKlinesForCoin };
