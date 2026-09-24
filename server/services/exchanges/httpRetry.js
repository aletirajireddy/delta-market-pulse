// Shared retry/backoff wrapper for exchange REST calls. Handles transient
// failures (network errors, 5xx) and rate-limit responses (429/418) so a
// brief hiccup loses a few seconds, not a data point — needed for genuine
// unattended 24/7 operation, not just staying under the weight ceiling.

const MAX_RETRIES = 4;
const BASE_DELAY_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// fn: async () => Response (fetch result, not yet parsed). Retries on
// network failure, 5xx, and 429/418 (rate limit) — never retries on 4xx
// client errors like a bad symbol, since retrying won't fix those.
async function fetchWithRetry(fn, { label = 'request' } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fn();

      if (res.status === 429 || res.status === 418) {
        const retryAfterSec = Number(res.headers.get('retry-after'));
        const delay = retryAfterSec > 0 ? retryAfterSec * 1000 : BASE_DELAY_MS * 2 ** attempt;
        console.warn(`[retry] ${label} rate-limited (${res.status}), waiting ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES + 1})`);
        if (attempt === MAX_RETRIES) return res; // let the caller surface the final failure
        await sleep(delay);
        continue;
      }

      if (res.status >= 500) {
        if (attempt === MAX_RETRIES) return res;
        const delay = BASE_DELAY_MS * 2 ** attempt;
        console.warn(`[retry] ${label} server error (${res.status}), retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES + 1})`);
        await sleep(delay);
        continue;
      }

      return res; // 2xx or a non-retryable 4xx — caller handles it
    } catch (e) {
      lastErr = e; // network-level failure (DNS, connection reset, timeout)
      if (attempt === MAX_RETRIES) break;
      const delay = BASE_DELAY_MS * 2 ** attempt;
      console.warn(`[retry] ${label} network error (${e.message}), retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES + 1})`);
      await sleep(delay);
    }
  }
  throw lastErr || new Error(`${label} failed after ${MAX_RETRIES + 1} attempts`);
}

module.exports = { fetchWithRetry };
