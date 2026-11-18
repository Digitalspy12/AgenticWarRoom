// ============================================
// Shared Card Footer — Pinned Annotation & Thread Trigger
// ============================================

import { Pin, MessageSquare, FileEdit } from 'lucide-react';
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
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-md px-2.5 py-1.5 flex items-start gap-2 text-xs font-mono text-amber-200">
          <Pin className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="font-medium text-amber-300 text-[11px]">Note by @{annotation.author}: </span>
            <span>{annotation.note}</span>
          </div>
        </div>
      )}

      <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={open}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-mono font-medium transition cursor-pointer ${buttonClass}`}
        >
          <MessageSquare className="w-3 h-3 text-slate-400" />
          <span>{threadCount > 0 ? `${threadCount} replies` : 'Reply in thread'}</span>
        </button>

        <button
          type="button"
          onClick={open}
          className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 transition cursor-pointer"
        >
          <FileEdit className="w-3 h-3" />
          <span>{annotation ? 'Edit note' : 'Annotate'}</span>
        </button>
      </div>
    </>
  );
}


