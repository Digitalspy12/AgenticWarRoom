// ============================================
// Diagnostic Log Card — @LogBot Message Card
// ============================================

interface DiagnosticLogCardProps {
  data: Record<string, unknown>;
  text: string;
}

export function DiagnosticLogCard({ data, text }: DiagnosticLogCardProps) {
  const service = (data.service as string) || 'unknown-service';
  const filePath = (data.filePath as string) || '';
  const lineNumber = data.lineNumber as number | undefined;
  const errorSignature = (data.errorSignature as string) || '';
  const snippet = (data.snippet as string) || '';
  const relatedErrors = (data.relatedErrors as string[]) || [];
  const confidenceScore = typeof data.confidenceScore === 'number' ? data.confidenceScore : null;

  return (
    <div className="bg-[var(--color-bg-card)] border border-blue-500/40 rounded-xl p-4 shadow-lg text-sm space-y-3">
      {/* Header / Summary */}
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-slate-100">{text}</p>
        {confidenceScore !== null && (
          <span className="shrink-0 px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            {Math.round(confidenceScore * 100)}% Conf
          </span>
        )}
      </div>

      {/* Target service & file locator */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/60 font-mono">
        <div>
          <span className="text-slate-400">Service: </span>
          <span className="text-blue-300 font-semibold">{service}</span>
        </div>
        {filePath && (
          <div className="truncate">
            <span className="text-slate-400">Location: </span>
            <span className="text-amber-300">
              {filePath}
              {lineNumber ? `:${lineNumber}` : ''}
            </span>
          </div>
        )}
      </div>

      {/* Offending signature & snippet */}
      {errorSignature && (
        <div className="text-xs">
          <span className="text-red-400 font-mono font-semibold">{errorSignature}</span>
        </div>
      )}

      {snippet && (
        <div className="bg-slate-950/90 rounded-lg p-3 font-mono text-xs overflow-x-auto text-emerald-300 border border-slate-800">
          <code>{snippet}</code>
        </div>
      )}

      {/* Related error patterns */}
      {relatedErrors.length > 0 && (
        <div className="space-y-1 text-xs pt-1 border-t border-slate-700/50">
          <span className="text-slate-400 font-medium">Telemetry Signals:</span>
          <ul className="list-disc list-inside space-y-0.5 text-slate-300 font-mono">
            {relatedErrors.slice(0, 3).map((err, i) => (
              <li key={i} className="truncate">{err}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

