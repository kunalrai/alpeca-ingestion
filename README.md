# Alpaca Ingest Pipeline

A stock market data ingestion pipeline with a real-time monitoring dashboard. Fetches live data from the Alpaca Markets API, stores it in PostgreSQL (TimescaleDB), and serves a React frontend for visualization and job control.

---

## Stack

- **Backend** — Node.js, Express, WebSocket (`ws`), node-cron
- **Database** — PostgreSQL / TimescaleDB, Prisma (migrations + type-safe client)
- **Frontend** — React, Vite, Radix UI
- **Data sources** — Alpaca Markets REST API, Polygon.io REST API

---

## Prerequisites

- Node.js 18+
- PostgreSQL / TimescaleDB running and accessible
- Alpaca API key + secret
- Polygon.io API key (for fundamentals enrichment)

---

## Setup

### 1. Install dependencies

```bash
# Backend
npm install

# Frontend
cd frontend && npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```env
ALPACA_API_KEY=your_key
ALPACA_SECRET_KEY=your_secret

DB_HOST=localhost
DB_PORT=5432
DB_NAME=stocks
DB_USER=postgres
DB_PASSWORD=your_password

PORT=3000

DATABASE_URL="postgresql://postgres:your_password@localhost:5432/stocks?schema=master"

POLYGON_API_KEY=your_polygon_key
```

---

## Running

### Development

```bash
# Terminal 1 — backend (auto-reload, runs migrations on start)
npm run dev

# Terminal 2 — frontend (Vite dev server with API proxy)
cd frontend && npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

### Production

```bash
cd frontend && npm run build   # builds to frontend/dist
npm start                      # serves API + static frontend on port 3000
```

---

## Database Migrations (Prisma)

Migrations run automatically on `npm start` / `npm run dev` via `prisma migrate deploy`.

### Common commands

```bash
# Apply pending migrations (runs automatically on start)
npx prisma migrate deploy

# Create a new migration after editing prisma/schema.prisma
npx prisma migrate dev --name describe_your_change

# Regenerate the Prisma client after schema changes
npx prisma generate

# Inspect current DB schema
npx prisma db pull

# Open Prisma Studio (DB GUI)
npx prisma studio
```

### Migration files

Migration history lives in `prisma/migrations/`. The `0_init` migration is the baseline snapshot of the existing schema — it is marked as applied and will not run against the DB.

---

## Project Structure

```
postgresdb/
├── prisma/
│   ├── schema.prisma          # Prisma schema (models + datasource)
│   └── migrations/            # Migration history
│       └── 0_init/            # Baseline migration (existing schema)
├── prisma.config.ts           # Prisma config (datasource URL)
├── generated/prisma/          # Generated Prisma client (gitignored)
├── server/
│   ├── server.js              # Express + WebSocket server
│   ├── config.js              # Market hours, poll intervals, credentials
│   ├── db.js                  # pg pool wrapper + raw query helpers
│   ├── alpacaClient.js        # Alpaca API client (batched, with retry)
│   ├── scheduler.js           # node-cron orchestrator
│   ├── logQueue.js            # In-memory log queue + WebSocket broadcast
│   ├── settingsStore.js       # Persists settings to settings.json
│   └── jobs/
│       ├── ingestOhlc.js                  # Regular-hours OHLC → master.ohlc
│       ├── ingestOhlcPremarket.js         # Pre-market OHLC → master.ohlc_premarket
│       ├── ingestFundamentals.js          # Alpaca fundamentals → master.stock_fundamentals_latest
│       ├── ingestPolygonFundamentals.js   # Polygon fundamentals enrichment (ticker details, financials, dividends)
│       ├── ingestSafeBet.js               # Safe-bet tracking → master.safe_bet
│       ├── ingestUsStocks.js              # US equity list → master.us_stocks
│       └── ingestOhlcHistory.js           # Historical OHLC backfill
├── frontend/src/
│   ├── App.jsx
│   ├── hooks/
│   │   ├── useWebSocket.js
│   │   └── useTheme.jsx           # Light/dark theme toggle
│   └── components/
│       ├── Dashboard.jsx
│       ├── PipelineStatus.jsx
│       ├── LogStream.jsx
│       ├── TableViewer.jsx
│       ├── Settings.jsx
│       ├── StockExplorer.jsx      # Searchable/paginated stock browser
│       ├── StockDetail.jsx        # Per-symbol fundamentals detail view
│       └── ui/                    # Radix UI wrappers
└── .env                           # Credentials (not committed)
```

---

## REST API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/status` | Scheduler + job states |
| POST | `/api/start` / `/api/stop` | Start / stop scheduler |
| POST | `/api/jobs/run/:name` | Manually trigger a job |
| GET | `/api/dashboard` | Aggregated dashboard data |
| GET | `/api/metrics` | Table row counts |
| GET | `/api/table/:name` | Paginated table viewer (`?page=&limit=&search=`) |
| GET/POST | `/api/settings` | Load / update settings |
| WS | `/ws/logs` | Real-time log stream |

Available job names: `fundamentals`, `polygon_fundamentals`, `ohlc`, `ohlc_premarket`, `safe_bet`, `us_stocks`

