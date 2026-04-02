# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Does

A stock market data ingestion pipeline + monitoring dashboard. It fetches live data from Alpaca Markets API and stores it in PostgreSQL (TimescaleDB). A React frontend provides real-time visualization and job control.

## Commands

### Backend (root directory)
```bash
npm install       # Install dependencies
npm start         # Run server on port 3000
npm run dev       # Run with nodemon (auto-reload)
```

### Frontend (`frontend/` directory)
```bash
npm install       # Install dependencies
npm run dev       # Vite dev server on port 5173 (proxies API to localhost:3000)
npm run build     # Build to frontend/dist (served by Express in production)
npm run preview   # Preview production build
```

### Development
Run both servers: backend from root (`npm run dev`), frontend from `frontend/` (`npm run dev`).
Access UI at http://localhost:5173 (dev) or http://localhost:3000 (production).

## Architecture

```
postgresdb/
├── server/
│   ├── server.js          # Express + WebSocket server; all REST endpoints
│   ├── config.js          # Market hours, poll intervals, Alpaca + DB credentials
│   ├── db.js              # pg pool wrapper; upsert helpers; async mutex for concurrent writes
│   ├── alpacaClient.js    # Alpaca API client; batched snapshot fetching with retry
│   ├── scheduler.js       # node-cron orchestrator; time-window-based job execution
│   ├── logQueue.js        # In-memory log queue; broadcasts to WebSocket clients
│   ├── settingsStore.js   # Persists settings to settings.json; falls back to config defaults
│   └── jobs/
│       ├── ingestOhlc.js            # Regular-hours OHLC → master.ohlc
│       ├── ingestOhlcPremarket.js   # Pre-market OHLC → master.ohlc_premarket
│       ├── ingestFundamentals.js    # Fundamentals → master.stock_fundamentals_latest
│       └── ingestSafeBet.js         # Safe-bet symbol tracking → master.safe_bet
├── frontend/src/
│   ├── App.jsx            # Navigation + page routing
│   ├── hooks/useWebSocket.js  # Connects to /ws/logs, keeps last 500 entries
│   └── components/
│       ├── Dashboard.jsx       # Metrics, hourly chart, market leaders
│       ├── PipelineStatus.jsx  # Job status cards + manual trigger buttons
│       ├── LogStream.jsx       # Real-time log viewer
│       ├── TableViewer.jsx     # Paginated DB table browser
│       ├── Settings.jsx        # Poll interval / market hours config UI
│       └── ui/                 # Radix UI wrappers (Button, Card, Badge, etc.)
└── .env                   # Alpaca keys + DB credentials (not committed)
```

## Key Patterns

**Scheduler time windows** — Jobs only run within configured windows (ET). Pre-market 04:00–09:30, regular market 09:30–16:00. `scheduler.js` checks windows before dispatching each job.

**Mutex on DB writes** — `db.js` uses an async mutex to serialize inserts into TimescaleDB hypertables, preventing chunk-level conflicts on concurrent writes.

**Batch + retry** — `alpacaClient.js` processes symbols in batches (default 1000). Retries with backoff on 429 rate-limit responses.

**Settings persistence** — `settingsStore.js` writes to `settings.json`. POSTing to `/api/settings` saves and restarts the scheduler to apply changes immediately.

**Log pipeline** — All jobs push structured log entries to `logQueue.js`. The WebSocket endpoint in `server.js` broadcasts new entries to all connected frontend clients.

## REST API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/status` | Scheduler + job states |
| POST | `/api/start` / `/api/stop` | Control scheduler |
| POST | `/api/jobs/run/:name` | Manually trigger job (`fundamentals`, `ohlc`, `ohlc_premarket`, `safe_bet`) |
| GET | `/api/dashboard` | Aggregated dashboard data |
| GET | `/api/metrics` | Table row counts |
| GET | `/api/table/:name` | Paginated table viewer (`?page=&limit=&search=`) |
| GET/POST | `/api/settings` | Load / update settings |
| WS | `/ws/logs` | Real-time log stream |

## Database

Target schema: `master` in the `stocks` database (TimescaleDB on `38.49.213.39:5433`).

Core ingest tables: `master.ohlc`, `master.ohlc_premarket`, `master.stock_fundamentals_latest`, `master.safe_bet`, `master.us_stocks`.

`pg_cron` is **not installed** — no database-side scheduling. All scheduling is handled by `server/scheduler.js` (node-cron) in the application layer.

## Environment Variables

See `.env.example`. Key vars: `ALPACA_API_KEY`, `ALPACA_SECRET_KEY`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `PORT`.
