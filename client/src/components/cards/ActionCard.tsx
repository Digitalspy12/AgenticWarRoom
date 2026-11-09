// ============================================
// Action Card — @DeployBot Interactive HITL Card
// ============================================

interface ActionCardProps {
  data: Record<string, unknown>;
  text: string;
  onApprove: () => void;
  onReject: () => void;
  executing: boolean;
  incidentStatus: string;
}

export function ActionCard({
  data,
  text,
  onApprove,
  onReject,
  executing,
  incidentStatus,
}: ActionCardProps) {
  const actionType = (data.actionType as string) || 'SYSTEM_REMEDIATION';
  const riskLevel = (data.riskLevel as string) || 'MEDIUM';
  const targetService = (data.targetService as string) || '';
  const commandPreview = (data.commandPreview as string) || '';
  const rollbackPlan = (data.rollbackPlan as string) || '';
  const cardStatus = (data.status as string) || 'AWAITING_APPROVAL';
  const approvedBy = data.approvedBy as string | undefined;

  const isResolved = incidentStatus === 'RESOLVED' || cardStatus === 'EXECUTED_BY_HUMAN';
  const isMitigating = incidentStatus === 'MITIGATING' || executing;

  const riskBadgeColor = (risk: string) => {
    switch (risk.toUpperCase()) {
      case 'LOW':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'MEDIUM':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'HIGH':
      case 'CRITICAL':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  return (
    <div className="bg-[var(--color-bg-card)] border border-orange-500/40 rounded-xl p-4 shadow-xl text-sm space-y-3.5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wider">
              {actionType.replace(/_/g, ' ')}
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${riskBadgeColor(riskLevel)}`}>
              Risk: {riskLevel}
            </span>
          </div>
          <p className="font-semibold text-slate-100">{text}</p>
        </div>
      </div>

      {/* Target service info */}
      {targetService && (
        <div className="text-xs text-slate-400">
          Target Scope: <span className="text-slate-200 font-mono font-medium">{targetService}</span>
        </div>
      )}

      {/* Proposed Executable Commands Preview */}
      {commandPreview && (
        <div className="space-y-1">
          <span className="text-xs font-semibold text-slate-300">Executable Payload:</span>
          <div className="bg-slate-950 rounded-lg p-3 font-mono text-xs overflow-x-auto text-amber-400 border border-slate-800">
            <code>{commandPreview}</code>
          </div>
        </div>
      )}

      {/* Safety rollback plan */}
      {rollbackPlan && (
        <div className="text-xs text-slate-400 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800">
          <span className="text-slate-300 font-medium">Contingency: </span>
          {rollbackPlan}
        </div>
      )}

      {/* Interactive Action Controls (HITL) */}
      <div className="pt-2 border-t border-slate-700/50 flex flex-wrap items-center justify-between gap-3">
        {isResolved ? (
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs py-1">
            <span>✅ Remediation Executed</span>
            {approvedBy && <span className="text-slate-400">(Approved by @{approvedBy})</span>}
          </div>
        ) : isMitigating ? (
          <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs py-1 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
            Executing remediation script...
          </div>
        ) : (
          <>
            <div className="text-[11px] text-slate-400 italic">
              Commander authorization required to apply fix
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onReject}
                disabled={executing}
                className="px-3 py-1.5 rounded-lg border border-slate-600 hover:bg-slate-700/60 text-slate-300 text-xs font-medium transition cursor-pointer disabled:opacity-50"
              >
                Reject / Modify
              </button>
              <button
                type="button"
                onClick={onApprove}
                disabled={executing}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-950/50 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>⚡ Approve & Execute</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

