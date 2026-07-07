import 'dotenv/config';
import { checkPrices } from './checkPrices.js';

async function main() {
  if (!process.env.WSD_API_TOKEN) {
    console.error('Error: WSD_API_TOKEN is not set. Copy .env.example to .env and add your token.');
    process.exit(1);
  }

  try {
    const result = await checkPrices();

    const parts = [`${result.unchanged} unchanged`];
    if (result.baselined > 0) parts.push(`${result.baselined} baselined`);
    if (result.changed > 0) parts.push(`${result.changed} changed`);
    if (result.failed > 0) parts.push(`${result.failed} failed`);

    console.log(`\nChecked ${result.total} SKUs: ${parts.join(', ')}`);

    if (result.reportPath) {
      console.log(`Report: ${result.reportPath}`);
    } else if (result.changed === 0) {
      console.log('No price changes detected — no report generated.');
    }

    process.exit(result.failed > 0 ? 1 : 0);
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
