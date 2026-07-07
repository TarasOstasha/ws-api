import { writeToPath } from '@fast-csv/format';
import { mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = join(__dirname, '../reports');

async function resolveReportPath(checkedAt) {
  const date = checkedAt.toISOString().slice(0, 10);
  const baseName = `price-changes-${date}`;
  const basePath = join(REPORTS_DIR, `${baseName}.csv`);

  try {
    await readdir(REPORTS_DIR);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return basePath;
    }
    throw err;
  }

  const files = await readdir(REPORTS_DIR);
  const existing = files.filter(
    (f) => f === `${baseName}.csv` || f.startsWith(`${baseName}-`) && f.endsWith('.csv')
  );

  if (existing.length === 0) {
    return basePath;
  }

  let maxSeq = existing.includes(`${baseName}.csv`) ? 1 : 0;
  for (const file of existing) {
    const match = file.match(new RegExp(`^${baseName}-(\\d+)\\.csv$`));
    if (match) {
      maxSeq = Math.max(maxSeq, parseInt(match[1], 10));
    }
  }

  return join(REPORTS_DIR, `${baseName}-${maxSeq + 1}.csv`);
}

export async function writeChangeReport(changes, checkedAt) {
  const reportPath = await resolveReportPath(checkedAt);

  const rows = changes.map((c) => ({
    sku: c.sku,
    displayName: c.displayName,
    itemId: c.itemId,
    previousPrice: c.previousPrice,
    currentPrice: c.currentPrice,
    changeAmount: c.changeAmount,
    checkedAt: c.checkedAt,
  }));

  await mkdir(REPORTS_DIR, { recursive: true });
  await writeToPath(reportPath, rows, {
    headers: true,
    writeHeaders: true,
  });

  return reportPath;
}
