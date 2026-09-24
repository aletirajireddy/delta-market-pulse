// Central, adjustable config for the watchlist lifecycle. No magic numbers
// buried in services — every threshold that governs coin discovery/removal
// lives here, same "one place to look, one place to change" rule as the
// old project's DataAuthority.js.

module.exports = {
  // 3-threshold discovery filter (mirrors the TradingView screener filter
  // the user showed live: Chg 24h outside ±2%, Vol USD 24h > 100M, Vol chg 24h > 5%)
  filter: {
    minAbsChangePct: 2,
    minVolumeUsd: 100_000_000,
    minVolumeChangePct: 5,
  },

  // A candidate must pass the filter continuously for this long before it
  // graduates onto the active watchlist. Any drop-out resets the timer.
  graduationWindowMs: 35 * 60 * 1000,

  // Coins that bypass the filter/gate entirely, always active.
  permanentMajors: ['BTC', 'ETH'],

  // Ghost/prune lifecycle for graduated (non-major, non-whitelisted) coins.
  // Matches the old project's Watchdog Confidence Clock defaults exactly
  // (settle 12h + ghost/grace 36h = 48h total from a coin's own clock start).
  ghost: {
    // How long a graduated coin can go without genuine price movement
    // before it's queued for removal review.
    settleMs: 12 * 60 * 60 * 1000, // 12h
    // Grace window once queued, before it's actually pruned (or recycled —
    // see autoApprove below).
    graceMs: 36 * 60 * 60 * 1000, // 36h
  },
  // true (auto): a ghosted coin that never showed real activity by the end
  //   of graceMs is actually removed from the watchlist — no memory carried
  //   forward, re-earns everything from scratch if it reappears.
  // false (manual): same expiry, but the coin is recycled instead — clock
  //   resets, it stays on the watchlist rather than being removed. Manual
  //   mode never auto-removes, matching the old project's behavior.
  ghostAutoApprove: true,

  // Mega-spot / EMA200 clustering threshold, ported from the Pine indicators.
  megaClusterThresholdPct: 0.25,
  megaAtThresholdPct: 0.15,

  // OI spike detection (new metric, not in the old TradingView pipeline).
  oiSpike: {
    minBaselineSamples: 3,
    spikeThresholdPct: 15,
  },

  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS) || 60_000,
};
