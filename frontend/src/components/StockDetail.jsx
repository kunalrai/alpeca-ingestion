import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { API_BASE } from '../api';

function formatLargeNum(v) {
  if (!v) return '—';
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(2)}M`;
  return `$${Number(v).toLocaleString()}`;
}

const LARGE_NUM_FIELDS = new Set([
  'market_cap', 'enterprise_value', 'totalrevenue', 'netincometocommon',
  'ebitda', 'free_cashflow', 'operating_cashflow', 'total_cash', 'total_debt',
]);

const DATE_FIELDS = new Set(['ex_dividend_date', 'dividend_date', 'last_dividend_date', 'governance_epoch', 'compensation_as_of_epoch']);

function fmt(v, decimals = 2, field = '') {
  if (v === null || v === undefined) return <span className="text-muted-foreground/40">—</span>;
  if (typeof v === 'boolean') return <Badge variant={v ? 'success' : 'muted'}>{String(v)}</Badge>;
  if (DATE_FIELDS.has(field) || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v))) {
    const d = new Date(v);
    return isNaN(d) ? String(v) : d.toLocaleDateString();
  }
  if (typeof v === 'number') return v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return String(v);
}

function PctChange({ current, prev }) {
  if (!current || !prev) return <span className="text-muted-foreground/40">—</span>;
  const pct = ((current - prev) / prev) * 100;
  const pos = pct >= 0;
  return (
    <span className={pos ? 'text-emerald-400' : 'text-red-400'}>
      {pos ? '+' : ''}{pct.toFixed(2)}%
    </span>
  );
}

function OhlcTable({ rows }) {
  if (!rows.length) return <p className="text-xs text-muted-foreground py-4 text-center">No data</p>;
  return (
    <div className="overflow-auto max-h-[420px]">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-card">
          <tr className="text-muted-foreground border-b border-border">
            {['Timestamp', 'Open', 'High', 'Low', 'Close', 'Volume'].map((h) => (
              <th key={h} className="text-left py-1.5 px-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const up = r.close >= r.open;
            return (
              <tr key={i} className="border-b border-border/40 hover:bg-accent/30">
                <td className="py-1 px-2 text-muted-foreground">{new Date(r.timestamp).toLocaleString()}</td>
                <td className="py-1 px-2">{fmt(r.open)}</td>
                <td className="py-1 px-2 text-emerald-400">{fmt(r.high)}</td>
                <td className="py-1 px-2 text-red-400">{fmt(r.low)}</td>
                <td className={`py-1 px-2 font-medium ${up ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(r.close)}</td>
                <td className="py-1 px-2 text-muted-foreground">{r.volume ? Number(r.volume).toLocaleString() : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const FUND_GROUPS = [
  {
    label: 'Price',
    fields: [
      'current_price', 'previous_close', 'open',
      'day_low', 'day_high',
      'regular_market_price', 'regular_market_open', 'regular_market_day_low', 'regular_market_day_high',
      'post_market_price', 'post_market_change', 'post_market_change_percent',
      'fifty_two_week_low', 'fifty_two_week_high', 'fifty_two_week_range',
      'all_time_low', 'all_time_high',
      'fifty_day_average', 'two_hundred_day_average',
      'fifty_day_average_change', 'fifty_day_average_change_percent',
      'two_hundred_day_average_change', 'two_hundred_day_average_change_percent',
    ],
  },
  {
    label: 'Quote',
    fields: ['bid', 'ask', 'bid_size', 'ask_size'],
  },
  {
    label: 'Volume',
    fields: ['volume', 'regular_market_volume', 'average_volume', 'average_volume_10days', 'average_daily_volume_10day'],
  },
  {
    label: 'Shares',
    fields: ['shares_outstanding', 'float_shares', 'implied_shares_outstanding', 'short_ratio', 'short_percent_of_float'],
  },
  {
    label: 'Valuation',
    fields: ['market_cap', 'enterprise_value', 'trailing_pe', 'forward_pe', 'peg_ratio', 'price_to_book', 'price_to_sales', 'book_value', 'beta'],
  },
  {
    label: 'EPS',
    fields: ['eps', 'trailing_eps', 'forward_eps', 'eps_current_year', 'eps_forward', 'earnings_quarterly_growth', 'earnings_growth'],
  },
  {
    label: 'Financials',
    fields: [
      'totalrevenue', 'revenue_per_share', 'revenue_growth',
      'netincometocommon', 'ebitda', 'free_cashflow', 'operating_cashflow',
      'total_cash', 'total_cash_per_share', 'total_debt',
      'profit_margins', 'gross_margins', 'ebitda_margins', 'operating_margins',
      'return_on_assets', 'return_on_equity',
      'current_ratio', 'quick_ratio', 'debt_to_equity',
    ],
  },
  {
    label: 'Dividends',
    fields: [
      'dividend_rate', 'dividend_yield',
      'trailing_annual_dividend_rate', 'trailing_annual_dividend_yield',
      'last_dividend_value', 'last_dividend_date',
      'payout_ratio', 'five_year_avg_dividend_yield',
      'ex_dividend_date', 'dividend_date',
    ],
  },
  {
    label: 'Analyst',
    fields: [
      'target_high_price', 'target_low_price', 'target_mean_price', 'target_median_price',
      'recommendation_key', 'recommendation_mean', 'number_of_analyst_opinions', 'average_analyst_rating',
    ],
  },
  {
    label: 'Risk',
    fields: ['audit_risk', 'board_risk', 'compensation_risk', 'shareholder_rights_risk', 'overall_risk'],
  },
  {
    label: 'Company',
    fields: ['sector', 'industry', 'full_time_employees', 'website', 'currency', 'market', 'exchange', 'beta'],
  },
];

function FundamentalsView({ data, symbol, onFetched }) {
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState(null);  // { type: 'error'|'success', text }

  const isEnriched = data?.long_name || data?.market_cap || data?.trailing_pe;

  async function handleFetch() {
    setFetching(true);
    setFetchMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/stocks/${symbol}/fetch-fundamentals`, { method: 'POST' });
      const json = await res.json();
      if (res.status === 429) {
        setFetchMsg({ type: 'rate', text: json.error });
      } else if (!res.ok) {
        setFetchMsg({ type: 'error', text: json.error || 'Failed to fetch fundamentals' });
      } else {
        setFetchMsg({ type: 'success', text: 'Fundamentals loaded successfully' });
        onFetched?.(json.fundamentals);
      }
    } catch {
      setFetchMsg({ type: 'error', text: 'Network error — is the server running?' });
    } finally {
      setFetching(false);
    }
  }

  const noPolygonData = !data || !isEnriched;

  return (
    <div className="flex flex-col h-full">
      {noPolygonData && (
        <div className="mb-3 rounded-lg border border-border/50 bg-accent/20 px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-foreground">Fundamental data not yet enriched</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Nightly Polygon sync hasn't reached this symbol. Fetch it now.
            </p>
          </div>
          <button
            onClick={handleFetch}
            disabled={fetching}
            className="shrink-0 px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/80 disabled:opacity-50 transition-colors"
          >
            {fetching ? 'Fetching…' : 'Fetch Now'}
          </button>
        </div>
      )}

      {fetchMsg && (
        <div className={`mb-3 rounded-md px-3 py-2 text-xs ${
          fetchMsg.type === 'rate'    ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
          fetchMsg.type === 'error'   ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                        'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
        }`}>
          {fetchMsg.type === 'rate' && <span className="font-semibold">Rate Limited — </span>}
          {fetchMsg.text}
        </div>
      )}

      {!data
        ? <p className="text-xs text-muted-foreground py-4 text-center">No price data available yet</p>
        : (
          <div className="space-y-4 overflow-auto flex-1 pr-1">
            {data.long_business_summary && (
              <div className="text-xs text-muted-foreground leading-relaxed border-b border-border/30 pb-3">
                {data.long_business_summary}
              </div>
            )}
            {FUND_GROUPS.map((group) => {
              const entries = group.fields.filter((f) => data[f] !== null && data[f] !== undefined);
              if (!entries.length) return null;
              return (
                <div key={group.label}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{group.label}</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
                    {entries.map((f) => (
                      <div key={f} className="flex justify-between text-xs py-0.5 border-b border-border/30">
                        <span className="text-muted-foreground capitalize">{f.replace(/_/g, ' ').replace(/\b(\w)/g, c => c.toUpperCase())}</span>
                        <span className="font-medium">{LARGE_NUM_FIELDS.has(f) ? formatLargeNum(data[f]) : fmt(data[f], 2, f)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )
      }
    </div>
  );
}

export default function StockDetail({ symbol }) {
  const [detail, setDetail] = useState(null);
  const [ohlc, setOhlc] = useState([]);
  const [premarket, setPremarket] = useState([]);
  const [tab, setTab] = useState('ohlc');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    setDetail(null);
    setOhlc([]);
    setPremarket([]);

    Promise.all([
      fetch(`${API_BASE}/api/stocks/${symbol}`).then((r) => r.json()),
      fetch(`${API_BASE}/api/stocks/${symbol}/ohlc?limit=50`).then((r) => r.json()),
      fetch(`${API_BASE}/api/stocks/${symbol}/premarket?limit=20`).then((r) => r.json()),
    ]).then(([d, o, p]) => {
      setDetail(d);
      setOhlc(Array.isArray(o) ? o : []);
      setPremarket(Array.isArray(p) ? p : []);
    }).finally(() => setLoading(false));
  }, [symbol]);

  if (!symbol) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Select a symbol to view details
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading…</div>;
  }

  if (!detail || detail.error) {
    return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Symbol not found</div>;
  }

  const { info, fundamentals, latestOhlc } = detail;
  const price = fundamentals?.current_price ?? latestOhlc?.close;
  const prevClose = fundamentals?.previous_close;

  const TABS = [
    { key: 'ohlc', label: `OHLC (${ohlc.length})` },
    { key: 'fundamentals', label: 'Fundamentals' },
    { key: 'premarket', label: `Pre-Market (${premarket.length})` },
  ];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-border">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-lg">{info.symbol}</CardTitle>
              {info.mic && <Badge variant="muted" className="text-[10px]">{info.mic}</Badge>}
              {fundamentals?.market_state && (
                <Badge variant={fundamentals.market_state === 'REGULAR' ? 'success' : 'warning'} className="text-[10px]">
                  {fundamentals.market_state}
                </Badge>
              )}
              {fundamentals?.industry && (
                <Badge variant="muted" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20">
                  {fundamentals.industry}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {fundamentals?.long_name || info.description || '—'}
            </p>
            {fundamentals?.website && (
              <p className="text-[10px] text-primary/60 mt-0.5 truncate">{fundamentals.website}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold">{price ? `$${Number(price).toFixed(2)}` : '—'}</p>
            <p className="text-xs mt-0.5"><PctChange current={price} prev={prevClose} /></p>
            {fundamentals?.market_cap && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Mkt Cap: {formatLargeNum(fundamentals.market_cap)}
              </p>
            )}
          </div>
        </div>

        {/* Key stats row */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          {[
            { label: 'Bid', value: fundamentals?.bid ? `$${Number(fundamentals.bid).toFixed(2)}` : '—' },
            { label: 'Ask', value: fundamentals?.ask ? `$${Number(fundamentals.ask).toFixed(2)}` : '—' },
            { label: 'Volume', value: fundamentals?.volume ? Number(fundamentals.volume).toLocaleString() : '—' },
            { label: 'Prev Close', value: prevClose ? `$${Number(prevClose).toFixed(2)}` : '—' },
            { label: 'P/E', value: fundamentals?.trailing_pe ? Number(fundamentals.trailing_pe).toFixed(2) : '—' },
            { label: 'EPS', value: fundamentals?.eps ? `$${Number(fundamentals.eps).toFixed(2)}` : '—' },
            { label: '52W Low', value: fundamentals?.fifty_two_week_low ? `$${Number(fundamentals.fifty_two_week_low).toFixed(2)}` : '—' },
            { label: '52W High', value: fundamentals?.fifty_two_week_high ? `$${Number(fundamentals.fifty_two_week_high).toFixed(2)}` : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-accent/30 rounded px-2 py-1.5">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className="text-xs font-semibold">{value}</p>
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex-1 pt-3 min-h-0 flex flex-col">
        {/* Tabs */}
        <div className="flex gap-1 mb-3">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                tab === t.key ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'ohlc' && <OhlcTable rows={ohlc} />}
        {tab === 'fundamentals' && (
          <FundamentalsView
            data={fundamentals}
            symbol={symbol}
            onFetched={(f) => setDetail((d) => ({ ...d, fundamentals: f }))}
          />
        )}
        {tab === 'premarket' && <OhlcTable rows={premarket} />}
      </CardContent>
    </Card>
  );
}
