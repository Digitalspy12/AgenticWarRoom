// ============================================
// Chaos Drawer — Left Pane (Cockpit Controls)
// ============================================

import { useState } from 'react';
import {
  Flame,
  Database,
  RefreshCw,
  Zap,
  ShieldCheck,
  Terminal,
  Cpu,
  PlayCircle,
  User,
} from 'lucide-react';
import { triggerIncident, getIncident } from '../lib/api';
import type { Incident, ScenarioId } from '../lib/types';
import { CURRENT_USER_ID, POLL_INTERVAL_MS, POLL_BACKOFF_MS } from '../lib/constants';
import { speechService } from '../lib/speechService';

interface ChaosDrawerProps {
  onIncidentCreated: (incident: Incident) => void;
  incidents: Incident[];
  activeIncidentId: string | null;
  onSelectIncident: (id: string) => void;
}

interface ScenarioCard {
  id: ScenarioId;
  icon: typeof Database;
  label: string;
  subtitle: string;
  severity: string;
  accentClass: string;
}

const SCENARIOS: ScenarioCard[] = [
  {
    id: 'db_deadlock',
    icon: Database,
    label: 'Database deadlock',
    subtitle: 'Postgres pool saturation & 40s lock timeout',
    severity: 'SEV-1',
    accentClass: 'bg-sky-950/40 border-sky-500/30 text-sky-400',
  },
  {
    id: 'pod_crashloop',
    icon: RefreshCw,
    label: 'Pod crashloop',
    subtitle: 'OOMKilled memory leak in billing worker',
    severity: 'SEV-1',
    accentClass: 'bg-amber-950/40 border-amber-500/30 text-amber-400',
  },
  {
    id: 'redis_502',
    icon: Zap,
    label: '502 API spike',
    subtitle: 'Redis cache eviction & gateway dropped frames',
    severity: 'SEV-2',
    accentClass: 'bg-rose-950/40 border-rose-500/30 text-rose-400',
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
    speechService.unlockAudio();
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
        return (
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
            Critical
          </span>
        );
      case 'DIAGNOSING':
        return (
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
            Diagnosing
          </span>
        );
      case 'AWAITING_APPROVAL':
        return (
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
            Approval
          </span>
        );
      case 'MITIGATING':
        return (
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
            Mitigating
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Resolved
          </span>
        );
      default:
        return <span className="text-[10px] text-slate-400 font-mono">{status}</span>;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0b0e17] text-slate-200 select-none">
      {/* Header */}
      <div className="p-3.5 border-b border-white/[0.08] flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-rose-400" />
            <h2 className="text-xs font-bold text-white tracking-tight">
              Chaos Simulator
            </h2>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Inject synthetic outage</p>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded keycap text-slate-300">
          Simulation
        </span>
      </div>

      {/* Scenario Trigger Cards */}
      <div className="p-3 space-y-2 border-b border-white/[0.08]">
        {SCENARIOS.map((s) => {
          const isCurrentTrigger = triggering === s.id;
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => handleTrigger(s.id)}
              disabled={triggering !== null}
              className={`w-full text-left p-2.5 rounded-lg border transition-all duration-150 relative ${
                isCurrentTrigger
                  ? 'border-sky-500/60 bg-[#162035] shadow-md shadow-sky-950/40'
                  : 'border-white/[0.08] bg-[#10141f] hover:bg-[#151b2a] hover:border-white/[0.18] bevel-card'
              } ${triggering !== null && !isCurrentTrigger ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded border flex items-center justify-center shrink-0 ${s.accentClass}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-100 group-hover:text-white">
                    {s.label}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded keycap text-slate-300 font-semibold">
                  {s.severity}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight pl-8 line-clamp-1 font-sans">
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
            <h3 className="text-[11px] font-semibold text-slate-300">
              Incident Sessions
            </h3>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded keycap text-slate-300">
              {incidents.length}
            </span>
          </div>

          {incidents.length === 0 ? (
            <div className="text-center py-6 px-3 border border-dashed border-white/[0.08] rounded-lg bg-[#0e121c] bevel-subtle">
              <ShieldCheck className="w-5 h-5 mx-auto mb-1.5 text-slate-500" />
              <p className="text-xs font-semibold text-slate-300">No Active Incidents</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Select a scenario above to simulate triage</p>
            </div>
          ) : (
            <div className="space-y-1">
              {incidents.map((inc) => {
                const isSelected = activeIncidentId === inc.id;
                return (
                  <button
                    key={inc.id}
                    onClick={() => onSelectIncident(inc.id)}
                    className={`w-full text-left p-2.5 rounded-lg text-xs transition-all border ${
                      isSelected
                        ? 'bg-[#161f33] border-sky-500/40 shadow-sm text-white'
                        : 'bg-[#10141f] border-white/[0.06] hover:bg-[#151b2a] hover:border-white/[0.12] text-slate-300 bevel-subtle'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold truncate max-w-[140px] text-slate-100">{inc.title}</span>
                      {statusBadge(inc.status)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>#{inc.id.split('-').slice(-2).join('-')}</span>
                      <span className="tabular-nums font-medium text-slate-300">{inc.mttrSeconds ? `MTTR: ${inc.mttrSeconds}s` : 'Active'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Online Agent Squad */}
      <div className="p-3 border-t border-white/[0.08] bg-[#0d101a]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-semibold text-slate-300">
            Connected Sentry Team
          </h3>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
          </span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-md bg-[#10141f] border border-white/[0.06] bevel-subtle">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.8)]" />
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold text-slate-100">@lead_dev</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-mono font-medium">Commander</span>
          </div>

          <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-md bg-[#10141f] border border-white/[0.06] bevel-subtle">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_4px_rgba(56,189,248,0.8)]" />
              <Terminal className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-semibold text-sky-100">@LogBot</span>
            </div>
            <span className="text-[10px] text-sky-400 font-mono font-medium">Telemetry</span>
          </div>

          <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-md bg-[#10141f] border border-white/[0.06] bevel-subtle">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_4px_rgba(168,85,247,0.8)]" />
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              <span className="font-semibold text-purple-100">@DBAgent</span>
            </div>
            <span className="text-[10px] text-purple-400 font-mono font-medium">Root Cause</span>
          </div>

          <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-md bg-[#10141f] border border-white/[0.06] bevel-subtle">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_4px_rgba(245,158,11,0.8)]" />
              <PlayCircle className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-semibold text-amber-100">@DeployBot</span>
            </div>
            <span className="text-[10px] text-amber-400 font-mono font-medium">Playbook</span>
          </div>
        </div>
      </div>
    </div>
  );
}
