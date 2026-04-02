Loaded Prisma config from prisma.config.ts.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "master";

-- CreateTable
CREATE TABLE "ingest_watermark" (
    "job" TEXT NOT NULL,
    "last_timestamp" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingest_watermark_pkey" PRIMARY KEY ("job")
);

-- CreateTable
CREATE TABLE "ohlc" (
    "symbol" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL,
    "open" DOUBLE PRECISION,
    "high" DOUBLE PRECISION,
    "low" DOUBLE PRECISION,
    "close" DOUBLE PRECISION,
    "volume" DOUBLE PRECISION
);

-- CreateTable
CREATE TABLE "ohlc_premarket" (
    "symbol" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL,
    "open" DOUBLE PRECISION,
    "high" DOUBLE PRECISION,
    "low" DOUBLE PRECISION,
    "close" DOUBLE PRECISION,
    "volume" DOUBLE PRECISION
);

-- CreateTable
CREATE TABLE "safe_bet" (
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "previous_close" DECIMAL,
    "open_price" DECIMAL,
    "current_price" DECIMAL,
    "pct_change_from_prev_close" DECIMAL,
    "pct_change_from_open" DECIMAL,
    "query_type" TEXT NOT NULL DEFAULT 'live',
    "captured_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "safe_bet_pkey" PRIMARY KEY ("symbol","query_type")
);

