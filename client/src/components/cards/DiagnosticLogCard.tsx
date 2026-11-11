// ============================================
// Diagnostic Log Card — @LogBot Message Card
// ============================================

import { useState } from 'react';

interface DiagnosticLogCardProps {
  data: Record<string, unknown>;
  text: string;
}

export function DiagnosticLogCard({ data, text }: DiagnosticLogCardProps) {
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
    <div className="bg-[#0f1629]/90 border border-sky-500/30 rounded-2xl p-4 shadow-xl shadow-sky-950/20 text-sm space-y-3 relative overflow-hidden">
      {/* Subtle top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-sky-500 via-blue-400 to-transparent" />

      {/* Header & Confidence */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
              Diagnostic Report
            </span>
            <span className="text-xs text-slate-400 font-mono">@LogBot</span>
          </div>
          <p className="font-semibold text-slate-100 text-sm leading-snug">{text}</p>
        </div>

        {confidenceScore !== null && (
          <div className="shrink-0 text-right">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
              {Math.round(confidenceScore * 100)}% Conf
            </span>
          </div>
        )}
      </div>

      {/* Service & Code Location Box */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-[#090d19] p-2.5 rounded-xl border border-white/[0.06] font-mono">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-[11px]">SERVICE:</span>
          <span className="text-sky-300 font-bold bg-sky-500/10 px-1.5 py-0.5 rounded">
            {service}
          </span>
        </div>
        {filePath && (
          <div className="truncate flex items-center gap-1.5 text-slate-300">
            <span className="text-slate-400 text-[11px]">SOURCE:</span>
            <span className="text-amber-300 truncate" title={`${filePath}:${lineNumber}`}>
              {filePath.split('/').slice(-2).join('/')}
              {lineNumber ? `:${lineNumber}` : ''}
            </span>
          </div>
        )}
      </div>

      {/* Offending Error Signature */}
      {errorSignature && (
        <div className="bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs">
          <span className="text-rose-400 text-sm">⚠</span>
          <span className="text-rose-300 font-mono font-medium truncate">{errorSignature}</span>
        </div>
      )}

      {/* Terminal Stack Trace Box */}
      {snippet && (
        <div className="rounded-xl overflow-hidden border border-white/[0.08] bg-[#070b14] shadow-inner">
          <div className="bg-[#0b101c] px-3 py-1.5 flex items-center justify-between border-b border-white/[0.06]">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              <span className="ml-2 text-[10px] text-slate-400 font-mono">stacktrace_capture.log</span>
            </div>
            <button
              onClick={handleCopy}
              className="text-[10px] font-mono text-slate-400 hover:text-white px-2 py-0.5 rounded bg-white/[0.05] hover:bg-white/[0.1] transition cursor-pointer"
            >
              {copied ? '✓ Copied' : 'Copy Log'}
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
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Signals:
          </span>
          {relatedErrors.slice(0, 3).map((err, i) => (
            <span
              key={i}
              className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-white/[0.06] truncate max-w-[220px]"
            >
              {err}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
