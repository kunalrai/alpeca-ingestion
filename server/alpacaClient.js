const axios = require('axios');
const config = require('./config');

const client = axios.create({
  baseURL: config.alpaca.baseUrl,
  headers: {
    'APCA-API-KEY-ID': config.alpaca.apiKey,
    'APCA-API-SECRET-KEY': config.alpaca.secretKey,
  },
  timeout: 30000,
});

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Fetch latest snapshots for a list of symbols.
 * Returns map: { SYMBOL: { latestTrade, latestQuote, dailyBar, prevDailyBar } }
 * onProgress(batchNum, totalBatches, fetched, total) — optional progress callback
 */
async function getSnapshots(symbols, onProgress) {
  const batches = chunk(symbols, config.batchSize);
  const total = batches.length;
  const result = {};

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    try {
      const res = await client.get('/stocks/snapshots', {
        params: { symbols: batch.join(','), feed: 'iex' },
      });
      Object.assign(result, res.data);
    } catch (err) {
      const status = err.response?.status;
      if (status === 429) {
        await sleep(1000);
        try {
          const res = await client.get('/stocks/snapshots', {
            params: { symbols: batch.join(','), feed: 'iex' },
          });
          Object.assign(result, res.data);
        } catch (retryErr) {
          console.error('Alpaca snapshot retry failed:', retryErr.message);
        }
      } else {
        console.error('Alpaca snapshot error:', err.message);
      }
    }

    if (onProgress) {
      const fetched = Math.min((i + 1) * config.batchSize, symbols.length);
      onProgress(i + 1, total, fetched, symbols.length);
    }
  }

  return result;
}

// Ensure value is a finite number, else null
function num(v) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return isFinite(n) ? n : null;
}

/**
 * Map Alpaca snapshot entry → OHLCV row
 */
function snapshotToOhlcRow(symbol, snap) {
  const bar = snap.dailyBar || snap.minuteBar || snap.latestTrade;
  if (!bar) return null;
  return {
    symbol,
    timestamp: bar.t ? new Date(bar.t) : new Date(),
    open: num(bar.o),
    high: num(bar.h),
    low: num(bar.l),
    close: num(bar.c ?? bar.p),
    volume: num(bar.v),
  };
}

/**
 * Map Alpaca snapshot entry → fundamentals row
 */
function snapshotToFundamentalsRow(symbol, snap) {
  const quote = snap.latestQuote || {};
  const bar = snap.dailyBar || {};
  const prevBar = snap.prevDailyBar || {};
  return {
    symbol,
    timestamp: new Date(),
    current_price: num(snap.latestTrade?.p ?? bar.c),
    previous_close: num(prevBar.c),
    open: num(bar.o),
    volume: num(bar.v),
    regular_market_volume: num(bar.v),
    bid: num(quote.bp),
    ask: num(quote.ap),
    market_state: 'PRE',
  };
}

/**
 * Fetch historical minute bars for a list of symbols from `start` to `end`.
 * Handles pagination via next_page_token.
 * Returns array of OHLCV rows ready for insertOhlc().
 */
async function getHistoricalBars(symbols, start, end, onProgress) {
  const batches = chunk(symbols, config.batchSize);
  const rows = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    let pageToken = null;

    do {
      try {
        const params = {
          symbols: batch.join(','),
          timeframe: '1Min',
          start: start.toISOString(),
          end: end.toISOString(),
          feed: 'iex',
          limit: 10000,
        };
        if (pageToken) params.page_token = pageToken;

        const res = await client.get('/stocks/bars', { params });
        const bars = res.data.bars ?? {};
        pageToken = res.data.next_page_token ?? null;

        for (const [symbol, barList] of Object.entries(bars)) {
          for (const bar of barList) {
            rows.push({
              symbol,
              timestamp: new Date(bar.t),
              open: num(bar.o),
              high: num(bar.h),
              low: num(bar.l),
              close: num(bar.c),
              volume: num(bar.v),
            });
          }
        }
      } catch (err) {
        if (err.response?.status === 429) {
          await sleep(1000);
        } else {
          console.error('Alpaca historical bars error:', err.message);
          pageToken = null;
        }
      }
    } while (pageToken);

    if (onProgress) onProgress(i + 1, batches.length);
  }

  return rows;
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

module.exports = { getSnapshots, getHistoricalBars, snapshotToOhlcRow, snapshotToFundamentalsRow };
