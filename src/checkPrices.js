import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchItemBySku } from './api.js';
import { writeChangeReport } from './report.js';
import { loadPrices, savePrices } from './storage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKUS_PATH = join(__dirname, '../skus.csv');

export async function loadSkus() {
  const raw = await readFile(SKUS_PATH, 'utf8');
  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  if (records.length > 0 && Object.keys(records[0]).some((k) => k.toLowerCase() === 'sku')) {
    return records
      .map((row) => {
        const key = Object.keys(row).find((k) => k.toLowerCase() === 'sku');
        return row[key]?.trim();
      })
      .filter(Boolean);
  }

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function checkPrices() {
  const checkedAt = new Date();
  const skus = await loadSkus();

  if (skus.length === 0) {
    throw new Error('No SKUs found in skus.csv');
  }

  const store = await loadPrices();
  const changes = [];
  const failures = [];
  let unchanged = 0;
  let baselined = 0;

  for (const sku of skus) {
    const result = await fetchItemBySku(sku);

    if (!result.ok) {
      console.error(`[FAIL] ${sku}: ${result.status} ${result.message}`);
      failures.push({ sku, status: result.status, message: result.message });

      if (result.status === 401 || result.status === 403) {
        throw new Error(`Authentication failed (${result.status}): check WSD_API_TOKEN`);
      }
      continue;
    }

    const { itemId, displayName, price } = result.data;
    const previous = store.items[sku];

    if (!previous) {
      store.items[sku] = {
        sku,
        itemId,
        displayName,
        price,
        updatedAt: checkedAt.toISOString(),
      };
      baselined++;
      console.log(`[BASELINE] ${sku}: ${price}`);
      continue;
    }

    if (previous.price === price) {
      unchanged++;
      continue;
    }

    const changeAmount = (parseFloat(price) - parseFloat(previous.price)).toFixed(2);

    changes.push({
      sku,
      displayName,
      itemId,
      previousPrice: previous.price,
      currentPrice: price,
      changeAmount,
      checkedAt: checkedAt.toISOString(),
    });

    store.items[sku] = {
      sku,
      itemId,
      displayName,
      price,
      updatedAt: checkedAt.toISOString(),
    };

    console.log(`[CHANGED] ${sku}: ${previous.price} → ${price}`);
  }

  store.lastCheckedAt = checkedAt.toISOString();
  await savePrices(store);

  let reportPath = null;
  if (changes.length > 0) {
    reportPath = await writeChangeReport(changes, checkedAt);
  }

  return {
    total: skus.length,
    unchanged,
    baselined,
    changed: changes.length,
    failed: failures.length,
    reportPath,
    failures,
  };
}
