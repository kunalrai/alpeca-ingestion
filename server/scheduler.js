const cron = require('node-cron');
const { schedule: cfgDefault } = require('./config');
const settingsStore = require('./settingsStore');
const log = require('./logQueue');

const ingestOhlc = require('./jobs/ingestOhlc');
const ingestOhlcPremarket = require('./jobs/ingestOhlcPremarket');
const ingestSafeBet = require('./jobs/ingestSafeBet');
const ingestFundamentals = require('./jobs/ingestFundamentals');

const jobState = {
  ohlc:           { running: false, lastRun: null, lastStatus: 'idle' },
  ohlc_premarket: { running: false, lastRun: null, lastStatus: 'idle' },
  safe_bet:       { running: false, lastRun: null, lastStatus: 'idle' },
  fundamentals:   { running: false, lastRun: null, lastStatus: 'idle' },
};

let tasks = [];
let active = false;

function getSettings() {
  return settingsStore.load();
}

function nowET() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: cfgDefault.timezone }));
}

function inWindow(startHHMM, endHHMM) {
  const now = nowET();
  const [sh, sm] = startHHMM.split(':').map(Number);
  const [eh, em] = endHHMM.split(':').map(Number);
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return nowMins >= sh * 60 + sm && nowMins < eh * 60 + em;
}

async function runJob(name, fn, windowStart, windowEnd) {
  if (!inWindow(windowStart, windowEnd)) return;
  if (jobState[name].running) {
    log.push('warn', name, `${name} already running, skipping`);
    return;
  }
  jobState[name].running = true;
  jobState[name].lastStatus = 'running';
  try {
    await fn();
    jobState[name].lastRun = new Date().toISOString();
    jobState[name].lastStatus = 'ok';
  } catch (err) {
    jobState[name].lastStatus = 'error';
    log.push('error', name, `${name} failed: ${err.message}`);
  } finally {
    jobState[name].running = false;
  }
}

function start() {
  if (active) return;
  active = true;
  const s = getSettings();
  log.push('info', 'scheduler', `Scheduler started — OHLC every ${s.ohlcPollSeconds}s, Fundamentals every ${s.fundamentalsIntervalSeconds}s`);

  const ohlcMins    = Math.max(1, Math.round(s.ohlcPollSeconds / 60));
  const preMins     = Math.max(1, Math.round(s.premarketPollSeconds / 60));
  const fundsMins   = Math.max(1, Math.round(s.fundamentalsIntervalSeconds / 60));

  tasks.push(
    cron.schedule(`0 */${ohlcMins} * * * *`, () =>
      runJob('ohlc', ingestOhlc.run, s.marketOpen, s.marketClose)
    )
  );
  tasks.push(
    cron.schedule(`10 */${preMins} * * * *`, () =>
      runJob('ohlc_premarket', ingestOhlcPremarket.run, s.preMarketStart, s.marketOpen)
    )
  );
  tasks.push(
    cron.schedule(`20 */${ohlcMins} * * * *`, () =>
      runJob('safe_bet', ingestSafeBet.run, s.marketOpen, s.marketClose)
    )
  );
  tasks.push(
    cron.schedule(`30 */${fundsMins} * * * *`, () =>
      runJob('fundamentals', ingestFundamentals.run, s.preMarketStart, s.marketOpen)
    )
  );
}

function stop() {
  tasks.forEach((t) => t.stop());
  tasks = [];
  active = false;
  log.push('info', 'scheduler', 'Scheduler stopped');
}

// Restart with new settings applied
function restart() {
  stop();
  start();
}

function getStatus() {
  return { active, jobs: jobState, settings: getSettings() };
}

module.exports = { start, stop, restart, getStatus };
