import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRICES_PATH = `${__dirname}/../data/prices.json`;

export function createEmptyStore() {
  return {
    lastCheckedAt: null,
    items: {},
  };
}

export async function loadPrices() {
  try {
    const raw = await readFile(PRICES_PATH, 'utf8');
    const data = JSON.parse(raw);
    return {
      lastCheckedAt: data.lastCheckedAt ?? null,
      items: data.items ?? {},
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return createEmptyStore();
    }
    throw err;
  }
}

export async function savePrices(store) {
  await mkdir(dirname(PRICES_PATH), { recursive: true });
  await writeFile(PRICES_PATH, JSON.stringify(store, null, 2) + '\n', 'utf8');
}
