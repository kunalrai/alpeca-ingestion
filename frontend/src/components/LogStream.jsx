import { useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Terminal } from 'lucide-react';

const LEVEL_VARIANT = {
  info: 'secondary',
  warn: 'warning',
  error: 'destructive',
};

const LEVEL_COLOR = {
  info: 'text-foreground',
  warn: 'text-yellow-400',
  error: 'text-red-400',
};

const JOB_COLOR = {
  ohlc: 'text-blue-400',
  ohlc_premarket: 'text-cyan-400',
  safe_bet: 'text-purple-400',
  fundamentals: 'text-orange-400',
  scheduler: 'text-emerald-400',
  server: 'text-muted-foreground',
};

export default function LogStream({ logs, connected }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Terminal className="w-4 h-4 text-primary" />
            Log Stream
          </CardTitle>
          <Badge variant={connected ? 'success' : 'destructive'} className="text-[10px]">
            {connected ? 'LIVE' : 'DISCONNECTED'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0 px-4 pb-4">
        <ScrollArea className="h-full rounded-md border border-border bg-background p-3">
          <div className="space-y-0.5 font-mono text-[11px]">
            {logs.length === 0 && (
              <p className="text-muted-foreground italic">Waiting for log entries...</p>
            )}
            {logs.map((entry, i) => (
              <div key={i} className={`flex gap-2 leading-5 ${LEVEL_COLOR[entry.level]}`}>
                <span className="text-muted-foreground flex-shrink-0 tabular-nums">
                  {new Date(entry.ts).toLocaleTimeString()}
                </span>
                <span className={`flex-shrink-0 w-16 ${JOB_COLOR[entry.job] || 'text-muted-foreground'}`}>
                  [{entry.job}]
                </span>
                <span className="break-all">{entry.message}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
