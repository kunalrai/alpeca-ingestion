require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

module.exports = {
  alpaca: {
    plan: 'free',
    apiKey: process.env.ALPACA_API_KEY,
    secretKey: process.env.ALPACA_SECRET_KEY,
    baseUrl: 'https://data.alpaca.markets/v2',
  },
  schedule: {
    preMarketStart: '04:00',
    marketOpen: '09:30',
    marketClose: '16:00',
    ohlcPollSeconds: 60,
    fundamentalsIntervalSeconds: 300,
    timezone: 'America/New_York',
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'abc123',
    max: 10,
    idleTimeoutMillis: 30000,
  },
  batchSize: 1000,
  port: parseInt(process.env.PORT) || 3000,
};
