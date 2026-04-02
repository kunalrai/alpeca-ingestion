import { API_BASE } from '../api';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Play, Square, Activity, RefreshCw } from 'lucide-react';

const JOB_LABELS = {
  ohlc: 'OHLC',
  ohlc_premarket: 'Pre-Market',
  safe_bet: 'Safe Bet',
  fundamentals: 'Fundamentals',
  us_stocks: 'US Stocks',
};

async function triggerJob(name) {
  await fetch(`${API_BASE}/api/jobs/run/${name}`, { method: 'POST' });
}

export default function PipelineStatus({ status, onStart, onStop }) {
  const { active = false, jobs = {} } = status || {};

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Pipeline
          </CardTitle>
          <Badge variant={active ? 'success' : 'muted'}>
            {active ? 'RUNNING' : 'IDLE'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Job status list */}
        <div className="space-y-2">
          {Object.entries(JOB_LABELS).map(([key, label]) => {
            const job = jobs[key] || {};
            const statusVariant =
              job.lastStatus === 'running' ? 'warning'
              : job.lastStatus === 'ok' ? 'success'
              : job.lastStatus === 'error' ? 'destructive'
              : 'muted';

            return (
              <div key={key} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      job.running ? 'bg-yellow-400 animate-pulse' :
                      job.lastStatus === 'ok' ? 'bg-emerald-400' :
                      job.lastStatus === 'error' ? 'bg-red-400' :
                      'bg-muted-foreground'
                    }`}
                  />
                  <span className="text-xs text-foreground">{label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {(key === 'fundamentals' || key === 'us_stocks') && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 w-5 p-0"
                      title={`Refresh ${JOB_LABELS[key]} now`}
                      onClick={() => triggerJob(key)}
                      disabled={job.running}
                    >
                      <RefreshCw className={`w-3 h-3 ${job.running ? 'animate-spin' : ''}`} />
                    </Button>
                  )}
                  <Badge variant={statusVariant} className="text-[10px]">
                    {job.running ? 'running' : job.lastStatus || 'idle'}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>

        {/* Last run times */}
        <div className="space-y-1 pt-1">
          {Object.entries(JOB_LABELS).map(([key, label]) => {
            const job = jobs[key] || {};
            return job.lastRun ? (
              <p key={key} className="text-[10px] text-muted-foreground">
                {label}: {new Date(job.lastRun).toLocaleTimeString()}
              </p>
            ) : null;
          })}
        </div>

        {/* Controls */}
        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={onStart} disabled={active} className="flex-1 gap-1">
            <Play className="w-3 h-3" /> Start
          </Button>
          <Button size="sm" variant="destructive" onClick={onStop} disabled={!active} className="flex-1 gap-1">
            <Square className="w-3 h-3" /> Stop
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
