const binance = require('./exchanges/binanceClient');

// TradingView's Pine script computes day_change_pct/today_volume off the
// "D" (daily) timeframe candle, which for crypto resets at 00:00 UTC (no
// custom session set in the indicator). Binance's own 1d klines use the
// same UTC-midnight boundary natively (confirmed: kline openTime lands
// exactly on a UTC day boundary) — so aligning to TV's session definition
// is just "use the current daily kline's open/quoteVolume", not a separate
// timezone calculation.
//
// asOf (ms epoch, optional): validate against a past moment instead of now.
async function getSessionMetrics(binanceSymbol, asOf) {
  const kl = await binance.getKlines(binanceSymbol, '1d', 1, asOf);
  const candle = kl[kl.length - 1];
  const [, open, , , close, , , quoteVolume] = candle;
  const dayOpen = Number(open);
  const lastClose = Number(close);
  return {
    dayOpen,
    price: lastClose,
    changePct: dayOpen ? ((lastClose - dayOpen) / dayOpen) * 100 : null,
    volumeUsd: Number(quoteVolume),
  };
}

module.exports = { getSessionMetrics };
