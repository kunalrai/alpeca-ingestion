const db = require('../db');
const { getSnapshots, snapshotToFundamentalsRow } = require('../alpacaClient');
const log = require('../logQueue');

async function run() {
  log.push('info', 'fundamentals', 'Fundamentals ingest started');
  try {
    const symbols = await db.getActiveSymbols();
    if (!symbols.length) {
      log.push('warn', 'fundamentals', 'No active symbols in us_stocks — skipping');
      return;
    }
    log.push('info', 'fundamentals', `Fetching fundamentals snapshots for ${symbols.length} symbols`);

    const snapshots = await getSnapshots(symbols, (batchNum, totalBatches, fetched, total) => {
      log.push('info', 'fundamentals', `Batch ${batchNum}/${totalBatches} — ${fetched.toLocaleString()}/${total.toLocaleString()} symbols fetched`);
    });
    const rows = [];

    for (const [symbol, snap] of Object.entries(snapshots)) {
      rows.push(snapshotToFundamentalsRow(symbol, snap));
    }

    const written = await db.upsertFundamentals(rows);
    await db.setWatermark('master.stock_fundamentals_latest', new Date());
    log.push('info', 'fundamentals', `Fundamentals done — ${written} rows upserted`);
  } catch (err) {
    log.push('error', 'fundamentals', `Fundamentals error: ${err.message}`);
  }
}

module.exports = { run };
