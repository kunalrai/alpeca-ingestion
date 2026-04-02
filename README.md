# Stock Market Data Pipeline

A stock market data ingestion pipeline with a real-time monitoring dashboard. Fetches live data from the Alpaca Markets API, stores it in PostgreSQL (TimescaleDB), and visualizes it through a React frontend.

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- Access to a TimescaleDB / PostgreSQL instance
- An [Alpaca Markets](https://alpaca.markets/) account (free tier works)

## Setup

### 1. Clone and install dependencies

```bash
# Install backend dependencies (from project root)
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Configure environment variables

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
ALPACA_API_KEY=your_alpaca_api_key
ALPACA_SECRET_KEY=your_alpaca_secret_key

DB_HOST=your_db_host
DB_PORT=5433
DB_NAME=stocks
DB_USER=postgres
DB_PASSWORD=your_password

PORT=3000
```

## Running the Project

The backend and frontend are two separate servers and must both be running.

### Terminal 1 — Backend (Express API + WebSocket)

```bash
# From project root
npm run dev
```

Runs on **http://localhost:3000**

### Terminal 2 — Frontend (Vite dev server)

```bash
cd frontend
npm run dev
```

Runs on **http://localhost:5173** — open this in your browser.

## Production Build

Build the frontend and serve everything from the backend:

```bash
cd frontend
npm run build
cd ..
npm start
```

Visit **http://localhost:3000** (no separate frontend server needed).

## Features

- **Dashboard** — aggregated metrics, hourly chart, market leaders
- **Pipeline Monitor** — job status cards, manual trigger buttons, real-time log stream
- **Table Viewer** — paginated browser for all database tables
- **Settings** — configure poll intervals and market hour windows

## Data Jobs

| Job | Schedule | Target Table |
|-----|----------|--------------|
| `ohlc` | Regular market hours (09:30–16:00 ET) | `master.ohlc` |
| `ohlc_premarket` | Pre-market (04:00–09:30 ET) | `master.ohlc_premarket` |
| `fundamentals` | Configurable | `master.stock_fundamentals_latest` |
| `safe_bet` | Configurable | `master.safe_bet` |

Jobs can also be triggered manually from the Pipeline Monitor page.
