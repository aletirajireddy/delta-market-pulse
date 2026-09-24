const { fetchWithRetry } = require('./httpRetry');

const BASE_URL = process.env.BYBIT_BASE_URL || 'https://api.bybit.com';

async function get(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE_URL}${path}${qs ? `?${qs}` : ''}`;
  const res = await fetchWithRetry(() => fetch(url), { label: `Bybit ${path}` });
  if (!res.ok) {
    throw new Error(`Bybit ${path} failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  if (body.retCode !== 0) throw new Error(`Bybit ${path} returned retCode ${body.retCode}: ${body.retMsg}`);
  return body.result;
}

// All USDT perpetual (linear) 24hr tickers in one call.
async function get24hrTickers() {
  const r = await get('/v5/market/tickers', { category: 'linear' });
  return r.list;
}

// Bybit intervals: 1,3,5,15,30,60,120,240,360,720 (minutes) or D,W,M.
const INTERVAL_MAP = { '1m': '1', '5m': '5', '15m': '15', '30m': '30', '1h': '60', '4h': '240', '1d': 'D', '1w': 'W', '1M': 'M' };

// Returns candles oldest -> newest as [openTime, open, high, low, close, volume, turnover]
// to match Binance's kline shape (our toCandle() reads indices 1-5 the same way).
async function getKlines(symbol, interval, limit = 300, endTime) {
  const params = { category: 'linear', symbol, interval: INTERVAL_MAP[interval] || interval, limit };
  if (endTime) params.end = endTime;
  const r = await get('/v5/market/kline', params);
  return r.list.slice().reverse(); // Bybit returns newest-first
}

module.exports = { get24hrTickers, getKlines };
