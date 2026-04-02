const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const scheduler = require('./scheduler');
const db = require('./db');
const logQueue = require('./logQueue');
const settingsStore = require('./settingsStore');

const app = express();
app.use(cors());
app.use(express.json());

// ── REST API ──────────────────────────────────────────────────────────────────

app.get('/api/status', (req, res) => {
  res.json(scheduler.getStatus());
});

app.get('/api/metrics', async (req, res) => {
  try {
    const counts = await db.getTableCounts();
    res.json(counts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settings', (req, res) => {
  res.json(settingsStore.load());
});

app.post('/api/settings', (req, res) => {
  const current = settingsStore.load();
  const updated = { ...current, ...req.body };
  settingsStore.save(updated);
  logQueue.push('info', 'settings', 'Settings updated — restarting scheduler');
  scheduler.restart();
  res.json({ ok: true, settings: updated });
});

app.post('/api/jobs/run/:name', async (req, res) => {
  const jobs = {
    fundamentals:         require('./jobs/ingestFundamentals'),
    polygon_fundamentals: require('./jobs/ingestPolygonFundamentals'),
    ohlc:                 require('./jobs/ingestOhlc'),
    ohlc_premarket:       require('./jobs/ingestOhlcPremarket'),
    safe_bet:             require('./jobs/ingestSafeBet'),
    ohlc_history:         require('./jobs/ingestOhlcHistory'),
    us_stocks:            require('./jobs/ingestUsStocks'),
  };
  const job = jobs[req.params.name];
  if (!job) return res.status(400).json({ error: 'Unknown job' });
  const { from, to } = req.body ?? {};
  job.run({ from, to }).catch(() => {});
  res.json({ ok: true, message: `${req.params.name} triggered` });
});

app.post('/api/start', async (req, res) => {
  await scheduler.start();
  res.json({ ok: true, message: 'Scheduler started' });
});

app.post('/api/stop', (req, res) => {
  scheduler.stop();
  res.json({ ok: true, message: 'Scheduler stopped' });
});

app.get('/api/logs', (req, res) => {
  res.json(logQueue.recent(100));
});

// ── Dashboard stats ───────────────────────────────────────────────────────────
app.get('/api/dashboard', async (req, res) => {
  try {
    const [counts, ohlcRecent, topSymbols, lastFundamentals, ohlcByHour, marketLeaders, watermarks] = await Promise.all([
      db.getTableCounts(),

      // Last 10 OHLC inserts
      db.query(`SELECT symbol, timestamp, open, high, low, close, volume
                FROM master.ohlc ORDER BY timestamp DESC LIMIT 10`),

      // Top 10 symbols by volume today
      db.query(`SELECT symbol, SUM(volume) as total_volume, COUNT(*) as bars,
                       MAX(close) as last_price
                FROM master.ohlc
                WHERE timestamp >= NOW() - INTERVAL '24 hours'
                GROUP BY symbol ORDER BY total_volume DESC NULLS LAST LIMIT 10`),

      // Fundamentals coverage
      db.query(`SELECT COUNT(*) as total,
                       COUNT(current_price) as with_price,
                       COUNT(trailing_pe) as with_pe,
                       COUNT(market_cap) as with_market_cap
                FROM master.stock_fundamentals_latest`),

      // OHLC rows inserted per hour (last 12 hours)
      db.query(`SELECT date_trunc('hour', timestamp) as hour, COUNT(*) as rows
                FROM master.ohlc
                WHERE timestamp >= NOW() - INTERVAL '12 hours'
                GROUP BY 1 ORDER BY 1`),

      // Market leaders: latest bar per symbol ranked by volume, with open-of-day for change calc
      db.query(`
        WITH latest AS (
          SELECT DISTINCT ON (symbol)
            o.symbol,
            o.close   AS price,
            o.volume,
            o.timestamp,
            o.open    AS bar_open
          FROM master.ohlc o
          ORDER BY symbol, timestamp DESC
        ),
        day_open AS (
          SELECT DISTINCT ON (symbol)
            symbol,
            open AS day_open_price
          FROM master.ohlc
          WHERE timestamp >= NOW()::date
          ORDER BY symbol, timestamp ASC
        )
        SELECT
          l.symbol,
          u.description AS name,
          l.price,
          ROUND((l.price - COALESCE(d.day_open_price, l.bar_open))::numeric, 2)  AS change,
          ROUND(((l.price - COALESCE(d.day_open_price, l.bar_open))
                 / NULLIF(COALESCE(d.day_open_price, l.bar_open), 0) * 100)::numeric, 2) AS pct_change,
          l.volume,
          l.timestamp
        FROM latest l
        LEFT JOIN master.us_stocks u ON u.symbol = l.symbol
        LEFT JOIN day_open d ON d.symbol = l.symbol
        ORDER BY l.volume DESC NULLS LAST
        LIMIT 25
      `),

      db.getAllWatermarks(),
    ]);

    const watermarkMap = Object.fromEntries(watermarks.map((w) => [w.job, w]));

    res.json({
      counts,
      ohlcRecent: ohlcRecent.rows,
      topSymbols: topSymbols.rows,
      fundamentalsCoverage: lastFundamentals.rows[0],
      ohlcByHour: ohlcByHour.rows,
      marketLeaders: marketLeaders.rows,
      schedulerStatus: scheduler.getStatus(),
      watermarks: watermarkMap,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Stock Explorer ────────────────────────────────────────────────────────────

app.get('/api/stocks', async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page) || 1);
  const limit  = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;
  const search = req.query.search?.trim() || '';

  try {
    const searchParam = search ? `%${search}%` : null;
    const dataWhere = search
      ? `WHERE u.is_active = true AND (u.symbol ILIKE $3 OR u.description ILIKE $3)`
      : `WHERE u.is_active = true`;
    const countWhere = search
      ? `WHERE is_active = true AND (symbol ILIKE $1 OR description ILIKE $1)`
      : `WHERE is_active = true`;
    const dataParams = search ? [limit, offset, searchParam] : [limit, offset];

    const [dataRes, countRes] = await Promise.all([
      db.query(
        `SELECT u.symbol, u.description, u.mic, u.type,
                f.current_price, f.previous_close, f.market_state, f.volume,
                f.bid, f.ask
         FROM master.us_stocks u
         LEFT JOIN master.stock_fundamentals_latest f ON f.symbol = u.symbol
         ${dataWhere}
         ORDER BY u.symbol
         LIMIT $1 OFFSET $2`,
        dataParams
      ),
      db.query(
        `SELECT COUNT(*) FROM master.us_stocks ${countWhere}`,
        search ? [searchParam] : []
      ),
    ]);

    res.json({
      rows: dataRes.rows,
      total: parseInt(countRes.rows[0].count),
      page,
      limit,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stocks/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  try {
    const [info, fundamentals, latestOhlc, latestPremarket] = await Promise.all([
      db.query(`SELECT * FROM master.us_stocks WHERE symbol = $1`, [symbol]),
      db.query(`SELECT * FROM master.stock_fundamentals_latest WHERE symbol = $1`, [symbol]),
      db.query(`SELECT * FROM master.ohlc WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 1`, [symbol]),
      db.query(`SELECT * FROM master.ohlc_premarket WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 1`, [symbol]),
    ]);

    if (!info.rows.length) return res.status(404).json({ error: 'Symbol not found' });

    res.json({
      info: info.rows[0],
      fundamentals: fundamentals.rows[0] ?? null,
      latestOhlc: latestOhlc.rows[0] ?? null,
      latestPremarket: latestPremarket.rows[0] ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/stocks/:symbol/fetch-fundamentals', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const { fetchTickerDetails, fetchFinancials, fetchDividends, polygonToFundamentalsRow } = require('./polygonClient');
  try {
    const existing = await db.query(
      'SELECT current_price FROM master.stock_fundamentals_latest WHERE symbol = $1', [symbol]
    );
    const currentPrice = existing.rows[0]?.current_price ?? null;

    const [details, financials, dividends] = await Promise.all([
      fetchTickerDetails(symbol),
      fetchFinancials(symbol),
      fetchDividends(symbol),
    ]);

    if (!details) return res.status(404).json({ error: 'Symbol not found in Polygon' });

    const row = polygonToFundamentalsRow(symbol, details, financials, dividends, currentPrice);
    await db.upsertPolygonFundamentals([row]);
    await db.updateSymbolFundamentalsTimestamp(symbol);

    const updated = await db.query(
      'SELECT * FROM master.stock_fundamentals_latest WHERE symbol = $1', [symbol]
    );
    res.json({ ok: true, fundamentals: updated.rows[0] });
  } catch (err) {
    if (err.response?.status === 429) {
      return res.status(429).json({ error: 'Rate limited by Polygon — please wait a minute and try again' });
    }
    if (err.response?.status === 403) {
      return res.status(403).json({ error: 'Polygon API key invalid or missing' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stocks/:symbol/ohlc', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const limit  = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));
  try {
    const result = await db.query(
      `SELECT timestamp, open, high, low, close, volume
       FROM master.ohlc WHERE symbol = $1
       ORDER BY timestamp DESC LIMIT $2`,
      [symbol, limit]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stocks/:symbol/premarket', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const limit  = Math.min(200, Math.max(1, parseInt(req.query.limit) || 20));
  try {
    const result = await db.query(
      `SELECT timestamp, open, high, low, close, volume
       FROM master.ohlc_premarket WHERE symbol = $1
       ORDER BY timestamp DESC LIMIT $2`,
      [symbol, limit]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Table data browser ────────────────────────────────────────────────────────
const ALLOWED_TABLES = {
  ohlc:          'master.ohlc',
  ohlc_premarket:'master.ohlc_premarket',
  safe_bet:      'master.safe_bet',
  fundamentals:  'master.stock_fundamentals_latest',
  us_stocks:     'master.us_stocks',
};

app.get('/api/table/:name', async (req, res) => {
  const table = ALLOWED_TABLES[req.params.name];
  if (!table) return res.status(400).json({ error: 'Unknown table' });

  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;
  const search = req.query.search?.trim() || '';

  try {
    let whereClause = '';
    let params = [limit, offset];
    if (search) {
      whereClause = `WHERE symbol ILIKE $3`;
      params.push(`%${search}%`);
    }

    const [dataRes, countRes] = await Promise.all([
      db.query(`SELECT * FROM ${table} ${whereClause} ORDER BY 1 DESC LIMIT $1 OFFSET $2`, params),
      db.query(`SELECT COUNT(*) FROM ${table} ${whereClause}`, search ? [`%${search}%`] : []),
    ]);

    res.json({
      columns: dataRes.fields.map((f) => f.name),
      rows: dataRes.rows,
      total: parseInt(countRes.rows[0].count),
      page,
      limit,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Serve React frontend (production) ────────────────────────────────────────
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// ── WebSocket ─────────────────────────────────────────────────────────────────

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws/logs' });

wss.on('connection', (ws) => {
  // Send last 100 logs on connect
  logQueue.recent(100).forEach((entry) => {
    ws.send(JSON.stringify(entry));
  });

  // Subscribe to new logs
  const unsub = logQueue.subscribe((entry) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(entry));
    }
  });

  ws.on('close', unsub);
});

// ── Boot ──────────────────────────────────────────────────────────────────────

server.listen(config.port, async () => {
  console.log(`Server running on http://localhost:${config.port}`);
  logQueue.push('info', 'server', `Server started on port ${config.port}`);
  await scheduler.start();
});
