import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Progress } from './ui/progress';
import { Database, Loader2 } from 'lucide-react';

const TABLE_CONFIG = {
  ohlc:           { label: 'master.ohlc',                      maxRows: 500000, job: 'ohlc' },
  ohlc_premarket: { label: 'master.ohlc_premarket',            maxRows: 250000, job: 'ohlc_premarket' },
  safe_bet:       { label: 'master.safe_bet',                  maxRows: 65,     job: 'safe_bet' },
  fundamentals:   { label: 'master.stock_fundamentals_latest', maxRows: 15000,  job: 'fundamentals' },
  us_stocks:      { label: 'master.us_stocks',                 maxRows: 32000,  job: null },
};

function fmt(n) {
  if (n == null) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

// Parse latest batch progress from logs for a given job
function useBatchProgress(logs, jobName) {
  return useMemo(() => {
    if (!logs?.length) return null;
    // Walk backwards to find the most recent batch log for this job
    for (let i = logs.length - 1; i >= 0; i--) {
      const entry = logs[i];
      if (entry.job !== jobName) continue;
      const match = entry.message.match(/Batch (\d+)\/(\d+) — ([\d,]+)\/([\d,]+) symbols fetched/);
      if (match) {
        const batchNum   = parseInt(match[1]);
        const totalBatch = parseInt(match[2]);
        const fetched    = parseInt(match[3].replace(/,/g, ''));
        const total      = parseInt(match[4].replace(/,/g, ''));
        // Only show if it's from a recent run (within last 3 minutes)
        const age = Date.now() - new Date(entry.ts).getTime();
        if (age < 3 * 60 * 1000) {
          return { batchNum, totalBatch, fetched, total, pct: Math.round((batchNum / totalBatch) * 100) };
        }
      }
      // If we hit a "done" or "started" log, stop looking
      if (entry.job === jobName && (entry.message.includes('done') || entry.message.includes('started'))) break;
    }
    return null;
  }, [logs, jobName]);
}

function TableRow({ tableKey, config, count, logs, status }) {
  const batch = useBatchProgress(logs, config.job);
  const jobRunning = status?.jobs?.[config.job]?.running;

  // Determine what to show
  const showBatch = config.job && jobRunning && batch;
  const rowPct = Math.min(100, ((count ?? 0) / config.maxRows) * 100);

  return (
    <div className="space-y-1.5">
      {/* Label row */}
      <div className="flex justify-between items-center gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {jobRunning && (
            <Loader2 className="w-3 h-3 text-primary animate-spin flex-shrink-0" />
          )}
          <span className="text-xs text-muted-foreground font-mono truncate">{config.label}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {showBatch && (
            <span className="text-[10px] text-primary font-mono">
              batch {batch.batchNum}/{batch.totalBatch}
            </span>
          )}
          <span className="text-xs font-semibold text-foreground tabular-nums">
            {fmt(count)}
          </span>
        </div>
      </div>

      {/* Progress bar — batch fetch progress if running, else row count */}
      {showBatch ? (
        <div className="space-y-0.5">
          <Progress value={batch.pct} className="h-1.5 bg-primary/20" />
          <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
            <span>{batch.fetched.toLocaleString()} symbols fetched</span>
            <span>{batch.total.toLocaleString()} total · {batch.pct}%</span>
          </div>
        </div>
      ) : (
        <Progress value={rowPct} className="h-1.5" />
      )}
    </div>
  );
}

export default function MetricBars({ metrics, logs, status }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          Table Row Counts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(TABLE_CONFIG).map(([key, cfg]) => (
          <TableRow
            key={key}
            tableKey={key}
            config={cfg}
            count={metrics?.[key]}
            logs={logs}
            status={status}
          />
        ))}
      </CardContent>
    </Card>
  );
}
