const db = require('../db');
const { fetchTickerDetails, fetchFinancials, fetchDividends, polygonToFundamentalsRow, sleep } = require('../polygonClient');
const log = require('../logQueue');
const settingsStore = require('../settingsStore');

async function fetchWithRetry(fn, symbol, label) {
  try {
    return await fn(symbol);
  } catch (err) {
    if (err.response?.status === 429) {
      log.push('warn', 'polygon_fundamentals', `429 rate limit on ${label} for ${symbol} — backing off 60s`);
      await sleep(60000);
      return await fn(symbol);  // one retry
    }
    if (err.response?.status === 404) {
      return null;  // symbol not in Polygon — caller handles
    }
    throw err;
  }
}

async function run() {
  const s = settingsStore.load();
  const budget = s.polygonBudgetPerRun ?? 200;
  const rateLimitMs = s.polygonRateLimitMs ?? 12000;

  log.push('info', 'polygon_fundamentals', `Polygon fundamentals started — budget: ${budget} symbols, rate: ${rateLimitMs}ms`);

  const symbols = await db.getStalestSymbolsForFundamentals(budget);
  if (!symbols.length) {
    log.push('warn', 'polygon_fundamentals', 'No active symbols found — skipping');
    return;
  }

  let succeeded = 0;
  let failed = 0;
  let notFound = 0;

  for (let i = 0; i < symbols.length; i++) {
    const { symbol, current_price } = symbols[i];

    try {
      const [details, financials, dividends] = await Promise.all([
        fetchWithRetry(fetchTickerDetails, symbol, 'ticker-details'),
        fetchWithRetry(fetchFinancials, symbol, 'financials'),
        fetchWithRetry(fetchDividends, symbol, 'dividends'),
      ]);

      if (!details) {
        log.push('warn', 'polygon_fundamentals', `${symbol} not found in Polygon — skipping`);
        notFound++;
        await db.updateSymbolFundamentalsTimestamp(symbol);  // deprioritize
        await sleep(rateLimitMs);
        continue;
      }

      const row = polygonToFundamentalsRow(symbol, details, financials, dividends, current_price);
      await db.upsertPolygonFundamentals([row]);
      await db.updateSymbolFundamentalsTimestamp(symbol);
      succeeded++;
    } catch (err) {
      log.push('error', 'polygon_fundamentals', `${symbol} failed: ${err.message}`);
      failed++;
    }

    if ((i + 1) % 10 === 0) {
      log.push('info', 'polygon_fundamentals', `Progress: ${i + 1}/${symbols.length} — ok:${succeeded} fail:${failed} notFound:${notFound}`);
    }

    // Rate limit between each symbol (3 parallel calls count as 3 requests)
    await sleep(rateLimitMs * 3);
  }

  await db.setWatermark('polygon_fundamentals', new Date());
  log.push('info', 'polygon_fundamentals', `Done — ${succeeded} updated, ${failed} failed, ${notFound} not found in Polygon`);
}

module.exports = { run };
