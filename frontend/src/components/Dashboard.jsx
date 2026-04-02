import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, AreaChart, Area,
} from 'recharts';
import { API_BASE } from '../api';
import {
  Database, TrendingUp, Activity, Clock, BarChart2,
  RefreshCw, Layers, Cpu, ShieldCheck, Trophy,
} from 'lucide-react';
import { Button } from './ui/button';

function fmt(n) {
  if (n == null || n === '') return '—';
  const num = parseFloat(n);
  if (isNaN(num)) return '—';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'k';
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function timeAgo(iso) {
  if (!iso) return '—';
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, sub, color = 'text-primary' }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
          </div>
          <div className={`p-2 rounded-md bg-primary/10 ${color}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-mono">
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/dashboard`);
      setData(await res.json());
      setLastRefresh(new Date());
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading dashboard...
      </div>
    );
  }

  const { counts, ohlcRecent, topSymbols, fundamentalsCoverage, ohlcByHour, schedulerStatus, marketLeaders } = data;
  const jobs = schedulerStatus?.jobs || {};

  // Format ohlcByHour for chart
  const hourlyChart = (ohlcByHour || []).map((r) => ({
    hour: new Date(r.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    rows: parseInt(r.rows),
  }));

  // Top symbols chart
  const topSymbolsChart = (topSymbols || []).map((r) => ({
    symbol: r.symbol,
    volume: parseFloat(r.total_volume) || 0,
    price: parseFloat(r.last_price) || 0,
  }));

  // Coverage pct
  const covTotal = parseInt(fundamentalsCoverage?.total) || 0;
  const covPrice = covTotal ? Math.round((parseInt(fundamentalsCoverage?.with_price) / covTotal) * 100) : 0;
  const covPe    = covTotal ? Math.round((parseInt(fundamentalsCoverage?.with_pe)    / covTotal) * 100) : 0;
  const covMcap  = covTotal ? Math.round((parseInt(fundamentalsCoverage?.with_market_cap) / covTotal) * 100) : 0;

  return (
    <div className="space-y-4 h-[calc(100vh-130px)] overflow-y-auto pr-1">

      {/* Refresh row */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Last updated: {lastRefresh ? lastRefresh.toLocaleTimeString() : '—'} · auto-refresh every 15s
        </p>
        <Button size="sm" variant="outline" className="h-7 px-2 gap-1" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* ── Top metric cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          icon={Database} label="OHLC Rows" value={fmt(counts?.ohlc)}
          sub={`+${fmt(counts?.ohlc)} total`} color="text-blue-400"
        />
        <MetricCard
          icon={Layers} label="Active Symbols" value={fmt(counts?.us_stocks)}
          sub="from master.us_stocks" color="text-cyan-400"
        />
        <MetricCard
          icon={ShieldCheck} label="Safe Bet Symbols" value={fmt(counts?.safe_bet)}
          sub="monitored live" color="text-purple-400"
        />
        <MetricCard
          icon={TrendingUp} label="Fundamentals" value={fmt(counts?.fundamentals)}
          sub={`${covPrice}% have price data`} color="text-orange-400"
        />
      </div>

      {/* ── Job status row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Object.entries(jobs).map(([key, job]) => (
          <Card key={key}>
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground capitalize">{key.replace('_', ' ')}</p>
                <p className="text-xs font-medium text-foreground mt-0.5">
                  {job.lastRun ? timeAgo(job.lastRun) : 'Never run'}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant={job.running ? 'warning' : job.lastStatus === 'ok' ? 'success' : 'muted'} className="text-[10px]">
                  {job.running ? 'running' : job.lastStatus || 'idle'}
                </Badge>
                <span className={`w-2 h-2 rounded-full ${job.running ? 'bg-yellow-400 animate-pulse' : job.lastStatus === 'ok' ? 'bg-emerald-400' : 'bg-muted-foreground'}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* OHLC rows per hour */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" /> OHLC Rows — Last 12 Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hourlyChart.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={hourlyChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="ohlcGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(142,71%,45%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(142,71%,45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(216,34%,17%)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'hsl(215,16%,57%)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(215,16%,57%)' }} tickFormatter={fmt} width={45} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="rows" name="Rows" stroke="hsl(142,71%,45%)" fill="url(#ohlcGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top symbols by volume */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Top 10 Symbols by Volume (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topSymbolsChart.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={topSymbolsChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(216,34%,17%)" />
                  <XAxis dataKey="symbol" tick={{ fontSize: 10, fill: 'hsl(215,16%,57%)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(215,16%,57%)' }} tickFormatter={fmt} width={45} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="volume" name="Volume" fill="hsl(142,71%,45%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Market Leaders ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" /> Stock Market Leaders
            <span className="ml-auto text-[10px] text-muted-foreground font-normal">Top 25 by volume · latest bar</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 px-4 pb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="border-b border-border">
                  {['Symbol', 'Name', 'Latest', 'Change', '% Change', 'Volume', 'Time'].map((h) => (
                    <th key={h} className="text-left py-1.5 pr-4 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(marketLeaders || []).length === 0 && (
                  <tr><td colSpan={7} className="text-center text-muted-foreground py-6">No data yet</td></tr>
                )}
                {(marketLeaders || []).map((r, i) => {
                  const chg = parseFloat(r.change);
                  const pct = parseFloat(r.pct_change);
                  const pos = chg >= 0;
                  const chgColor = pos ? 'text-emerald-400' : 'text-red-400';
                  return (
                    <tr key={i} className="border-b border-border/40 hover:bg-accent/20 transition-colors">
                      <td className="py-1.5 pr-4 text-blue-400 font-semibold">{r.symbol}</td>
                      <td className="py-1.5 pr-4 text-muted-foreground max-w-[160px] truncate" title={r.name}>{r.name || '—'}</td>
                      <td className="py-1.5 pr-4 font-semibold">{fmt(r.price)}</td>
                      <td className={`py-1.5 pr-4 ${chgColor}`}>{isNaN(chg) ? '—' : `${pos ? '+' : ''}${chg.toFixed(2)}`}</td>
                      <td className={`py-1.5 pr-4 font-semibold ${chgColor}`}>{isNaN(pct) ? '—' : `${pos ? '+' : ''}${pct.toFixed(2)}%`}</td>
                      <td className="py-1.5 pr-4 text-muted-foreground">{fmt(r.volume)}</td>
                      <td className="py-1.5 text-muted-foreground whitespace-nowrap">
                        {r.timestamp ? new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ET' : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Bottom row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Recent OHLC */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Recent OHLC Rows
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 px-4 pb-4">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="border-b border-border">
                  {['Symbol', 'Time', 'Open', 'High', 'Low', 'Close', 'Volume'].map((h) => (
                    <th key={h} className="text-left py-1.5 pr-3 text-muted-foreground font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(ohlcRecent || []).map((r, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-accent/20">
                    <td className="py-1 pr-3 text-blue-400 font-semibold">{r.symbol}</td>
                    <td className="py-1 pr-3 text-muted-foreground">{new Date(r.timestamp).toLocaleTimeString()}</td>
                    <td className="py-1 pr-3">{fmt(r.open)}</td>
                    <td className="py-1 pr-3 text-emerald-400">{fmt(r.high)}</td>
                    <td className="py-1 pr-3 text-red-400">{fmt(r.low)}</td>
                    <td className="py-1 pr-3 font-semibold">{fmt(r.close)}</td>
                    <td className="py-1 text-muted-foreground">{fmt(r.volume)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Fundamentals coverage */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" /> Fundamentals Coverage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Total symbols with fundamentals', value: fmt(covTotal), pct: null },
              { label: 'Have price data', value: `${fmt(fundamentalsCoverage?.with_price)} (${covPrice}%)`, pct: covPrice },
              { label: 'Have P/E ratio', value: `${fmt(fundamentalsCoverage?.with_pe)} (${covPe}%)`, pct: covPe },
              { label: 'Have market cap', value: `${fmt(fundamentalsCoverage?.with_market_cap)} (${covMcap}%)`, pct: covMcap },
            ].map(({ label, value, pct }) => (
              <div key={label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono font-medium text-foreground">{value}</span>
                </div>
                {pct !== null && (
                  <div className="w-full bg-secondary rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
