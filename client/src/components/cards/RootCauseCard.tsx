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
    <div className="bg-[#121429]/90 border border-purple-500/30 rounded-2xl p-4 shadow-xl shadow-purple-950/20 text-sm space-y-3 relative overflow-hidden">
      {/* Top purple accent line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 via-fuchsia-400 to-transparent" />

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded-full border border-purple-500/25">
              Root Cause Analysis
            </span>
            <span className="text-xs text-slate-400 font-mono">@DBAgent</span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/[0.05] text-purple-200">
              {affectedComponent}
            </span>
          </div>
          <p className="font-semibold text-slate-100 text-sm leading-snug">{text}</p>
        </div>

        {confidenceScore !== null && (
          <div className="shrink-0 text-right">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              {Math.round(confidenceScore * 100)}% Conf
            </span>
          </div>
        )}
      </div>

      {/* Deep Diagnosis Callout */}
      <div className="bg-[#090b17] p-3 rounded-xl border border-white/[0.06] text-xs text-slate-200 leading-relaxed font-mono">
        <span className="text-purple-400 font-bold block text-[10px] uppercase mb-1">
          Detailed Finding:
        </span>
        {rootCause}
      </div>

      {/* Failure Cascade Chain Timeline */}
      {failureChain.length > 0 && (
        <div className="space-y-2 pt-1">
          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
            Cascade Propagation Chain
          </span>
          <div className="space-y-1.5 pl-1">
            {failureChain.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs group">
                <span className="w-5 h-5 rounded-full bg-purple-900/60 border border-purple-500/40 text-purple-300 flex items-center justify-center font-mono font-bold text-[10px] shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <span className="text-slate-300 font-mono leading-relaxed bg-[#0b0e1c] px-2.5 py-1 rounded-lg border border-white/[0.04] flex-1">
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Impact & MTTR Estimate */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-white/[0.06]">
        {impactAssessment && (
          <div className="bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-xl">
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">
              Blast Radius:
            </span>
            <span className="text-rose-200 font-medium">{impactAssessment}</span>
          </div>
        )}
        {mttrEstimate && (
          <div className="bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
              Est. Recovery Time:
            </span>
            <span className="text-amber-200 font-mono font-semibold">{mttrEstimate}</span>
          </div>
        )}
      </div>
    </div>
  );
}
