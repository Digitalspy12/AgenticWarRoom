// ============================================
// Telemetry Pane — Right Panel (Cockpit Signals)
// ============================================

import type { Incident } from '../lib/types';

interface TelemetryPaneProps {
  incident: Incident | null;
}

function MetricProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full bg-[#080d18] rounded-full h-1.5 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function TelemetryPane({ incident }: TelemetryPaneProps) {
  const downloadPostMortem = () => {
    if (!incident) return;

    const rcaContent = `# INCIDENT POST-MORTEM REPORT
**Incident ID**: ${incident.id}
**Scenario**: ${incident.title}
**Severity**: ${incident.severity}
**Status**: ${incident.status}
**MTTR**: ${incident.mttrSeconds || 0} seconds
**Started At**: ${new Date(incident.startedAt).toISOString()}
**Resolved At**: ${incident.resolvedAt ? new Date(incident.resolvedAt).toISOString() : 'N/A'}
**Incident Commander**: @${incident.commanderId || 'lead_dev'}

---

## 1. System Metrics at Outage
- CPU Utilization: ${incident.metrics.cpuPercent}%
- Error Rate: ${incident.metrics.errorRatePercent}%
- Pod Health: ${incident.metrics.healthyPods}
- Request Latency: ${incident.metrics.requestLatencyMs}ms

---

## 2. Agent Diagnosis & Remediation Chain
### Stage 1: @LogBot Diagnostic Log
- Service: ${(incident.pipelineResult?.logBot?.customData?.service as string) || 'N/A'}
- File: ${(incident.pipelineResult?.logBot?.customData?.filePath as string) || 'N/A'}
- Error Signature: ${(incident.pipelineResult?.logBot?.customData?.errorSignature as string) || 'N/A'}

### Stage 2: @DBAgent Root Cause
- Affected Component: ${(incident.pipelineResult?.dbAgent?.customData?.affectedComponent as string) || 'N/A'}
- Root Cause: ${(incident.pipelineResult?.dbAgent?.customData?.rootCause as string) || 'N/A'}

### Stage 3: @DeployBot Action Card
- Action: ${(incident.pipelineResult?.deployBot?.customData?.actionType as string) || 'N/A'}
- Command Preview: \`${(incident.pipelineResult?.deployBot?.customData?.commandPreview as string) || 'N/A'}\`
- Approved By: @${(incident.pipelineResult?.deployBot?.customData?.approvedBy as string) || 'lead_dev'}

---
*Generated automatically by Agentic WarRoom via Nexconn Chat SDK.*
`;

    const blob = new Blob([rcaContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `postmortem-${incident.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!incident) {
    return (
      <div className="p-4 text-slate-400 text-xs flex flex-col h-full bg-[#0a0f1d]/90">
        <h3 className="font-extrabold uppercase tracking-wider text-[11px] text-slate-200 mb-3 flex items-center gap-1.5">
          <span>📊</span> Telemetry Stream
        </h3>
        <div className="flex-1 flex items-center justify-center text-center p-4 border border-dashed border-white/[0.06] rounded-2xl bg-slate-900/20">
          <div>
            <span className="text-2xl block mb-2 opacity-50">📡</span>
            <p className="font-medium text-slate-300">Telemetry Inactive</p>
            <p className="text-[10px] text-slate-500 mt-1">Awaiting incident connection</p>
          </div>
        </div>
      </div>
    );
  }

  const isResolved = incident.status === 'RESOLVED';
  const metrics = isResolved
    ? { cpuPercent: 22, errorRatePercent: 0.05, healthyPods: '12/12', requestLatencyMs: 42 }
    : incident.metrics;

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#0a0f1d]/95 text-slate-200 select-none divide-y divide-white/[0.08]">
      {/* Live System Metrics */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold uppercase tracking-wider text-[11px] text-slate-200 flex items-center gap-1.5">
            <span>📊</span> Live Telemetry
          </h3>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
            KV SYNCED
          </span>
        </div>

        {/* 2x2 Metric Cards */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* CPU */}
          <div className="bg-[#101627] p-2.5 rounded-xl border border-white/[0.06]">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span>CPU Load</span>
              <span className={`font-mono font-bold ${metrics.cpuPercent > 80 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {metrics.cpuPercent}%
              </span>
            </div>
            <MetricProgressBar
              value={metrics.cpuPercent}
              max={100}
              color={metrics.cpuPercent > 80 ? 'bg-rose-500' : metrics.cpuPercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'}
            />
          </div>

          {/* Error Rate */}
          <div className="bg-[#101627] p-2.5 rounded-xl border border-white/[0.06]">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span>Error Rate</span>
              <span className={`font-mono font-bold ${metrics.errorRatePercent > 5 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {metrics.errorRatePercent}%
              </span>
            </div>
            <MetricProgressBar
              value={metrics.errorRatePercent}
              max={100}
              color={metrics.errorRatePercent > 20 ? 'bg-rose-500' : metrics.errorRatePercent > 5 ? 'bg-amber-500' : 'bg-emerald-500'}
            />
          </div>

          {/* Pods */}
          <div className="bg-[#101627] p-2.5 rounded-xl border border-white/[0.06]">
            <div className="text-[11px] text-slate-400 mb-0.5">Active Pods</div>
            <div className={`font-mono text-sm font-black ${
              metrics.healthyPods.startsWith('2/') || metrics.healthyPods.startsWith('1/')
                ? 'text-rose-400 animate-pulse'
                : 'text-emerald-400'
            }`}>
              {metrics.healthyPods}
            </div>
          </div>

          {/* Latency */}
          <div className="bg-[#101627] p-2.5 rounded-xl border border-white/[0.06]">
            <div className="text-[11px] text-slate-400 mb-0.5">Avg Latency</div>
            <div className={`font-mono text-sm font-black ${
              metrics.requestLatencyMs > 800 ? 'text-rose-400' : 'text-emerald-400'
            }`}>
              {metrics.requestLatencyMs}ms
            </div>
          </div>
        </div>
      </div>

      {/* AI Reasoning Pipeline Steps */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold uppercase tracking-wider text-[11px] text-slate-200 flex items-center gap-1.5">
            <span>🧠</span> Agent Reasoning Trace
          </h3>
          <span className="text-[9px] font-mono text-slate-400">Sequential</span>
        </div>

        <div className="space-y-2 text-xs">
          {/* Step 1: LogBot */}
          <div className="p-2.5 rounded-xl bg-[#0f1526] border border-sky-500/20 flex items-start gap-2">
            <span className="text-xs">🤖</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between font-bold text-sky-300 text-[11px]">
                <span>Stage 1: @LogBot</span>
                <span className="text-[9px] font-mono font-normal text-sky-400/80">Completed</span>
              </div>
              <p className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                {incident.pipelineResult?.logBot?.customData?.errorSignature as string || 'Diagnostics ingested'}
              </p>
            </div>
          </div>

          {/* Step 2: DBAgent */}
          <div className="p-2.5 rounded-xl bg-[#0f1526] border border-purple-500/20 flex items-start gap-2">
            <span className="text-xs">🧠</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between font-bold text-purple-300 text-[11px]">
                <span>Stage 2: @DBAgent</span>
                <span className="text-[9px] font-mono font-normal text-purple-400/80">Completed</span>
              </div>
              <p className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                {incident.pipelineResult?.dbAgent?.customData?.affectedComponent as string || 'RCA finalized'}
              </p>
            </div>
          </div>

          {/* Step 3: DeployBot */}
          <div className="p-2.5 rounded-xl bg-[#0f1526] border border-orange-500/20 flex items-start gap-2">
            <span className="text-xs">🛠️</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between font-bold text-orange-300 text-[11px]">
                <span>Stage 3: @DeployBot</span>
                <span className="text-[9px] font-mono font-normal text-orange-400/80">
                  {incident.status === 'RESOLVED' ? 'Applied' : 'Awaiting Approval'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                {incident.pipelineResult?.deployBot?.customData?.actionType as string || 'Playbook created'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Security RBAC & HITL */}
      <div className="p-4 space-y-2">
        <h3 className="font-extrabold uppercase tracking-wider text-[11px] text-slate-200 flex items-center gap-1.5">
          <span>🛡️</span> Security & RBAC Guardrail
        </h3>
        <div className="bg-[#0e1424] p-3 rounded-xl border border-white/[0.06] text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Commander:</span>
            <span className="font-mono font-bold text-indigo-300">@lead_dev</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Privilege:</span>
            <span className="font-mono text-emerald-400 font-semibold">WRITE_ACTIONS</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Policy:</span>
            <span className="font-mono text-amber-300 text-[10px]">HITL Required</span>
          </div>
        </div>
      </div>

      {/* Post-Mortem Export */}
      <div className="p-4 space-y-2 mt-auto">
        <h3 className="font-extrabold uppercase tracking-wider text-[11px] text-slate-200 flex items-center gap-1.5">
          <span>📄</span> Incident Report
        </h3>
        <button
          onClick={downloadPostMortem}
          disabled={!isResolved}
          className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg ${
            isResolved
              ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white cursor-pointer active:scale-95 shadow-blue-900/30'
              : 'bg-slate-900/70 border border-white/[0.06] text-slate-500 cursor-not-allowed'
          }`}
        >
          <span>📄</span>
          <span>{isResolved ? 'Export Post-Mortem (Markdown)' : 'Unlocks On Resolution'}</span>
        </button>
      </div>
    </div>
  );
}
