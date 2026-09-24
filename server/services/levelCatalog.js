// Compiles every known level for a coin (EMA200 stack, base/neck, fib,
// mega-spot) into one flat, labeled list with % distance from price —
// backs both the "Speed Breakers" level map and the next-up/next-down
// columns. All inputs are already-validated data, nothing new computed
// here, just organized for display.

function pctDist(price, level) {
  return price && level ? ((level - price) / price) * 100 : null;
}

function buildLevelCatalog(price, ema200, smartLevels, megaSpots) {
  const levels = [];
  const push = (label, value) => {
    if (value == null) return;
    levels.push({ label, price: value, distPct: pctDist(price, value) });
  };

  push('EMA200 (5m)', ema200?.m5);
  push('EMA200 (15m)', ema200?.m15);
  push('EMA200 (1h)', ema200?.h1);
  push('EMA200 (4h)', ema200?.h4);

  push('1H Base Support', smartLevels?.hourly?.baseSupport);
  push('1H Base Resistance', smartLevels?.hourly?.baseResistance);
  push('1H Neck Support', smartLevels?.hourly?.neckSupport);
  push('1H Neck Resistance', smartLevels?.hourly?.neckResistance);
  push('Day Base Support', smartLevels?.daily?.baseSupport);
  push('Day Base Resistance', smartLevels?.daily?.baseResistance);
  push('Fib 618 (1H)', smartLevels?.fib?.h1);
  push('Fib 618 (Day)', smartLevels?.fib?.d1);
  push('Fib 618 (Week)', smartLevels?.fib?.w1);

  push('Day Open', smartLevels?.htf?.daily?.open);
  push('Day High', smartLevels?.htf?.daily?.high);
  push('Day Low', smartLevels?.htf?.daily?.low);
  push('Day Close', smartLevels?.htf?.daily?.close);
  push('Week Open', smartLevels?.htf?.weekly?.open);
  push('Week High', smartLevels?.htf?.weekly?.high);
  push('Week Low', smartLevels?.htf?.weekly?.low);
  push('Week Close', smartLevels?.htf?.weekly?.close);

  for (const spot of megaSpots || []) {
    push(`Mega Spot [${spot.count}]`, spot.price);
  }

  levels.sort((a, b) => (a.distPct ?? 0) - (b.distPct ?? 0));

  const above = levels.filter((l) => l.distPct != null && l.distPct > 0);
  const below = levels.filter((l) => l.distPct != null && l.distPct < 0);
  const nextUp = above.length ? above.reduce((a, b) => (a.distPct < b.distPct ? a : b)) : null;
  const nextDown = below.length ? below.reduce((a, b) => (a.distPct > b.distPct ? a : b)) : null;

  return { levels, nextUp, nextDown };
}

module.exports = { buildLevelCatalog };
