// ============================================
// Incident Banner — Top Bar
// ============================================
// Shows severity, status, and live MTTR timer
// Synced across tabs via Room KV (Day 2)

import { useState, useEffect } from 'react';
import type { Incident } from '../lib/types';

interface IncidentBannerProps {
  incident: Incident | null;
  connectionStatus: 'connecting' | 'connected' | 'error';
  llmLatency: number | null;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function IncidentBanner({ incident, connectionStatus, llmLatency }: IncidentBannerProps) {
  const [elapsed, setElapsed] = useState(0);

  // Live MTTR timer — computed client-side from startedAt
  useEffect(() => {
    if (!incident || incident.resolvedAt) {
      if (incident?.mttrSeconds) setElapsed(incident.mttrSeconds);
      return;
    }

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - incident.startedAt) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [incident]);

  const statusColor = () => {
    if (!incident) return 'bg-[var(--color-bg-panel)]';
    switch (incident.status) {
      case 'CRITICAL': return 'bg-red-900/80';
      case 'DIAGNOSING': return 'bg-yellow-900/60';
      case 'AWAITING_APPROVAL': return 'bg-orange-900/60';
      case 'MITIGATING': return 'bg-blue-900/60';
      case 'RESOLVED': return 'bg-green-900/60';
      default: return 'bg-[var(--color-bg-panel)]';
    }
  };

  const connectionDot = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500 animate-pulse';
      case 'error': return 'bg-red-500';
    }
  };

  return (
    <div className={`h-12 flex items-center justify-between px-4 border-b border-[var(--color-border)] transition-colors duration-500 ${statusColor()}`}>
      {/* Left: Logo + Connection */}
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-bold tracking-wide">⚡ AGENTIC WARROOM</h1>
        <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
          <span className={`w-2 h-2 rounded-full ${connectionDot()}`} />
          <span>
            {connectionStatus === 'connected'
              ? `Connected${llmLatency ? ` (${llmLatency}ms)` : ''}`
              : connectionStatus === 'connecting'
              ? 'Connecting...'
              : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Center: Incident Status */}
      {incident && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase
              ${incident.severity === 'SEV-1' ? 'bg-red-600 text-white' : 'bg-yellow-600 text-white'}`}>
              {incident.severity}
            </span>
            <span className="text-sm font-medium truncate max-w-[300px]">
              {incident.title}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-semibold
              ${incident.status === 'RESOLVED'
                ? 'bg-green-600 text-white'
                : incident.status === 'CRITICAL'
                ? 'bg-red-600 text-white animate-pulse'
                : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)]'}`}>
              {incident.status}
            </span>
            <span className="font-mono text-sm font-bold">
              MTTR: {formatTime(elapsed)}
            </span>
          </div>
        </div>
      )}

      {/* Right: User */}
      <div className="text-xs text-[var(--color-text-secondary)]">
        @lead_dev <span className="text-green-400">(Commander)</span>
      </div>
    </div>
  );
}