---

## Database Schema

Target: `master` schema in the `stocks` database (TimescaleDB).

| Table | Description |
|-------|-------------|
| `master.us_stocks` | Active US equity symbols from Alpaca |
| `master.ohlc` | Regular-hours OHLC bars (hypertable) |
| `master.ohlc_premarket` | Pre-market OHLC bars (hypertable) |
| `master.stock_fundamentals_latest` | Latest fundamentals per symbol |
| `master.safe_bet` | Safe-bet symbol snapshots |
| `master.ingest_watermark` | Last successful run timestamp per job |

Polygon fundamentals enrichment writes into `master.stock_fundamentals_latest`, extending existing rows with ticker details, annual financials, and dividend data sourced from Polygon.io.

---

## Scheduler

The scheduler runs **inside the same Node.js process as the Express server** — no separate process or database-side cron.

```mermaid
flowchart TD
    A([npm start]) --> B[server.js]
    B --> C[Express HTTP :3000]
    B --> D[WebSocket /ws/logs]
    B --> E[scheduler.start]

    E --> F[node-cron — event loop]

    F --> J1["ohlc\nevery N mins"]
    F --> J2["ohlc_premarket\nevery N mins"]
    F --> J3["safe_bet\nevery N mins"]
    F --> J4["fundamentals\nevery N mins"]
    F --> J5["polygon_fundamentals\ndaily 02:00 ET"]

    J1 --> W1{inWindow?\n09:30–16:00 ET}
    J2 --> W2{inWindow?\n04:00–09:30 ET}
    J3 --> W3{inWindow?\n09:30–16:00 ET}
    J4 --> W4{inWindow?\n04:00–09:30 ET}
    J5 --> W5{inWindow?\n00:00–23:59 ET}

    W1 -->|yes| R1[(master.ohlc)]
    W2 -->|yes| R2[(master.ohlc_premarket)]
    W3 -->|yes| R3[(master.safe_bet)]
    W4 -->|yes| R4[(master.stock_fundamentals_latest)]
    W5 -->|yes| R4

    W1 -->|no| SK[skip]
    W2 -->|no| SK
    W3 -->|no| SK
    W4 -->|no| SK
```

- Each cron tick calls `inWindow()` — if the current ET time is outside the job's window, the job is silently skipped
- A `running` flag per job prevents overlapping executions
- POST `/api/start` / `/api/stop` start or stop all cron tasks without restarting the server
- POST `/api/settings` saves new intervals and calls `scheduler.restart()` to apply them immediately

### Data Ingestion Sequence

```mermaid
sequenceDiagram
    participant Browser
    participant Express
    participant Scheduler
    participant AlpacaAPI
    participant PolygonAPI
    participant TimescaleDB

    Note over Scheduler: node-cron tick fires

    Scheduler->>Scheduler: inWindow() check (ET)
    alt outside window
        Scheduler-->>Scheduler: skip
    else inside window
        Scheduler->>AlpacaAPI: GET /v2/stocks/snapshots (batch 1000)
        AlpacaAPI-->>Scheduler: OHLC snapshots
        Scheduler->>TimescaleDB: UPSERT master.ohlc / ohlc_premarket
        TimescaleDB-->>Scheduler: ok
        Scheduler->>Scheduler: log.push(info)
    end

    Note over Scheduler: daily 02:00 ET — Polygon fundamentals

    Scheduler->>TimescaleDB: getStalestSymbols(budget)
    TimescaleDB-->>Scheduler: symbol list
    loop each symbol
        Scheduler->>PolygonAPI: GET /v3/reference/tickers/:symbol
        Scheduler->>PolygonAPI: GET /vX/reference/financials
        Scheduler->>PolygonAPI: GET /v3/reference/dividends
        PolygonAPI-->>Scheduler: ticker details + financials + dividends
        Scheduler->>TimescaleDB: UPSERT master.stock_fundamentals_latest
    end

    Note over Browser: user opens dashboard

    Browser->>Express: GET /api/dashboard
    Express->>TimescaleDB: aggregate queries
    TimescaleDB-->>Express: metrics + leaders
    Express-->>Browser: JSON response

    Browser->>Express: WS /ws/logs (upgrade)
    Scheduler->>Express: log.push(event)
    Express-->>Browser: broadcast log entry

    Note over Browser: user triggers manual job

    Browser->>Express: POST /api/jobs/run/ohlc
    Express->>Scheduler: runJob('ohlc')
    Scheduler->>AlpacaAPI: GET /v2/stocks/snapshots
    AlpacaAPI-->>Scheduler: snapshots
    Scheduler->>TimescaleDB: UPSERT master.ohlc
    Scheduler-->>Express: done
    Express-->>Browser: 200 ok
```

### Scheduler Windows (ET)

| Job | Window |
|-----|--------|
| Pre-market OHLC | 04:00 – 09:30 |
| Regular OHLC | 09:30 – 16:00 |
| Fundamentals | 04:00 – 09:30 |
| Safe Bet | 09:30 – 16:00 |
| Polygon Fundamentals | Daily at 02:00 ET (off-market enrichment) |
