const db = require('../db');
const { getHistoricalBars } = require('../alpacaClient');
const log = require('../logQueue');

const JOB = 'ohlc_history';

async function run({ from, to } = {}) {
  log.push('info', JOB, 'OHLC history ingest started');
  try {
    const symbols = await db.getActiveSymbols();
    const watermark = await db.getWatermark(JOB);

    const start = from
      ? new Date(from)
      : watermark
        ? new Date(watermark)
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = to ? new Date(to) : new Date();

    log.push('info', JOB, `Fetching bars from ${start.toISOString()} to ${end.toISOString()} for ${symbols.length} symbols`);

    const rows = await getHistoricalBars(symbols, start, end, (batch, total) => {
      log.push('info', JOB, `Batch ${batch}/${total} fetched`);
    });

    if (!rows.length) {
      log.push('info', JOB, 'No new bars returned');
      return;
    }

    const written = await db.insertOhlc(rows);
    await db.setWatermark(JOB, end);
    log.push('info', JOB, `OHLC history done — ${written} rows written, watermark updated to ${end.toISOString()}`);
  } catch (err) {
    log.push('error', JOB, `OHLC history error: ${err.message}`);
  }
}

module.exports = { run };
