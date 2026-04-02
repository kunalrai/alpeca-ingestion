import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from './ui/card';
import { Search, X } from 'lucide-react';
import StockDetail from './StockDetail';
import { API_BASE } from '../api';

function PctBadge({ current, prev }) {
  if (!current || !prev) return null;
  const pct = ((current - prev) / prev) * 100;
  const pos = pct >= 0;
  return (
    <span className={`text-[10px] font-medium ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
      {pos ? '+' : ''}{pct.toFixed(2)}%
    </span>
  );
}

export default function StockExplorer() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const debounceRef = useRef(null);
  const LIMIT = 50;

  const fetchStocks = useCallback(async (q, p) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: LIMIT, page: p });
      if (q) params.set('search', q);
      const res = await fetch(`${API_BASE}/api/stocks?${params}`);
      const data = await res.json();
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchStocks(search, 1);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search, fetchStocks]);

  useEffect(() => {
    fetchStocks(search, page);
  }, [page]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="grid grid-cols-[280px_1fr] gap-4 h-[calc(100vh-40px)]">
      {/* Left — symbol list */}
      <Card className="flex flex-col overflow-hidden">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              className="w-full bg-accent/40 border border-border rounded-md pl-8 pr-8 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Search symbol or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearch('')}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            {loading ? 'Loading…' : `${total.toLocaleString()} symbols`}
          </p>
        </div>

        {/* Symbol rows */}
        <div className="flex-1 overflow-auto">
          {rows.map((r) => (
            <button
              key={r.symbol}
              onClick={() => setSelected(r.symbol)}
              className={`w-full flex items-center justify-between px-3 py-2 border-b border-border/40 text-left hover:bg-accent/40 transition-colors ${
                selected === r.symbol ? 'bg-primary/10 border-l-2 border-l-primary' : ''
              }`}
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold">{r.symbol}</p>
                {r.description && (
                  <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">{r.description}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <p className="text-xs font-medium">
                  {r.current_price ? `$${Number(r.current_price).toFixed(2)}` : <span className="text-muted-foreground/40">—</span>}
                </p>
                <PctBadge current={r.current_price} prev={r.previous_close} />
              </div>
            </button>
          ))}

          {!loading && rows.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">No symbols found</p>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-border text-[10px] text-muted-foreground">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="disabled:opacity-30 hover:text-foreground"
            >
              Prev
            </button>
            <span>{page} / {totalPages}</span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="disabled:opacity-30 hover:text-foreground"
            >
              Next
            </button>
          </div>
        )}
      </Card>

      {/* Right — detail panel */}
      <StockDetail symbol={selected} />
    </div>
  );
}
