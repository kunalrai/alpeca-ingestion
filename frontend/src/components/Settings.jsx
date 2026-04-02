import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Settings2, Clock, RefreshCw, Save, RotateCcw } from 'lucide-react';
import { API_BASE } from '../api';

const FIELD_CONFIG = [
  {
    section: 'OHLC Refresh',
    icon: RefreshCw,
    fields: [
      { key: 'ohlcPollSeconds',       label: 'OHLC Poll Interval',           unit: 'seconds', min: 30,  max: 3600, step: 30,  hint: 'How often to fetch OHLC data during market hours' },
      { key: 'premarketPollSeconds',  label: 'Pre-Market Poll Interval',     unit: 'seconds', min: 30,  max: 3600, step: 30,  hint: 'How often to fetch OHLC during pre-market hours' },
    ],
  },
  {
    section: 'Fundamentals',
    icon: RefreshCw,
    fields: [
      { key: 'fundamentalsIntervalSeconds', label: 'Fundamentals Poll Interval', unit: 'seconds', min: 60, max: 3600, step: 60, hint: 'How often to poll fundamentals data' },
    ],
  },
  {
    section: 'Market Hours (ET)',
    icon: Clock,
    fields: [
      { key: 'preMarketStart', label: 'Pre-Market Start', unit: 'time', hint: 'Start of pre-market window (HH:MM)' },
      { key: 'marketOpen',     label: 'Market Open',      unit: 'time', hint: 'Market open time (HH:MM)' },
      { key: 'marketClose',    label: 'Market Close',     unit: 'time', hint: 'Market close time (HH:MM)' },
    ],
  },
  {
    section: 'API',
    icon: Settings2,
    fields: [
      { key: 'batchSize', label: 'Batch Size', unit: 'symbols', min: 100, max: 1000, step: 100, hint: 'Symbols per Alpaca API request' },
    ],
  },
];

function fmtSeconds(s) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${s / 60}m`;
  return `${s / 3600}h`;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [draft, setDraft]       = useState(null);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/settings`)
      .then((r) => r.json())
      .then((s) => { setSettings(s); setDraft(s); });
  }, []);

  function handleChange(key, value) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      setSettings(data.settings);
      setDraft(data.settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setDraft(settings);
    setSaved(false);
  }

  const isDirty = draft && settings && JSON.stringify(draft) !== JSON.stringify(settings);

  if (!draft) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Loading settings...
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5 h-[calc(100vh-90px)] overflow-y-auto pr-1">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Pipeline Settings</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Changes take effect immediately — scheduler restarts automatically</p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={handleReset}>
              <RotateCcw className="w-3 h-3" /> Reset
            </Button>
          )}
          <Button
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={handleSave}
            disabled={!isDirty || saving}
          >
            {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {saved && (
        <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 text-xs text-emerald-400">
          Settings saved — scheduler restarted with new intervals.
        </div>
      )}

      {/* Setting sections */}
      {FIELD_CONFIG.map(({ section, icon: Icon, fields }) => (
        <Card key={section}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Icon className="w-4 h-4 text-primary" />
              {section}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {fields.map(({ key, label, unit, min, max, step, hint }) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground">{label}</label>
                  <Badge variant="secondary" className="font-mono text-[11px]">
                    {unit === 'seconds'
                      ? `${draft[key]}s = ${fmtSeconds(draft[key])}`
                      : unit === 'symbols'
                      ? `${draft[key]} symbols`
                      : draft[key]}
                  </Badge>
                </div>

                {unit === 'time' ? (
                  <input
                    type="time"
                    value={draft[key]}
                    onChange={(e) => handleChange(key, e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
                  />
                ) : (
                  <div className="space-y-1">
                    <input
                      type="range"
                      min={min} max={max} step={step}
                      value={draft[key]}
                      onChange={(e) => handleChange(key, parseInt(e.target.value))}
                      className="w-full accent-primary cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{fmtSeconds(min)}</span>
                      <span>{fmtSeconds(max)}</span>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground">{hint}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
