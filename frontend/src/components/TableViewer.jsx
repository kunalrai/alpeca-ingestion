import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';
import { ScrollArea } from './ui/scroll-area';
import { ChevronLeft, ChevronRight, RefreshCw, Search, Table2, X } from 'lucide-react';
import { API_BASE } from '../api';

const TABLES = [
  { key: 'ohlc',          label: 'master.ohlc' },
  { key: 'ohlc_premarket',label: 'master.ohlc_premarket' },
  { key: 'safe_bet',      label: 'master.safe_bet' },
  { key: 'fundamentals',  label: 'master.stock_fundamentals_latest' },
  { key: 'us_stocks',     label: 'master.us_stocks' },
];

function fmt(val) {
  if (val === null || val === undefined) return <span className="text-muted-foreground/40">—</span>;
  if (typeof val === 'boolean') return <Badge variant={val ? 'success' : 'muted'}>{String(val)}</Badge>;
  if (typeof val === 'object') return <span className="text-muted-foreground text-[10px]">{JSON.stringify(val)}</span>;
  const str = String(val);
  // truncate long strings
  return str.length > 60 ? <span title={str}>{str.slice(0, 58)}…</span> : str;
}

export default function TableViewer() {
  const [tableKey, setTableKey] = useState('ohlc');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef(null);
  const limit = 50;

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit });
      if (search) params.set('search', search);
      const res = await window.fetch(`${API_BASE}/api/table/${tableKey}?${params}`);
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [tableKey, page, search]);

  useEffect(() => {
    setPage(1);
  }, [tableKey, search]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const totalPages = data ? Math.ceil(data.total / limit) : 1;

  function handleSearch(e) {
    e.preventDefault();
    setSearch(searchInput);
  }

  function handleSearchInput(e) {
    const val = e.target.value;
    setSearchInput(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(val.trim()), 400);
  }

  function clearSearch() {
    setSearchInput('');
    setSearch('');
  }

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Table2 className="w-4 h-4 text-primary" />
            Table Browser
          </CardTitle>

          {/* Table selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={tableKey} onValueChange={(v) => { setTableKey(v); setSearchInput(''); setSearch(''); }}>
              <SelectTrigger className="w-64 text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TABLES.map((t) => (
                  <SelectItem key={t.key} value={t.key} className="text-xs font-mono">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Symbol search */}
            <form onSubmit={handleSearch} className="flex gap-1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                <input
                  value={searchInput}
                  onChange={handleSearchInput}
                  placeholder="Filter symbol…"
                  className="h-8 w-40 rounded-md border border-input bg-transparent pl-7 pr-7 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
                {searchInput && (
                  <button type="button" onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </form>

            <Button size="sm" variant="outline" className="h-8 px-2" onClick={fetch} disabled={loading}>
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Row count + pagination info */}
        {data && (
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted-foreground">
              {data.total.toLocaleString()} rows
              {search && <span> matching <span className="text-foreground font-mono">{search}</span></span>}
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
                <ChevronLeft className="w-3 h-3" />
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">
                {page} / {totalPages}
              </span>
              <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 min-h-0 p-0 px-4 pb-4">
        {loading && !data && (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Loading…</div>
        )}
        {data?.error && (
          <div className="text-destructive text-sm p-4">{data.error}</div>
        )}
        {data && !data.error && (
          <ScrollArea className="h-full rounded-md border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] font-mono">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b border-border">
                    {data.columns.map((col) => (
                      <th key={col} className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                      {data.columns.map((col) => (
                        <td key={col} className="px-3 py-1.5 whitespace-nowrap text-foreground/90">
                          {fmt(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {data.rows.length === 0 && (
                    <tr>
                      <td colSpan={data.columns.length} className="text-center text-muted-foreground py-8">
                        No rows found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
