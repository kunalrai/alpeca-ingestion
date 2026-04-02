const axios = require('axios');
const db = require('../db');
const config = require('../config');
const log = require('../logQueue');

async function run() {
  log.push('info', 'us_stocks', 'US stocks ingest started');
  try {
    const client = axios.create({
      baseURL: 'https://paper-api.alpaca.markets/v2',
      headers: {
        'APCA-API-KEY-ID': config.alpaca.apiKey,
        'APCA-API-SECRET-KEY': config.alpaca.secretKey,
      },
      timeout: 30000,
    });

    const res = await client.get('/assets', {
      params: { status: 'active', asset_class: 'us_equity' },
    });

    const assets = res.data;
    if (!Array.isArray(assets) || !assets.length) {
      log.push('warn', 'us_stocks', 'No assets returned from Alpaca');
      return;
    }

    log.push('info', 'us_stocks', `Fetched ${assets.length} assets from Alpaca`);

    const chunkSize = 500;
    let total = 0;

    for (let i = 0; i < assets.length; i += chunkSize) {
      const chunk = assets.slice(i, i + chunkSize);
      // 7 params per row; updated_at uses NOW() literal
      const values = chunk
        .map((_, j) => {
          const b = j * 7;
          return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},NOW())`;
        })
        .join(',');
      const flat = chunk.flatMap((a) => [
        a.symbol,
        a.name ?? null,
        a.currency ?? null,
        a.exchange ?? null,
        a.class ?? null,
        a.status === 'active',
        a.listed_at ? new Date(a.listed_at) : null,
      ]);

      await db.query(
        `INSERT INTO master.us_stocks (symbol, description, currency, mic, type, is_active, listed_at, updated_at)
         VALUES ${values}
         ON CONFLICT (symbol) DO UPDATE SET
           description = EXCLUDED.description,
           currency    = EXCLUDED.currency,
           mic         = EXCLUDED.mic,
           type        = EXCLUDED.type,
           is_active   = EXCLUDED.is_active,
           listed_at   = EXCLUDED.listed_at,
           updated_at  = NOW()`,
        flat
      );

      total += chunk.length;
      log.push('info', 'us_stocks', `Upserted ${total}/${assets.length} symbols`);
    }

    await db.setWatermark('us_stocks', new Date());
    log.push('info', 'us_stocks', `US stocks done — ${total} rows upserted`);
  } catch (err) {
    log.push('error', 'us_stocks', `US stocks error: ${err.message}`);
  }
}

module.exports = { run };
