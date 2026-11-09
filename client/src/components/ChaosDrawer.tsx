// ============================================
// Chaos Drawer — Left Pane
// ============================================
// 3 big red buttons to trigger mock outages
// + list of active/resolved incidents

import { useState } from 'react';
import { triggerIncident, getIncident } from '../lib/api';
import type { Incident, ScenarioId } from '../lib/types';

interface ChaosDrawerProps {
  onIncidentCreated: (incident: Incident) => void;
  incidents: Incident[];
  activeIncidentId: string | null;
  onSelectIncident: (id: string) => void;
}

const SCENARIOS: { id: ScenarioId; icon: string; label: string; color: string }[] = [
  { id: 'db_deadlock', icon: '🗄️', label: 'Database Deadlock', color: 'bg-red-600 hover:bg-red-700' },
  { id: 'pod_crashloop', icon: '🔄', label: 'Pod CrashLoop', color: 'bg-orange-600 hover:bg-orange-700' },
  { id: 'redis_502', icon: '⚡', label: '502 API Spike', color: 'bg-yellow-600 hover:bg-yellow-700' },
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
        commanderId: 'lead_dev',
      });

      // Create initial incident object from trigger response
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
        commanderId: 'lead_dev',
        currentMttrSeconds: 0,
      };
      onIncidentCreated(incident);

      // Poll for pipeline results
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
          setTimeout(poll, 1500);
        }
      } catch (err) {
        console.error('Poll failed:', err);
        setTimeout(poll, 3000);
      }
    };
    // Start polling after a short delay to let the pipeline begin
    setTimeout(poll, 2000);
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'CRITICAL': return '🔴';
      case 'DIAGNOSING': return '🟡';
      case 'AWAITING_APPROVAL': return '🟠';
      case 'MITIGATING': return '🔵';
      case 'RESOLVED': return '🟢';
      default: return '⚪';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chaos Simulator Header */}
      <div className="p-4 border-b border-[var(--color-border)]">
        <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
          🔥 Chaos Simulator
        </h2>
        <p className="text-xs text-[var(--color-text-secondary)] mt-1">
          Trigger a mock production outage
        </p>
      </div>

      {/* Chaos Buttons */}
      <div className="p-3 space-y-2 border-b border-[var(--color-border)]">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            onClick={() => handleTrigger(s.id)}
            disabled={triggering !== null}
            className={`w-full px-3 py-2.5 rounded-lg text-white font-medium text-sm
              ${triggering === s.id ? 'opacity-50 cursor-wait' : s.color}
              ${triggering !== null && triggering !== s.id ? 'opacity-30 cursor-not-allowed' : ''}
              transition-all duration-150 flex items-center gap-2`}
          >
            <span className="text-lg">{s.icon}</span>
            <span>{triggering === s.id ? 'Triggering...' : s.label}</span>
          </button>
        ))}
      </div>

      {/* Active Incidents List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
            Active Incidents
          </h3>
          {incidents.length === 0 ? (
            <p className="text-xs text-[var(--color-text-secondary)] italic">
              No incidents yet. Click a button above to start.
            </p>
          ) : (
            <div className="space-y-1">
              {incidents.map((inc) => (
                <button
                  key={inc.id}
                  onClick={() => onSelectIncident(inc.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors
                    ${activeIncidentId === inc.id
                      ? 'bg-[var(--color-bg-card)] border border-[var(--color-border)]'
                      : 'hover:bg-[var(--color-bg-card)]'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{statusIcon(inc.status)}</span>
                    <span className="font-medium truncate">{inc.title}</span>
                  </div>
                  <div className="ml-6 text-[var(--color-text-secondary)] mt-0.5">
                    {inc.status} • {inc.severity}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Online Participants */}
      <div className="p-3 border-t border-[var(--color-border)]">
        <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
          Online Participants
        </h3>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span>@lead_dev</span>
            <span className="text-[var(--color-text-secondary)]">(Commander)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>🤖 @LogBot</span>
            <span className="text-[var(--color-text-secondary)]">(AI)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span>🧠 @DBAgent</span>
            <span className="text-[var(--color-text-secondary)]">(AI)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            <span>🛠️ @DeployBot</span>
            <span className="text-[var(--color-text-secondary)]">(AI)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

