// ============================================
// Incident Banner — Cockpit Navigation & Status Bar
// ============================================

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

  const getStatusBadge = () => {
    if (!incident) return null;

    switch (incident.status) {
      case 'CRITICAL':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
            </span>
            CRITICAL OUTAGE
          </span>
        );
      case 'DIAGNOSING':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
            <span className="animate-spin h-2 w-2 border-2 border-sky-400 border-t-transparent rounded-full" />
            AI DIAGNOSING
          </span>
        );
      case 'AWAITING_APPROVAL':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            AWAITING APPROVAL
          </span>
        );
      case 'MITIGATING':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
            <span className="animate-pulse h-2 w-2 rounded-full bg-indigo-400" />
            MITIGATING FIX
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            RESOLVED
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <header className="h-14 bg-[#0a0f1d]/90 backdrop-blur-md border-b border-white/[0.08] px-4 flex items-center justify-between z-20 shrink-0">
      {/* Brand & Workspace title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-black text-sm">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm tracking-tight bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent">
                AGENTIC WARROOM
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                v2.0
              </span>
            </div>
            <p className="text-[10px] text-slate-400 -mt-0.5">Real-time SRE Incident Triage</p>
          </div>
        </div>

        {incident && (
          <>
            <div className="h-5 w-px bg-white/[0.08] hidden md:block" />
            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-300">
              <span className="font-mono text-slate-500">#{incident.id}</span>
              <span className="text-slate-400 font-medium truncate max-w-[280px]">
                {incident.title}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Center Status / MTTR Stopwatch */}
      <div className="flex items-center gap-3">
        {incident ? (
          <div className="flex items-center gap-2.5 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-white/[0.06] shadow-inner">
            {/* Severity Chip */}
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                incident.severity === 'SEV-1'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}
            >
              {incident.severity}
            </span>

            {/* Dynamic Status Pill */}
            {getStatusBadge()}

            {/* Digital MTTR Stopwatch */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-white/[0.08]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">MTTR</span>
              <span className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${
                incident.status === 'RESOLVED'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-slate-800 text-amber-400'
              }`}>
                {formatTime(elapsed)}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-white/[0.06]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
            <span className="font-medium text-slate-300">Cockpit Ready</span>
            <span className="text-[11px] text-slate-500">• Systems Nominal</span>
          </div>
        )}
      </div>

      {/* Right Telemetry & Presence */}
      <div className="flex items-center gap-3">
        {/* LLM Status pill */}
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] bg-slate-900/60 px-2.5 py-1 rounded-lg border border-white/[0.06] font-mono">
          <span className={`w-1.5 h-1.5 rounded-full ${
            connectionStatus === 'connected' ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-rose-400'
          }`} />
          <span className="text-slate-400">Groq:</span>
          <span className="text-slate-200 font-semibold">
            {llmLatency ? `${llmLatency}ms` : 'ready'}
          </span>
        </div>

        {/* Nexconn status */}
        <div className="hidden md:flex items-center gap-1.5 text-[11px] bg-blue-950/30 px-2.5 py-1 rounded-lg border border-blue-500/20 text-blue-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
          <span className="font-medium">Nexconn IM</span>
        </div>

        {/* Current user chip */}
        <div className="flex items-center gap-2 pl-2 border-l border-white/[0.08]">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-[11px] font-bold text-white shadow">
            LD
          </div>
          <div className="hidden xl:block text-left">
            <div className="text-xs font-semibold text-slate-200">@lead_dev</div>
            <div className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Commander</div>
          </div>
        </div>
      </div>
    </header>
  );
}
