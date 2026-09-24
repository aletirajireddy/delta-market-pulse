const BASE_URL = process.env.BINANCE_BASE_URL || 'https://fapi.binance.com';

async function get(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE_URL}${path}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Binance ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// All USDT-M perpetual 24hr tickers in one call.
async function get24hrTickers() {
  return get('/fapi/v1/ticker/24hr');
}

// Klines: [openTime, open, high, low, close, volume, closeTime, ...]
// endTime (ms epoch), when given, fetches the `limit` candles ending at that
// moment — used for historical/backtest-style validation against a past
// timestamp instead of "right now".
async function getKlines(symbol, interval, limit = 300, endTime) {
  const params = { symbol, interval, limit };
  if (endTime) params.endTime = endTime;
  return get('/fapi/v1/klines', params);
}

async function getOpenInterest(symbol) {
  return get('/fapi/v1/openInterest', { symbol });
}

module.exports = { get24hrTickers, getKlines, getOpenInterest };
