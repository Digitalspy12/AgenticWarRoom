// ============================================
// Root Cause Analysis Card — @DBAgent Message Card
// ============================================

import { CardFooter } from './CardFooter';
import type { CardAnnotation } from '../../lib/types';

interface RootCauseCardProps {
  data: Record<string, unknown>;
  text: string;
  cardId?: string;
  threadCount?: number;
  annotation?: CardAnnotation;
  onOpenThread?: (cardId: string, title: string, subtitle: string, agentName: string) => void;
}

export function RootCauseCard({
  data,
  text,
  cardId = 'card-dbagent',
  threadCount = 0,
  annotation,
  onOpenThread,
}: RootCauseCardProps) {
  const rootCause = (data.rootCause as string) || text;
  const affectedComponent = (data.affectedComponent as string) || 'Infrastructure';
  const failureChain = (data.failureChain as string[]) || [];
  const impactAssessment = (data.impactAssessment as string) || '';
  const mttrEstimate = (data.mttrEstimate as string) || '';
  const confidenceScore = typeof data.confidenceScore === 'number' ? data.confidenceScore : null;

  return (
    <div className="bg-[#161b24] border border-white/[0.08] rounded-lg p-4 text-xs space-y-3 relative">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
              Root cause analysis
            </span>
            <span className="text-[11px] text-slate-400 font-mono">@DBAgent</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/[0.05] text-slate-300">
              {affectedComponent}
            </span>
          </div>
          <p className="font-medium text-slate-100 text-xs leading-snug">{text}</p>
        </div>

        {confidenceScore !== null && (
          <div className="shrink-0 text-right">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-white/[0.05] text-slate-300 border border-white/[0.08] tabular-nums">
              {Math.round(confidenceScore * 100)}% conf
            </span>
          </div>
        )}
      </div>

      {/* Deep Diagnosis Callout */}
      <div className="bg-[#11151d] p-2.5 rounded-md border border-white/[0.06] text-xs text-slate-300 leading-relaxed font-mono">
        <span className="text-slate-400 font-medium block text-[10px] mb-0.5">
          Detailed finding:
        </span>
        {rootCause}
      </div>

      {/* Failure Cascade Chain Timeline */}
      {failureChain.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-medium text-slate-400 block">
            Cascade propagation chain
          </span>
          <div className="space-y-1 pl-1">
            {failureChain.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs">
                <span className="w-4 h-4 rounded bg-white/[0.06] text-slate-300 flex items-center justify-center font-mono text-[10px] shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <span className="text-slate-300 font-mono leading-relaxed bg-[#11151d] px-2 py-1 rounded-md border border-white/[0.04] flex-1">
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Impact & MTTR Estimate */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-white/[0.06]">
        {impactAssessment && (
          <div className="bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 rounded-md">
            <span className="text-[10px] font-mono text-rose-400 block">
              Blast radius:
            </span>
            <span className="text-rose-200">{impactAssessment}</span>
          </div>
        )}
        {mttrEstimate && (
          <div className="bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-md">
            <span className="text-[10px] font-mono text-amber-400 block">
              Est. recovery:
            </span>
            <span className="text-amber-200 font-mono">{mttrEstimate}</span>
          </div>
        )}
      </div>

      <CardFooter
        cardId={cardId}
        title={`RCA: ${affectedComponent}`}
        subtitle={rootCause}
        agentName="@DBAgent"
        buttonClass="bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border-white/[0.08]"
        threadCount={threadCount}
        annotation={annotation}
        onOpenThread={onOpenThread}
      />
    </div>
  );
}
