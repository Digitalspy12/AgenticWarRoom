// ============================================
// Action Card — @DeployBot Interactive HITL Card
// ============================================

import { useState } from 'react';
import { Terminal, Copy, Check, ShieldCheck, CheckCircle2 } from 'lucide-react';
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
        return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
      case 'HIGH':
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-300 border-rose-500/25';
      default:
        return 'bg-white/[0.05] text-slate-300 border-white/[0.08]';
    }
  };

  return (
    <div className="bg-[#161b24] border border-white/[0.08] rounded-lg p-4 text-xs space-y-3 relative">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-orange-500/10 text-orange-300 border border-orange-500/20">
              {actionType.replace(/_/g, ' ')}
            </span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono border ${riskBadge(riskLevel)}`}>
              Risk: {riskLevel}
            </span>
            <span className="text-[11px] text-slate-400 font-mono">@DeployBot</span>
          </div>
          <p className="font-medium text-slate-100 text-xs leading-snug">{text}</p>
        </div>
      </div>

      {/* Target Scope */}
      {targetService && (
        <div className="flex items-center gap-2 text-xs bg-[#11151d] px-2.5 py-1.5 rounded-md border border-white/[0.06] font-mono">
          <span className="text-slate-400 text-[10px]">Target:</span>
          <span className="text-orange-300 font-medium">{targetService}</span>
        </div>
      )}

      {/* Executable Terminal Command Preview */}
      {commandPreview && (
        <div className="rounded-md overflow-hidden border border-white/[0.08] bg-[#0a0d14]">
          <div className="bg-[#11151d] px-3 py-1 flex items-center justify-between border-b border-white/[0.06]">
            <div className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] text-slate-300 font-mono">
                Remediation playbook script
              </span>
            </div>
            <button
              onClick={handleCopyCommand}
              className="text-[10px] font-mono text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-white/[0.05] hover:bg-white/[0.1] transition cursor-pointer flex items-center gap-1"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <div className="p-3 font-mono text-xs overflow-x-auto text-amber-200/90 leading-relaxed max-h-36">
            <code>{commandPreview}</code>
          </div>
        </div>
      )}

      {/* Rollback Plan */}
      {rollbackPlan && (
        <div className="text-xs text-slate-300 bg-[#11151d] p-2 rounded-md border border-white/[0.06] font-mono flex items-start gap-2">
          <span className="text-slate-400 shrink-0">Contingency:</span>
          <span className="text-slate-300">{rollbackPlan}</span>
        </div>
      )}

      {/* HITL Action Bar */}
      <div className="pt-2 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
        {isResolved ? (
          <div className="flex items-center gap-2 text-emerald-400 font-medium text-xs py-0.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Remediation playbook applied</span>
            {approvedBy && (
              <span className="text-slate-400 font-mono text-[10px]">(approved by @{approvedBy})</span>
            )}
          </div>
        ) : isMitigating ? (
          <div className="flex items-center gap-2 text-sky-400 text-xs py-0.5">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <span>Executing remediation commands on cluster...</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>Requires Incident Commander approval</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onReject}
                disabled={executing}
                className="px-3 py-1.5 rounded-md border border-white/[0.1] hover:bg-white/[0.05] text-slate-300 text-xs font-medium transition cursor-pointer disabled:opacity-40"
              >
                Reject / Modify
              </button>
              <button
                type="button"
                onClick={onApprove}
                disabled={executing}
                className="px-3.5 py-1.5 rounded-md bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-medium transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>Approve & Execute</span>
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
        buttonClass="bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border-white/[0.08]"
        threadCount={threadCount}
        annotation={annotation}
        onOpenThread={onOpenThread}
      />
    </div>
  );
}
