// Tiny in-memory cache of the current poll cycle's per-coin 24h volume-change
// (exchange-native, see filterEngine.js). Populated once per poll cycle by
// poller.js; read by anything that needs the same number without re-fetching
// 185 coins' worth of klines on every HTTP request (e.g. momentumScanner.js).
let cache = new Map();
let lastUpdated = null;

function set(volChangeByBase, ts) {
  cache = volChangeByBase;
  lastUpdated = ts;
}

function get(base) {
  return cache.get(base) ?? null;
}

function getLastUpdated() {
  return lastUpdated;
}

module.exports = { set, get, getLastUpdated };
