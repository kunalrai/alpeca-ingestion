const db = require('../db');
const { getSnapshots, snapshotToOhlcRow } = require('../alpacaClient');
const log = require('../logQueue');

async function run() {
  log.push('info', 'safe_bet', 'Safe bet ingest started');
  try {
    const symbols = await db.getSafeBetSymbols();
    if (!symbols.length) {
      log.push('warn', 'safe_bet', 'No safe_bet symbols found in DB');
      return;
    }

    log.push('info', 'safe_bet', `Fetching snapshots for ${symbols.length} safe_bet symbols`);
    const snapshots = await getSnapshots(symbols, (batchNum, totalBatches, fetched, total) => {
      log.push('info', 'safe_bet', `Batch ${batchNum}/${totalBatches} — ${fetched}/${total} symbols fetched`);
    });
    const rows = [];

    for (const [symbol, snap] of Object.entries(snapshots)) {
      const bar = snap.dailyBar || {};
      const prevBar = snap.prevDailyBar || {};
      const currentPrice = snap.latestTrade?.p ?? bar.c ?? null;
      const prevClose = prevBar.c ?? null;
      const openPrice = bar.o ?? null;

      rows.push({
        symbol,
        name: null,
        previous_close: prevClose,
        open_price: openPrice,
        current_price: currentPrice,
        pct_change_from_prev_close:
          currentPrice && prevClose ? ((currentPrice - prevClose) / prevClose) * 100 : null,
        pct_change_from_open:
          currentPrice && openPrice ? ((currentPrice - openPrice) / openPrice) * 100 : null,
        query_type: 'live',
        captured_at: new Date(),
      });
    }

    const written = await db.upsertSafeBet(rows);
    await db.setWatermark('master.safe_bet', new Date());
    log.push('info', 'safe_bet', `Safe bet done — ${written} rows upserted`);
  } catch (err) {
    log.push('error', 'safe_bet', `Safe bet error: ${err.message}`);
  }
}

module.exports = { run };
