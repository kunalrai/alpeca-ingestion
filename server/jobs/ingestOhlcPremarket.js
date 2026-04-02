const db = require('../db');
const { getSnapshots, snapshotToOhlcRow } = require('../alpacaClient');
const log = require('../logQueue');

async function run() {
  log.push('info', 'ohlc_premarket', 'Pre-market OHLC ingest started');
  try {
    const symbols = await db.getActiveSymbols();
    if (!symbols.length) {
      log.push('warn', 'ohlc_premarket', 'No active symbols in us_stocks — skipping');
      return;
    }
    log.push('info', 'ohlc_premarket', `Fetching pre-market snapshots for ${symbols.length} symbols`);

    const snapshots = await getSnapshots(symbols, (batchNum, totalBatches, fetched, total) => {
      log.push('info', 'ohlc_premarket', `Batch ${batchNum}/${totalBatches} — ${fetched.toLocaleString()}/${total.toLocaleString()} symbols fetched`);
    });
    const rows = [];

    for (const [symbol, snap] of Object.entries(snapshots)) {
      const row = snapshotToOhlcRow(symbol, snap);
      if (row) rows.push(row);
    }

    const written = await db.insertOhlcPremarket(rows);
    await db.setWatermark('master.ohlc_premarket', new Date());
    log.push('info', 'ohlc_premarket', `Pre-market OHLC done — ${written} rows written`);
  } catch (err) {
    log.push('error', 'ohlc_premarket', `Pre-market OHLC error: ${err.message}`);
  }
}

module.exports = { run };
