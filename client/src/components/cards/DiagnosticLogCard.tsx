// ============================================
// Diagnostic Log Card — @LogBot Message Card
// ============================================

import { useState } from 'react';
import { AlertTriangle, Copy, Check } from 'lucide-react';
import { CardFooter } from './CardFooter';
import type { CardAnnotation } from '../../lib/types';

interface DiagnosticLogCardProps {
  data: Record<string, unknown>;
  text: string;
  cardId?: string;
  threadCount?: number;
  annotation?: CardAnnotation;
  onOpenThread?: (cardId: string, title: string, subtitle: string, agentName: string) => void;
}

export function DiagnosticLogCard({
  data,
  text,
  cardId = 'card-logbot',
  threadCount = 0,
  annotation,
  onOpenThread,
}: DiagnosticLogCardProps) {
  const service = (data.service as string) || 'service-core';
  const filePath = (data.filePath as string) || '';
  const lineNumber = data.lineNumber as number | undefined;
  const errorSignature = (data.errorSignature as string) || '';
  const snippet = (data.snippet as string) || '';
  const relatedErrors = (data.relatedErrors as string[]) || [];
  const confidenceScore = typeof data.confidenceScore === 'number' ? data.confidenceScore : null;
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (snippet) {
      navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-[#161b24] border border-white/[0.08] rounded-lg p-4 text-xs space-y-3 relative">
      {/* Header & Confidence */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
              Diagnostic report
            </span>
            <span className="text-[11px] text-slate-400 font-mono">@LogBot</span>
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

      {/* Service & Code Location Box */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-[#11151d] p-2.5 rounded-md border border-white/[0.06] font-mono">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-[10px]">Service:</span>
          <span className="text-sky-300 font-medium">
            {service}
          </span>
        </div>
        {filePath && (
          <div className="truncate flex items-center gap-1.5 text-slate-300">
            <span className="text-slate-400 text-[10px]">Source:</span>
            <span className="text-amber-200 truncate" title={`${filePath}:${lineNumber}`}>
              {filePath.split('/').slice(-2).join('/')}
              {lineNumber ? `:${lineNumber}` : ''}
            </span>
          </div>
        )}
      </div>

      {/* Offending Error Signature */}
      {errorSignature && (
        <div className="bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 rounded-md flex items-center gap-2 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span className="text-rose-300 font-mono truncate">{errorSignature}</span>
        </div>
      )}

      {/* Terminal Stack Trace Box */}
      {snippet && (
        <div className="rounded-md overflow-hidden border border-white/[0.08] bg-[#0a0d14]">
          <div className="bg-[#11151d] px-3 py-1 flex items-center justify-between border-b border-white/[0.06]">
            <span className="text-[10px] text-slate-400 font-mono">stacktrace_capture.log</span>
            <button
              onClick={handleCopy}
              className="text-[10px] font-mono text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-white/[0.05] hover:bg-white/[0.1] transition cursor-pointer flex items-center gap-1"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <div className="p-3 font-mono text-xs overflow-x-auto text-emerald-400/90 leading-relaxed max-h-40">
            <code>{snippet}</code>
          </div>
        </div>
      )}

      {/* Related Telemetry Signals */}
      {relatedErrors.length > 0 && (
        <div className="pt-2 border-t border-white/[0.06] flex items-center gap-2 flex-wrap text-xs">
          <span className="text-[10px] font-mono text-slate-400">
            Signals:
          </span>
          {relatedErrors.slice(0, 3).map((err, i) => (
            <span
              key={i}
              className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/[0.04] text-slate-300 border border-white/[0.06] truncate max-w-[220px]"
            >
              {err}
            </span>
          ))}
        </div>
      )}

      <CardFooter
        cardId={cardId}
        title={`Log Analysis: ${service}`}
        subtitle={filePath ? `${filePath}:${lineNumber || 0}` : errorSignature}
        agentName="@LogBot"
        buttonClass="bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border-white/[0.08]"
        threadCount={threadCount}
        annotation={annotation}
        onOpenThread={onOpenThread}
      />
    </div>
  );
}
