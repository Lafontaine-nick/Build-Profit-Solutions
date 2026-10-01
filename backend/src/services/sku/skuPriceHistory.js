/**
 * Shelf-price history for live retailer searches.
 * One observation per store + ZIP + SKU per day. Mock catalog prices are not recorded.
 */

const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(__dirname, '../../data/sku-price-history.json');
const MAX_POINTS = 400;
const DAY_MS = 24 * 60 * 60 * 1000;
const SIX_MONTHS_MS = 183 * DAY_MS;
const EIGHTEEN_MONTHS_MS = 548 * DAY_MS;
const MIN_SPAN_MS = 30 * DAY_MS;

function ensureFile() {
  const dir = path.dirname(HISTORY_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, '{}\n', 'utf8');
  }
}

function loadHistory() {
  ensureFile();
  try {
    const parsed = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    console.warn('skuPriceHistory: could not read store', error.message);
    return {};
  }
}

function saveHistory(history) {
  ensureFile();
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history), 'utf8');
}

function historyKey(store, zip, sku) {
  const cleanSku = String(sku || '').trim();
  const cleanZip = String(zip || '').trim();
  const cleanStore = String(store || '').trim().toLowerCase();
  if (!cleanSku || !cleanZip || !cleanStore) return null;
  return `${cleanStore}|${cleanZip}|${cleanSku}`;
}

function dayStamp(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function prunePoints(points, now) {
  const cutoff = now - EIGHTEEN_MONTHS_MS;
  const kept = points.filter((point) => new Date(point.at).getTime() >= cutoff);
  if (kept.length <= MAX_POINTS) return kept;
  return kept.slice(kept.length - MAX_POINTS);
}

/**
 * @param {Array<{ sku?: string, price?: number, store?: string, zip?: string }>} results
 * @param {{ store: string, zip: string }} scope
 */
function recordSkuPrices(results, scope, now = Date.now()) {
  const list = Array.isArray(results) ? results : [];
  const history = loadHistory();
  const today = dayStamp(now);
  let changed = false;

  list.forEach((item) => {
    const price = Number(item?.price);
    if (!Number.isFinite(price) || price <= 0) return;
    const key = historyKey(item.store || scope.store, item.zip || scope.zip, item.sku);
    if (!key) return;
    const points = Array.isArray(history[key]) ? history[key] : [];
    const last = points[points.length - 1];
    if (last && last.at === today) {
      if (Number(last.price) !== price) {
        last.price = price;
        changed = true;
      }
      return;
    }
    points.push({ at: today, price });
    history[key] = prunePoints(points, now);
    changed = true;
  });

  if (changed) saveHistory(history);
  return history;
}

function pickBaseline(points, now) {
  const older = (points || [])
    .map((point) => ({ at: point.at, price: Number(point.price), time: new Date(point.at).getTime() }))
    .filter((point) => Number.isFinite(point.price) && point.price > 0 && now - point.time >= MIN_SPAN_MS)
    .sort((a, b) => a.time - b.time);
  if (!older.length) return null;

  const inYearWindow = older.filter((point) => {
    const age = now - point.time;
    return age >= SIX_MONTHS_MS && age <= EIGHTEEN_MONTHS_MS;
  });
  if (inYearWindow.length) {
    const target = now - 365 * DAY_MS;
    return inYearWindow.reduce((best, point) =>
      Math.abs(point.time - target) < Math.abs(best.time - target) ? point : best
    );
  }

  return older[0];
}

function priceChangeFromPoints(currentPrice, points, now = Date.now()) {
  const price = Number(currentPrice);
  const baseline = pickBaseline(points, now);
  if (!baseline || !Number.isFinite(price) || price <= 0) return null;
  const delta = price - baseline.price;
  const percent = (delta / baseline.price) * 100;
  if (!Number.isFinite(percent) || Math.abs(percent) < 0.5) return null;
  const months = Math.max(1, Math.round((now - baseline.time) / (30.44 * DAY_MS)));
  return {
    direction: delta > 0 ? 'up' : 'down',
    percent: Math.round(Math.abs(percent) * 10) / 10,
    months,
    baselinePrice: baseline.price,
    baselineAt: baseline.at,
  };
}

function attachPriceChanges(results, scope, history = loadHistory(), now = Date.now()) {
  return (Array.isArray(results) ? results : []).map((item) => {
    const key = historyKey(item.store || scope.store, item.zip || scope.zip, item.sku);
    const points = key ? history[key] : null;
    return {
      ...item,
      priceChange: priceChangeFromPoints(item.price, points, now),
    };
  });
}

module.exports = {
  recordSkuPrices,
  attachPriceChanges,
  priceChangeFromPoints,
  pickBaseline,
  historyKey,
};
