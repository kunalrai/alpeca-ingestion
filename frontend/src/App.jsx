import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import PipelineStatus from './components/PipelineStatus';
import MetricBars from './components/MetricBars';
import LogStream from './components/LogStream';
import TableViewer from './components/TableViewer';
import SettingsPage from './components/Settings';
import { useWebSocket } from './hooks/useWebSocket';
import { API_BASE, WS_URL } from './api';

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [status, setStatus] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const { logs, connected } = useWebSocket(WS_URL);

  async function fetchStatus() {
    try {
      const res = await fetch(`${API_BASE}/api/status`);
      setStatus(await res.json());
    } catch {}
  }

  async function fetchMetrics() {
    try {
      const res = await fetch(`${API_BASE}/api/metrics`);
      setMetrics(await res.json());
    } catch {}
  }

  async function handleStart() {
    await fetch(`${API_BASE}/api/start`, { method: 'POST' });
    fetchStatus();
  }

  async function handleStop() {
    await fetch(`${API_BASE}/api/stop`, { method: 'POST' });
    fetchStatus();
  }

  useEffect(() => {
    fetchStatus();
    fetchMetrics();
    const s = setInterval(fetchStatus, 3000);
    const m = setInterval(fetchMetrics, 5000);
    return () => { clearInterval(s); clearInterval(m); };
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <Sidebar
        active={page}
        onChange={setPage}
        pipelineActive={status?.active}
        connected={connected}
      />

      {/* Main content — offset by sidebar width */}
      <main className="ml-48 flex-1 p-5 min-h-screen">
        {page === 'dashboard' && <Dashboard />}

        {page === 'monitor' && (
          <div className="grid grid-cols-[220px_1fr] gap-4 h-[calc(100vh-40px)]">
            <PipelineStatus status={status} onStart={handleStart} onStop={handleStop} />
            <div className="flex flex-col gap-4 min-h-0">
              <MetricBars metrics={metrics} logs={logs} status={status} />
              <div className="flex-1 min-h-0">
                <LogStream logs={logs} connected={connected} />
              </div>
            </div>
          </div>
        )}

        {page === 'tables' && <TableViewer />}

        {page === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}
