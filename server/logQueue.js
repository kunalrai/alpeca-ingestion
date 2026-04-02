// Shared in-memory log queue — pipeline jobs push here, WS server broadcasts from here
const MAX_LOGS = 500;
const logs = [];
const listeners = new Set();

function push(level, job, message) {
  const entry = {
    ts: new Date().toISOString(),
    level,   // 'info' | 'warn' | 'error'
    job,
    message,
  };
  logs.push(entry);
  if (logs.length > MAX_LOGS) logs.shift();
  listeners.forEach((fn) => fn(entry));
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function recent(n = 100) {
  return logs.slice(-n);
}

module.exports = { push, subscribe, recent };
