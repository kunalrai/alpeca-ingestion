const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../settings.json');

const DEFAULTS = {
  ohlcPollSeconds: 60,
  premarketPollSeconds: 60,
  fundamentalsIntervalSeconds: 300,
  preMarketStart: '04:00',
  marketOpen: '09:30',
  marketClose: '16:00',
  batchSize: 1000,
  polygonRateLimitMs: 12000,
  polygonBudgetPerRun: 200,
};

function load() {
  try {
    if (fs.existsSync(FILE)) {
      return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
    }
  } catch {}
  return { ...DEFAULTS };
}

function save(settings) {
  fs.writeFileSync(FILE, JSON.stringify(settings, null, 2));
}

module.exports = { load, save, DEFAULTS };
