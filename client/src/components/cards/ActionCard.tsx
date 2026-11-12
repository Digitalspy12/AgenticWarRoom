// ============================================
// Action Card — @DeployBot Interactive HITL Card
// ============================================

import { useState } from 'react';
import { CardFooter } from './CardFooter';
import type { CardAnnotation } from '../../lib/types';

interface ActionCardProps {
  data: Record<string, unknown>;
  text: string;
  onApprove: () => void;
  onReject: () => void;
  executing: boolean;
  incidentStatus: string;
  cardId?: string;
  threadCount?: number;
  annotation?: CardAnnotation;
  onOpenThread?: (cardId: string, title: string, subtitle: string, agentName: string) => void;
}

export function ActionCard({
  data,
  text,
  onApprove,
  onReject,
  executing,
  incidentStatus,
  cardId = 'card-deploybot',
  threadCount = 0,
  annotation,
  onOpenThread,
}: ActionCardProps) {
  const actionType = (data.actionType as string) || 'SYSTEM_REMEDIATION';
  const riskLevel = (data.riskLevel as string) || 'MEDIUM';
  const targetService = (data.targetService as string) || '';
  const commandPreview = (data.commandPreview as string) || '';
  const rollbackPlan = (data.rollbackPlan as string) || '';
  const cardStatus = (data.status as string) || 'AWAITING_APPROVAL';
  const approvedBy = data.approvedBy as string | undefined;
  const [copied, setCopied] = useState(false);

  const isResolved = incidentStatus === 'RESOLVED' || cardStatus === 'EXECUTED_BY_HUMAN';
  const isMitigating = incidentStatus === 'MITIGATING' || executing;

  const handleCopyCommand = () => {
    if (commandPreview) {
      navigator.clipboard.writeText(commandPreview);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const riskBadge = (risk: string) => {
    switch (risk.toUpperCase()) {
      case 'LOW':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'MEDIUM':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'HIGH':
      case 'CRITICAL':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse';
      default:
        return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
    }
  };

  return (
    <div className="bg-[#171424]/95 border border-orange-500/40 rounded-2xl p-4 shadow-2xl shadow-orange-950/25 text-sm space-y-3.5 relative overflow-hidden">
      {/* Top Orange Accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400" />

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-widest text-orange-400 bg-orange-500/15 px-2 py-0.5 rounded-full border border-orange-500/30">
              {actionType.replace(/_/g, ' ')}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${riskBadge(riskLevel)}`}>
              Risk: {riskLevel}
            </span>
            <span className="text-xs text-slate-400 font-mono">@DeployBot</span>
          </div>
          <p className="font-bold text-slate-100 text-sm leading-snug">{text}</p>
        </div>
      </div>

      {/* Target Scope */}
      {targetService && (
        <div className="flex items-center gap-2 text-xs bg-[#0b0e1a] px-3 py-1.5 rounded-xl border border-white/[0.06] font-mono">
          <span className="text-slate-400 text-[11px]">TARGET:</span>
          <span className="text-orange-300 font-bold">{targetService}</span>
        </div>
      )}

      {/* Executable Terminal Command Preview */}
      {commandPreview && (
        <div className="rounded-xl overflow-hidden border border-white/[0.08] bg-[#070912] shadow-inner">
          <div className="bg-[#0e111d] px-3 py-1.5 flex items-center justify-between border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <span className="text-xs">⚡</span>
              <span className="text-[11px] font-bold text-slate-300 font-mono">
                Remediation Playbook Script
              </span>
            </div>
            <button
              onClick={handleCopyCommand}
              className="text-[10px] font-mono text-slate-400 hover:text-white px-2 py-0.5 rounded bg-white/[0.05] hover:bg-white/[0.1] transition cursor-pointer"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <div className="p-3 font-mono text-xs overflow-x-auto text-amber-300 leading-relaxed max-h-36">
            <code>{commandPreview}</code>
          </div>
        </div>
      )}

      {/* Rollback Plan */}
      {rollbackPlan && (
        <div className="text-xs text-slate-300 bg-[#0c101d] p-2.5 rounded-xl border border-white/[0.06] font-mono flex items-start gap-2">
          <span className="text-slate-400 font-bold shrink-0">Contingency:</span>
          <span className="text-slate-300">{rollbackPlan}</span>
        </div>
      )}

      {/* HITL Action Bar */}
      <div className="pt-2 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
        {isResolved ? (
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs py-1">
            <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-xs">
              ✓
            </span>
            <span>Remediation Playbook Applied Successfully</span>
            {approvedBy && (
              <span className="text-slate-400 font-normal font-mono">(Approved by @{approvedBy})</span>
            )}
          </div>
        ) : isMitigating ? (
          <div className="flex items-center gap-2.5 text-blue-400 font-semibold text-xs py-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
            </span>
            <span>Executing remediation commands on Kubernetes cluster...</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className="text-amber-400">🛡️</span>
              <span>Requires Incident Commander approval</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onReject}
                disabled={executing}
                className="px-3 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition cursor-pointer disabled:opacity-40"
              >
                Reject / Modify
              </button>
              <button
                type="button"
                onClick={onApprove}
                disabled={executing}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-extrabold transition shadow-lg shadow-emerald-500/25 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transform active:scale-95"
              >
                <span>⚡ Approve & Execute</span>
              </button>
            </div>
          </>
        )}
      </div>

      <CardFooter
        cardId={cardId}
        title={`Remediation Playbook: ${actionType.replace(/_/g, ' ')}`}
        subtitle={commandPreview || text}
        agentName="@DeployBot"
        buttonClass="bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 border-orange-500/20"
        threadCount={threadCount}
        annotation={annotation}
        onOpenThread={onOpenThread}
      />
    </div>
  );
}
