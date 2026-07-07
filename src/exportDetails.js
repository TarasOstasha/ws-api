import 'dotenv/config';
import { fetchItemBySku } from './api.js';
import { loadSkus } from './checkPrices.js';
import { writeDetailsReport, writeMissingReport } from './report.js';

export async function exportDetails() {
  const exportedAt = new Date();
  const skus = await loadSkus();

  if (skus.length === 0) {
    throw new Error('No SKUs found in skus.csv');
  }

  const items = [];
  const missing = [];
  const failures = [];

  for (let i = 0; i < skus.length; i++) {
    const sku = skus[i];
    const result = await fetchItemBySku(sku);

    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        throw new Error(`Authentication failed (${result.status}): check WSD_API_TOKEN`);
      }

      if (result.notFound) {
        console.warn(`[${i + 1}/${skus.length}] [MISSING] ${sku}: ${result.message}`);
        missing.push({
          sku,
          status: result.status,
          message: result.message || 'Unable to find item matching provided',
          checkedAt: exportedAt.toISOString(),
        });
      } else {
        console.error(`[${i + 1}/${skus.length}] [FAIL] ${sku}: ${result.status} ${result.message}`);
        failures.push({ sku, status: result.status, message: result.message });
      }
      continue;
    }

    const { itemId, displayName, package: packageName, weight, turnTime } = result.data;

    items.push({
      sku,
      displayName,
      itemId,
      package: packageName,
      weight,
      turnTime,
    });

    console.log(
      `[${i + 1}/${skus.length}] [OK] ${sku}: package=${packageName}, weight=${weight}, turnTime=${turnTime || '(empty)'}`
    );
  }

  const reportPath = await writeDetailsReport(items, exportedAt);

  let missingReportPath = null;
  if (missing.length > 0) {
    missingReportPath = await writeMissingReport(missing, exportedAt);
  }

  return {
    total: skus.length,
    exported: items.length,
    missing: missing.length,
    failed: failures.length,
    reportPath,
    missingReportPath,
    failures,
  };
}

async function main() {
  if (!process.env.WSD_API_TOKEN) {
    console.error('Error: WSD_API_TOKEN is not set. Copy .env.example to .env and add your token.');
    process.exit(1);
  }

  try {
    const result = await exportDetails();

    const parts = [`${result.exported} exported`];
    if (result.missing > 0) parts.push(`${result.missing} missing`);
    if (result.failed > 0) parts.push(`${result.failed} failed`);

    console.log(`\nExported ${result.total} SKUs: ${parts.join(', ')}`);
    console.log(`Details report: ${result.reportPath}`);

    if (result.missingReportPath) {
      console.log(`Missing items report: ${result.missingReportPath}`);
    }

    process.exit(result.failed > 0 || result.missing > 0 ? 1 : 0);
  } catch (err) {
    if (err.code === 'ENOENT' && err.path?.includes('skus.csv')) {
      console.error('Error: skus.csv not found. Add your SKU list and try again.');
    } else {
      console.error(`Error: ${err.message}`);
    }
    process.exit(1);
  }
}

main();
