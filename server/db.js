const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool(config.db);

pool.on('error', (err) => {
  console.error('Postgres pool error:', err.message);
});

// Simple async mutex — prevents concurrent inserts into the same hypertable
// which causes TimescaleDB chunk_pkey / dimension_slice_pkey conflicts
const _locks = {};
async function withLock(key, fn) {
  while (_locks[key]) await _locks[key];
  let resolve;
  _locks[key] = new Promise((r) => { resolve = r; });
  try {
    return await fn();
  } finally {
    delete _locks[key];
    resolve();
  }
}

async function query(sql, params) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

// ── Symbol helpers ────────────────────────────────────────────────────────────

async function getActiveSymbols() {
  const res = await query(
    'SELECT symbol FROM master.us_stocks WHERE is_active = true ORDER BY symbol'
  );
  return res.rows.map((r) => r.symbol);
}

async function getSafeBetSymbols() {
  const res = await query('SELECT DISTINCT symbol FROM master.safe_bet');
  return res.rows.map((r) => r.symbol);
}

// ── OHLC ──────────────────────────────────────────────────────────────────────

async function _bulkInsertOhlc(table, rows) {
  return withLock(table, () => _doInsertOhlc(table, rows));
}

async function _doInsertOhlc(table, rows) {
  if (!rows.length) return 0;
  const chunks = chunkArray(rows, 500);
  const client = await pool.connect();
  let total = 0;
  try {
    for (const chunk of chunks) {
      const values = chunk
        .map((_, i) => {
          const base = i * 7;
          return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7})`;
        })
        .join(',');
      const flat = chunk.flatMap((r) => [r.symbol, r.timestamp, r.open, r.high, r.low, r.close, r.volume]);
      await client.query(
        `INSERT INTO ${table} (symbol,timestamp,open,high,low,close,volume) VALUES ${values} ON CONFLICT DO NOTHING`,
        flat
      );
      total += chunk.length;
    }
  } finally {
    client.release();
  }
  return total;
}

async function insertOhlc(rows) {
  return _bulkInsertOhlc('master.ohlc', rows);
}

async function insertOhlcPremarket(rows) {
  return _bulkInsertOhlc('master.ohlc_premarket', rows);
}

// ── Safe Bet ──────────────────────────────────────────────────────────────────

async function upsertSafeBet(rows) {
  if (!rows.length) return 0;
  for (const r of rows) {
    await query(
      `INSERT INTO master.safe_bet
        (symbol, name, previous_close, open_price, current_price,
         pct_change_from_prev_close, pct_change_from_open, query_type, captured_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (symbol, query_type) DO UPDATE SET
         current_price = EXCLUDED.current_price,
         pct_change_from_prev_close = EXCLUDED.pct_change_from_prev_close,
         pct_change_from_open = EXCLUDED.pct_change_from_open,
         captured_at = EXCLUDED.captured_at`,
      [
        r.symbol, r.name ?? null, r.previous_close ?? null, r.open_price ?? null,
        r.current_price ?? null, r.pct_change_from_prev_close ?? null,
        r.pct_change_from_open ?? null, r.query_type ?? 'live', r.captured_at ?? new Date(),
      ]
    );
  }
  return rows.length;
}

// ── Fundamentals ──────────────────────────────────────────────────────────────

async function upsertFundamentals(rows) {
  if (!rows.length) return 0;
  for (const r of rows) {
    await query(
      `INSERT INTO master.stock_fundamentals_latest
        (symbol, timestamp, current_price, previous_close, open, volume,
         regular_market_volume, bid, ask, market_state)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (symbol) DO UPDATE SET
         timestamp = EXCLUDED.timestamp,
         current_price = EXCLUDED.current_price,
         previous_close = EXCLUDED.previous_close,
         open = EXCLUDED.open,
         volume = EXCLUDED.volume,
         regular_market_volume = EXCLUDED.regular_market_volume,
         bid = EXCLUDED.bid,
         ask = EXCLUDED.ask,
         market_state = EXCLUDED.market_state`,
      [
        r.symbol, r.timestamp ?? new Date(), r.current_price ?? null,
        r.previous_close ?? null, r.open ?? null, r.volume ?? null,
        r.regular_market_volume ?? null, r.bid ?? null, r.ask ?? null,
        r.market_state ?? 'PRE',
      ]
    );
  }
  return rows.length;
}

// ── Watermark ─────────────────────────────────────────────────────────────────

async function getWatermark(job) {
  const res = await query(
    'SELECT last_timestamp FROM master.ingest_watermark WHERE job = $1',
    [job]
  );
  return res.rows[0]?.last_timestamp ?? null;
}

async function setWatermark(job, timestamp) {
  await query(
    `INSERT INTO master.ingest_watermark (job, last_timestamp, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (job) DO UPDATE SET last_timestamp = EXCLUDED.last_timestamp, updated_at = NOW()`,
    [job, timestamp]
  );
}

// ── Metrics ───────────────────────────────────────────────────────────────────

async function getTableCounts() {
  const tables = {
    ohlc: 'master.ohlc',
    ohlc_premarket: 'master.ohlc_premarket',
    safe_bet: 'master.safe_bet',
    fundamentals: 'master.stock_fundamentals_latest',
    us_stocks: 'master.us_stocks',
  };
  const counts = {};
  for (const [key, table] of Object.entries(tables)) {
    const res = await query(`SELECT COUNT(*) FROM ${table}`);
    counts[key] = parseInt(res.rows[0].count);
  }
  return counts;
}

// ── Util ──────────────────────────────────────────────────────────────────────

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

module.exports = {
  query,
  getActiveSymbols,
  getSafeBetSymbols,
  insertOhlc,
  insertOhlcPremarket,
  upsertSafeBet,
  upsertFundamentals,
  getTableCounts,
  getWatermark,
  setWatermark,
};
