// ============================================
// Chaos Drawer — Left Pane (Cockpit Controls)
// ============================================

import { useState } from 'react';
import { triggerIncident, getIncident } from '../lib/api';
import type { Incident, ScenarioId } from '../lib/types';
import { CURRENT_USER_ID, POLL_INTERVAL_MS, POLL_BACKOFF_MS } from '../lib/constants';

interface ChaosDrawerProps {
  onIncidentCreated: (incident: Incident) => void;
  incidents: Incident[];
  activeIncidentId: string | null;
  onSelectIncident: (id: string) => void;
}

interface ScenarioCard {
  id: ScenarioId;
  icon: string;
  label: string;
  subtitle: string;
  severity: string;
  borderHover: string;
  bgGlow: string;
}

const SCENARIOS: ScenarioCard[] = [
  {
    id: 'db_deadlock',
    icon: '🗄️',
    label: 'Database Deadlock',
    subtitle: 'Postgres pool saturation & 40s lock timeout',
    severity: 'SEV-1',
    borderHover: 'hover:border-rose-500/60',
    bgGlow: 'hover:shadow-rose-950/40',
  },
  {
    id: 'pod_crashloop',
    icon: '🔄',
    label: 'Pod CrashLoop',
    subtitle: 'OOMKilled memory leak in billing worker',
    severity: 'SEV-1',
    borderHover: 'hover:border-amber-500/60',
    bgGlow: 'hover:shadow-amber-950/40',
  },
  {
    id: 'redis_502',
    icon: '⚡',
    label: '502 API Spike',
    subtitle: 'Redis cache eviction & gateway dropped frames',
    severity: 'SEV-2',
    borderHover: 'hover:border-sky-500/60',
    bgGlow: 'hover:shadow-sky-950/40',
  },
];

export function ChaosDrawer({
  onIncidentCreated,
  incidents,
  activeIncidentId,
  onSelectIncident,
}: ChaosDrawerProps) {
  const [triggering, setTriggering] = useState<ScenarioId | null>(null);

  const handleTrigger = async (scenarioId: ScenarioId) => {
    setTriggering(scenarioId);
    try {
      const response = await triggerIncident({
        scenarioId,
        commanderId: CURRENT_USER_ID,
      });

      const incident: Incident = {
        id: response.incidentId,
        scenarioId,
        title: response.title,
        severity: response.severity,
        status: 'CRITICAL',
        startedAt: response.startedAt,
        resolvedAt: null,
        mttrSeconds: null,
        metrics: response.metrics,
        pipelineResult: null,
        commanderId: CURRENT_USER_ID,
        currentMttrSeconds: 0,
      };
      onIncidentCreated(incident);

      // Start polling for agent pipeline updates
      pollIncident(response.incidentId);
    } catch (err) {
      console.error('Failed to trigger incident:', err);
    } finally {
      setTriggering(null);
    }
  };

  const pollIncident = async (id: string) => {
    const poll = async () => {
      try {
        const inc = await getIncident(id);
        onIncidentCreated(inc);
        if (inc.status !== 'RESOLVED') {
          setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (err) {
        console.error('Poll failed:', err);
        setTimeout(poll, POLL_BACKOFF_MS);
      }
    };
    setTimeout(poll, 1500);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'CRITICAL':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">CRITICAL</span>;
      case 'DIAGNOSING':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">DIAGNOSING</span>;
      case 'AWAITING_APPROVAL':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">APPROVAL</span>;
      case 'MITIGATING':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">MITIGATING</span>;
      case 'RESOLVED':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">RESOLVED</span>;
      default:
        return <span className="text-[10px] text-slate-400">{status}</span>;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0e1a]/95 text-slate-200 select-none">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-rose-400 text-sm">🔥</span>
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-100">
              Chaos Simulator
            </h2>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Inject synthetic outage</p>
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-semibold">
          1-CLICK
        </span>
      </div>

      {/* Scenario Trigger Cards */}
      <div className="p-3 space-y-2 border-b border-white/[0.08]">
        {SCENARIOS.map((s) => {
          const isCurrentTrigger = triggering === s.id;
          return (
            <button
              key={s.id}
              onClick={() => handleTrigger(s.id)}
              disabled={triggering !== null}
              className={`w-full text-left p-2.5 rounded-xl border border-white/[0.07] bg-[#121829]/80 transition-all duration-200 group relative overflow-hidden shadow-sm ${s.borderHover} ${s.bgGlow} ${
                isCurrentTrigger ? 'ring-2 ring-blue-500 bg-blue-950/40' : ''
              } ${triggering !== null && !isCurrentTrigger ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-[#162035]'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-base">{s.icon}</span>
                  <span className="text-xs font-bold text-slate-200 group-hover:text-white">
                    {s.label}
                  </span>
                </div>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-300 font-mono">
                  {s.severity}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight pl-6 line-clamp-1">
                {isCurrentTrigger ? '⚡ Injecting failure & notifying agents...' : s.subtitle}
              </p>
            </button>
          );
        })}
      </div>

      {/* Active Incidents List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Triage Sessions
            </h3>
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
              {incidents.length}
            </span>
          </div>

          {incidents.length === 0 ? (
            <div className="text-center py-6 px-3 border border-dashed border-white/[0.08] rounded-xl bg-slate-900/30">
              <span className="text-2xl block mb-1">🛡️</span>
              <p className="text-xs font-semibold text-slate-300">No Active Incidents</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Click a scenario button above to trigger an incident war room</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {incidents.map((inc) => {
                const isSelected = activeIncidentId === inc.id;
                return (
                  <button
                    key={inc.id}
                    onClick={() => onSelectIncident(inc.id)}
                    className={`w-full text-left p-2.5 rounded-xl text-xs transition-all border ${
                      isSelected
                        ? 'bg-blue-600/15 border-blue-500/40 shadow-sm shadow-blue-500/10 text-white'
                        : 'bg-[#101626]/70 border-white/[0.05] hover:bg-[#141c30] text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold truncate max-w-[150px]">{inc.title}</span>
                      {statusBadge(inc.status)}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>#{inc.id.split('-').slice(-2).join('-')}</span>
                      <span>{inc.mttrSeconds ? `MTTR: ${inc.mttrSeconds}s` : 'Active'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Online Agent Squad */}
      <div className="p-3 border-t border-white/[0.08] bg-[#0c101d]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Connected Sentry Team
          </h3>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs px-2 py-1 rounded-lg bg-slate-900/60 border border-white/[0.04]">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="font-semibold text-slate-200">@lead_dev</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono font-semibold">Commander</span>
          </div>

          <div className="flex items-center justify-between text-xs px-2 py-1 rounded-lg bg-slate-900/60 border border-white/[0.04]">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span className="font-semibold text-sky-200">🤖 @LogBot</span>
            </div>
            <span className="text-[10px] text-sky-400 font-mono">Telemetry</span>
          </div>

          <div className="flex items-center justify-between text-xs px-2 py-1 rounded-lg bg-slate-900/60 border border-white/[0.04]">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              <span className="font-semibold text-purple-200">🧠 @DBAgent</span>
            </div>
            <span className="text-[10px] text-purple-400 font-mono">Root Cause</span>
          </div>

          <div className="flex items-center justify-between text-xs px-2 py-1 rounded-lg bg-slate-900/60 border border-white/[0.04]">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
              <span className="font-semibold text-orange-200">🛠️ @DeployBot</span>
            </div>
            <span className="text-[10px] text-orange-400 font-mono">Orchestrator</span>
          </div>
        </div>
      </div>
    </div>
  );
}
