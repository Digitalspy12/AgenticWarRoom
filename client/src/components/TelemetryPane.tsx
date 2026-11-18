// ============================================
// Telemetry Pane — Right Panel (Cockpit Signals)
// ============================================

import {
  Activity,
  FileDown,
  ShieldCheck,
  Terminal,
  Cpu,
  PlayCircle,
  Radio,
} from 'lucide-react';
import { AudioBriefingPill } from './AudioBriefingPill';
import type { Incident } from '../lib/types';

interface TelemetryPaneProps {
  incident: Incident | null;
}

function MetricProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full bg-[#11151d] rounded-full h-1 overflow-hidden mt-1.5">
      <div
        className={`h-full rounded-full transition-all duration-300 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function TelemetryPane({ incident }: TelemetryPaneProps) {
  const downloadPostMortem = () => {
    if (!incident) return;

    const logData = incident.pipelineResult?.logBot?.customData || {};
    const dbData = incident.pipelineResult?.dbAgent?.customData || {};
    const deployData = incident.pipelineResult?.deployBot?.customData || {};

    const culpritLine = (logData.culpritLine as string) || (logData.service as string) || (logData.filePath as string) || 'N/A';
    const errorSignature = (logData.errorSignature as string) || 'N/A';
    const suggestedInvestigate = Array.isArray(logData.suggestedInvestigate)
      ? (logData.suggestedInvestigate as string[]).join(', ')
      : 'N/A';

    const rootCause = (dbData.rootCause as string) || 'N/A';
    const affectedServices = Array.isArray(dbData.affectedServices)
      ? (dbData.affectedServices as string[]).join(', ')
      : (dbData.affectedComponent as string) || 'N/A';
    const propagationPath = Array.isArray(dbData.propagationPath)
      ? (dbData.propagationPath as string[]).join(' ➔ ')
      : 'N/A';

    const actionTitle = (deployData.actionTitle as string) || (deployData.actionType as string) || 'Remediation Playbook';
    const risk = (deployData.risk as string) || (deployData.riskLevel as string) || 'MEDIUM';
    const command = (deployData.command as string) || (deployData.commandPreview as string) || 'N/A';
    const approver = (deployData.approvedBy as string) || incident.commanderId || 'lead_dev';
    const executedAt = deployData.executedAt ? String(deployData.executedAt) : incident.resolvedAt ? new Date(incident.resolvedAt).toISOString() : 'N/A';

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

## 2. Autonomous Agent Diagnosis & Remediation Chain
### Stage 1: @LogBot Diagnostic Log
- Offending Code / File: ${culpritLine}
- Error Signature: ${errorSignature}
- Suggested Target: ${suggestedInvestigate}

### Stage 2: @DBAgent Root Cause Analysis
- Root Cause: ${rootCause}
- Affected Services: ${affectedServices}
- Blast Radius Propagation: ${propagationPath}

### Stage 3: @DeployBot Action Playbook
- Action: ${actionTitle}
- Risk Level: ${risk}
- Executed Command:
\`\`\`bash
${command}
\`\`\`
- Approved & Executed By: @${approver}
- Executed At: ${executedAt}

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
      <div className="p-4 text-slate-400 text-xs flex flex-col h-full bg-[#0d1117]">
        <h3 className="font-medium text-xs text-slate-200 mb-3 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-slate-400" />
          <span>Live telemetry</span>
        </h3>
        <div className="flex-1 flex items-center justify-center text-center p-4 border border-dashed border-white/[0.08] rounded-lg bg-[#11151d]">
          <div>
            <Radio className="w-5 h-5 mx-auto mb-2 text-slate-400" />
            <p className="font-medium text-slate-300">Telemetry inactive</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Awaiting incident connection</p>
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
    <div className="flex flex-col h-full overflow-y-auto bg-[#0d1117] text-slate-200 select-none divide-y divide-white/[0.08]">
      {/* Live System Metrics */}
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-xs text-slate-200 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            <span>Live telemetry</span>
          </h3>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/[0.05] text-slate-400 border border-white/[0.08]">
            KV synced
          </span>
        </div>

        {/* 2x2 Metric Cards */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* CPU */}
          <div className="bg-[#161b24] p-2.5 rounded-lg border border-white/[0.06]">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-0.5">
              <span>CPU load</span>
              <span className={`font-mono tabular-nums font-medium ${metrics.cpuPercent > 80 ? 'text-rose-400' : 'text-slate-200'}`}>
                {metrics.cpuPercent}%
              </span>
            </div>
            <MetricProgressBar
              value={metrics.cpuPercent}
              max={100}
              color={metrics.cpuPercent > 80 ? 'bg-rose-500' : 'bg-slate-400'}
            />
          </div>

          {/* Error Rate */}
          <div className="bg-[#161b24] p-2.5 rounded-lg border border-white/[0.06]">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-0.5">
              <span>Error rate</span>
              <span className={`font-mono tabular-nums font-medium ${metrics.errorRatePercent > 5 ? 'text-rose-400' : 'text-slate-200'}`}>
                {metrics.errorRatePercent}%
              </span>
            </div>
            <MetricProgressBar
              value={metrics.errorRatePercent}
              max={100}
              color={metrics.errorRatePercent > 5 ? 'bg-rose-500' : 'bg-slate-400'}
            />
          </div>

          {/* Pods */}
          <div className="bg-[#161b24] p-2.5 rounded-lg border border-white/[0.06]">
            <div className="text-[11px] text-slate-400 mb-0.5">Active pods</div>
            <div className="font-mono text-xs tabular-nums text-slate-200">
              {metrics.healthyPods}
            </div>
          </div>

          {/* Latency */}
          <div className="bg-[#161b24] p-2.5 rounded-lg border border-white/[0.06]">
            <div className="text-[11px] text-slate-400 mb-0.5">Avg latency</div>
            <div className="font-mono text-xs tabular-nums text-slate-200">
              {metrics.requestLatencyMs}ms
            </div>
          </div>
        </div>
      </div>

      {/* AI Reasoning Pipeline Steps */}
      <div className="p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-xs text-slate-200 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            <span>Agent reasoning trace</span>
          </h3>
          <span className="text-[10px] font-mono text-slate-400">Sequential</span>
        </div>

        <div className="space-y-1.5 text-xs">
          {/* Step 1: LogBot */}
          <div className="p-2 rounded-lg bg-[#161b24] border border-white/[0.06] flex items-start gap-2">
            <Terminal className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[11px] text-slate-200">
                <span className="font-medium">Stage 1: @LogBot</span>
                <span className="text-[10px] font-mono text-slate-400">Done</span>
              </div>
              <p className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                {incident.pipelineResult?.logBot?.customData?.errorSignature as string || 'Diagnostics parsed'}
              </p>
            </div>
          </div>

          {/* Step 2: DBAgent */}
          <div className="p-2 rounded-lg bg-[#161b24] border border-white/[0.06] flex items-start gap-2">
            <Cpu className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[11px] text-slate-200">
                <span className="font-medium">Stage 2: @DBAgent</span>
                <span className="text-[10px] font-mono text-slate-400">Done</span>
              </div>
              <p className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                {incident.pipelineResult?.dbAgent?.customData?.affectedComponent as string || 'RCA confirmed'}
              </p>
            </div>
          </div>

          {/* Step 3: DeployBot */}
          <div className="p-2 rounded-lg bg-[#161b24] border border-white/[0.06] flex items-start gap-2">
            <PlayCircle className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[11px] text-slate-200">
                <span className="font-medium">Stage 3: @DeployBot</span>
                <span className="text-[10px] font-mono text-slate-400">
                  {incident.status === 'RESOLVED' ? 'Applied' : 'Awaiting approval'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                {incident.pipelineResult?.deployBot?.customData?.actionType as string || 'Playbook ready'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Security RBAC & HITL */}
      <div className="p-3.5 space-y-1.5">
        <h3 className="font-medium text-xs text-slate-200 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          <span>Access & security guardrail</span>
        </h3>
        <div className="bg-[#161b24] p-2.5 rounded-lg border border-white/[0.06] text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">Commander:</span>
            <span className="font-mono text-slate-200">@lead_dev</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">Privilege:</span>
            <span className="font-mono text-slate-300">WRITE_ACTIONS</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">Policy:</span>
            <span className="font-mono text-slate-400 text-[10px]">HITL approval required</span>
          </div>
        </div>
      </div>

      {/* Post-Mortem Export & Audio Debrief */}
      <div className="p-3.5 space-y-2 mt-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-xs text-slate-200 flex items-center gap-1.5">
            <FileDown className="w-3.5 h-3.5 text-slate-400" />
            <span>Incident report</span>
          </h3>
          {isResolved && <AudioBriefingPill incident={incident} />}
        </div>
        <button
          onClick={downloadPostMortem}
          disabled={!isResolved}
          className={`w-full py-2 px-3 rounded-md text-xs font-medium transition flex items-center justify-center gap-2 border ${
            isResolved
              ? 'bg-[#1c222e] hover:bg-[#222938] text-slate-200 border-white/[0.1] cursor-pointer'
              : 'bg-[#11151d] border-white/[0.04] text-slate-500 cursor-not-allowed'
          }`}
        >
          <FileDown className="w-3.5 h-3.5" />
          <span>{isResolved ? 'Export post-mortem (.md)' : 'Unlocks on resolution'}</span>
        </button>
      </div>
    </div>
  );
}
