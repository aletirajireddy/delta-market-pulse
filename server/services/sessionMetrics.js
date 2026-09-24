const marketData = require('./marketData');

// TradingView's Pine script computes day_change_pct/today_volume off the
// "D" (daily) timeframe candle, which for crypto resets at 00:00 UTC (no
// custom session set in the indicator). Both Binance's and Bybit's 1d
// klines use the same UTC-midnight boundary natively — so aligning to TV's
// session definition is just "use the current daily kline's open/quote
// volume", not a separate timezone calculation.
//
// Quote-volume sits at a different index depending on exchange: Binance's
// kline array is [time,open,high,low,close,volume,closeTime,quoteVolume,...]
// (index 7); Bybit's is [time,open,high,low,close,volume,turnover] (index 6,
// turnover = quote volume). Routed here so callers never need to know which.
//
// asOf (ms epoch, optional): validate against a past moment instead of now.
async function getSessionMetrics(coin, asOf) {
  const kl = await marketData.getKlinesForCoin(coin, '1d', 1, asOf);
  const candle = kl[kl.length - 1];
  const [, open, , , close] = candle;
  const quoteVolume = coin.sourceExchange === 'bybit' ? candle[6] : candle[7];
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
