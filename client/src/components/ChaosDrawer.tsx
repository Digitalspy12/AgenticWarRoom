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
}

const SCENARIOS: ScenarioCard[] = [
  {
    id: 'db_deadlock',
    icon: Database,
    label: 'Database deadlock',
    subtitle: 'Postgres pool saturation & 40s lock timeout',
    severity: 'SEV-1',
  },
  {
    id: 'pod_crashloop',
    icon: RefreshCw,
    label: 'Pod crashloop',
    subtitle: 'OOMKilled memory leak in billing worker',
    severity: 'SEV-1',
  },
  {
    id: 'redis_502',
    icon: Zap,
    label: '502 API spike',
    subtitle: 'Redis cache eviction & gateway dropped frames',
    severity: 'SEV-2',
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
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-300 border border-rose-500/25">
            Critical
          </span>
        );
      case 'DIAGNOSING':
        return (
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-300 border border-sky-500/25">
            Diagnosing
          </span>
        );
      case 'AWAITING_APPROVAL':
        return (
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/25">
            Approval
          </span>
        );
      case 'MITIGATING':
        return (
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/25">
            Mitigating
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
            Resolved
          </span>
        );
      default:
        return <span className="text-[10px] text-slate-400">{status}</span>;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-slate-200 select-none">
      {/* Header */}
      <div className="p-3.5 border-b border-white/[0.08] flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <h2 className="text-xs font-semibold text-slate-200">
              Chaos simulator
            </h2>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Inject synthetic outage</p>
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] text-slate-400 border border-white/[0.08]">
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
              className={`w-full text-left p-2.5 rounded-lg border transition-colors duration-150 relative ${
                isCurrentTrigger
                  ? 'border-blue-500/60 bg-[#162035]'
                  : 'border-white/[0.08] bg-[#161b24] hover:bg-[#1c222e] hover:border-white/[0.14]'
              } ${triggering !== null && !isCurrentTrigger ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-medium text-slate-200">
                    {s.label}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/[0.06] text-slate-300">
                  {s.severity}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight pl-5.5 line-clamp-1">
                {isCurrentTrigger ? 'Injecting failure & notifying agents...' : s.subtitle}
              </p>
            </button>
          );
        })}
      </div>

      {/* Active Incidents List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-medium text-slate-400">
              Incident sessions
            </h3>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#161b24] text-slate-400 border border-white/[0.08]">
              {incidents.length}
            </span>
          </div>

          {incidents.length === 0 ? (
            <div className="text-center py-6 px-3 border border-dashed border-white/[0.08] rounded-lg bg-[#11151d]">
              <ShieldCheck className="w-5 h-5 mx-auto mb-1.5 text-slate-400" />
              <p className="text-xs font-medium text-slate-300">No active incidents</p>
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
                    className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors border ${
                      isSelected
                        ? 'bg-[#1c222e] border-white/[0.16] text-white'
                        : 'bg-[#161b24] border-white/[0.06] hover:bg-[#1c222e] text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium truncate max-w-[140px]">{inc.title}</span>
                      {statusBadge(inc.status)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>#{inc.id.split('-').slice(-2).join('-')}</span>
                      <span className="tabular-nums">{inc.mttrSeconds ? `MTTR: ${inc.mttrSeconds}s` : 'Active'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Online Agent Squad */}
      <div className="p-3 border-t border-white/[0.08] bg-[#11151d]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-medium text-slate-400">
            Connected Sentry Team
          </h3>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs px-2 py-1 rounded bg-[#161b24] border border-white/[0.06]">
            <div className="flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-medium text-slate-200">@lead_dev</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Commander</span>
          </div>

          <div className="flex items-center justify-between text-xs px-2 py-1 rounded bg-[#161b24] border border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-medium text-slate-200">@LogBot</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Telemetry</span>
          </div>

          <div className="flex items-center justify-between text-xs px-2 py-1 rounded bg-[#161b24] border border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              <span className="font-medium text-slate-200">@DBAgent</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Root cause</span>
          </div>

          <div className="flex items-center justify-between text-xs px-2 py-1 rounded bg-[#161b24] border border-white/[0.06]">
            <div className="flex items-center gap-2">
              <PlayCircle className="w-3.5 h-3.5 text-orange-400" />
              <span className="font-medium text-slate-200">@DeployBot</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Playbook</span>
          </div>
        </div>
      </div>
    </div>
  );
}
