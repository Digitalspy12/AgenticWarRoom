// ============================================
// Shared Card Footer — Pinned Annotation & Thread Trigger
// ============================================

import type { CardAnnotation } from '../../lib/types';

interface CardFooterProps {
  cardId: string;
  title: string;
  subtitle: string;
  agentName: string;
  buttonClass: string;
  threadCount?: number;
  annotation?: CardAnnotation;
  onOpenThread?: (cardId: string, title: string, subtitle: string, agentName: string) => void;
}

export function CardFooter({
  cardId,
  title,
  subtitle,
  agentName,
  buttonClass,
  threadCount = 0,
  annotation,
  onOpenThread,
}: CardFooterProps) {
  const open = () => onOpenThread?.(cardId, title, subtitle, agentName);

  return (
    <>
      {annotation && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 flex items-start gap-2 text-xs font-mono text-amber-200">
          <span className="text-amber-400 text-sm">📌</span>
          <div className="flex-1 min-w-0">
            <span className="font-bold text-amber-300 text-[11px]">Annotation by @{annotation.author}: </span>
            <span>{annotation.note}</span>
          </div>
        </div>
      )}

      <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={open}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-medium transition cursor-pointer ${buttonClass}`}
        >
          <span>💬</span>
          <span>{threadCount > 0 ? `${threadCount} Replies` : 'Reply in Thread'}</span>
        </button>

        <button
          type="button"
          onClick={open}
          className="text-[11px] font-mono text-slate-400 hover:text-amber-300 transition cursor-pointer"
        >
          {annotation ? 'Edit Note' : '📝 Annotate'}
        </button>
      </div>
    </>
  );
}