-- CreateTable
CREATE TABLE "stock_fundamentals_latest" (
    "id" BIGINT,
    "symbol" TEXT,
    "timestamp" TIMESTAMPTZ(6),
    "current_price" DOUBLE PRECISION,
    "previous_close" DOUBLE PRECISION,
    "open" DOUBLE PRECISION,
    "day_low" DOUBLE PRECISION,
    "day_high" DOUBLE PRECISION,
    "regular_market_price" DOUBLE PRECISION,
    "regular_market_open" DOUBLE PRECISION,
    "regular_market_day_low" DOUBLE PRECISION,
    "regular_market_day_high" DOUBLE PRECISION,
    "post_market_price" DOUBLE PRECISION,
    "post_market_change" DOUBLE PRECISION,
    "post_market_change_percent" DOUBLE PRECISION,
    "fifty_two_week_low" DOUBLE PRECISION,
    "fifty_two_week_high" DOUBLE PRECISION,
    "fifty_two_week_range" TEXT,
    "all_time_low" DOUBLE PRECISION,
    "all_time_high" DOUBLE PRECISION,
    "fifty_day_average" DOUBLE PRECISION,
    "two_hundred_day_average" DOUBLE PRECISION,
    "fifty_day_average_change" DOUBLE PRECISION,
    "fifty_day_average_change_percent" DOUBLE PRECISION,
    "two_hundred_day_average_change" DOUBLE PRECISION,
    "two_hundred_day_average_change_percent" DOUBLE PRECISION,
    "volume" DOUBLE PRECISION,
    "regular_market_volume" DOUBLE PRECISION,
    "average_volume" DOUBLE PRECISION,
    "average_volume_10days" DOUBLE PRECISION,
    "average_daily_volume_10day" DOUBLE PRECISION,
    "bid" DOUBLE PRECISION,
    "ask" DOUBLE PRECISION,
    "bid_size" DOUBLE PRECISION,
    "ask_size" DOUBLE PRECISION,
    "shares_outstanding" DOUBLE PRECISION,
    "float_shares" DOUBLE PRECISION,
    "short_ratio" DOUBLE PRECISION,
    "short_percent_of_float" DOUBLE PRECISION,
    "implied_shares_outstanding" DOUBLE PRECISION,
    "market_cap" DOUBLE PRECISION,
    "enterprise_value" DOUBLE PRECISION,
    "trailing_pe" DOUBLE PRECISION,
    "forward_pe" DOUBLE PRECISION,
    "peg_ratio" DOUBLE PRECISION,
    "price_to_book" DOUBLE PRECISION,
    "price_to_sales" DOUBLE PRECISION,
    "book_value" DOUBLE PRECISION,
    "totalrevenue" DOUBLE PRECISION,
    "netincometocommon" DOUBLE PRECISION,
    "revenue_per_share" DOUBLE PRECISION,
    "revenue_growth" DOUBLE PRECISION,
    "earnings_growth" DOUBLE PRECISION,
    "total_cash" DOUBLE PRECISION,
    "total_cash_per_share" DOUBLE PRECISION,
    "total_debt" DOUBLE PRECISION,
    "ebitda" DOUBLE PRECISION,
    "free_cashflow" DOUBLE PRECISION,
    "operating_cashflow" DOUBLE PRECISION,
    "profit_margins" DOUBLE PRECISION,
    "gross_margins" DOUBLE PRECISION,
    "ebitda_margins" DOUBLE PRECISION,
    "operating_margins" DOUBLE PRECISION,
    "return_on_assets" DOUBLE PRECISION,
    "return_on_equity" DOUBLE PRECISION,
    "current_ratio" DOUBLE PRECISION,
    "quick_ratio" DOUBLE PRECISION,
    "debt_to_equity" DOUBLE PRECISION,
    "eps" DOUBLE PRECISION,
    "trailing_eps" DOUBLE PRECISION,
    "forward_eps" DOUBLE PRECISION,
    "eps_current_year" DOUBLE PRECISION,
    "eps_forward" DOUBLE PRECISION,
    "earnings_quarterly_growth" DOUBLE PRECISION,
    "dividend_rate" DOUBLE PRECISION,
    "dividend_yield" DOUBLE PRECISION,
    "trailing_annual_dividend_rate" DOUBLE PRECISION,
    "trailing_annual_dividend_yield" DOUBLE PRECISION,
    "last_dividend_value" DOUBLE PRECISION,
    "last_dividend_date" TIMESTAMPTZ(6),
    "ex_dividend_date" TIMESTAMPTZ(6),
    "payout_ratio" DOUBLE PRECISION,
    "five_year_avg_dividend_yield" DOUBLE PRECISION,
    "dividend_date" TIMESTAMPTZ(6),
    "target_high_price" DOUBLE PRECISION,
    "target_low_price" DOUBLE PRECISION,
    "target_mean_price" DOUBLE PRECISION,
    "target_median_price" DOUBLE PRECISION,
    "recommendation_mean" DOUBLE PRECISION,
    "recommendation_key" TEXT,
    "number_of_analyst_opinions" INTEGER,
    "average_analyst_rating" TEXT,
    "audit_risk" INTEGER,
    "board_risk" INTEGER,
    "compensation_risk" INTEGER,
    "shareholder_rights_risk" INTEGER,
    "overall_risk" INTEGER,
    "governance_epoch" TIMESTAMPTZ(6),
    "compensation_as_of_epoch" TIMESTAMPTZ(6),
    "beta" DOUBLE PRECISION,
    "currency" TEXT,
    "tradeable" BOOLEAN,
    "quote_type" TEXT,
    "quote_source_name" TEXT,
    "market" TEXT,
    "market_state" TEXT,
    "triggerable" BOOLEAN,
    "custom_price_alert_confidence" TEXT,
    "exchange" TEXT,
    "exchange_timezone_name" TEXT,
    "exchange_timezone_short_name" TEXT,
    "gmt_offset_ms" INTEGER,
    "first_trade_date_ms" BIGINT,
    "has_pre_post_market_data" BOOLEAN,
    "long_business_summary" TEXT,
    "website" TEXT,
    "full_time_employees" INTEGER,
    "short_name" TEXT,
    "industry" TEXT,
    "sector" TEXT,
    "long_name" TEXT
);

-- CreateTable
CREATE TABLE "us_stocks" (
    "symbol" TEXT NOT NULL,
    "description" TEXT,
    "currency" TEXT,
    "mic" TEXT,
    "type" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "listed_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "last_fundamentals_update" TIMESTAMPTZ(6),

    CONSTRAINT "us_stocks_pkey" PRIMARY KEY ("symbol")
);

-- CreateIndex
CREATE INDEX "ohlc_timestamp_idx" ON "ohlc"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "ohlc_premarket_timestamp_idx" ON "ohlc_premarket"("timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "latest_stock_fundamentals_symbol_ts_idx" ON "stock_fundamentals_latest"("symbol");

