const db = require('../../db/database');
const defaults = require('../../config/thresholds');

// Runtime-adjustable ghost/prune settings — matches the old project's
// /api/ghosts/watchdog-settings pattern (DB-backed override, code defaults
// as fallback, no redeploy needed to tune). Values are stored in ms/bool
// in system_settings, keyed distinctly from anything else there.

const KEYS = {
  settleMs: 'ghost_settle_ms',
  graceMs: 'ghost_grace_ms',
  autoApprove: 'ghost_auto_approve',
};

const get = db.prepare('SELECT value FROM system_settings WHERE key = ?');
const upsert = db.prepare(`
  INSERT INTO system_settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

function getSettings() {
  const settleRow = get.get(KEYS.settleMs);
  const graceRow = get.get(KEYS.graceMs);
  const autoRow = get.get(KEYS.autoApprove);
  return {
    settleMs: settleRow ? Number(settleRow.value) : defaults.ghost.settleMs,
    graceMs: graceRow ? Number(graceRow.value) : defaults.ghost.graceMs,
    autoApprove: autoRow ? autoRow.value === 'true' : defaults.ghostAutoApprove,
  };
}

// Clamped to sane bounds, same discipline as the old project's settings API.
function updateSettings({ settleHours, graceHours, autoApprove }) {
  if (settleHours != null) {
    const h = Math.min(72, Math.max(0, Number(settleHours)));
    upsert.run(KEYS.settleMs, String(h * 60 * 60 * 1000));
  }
  if (graceHours != null) {
    const h = Math.min(336, Math.max(1, Number(graceHours)));
    upsert.run(KEYS.graceMs, String(h * 60 * 60 * 1000));
  }
  if (autoApprove != null) {
    upsert.run(KEYS.autoApprove, String(!!autoApprove));
  }
  return getSettings();
}

module.exports = { getSettings, updateSettings };
