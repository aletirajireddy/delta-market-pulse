const db = require('../../db/database');
const { permanentMajors } = require('../../config/thresholds');

const insert = db.prepare('INSERT OR IGNORE INTO coin_whitelist (base, added_at) VALUES (?, ?)');
const remove = db.prepare('DELETE FROM coin_whitelist WHERE base = ?');
const listAll = db.prepare('SELECT base, added_at FROM coin_whitelist ORDER BY added_at DESC');
const exists = db.prepare('SELECT 1 FROM coin_whitelist WHERE base = ?');

function add(base) {
  insert.run(base.toUpperCase(), Date.now());
}

function removeCoin(base) {
  remove.run(base.toUpperCase());
}

function list() {
  return listAll.all();
}

// True for permanent majors (BTC/ETH, hardcoded) OR anything in the
// user-managed whitelist table. Both bypass the filter/graduation gate.
function isBypassed(base) {
  if (permanentMajors.includes(base)) return true;
  return !!exists.get(base);
}

module.exports = { add, removeCoin, list, isBypassed };
