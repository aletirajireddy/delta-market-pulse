const { fetchWithRetry } = require('./httpRetry');

const BASE_URL = process.env.DELTA_BASE_URL || 'https://api.india.delta.exchange';

async function get(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE_URL}${path}${qs ? `?${qs}` : ''}`;
  const res = await fetchWithRetry(() => fetch(url), { label: `Delta ${path}` });
  if (!res.ok) {
    throw new Error(`Delta ${path} failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  if (!body.success) throw new Error(`Delta ${path} returned success:false`);
  return body.result;
}

async function getTickers() {
  return get('/v2/tickers', { contract_types: 'perpetual_futures' });
}

async function getTicker(symbol) {
  const r = await get(`/v2/tickers/${symbol}`);
  return r;
}

// resolution: 1m, 5m, 15m, 30m, 1h, 4h, 1d ...
async function getCandles(symbol, resolution, startSec, endSec) {
  return get('/v2/history/candles', { symbol, resolution, start: startSec, end: endSec });
}

async function getL2Orderbook(symbol) {
  return get(`/v2/l2orderbook/${symbol}`);
}

async function getTrades(symbol, count = 100) {
  return get(`/v2/trades/${symbol}`, { count });
}

module.exports = { getTickers, getTicker, getCandles, getL2Orderbook, getTrades };
