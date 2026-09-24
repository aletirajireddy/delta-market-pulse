const db = require('../../db/database');
const { ghost } = require('../../config/thresholds');
const whitelist = require('./whitelist');

const getLifecycle = db.prepare('SELECT * FROM coin_lifecycle WHERE base = ?');
const update = db.prepare(`
  UPDATE coin_lifecycle SET status = ?, last_active_at = ?, ghosted_at = ?, removed_at = ?
  WHERE base = ?
`);

// Governs removal for coins already on the active watchlist ('active' or
// 'ghosted' status). Never touches entry — that's graduationGate.js.
//
// passesFilter: still passing the live 3-threshold filter this cycle.
//   VETO — if true, the coin can never be ghosted/pruned here, full stop,
//   regardless of how long it's been quiet.
// movedMeaningfully: true if price moved beyond noise since the last poll
//   (the "is this coin actually alive" signal, independent of the filter).
function advance(base, passesFilter, movedMeaningfully, now) {
  if (whitelist.isBypassed(base)) return; // majors + whitelist never ghost

  const existing = getLifecycle.get(base);
  if (!existing || (existing.status !== 'active' && existing.status !== 'ghosted')) return;

  // VETO: still qualifying on the live filter = proof of relevance, always active.
  if (passesFilter) {
    update.run('active', now, null, null, base);
    return;
  }

  if (movedMeaningfully) {
    // Genuine activity resets the quiet clock and revives a ghosted coin.
    update.run('active', now, null, null, base);
    return;
  }

  if (existing.status === 'active') {
    const quietFor = now - existing.last_active_at;
    if (quietFor >= ghost.settleMs) {
      update.run('ghosted', existing.last_active_at, now, null, base);
    }
    // else: still within settle window, stays active untouched
    return;
  }

  if (existing.status === 'ghosted') {
    const graceFor = now - existing.ghosted_at;
    if (graceFor >= ghost.graceMs) {
      update.run('idle', existing.last_active_at, existing.ghosted_at, now, base); // pruned
    }
    // else: still within grace window, stays ghosted (visible, not yet removed)
  }
}

module.exports = { advance };
