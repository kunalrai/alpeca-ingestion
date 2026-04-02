const db = require('../db');
const { getSnapshots, snapshotToOhlcRow } = require('../alpacaClient');
const log = require('../logQueue');

async function run() {
  log.push('info', 'ohlc', 'OHLC ingest started');
  try {
    const symbols = await db.getActiveSymbols();
    if (!symbols.length) {
      log.push('warn', 'ohlc', 'No active symbols in us_stocks — skipping');
      return;
    }
    log.push('info', 'ohlc', `Fetching snapshots for ${symbols.length} symbols`);

    const snapshots = await getSnapshots(symbols, (batchNum, totalBatches, fetched, total) => {
      log.push('info', 'ohlc', `Batch ${batchNum}/${totalBatches} — ${fetched.toLocaleString()}/${total.toLocaleString()} symbols fetched`);
    });
    const rows = [];

    for (const [symbol, snap] of Object.entries(snapshots)) {
      const row = snapshotToOhlcRow(symbol, snap);
      if (row) {
        rows.push(row);
        log.push('info', 'ohlc', `${symbol} — O:${row.open} H:${row.high} L:${row.low} C:${row.close} V:${row.volume}`);
      }
    }

    const written = await db.insertOhlc(rows);
    await db.setWatermark('master.ohlc', new Date());
    log.push('info', 'ohlc', `OHLC done — ${written} rows written`);
  } catch (err) {
    log.push('error', 'ohlc', `OHLC error: ${err.message}`);
  }
}

module.exports = { run };
