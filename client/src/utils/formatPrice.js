// Adaptive precision: crypto prices span from ~$100k (BTC) to sub-cent
// micro-caps, so a fixed decimal count either loses precision on small
// coins or looks noisy on large ones.
export function formatPrice(price) {
  if (price == null || Number.isNaN(price)) return '--';
  if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(6);
}
