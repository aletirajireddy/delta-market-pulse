const db = require('../../db/database');
const { graduationWindowMs, permanentMajors } = require('../../config/thresholds');

const getLifecycle = db.prepare('SELECT * FROM coin_lifecycle WHERE base = ?');
const upsert = db.prepare(`
  INSERT INTO coin_lifecycle (base, status, qualifying_since, graduated_at, last_active_at)
  VALUES (@base, @status, @qualifying_since, @graduated_at, @last_active_at)
  ON CONFLICT(base) DO UPDATE SET
    status = @status,
    qualifying_since = @qualifying_since,
    graduated_at = COALESCE(@graduated_at, coin_lifecycle.graduated_at),
    last_active_at = @last_active_at
`);

// Advances one coin's lifecycle state for this poll cycle.
// passesFilter: bool result of the 3-threshold filter this cycle.
// Returns the updated lifecycle row.
function advance(base, passesFilter, now) {
  const isPermanent = permanentMajors.includes(base);
  const existing = getLifecycle.get(base);

  if (isPermanent) {
    upsert.run({
      base,
      status: 'active',
      qualifying_since: existing?.qualifying_since ?? now,
      graduated_at: existing?.graduated_at ?? now,
      last_active_at: now,
    });
    return getLifecycle.get(base);
  }

  if (!existing || existing.status === 'idle') {
    if (passesFilter) {
      upsert.run({ base, status: 'qualifying', qualifying_since: now, graduated_at: null, last_active_at: now });
    }
    // not qualifying and no existing row: nothing to do, stays untracked
    return getLifecycle.get(base);
  }

  if (existing.status === 'qualifying') {
    if (!passesFilter) {
      // Drop-out resets the timer entirely — this is what kills flicker.
      upsert.run({ base, status: 'idle', qualifying_since: null, graduated_at: null, last_active_at: now });
      return getLifecycle.get(base);
    }
    const elapsed = now - existing.qualifying_since;
    if (elapsed >= graduationWindowMs) {
      upsert.run({ base, status: 'active', qualifying_since: existing.qualifying_since, graduated_at: now, last_active_at: now });
    } else {
      upsert.run({ base, status: 'qualifying', qualifying_since: existing.qualifying_since, graduated_at: null, last_active_at: now });
    }
    return getLifecycle.get(base);
  }

  // 'active' and 'ghosted' status is owned by ghostPrune.js from here on —
  // this gate only governs entry (idle -> qualifying -> active). Exit is
  // never immediate on a single filter miss; it goes through the
  // settle -> ghost -> prune pipeline, with the filter itself acting as a
  // veto against removal (see ghostPrune.js).
  return existing;
}

function counts() {
  const qualifying = db.prepare("SELECT COUNT(*) c FROM coin_lifecycle WHERE status = 'qualifying'").get().c;
  const active = db.prepare("SELECT COUNT(*) c FROM coin_lifecycle WHERE status = 'active'").get().c;
  return { qualifying, active };
}

module.exports = { advance, counts, getLifecycle };
