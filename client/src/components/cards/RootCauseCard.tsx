// ============================================
// Root Cause Analysis Card — @DBAgent Message Card
// ============================================

interface RootCauseCardProps {
  data: Record<string, unknown>;
  text: string;
}

export function RootCauseCard({ data, text }: RootCauseCardProps) {
  const rootCause = (data.rootCause as string) || text;
  const affectedComponent = (data.affectedComponent as string) || 'Infrastructure';
  const failureChain = (data.failureChain as string[]) || [];
  const impactAssessment = (data.impactAssessment as string) || '';
  const mttrEstimate = (data.mttrEstimate as string) || '';
  const confidenceScore = typeof data.confidenceScore === 'number' ? data.confidenceScore : null;

  return (
    <div className="bg-[var(--color-bg-card)] border border-purple-500/40 rounded-xl p-4 shadow-lg text-sm space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider block mb-0.5">
            Component: {affectedComponent}
          </span>
          <p className="font-medium text-slate-100">{text}</p>
        </div>
        {confidenceScore !== null && (
          <span className="shrink-0 px-2 py-0.5 rounded text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            {Math.round(confidenceScore * 100)}% Conf
          </span>
        )}
      </div>

      {/* Deep Diagnosis */}
      <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-700/60 text-xs text-slate-300 leading-relaxed">
        {rootCause}
      </div>

      {/* Failure Cascade Chain */}
      {failureChain.length > 0 && (
        <div className="space-y-1.5 text-xs">
          <span className="text-purple-300 font-semibold block">Failure Propagation Chain:</span>
          <div className="space-y-1 pl-1">
            {failureChain.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-purple-400 font-bold shrink-0">{idx + 1}.</span>
                <span className="text-slate-300">{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Impact & Estimated MTTR */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-700/50">
        {impactAssessment && (
          <div>
            <span className="text-slate-400 font-semibold">User Impact: </span>
            <span className="text-rose-300">{impactAssessment}</span>
          </div>
        )}
        {mttrEstimate && (
          <div>
            <span className="text-slate-400 font-semibold">Projected MTTR: </span>
            <span className="text-amber-300">{mttrEstimate}</span>
          </div>
        )}
      </div>
    </div>
  );
}

