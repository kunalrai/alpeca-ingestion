import { PieChart, LayoutDashboard, Table2, Settings, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';

const NAV = [
  { key: 'dashboard', label: 'Dashboard',  icon: PieChart },
  { key: 'monitor',   label: 'Monitor',    icon: LayoutDashboard },
  { key: 'tables',    label: 'Tables',     icon: Table2 },
  { key: 'settings',  label: 'Settings',   icon: Settings },
];

export default function Sidebar({ active, onChange, pipelineActive, connected }) {
  return (
    <aside className="flex flex-col w-48 bg-card border-r border-border h-screen fixed left-0 top-0 z-20">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <div>
            <p className="text-sm font-bold text-foreground leading-none">Alpaca Ingest</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">FXMiracle · IEX</p>
          </div>
        </div>
        {/* Live status dot */}
        <div className="flex items-center gap-1.5 mt-3">
          <span className={`w-1.5 h-1.5 rounded-full ${pipelineActive ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground'}`} />
          <span className="text-[10px] text-muted-foreground">{pipelineActive ? 'Pipeline running' : 'Pipeline idle'}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-blue-400' : 'bg-red-400'}`} />
          <span className="text-[10px] text-muted-foreground">{connected ? 'WS connected' : 'WS disconnected'}</span>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left',
              active === key
                ? 'bg-primary/15 text-primary font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border">
        <p className="text-[10px] text-muted-foreground">stocks DB · 38.49.213.39</p>
        <p className="text-[10px] text-muted-foreground">PostgreSQL 18.1</p>
      </div>
    </aside>
  );
}
