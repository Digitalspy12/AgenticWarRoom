// ============================================
// Telemetry Pane — Right Panel
// ============================================
// Shows simulated system metrics and AI agent reasoning trace

import type { Incident } from '../lib/types';

interface TelemetryPaneProps {
  incident: Incident | null;
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full bg-[var(--color-bg-dark)] rounded-full h-2">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function TelemetryPane({ incident }: TelemetryPaneProps) {
  if (!incident) {
    return (
      <div className="p-4 text-[var(--color-text-secondary)] text-sm">
        <h3 className="font-semibold uppercase tracking-wider text-xs mb-4">
          System Metrics
        </h3>
        <p className="text-xs italic">Waiting for incident...</p>
      </div>
    );
  }

  const isResolved = incident.status === 'RESOLVED';
  const metrics = isResolved
    ? { cpuPercent: 24, errorRatePercent: 0.1, healthyPods: '12/12', requestLatencyMs: 45 }
    : incident.metrics;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* System Metrics */}
      <div className="p-4 border-b border-[var(--color-border)]">
        <h3 className="font-semibold uppercase tracking-wider text-xs text-[var(--color-text-secondary)] mb-3">
          System Metrics (KV)
        </h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>CPU Load</span>
              <span className={metrics.cpuPercent > 80 ? 'text-red-400' : 'text-green-400'}>
                {metrics.cpuPercent}%
              </span>
            </div>
            <ProgressBar
              value={metrics.cpuPercent}
              max={100}
              color={metrics.cpuPercent > 80 ? 'bg-red-500' : metrics.cpuPercent > 50 ? 'bg-yellow-500' : 'bg-green-500'}
            />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Error Rate</span>
              <span className={metrics.errorRatePercent > 5 ? 'text-red-400' : 'text-green-400'}>
                {metrics.errorRatePercent}%
              </span>
            </div>
            <ProgressBar
              value={metrics.errorRatePercent}
              max={100}
              color={metrics.errorRatePercent > 20 ? 'bg-red-500' : metrics.errorRatePercent > 5 ? 'bg-yellow-500' : 'bg-green-500'}
            />
          </div>
          <div className="flex justify-between text-xs">
            <span>Active Pods</span>
            <span className={
              metrics.healthyPods.startsWith('2/') || metrics.healthyPods.startsWith('1/')
                ? 'text-red-400 font-bold'
                : 'text-green-400'
            }>
              {metrics.healthyPods}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span>Avg Latency</span>
            <span className={metrics.requestLatencyMs > 1000 ? 'text-red-400' : 'text-green-400'}>
              {metrics.requestLatencyMs}ms
            </span>
          </div>
        </div>
      </div>

      {/* AI Thinking Trace */}
      <div className="p-4 border-b border-[var(--color-border)]">
        <h3 className="font-semibold uppercase tracking-wider text-xs text-[var(--color-text-secondary)] mb-3">
          AI Thinking Trace
        </h3>
        <div className="space-y-2 text-xs font-mono">
          {incident.pipelineResult ? (
            <>
              <div className="text-blue-400">
                &gt; @LogBot: Parsed{' '}
                {(incident.pipelineResult.logBot?.customData?.logLinesAnalyzed as number) || '...'}{' '}
                lines, confidence{' '}
                {((incident.pipelineResult.logBot?.customData?.confidenceScore as number) * 100 || 0).toFixed(0)}%
              </div>
              <div className="text-purple-400">
                &gt; @DBAgent: Identified root cause in{' '}
                {(incident.pipelineResult.dbAgent?.customData?.affectedComponent as string) || '...'}
              </div>
              <div className="text-orange-400">
                &gt; @DeployBot: Proposed{' '}
                {(incident.pipelineResult.deployBot?.customData?.actionType as string)?.replace(/_/g, ' ') || '...'}
              </div>
              {incident.pipelineResult.usedFallback && (
                <div className="text-yellow-400 mt-2">
                  ⚠ Fallback responses were used (LLM timeout or error)
                </div>
              )}
            </>
          ) : incident.status === 'DIAGNOSING' ? (
            <div className="text-yellow-400 animate-pulse">
              &gt; Agents analyzing...
            </div>
          ) : (
            <div className="text-[var(--color-text-secondary)]">
              &gt; Waiting for agent pipeline...
            </div>
          )}
        </div>
      </div>

      {/* Security Guardrail */}
      <div className="p-4 border-b border-[var(--color-border)]">
        <h3 className="font-semibold uppercase tracking-wider text-xs text-[var(--color-text-secondary)] mb-3">
          Security Guardrail
        </h3>
        <div className="text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-green-400">🛡️</span>
            <span>RBAC active: Only @lead_dev can execute rollbacks</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <span className="text-[var(--color-text-secondary)]">Commander: @lead_dev</span>
          </div>
        </div>
      </div>

      {/* Post-Mortem Export */}
      <div className="p-4">
        <h3 className="font-semibold uppercase tracking-wider text-xs text-[var(--color-text-secondary)] mb-3">
          Post-Mortem Export
        </h3>
        <button
          disabled={incident.status !== 'RESOLVED'}
          className={`w-full px-3 py-2 rounded text-xs font-medium transition-colors
            ${incident.status === 'RESOLVED'
              ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
              : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] cursor-not-allowed'
            }`}
        >
          📄 {incident.status === 'RESOLVED' ? 'Download RCA Report' : 'Unlocks on Resolve'}
        </button>
      </div>
    </div>
  );
}

