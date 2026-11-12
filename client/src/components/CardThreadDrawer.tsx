// ============================================
// Card Thread Drawer — Threaded Discussions & Annotations
// ============================================
// Slide-over panel attached to specific diagnostic cards.
// Supports Human-in-the-Loop discussions, card annotations,
// and targeted agent Q&A within the card's context.

import { useState, useEffect, useRef } from 'react';
import {
  getCardThread,
  postCardThreadMessage,
  saveCardAnnotation,
} from '../lib/api';
import { CURRENT_USER_ID } from '../lib/constants';
import type { ThreadMessage, CardAnnotation } from '../lib/types';

interface CardThreadDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  incidentId: string;
  cardId: string;
  cardTitle: string;
  cardSubtitle?: string;
  agentName: string;
  annotation?: CardAnnotation;
  onAnnotationSaved?: (cardId: string, annotation: CardAnnotation) => void;
  onThreadCountChanged?: (cardId: string, count: number) => void;
}

export function CardThreadDrawer({
  isOpen,
  onClose,
  incidentId,
  cardId,
  cardTitle,
  cardSubtitle,
  agentName,
  annotation,
  onAnnotationSaved,
  onThreadCountChanged,
}: CardThreadDrawerProps) {
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [agentThinking, setAgentThinking] = useState(false);
  const [isEditingAnnotation, setIsEditingAnnotation] = useState(false);
  const [annotationText, setAnnotationText] = useState(annotation?.note || '');
  const [savingAnnotation, setSavingAnnotation] = useState(false);

  const threadEndRef = useRef<HTMLDivElement>(null);

  // Load thread history when opened
  useEffect(() => {
    if (!isOpen || !incidentId || !cardId) return;
    let cancelled = false;

    getCardThread(incidentId, cardId)
      .then((data) => {
        if (cancelled) return;
        const list = data.messages || [];
        setMessages(list);
        onThreadCountChanged?.(cardId, list.length);
      })
      .catch((err) => console.warn('Failed to load thread messages:', err));

    return () => {
      cancelled = true;
    };
  }, [isOpen, incidentId, cardId, onThreadCountChanged]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, agentThinking, isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || sending) return;

    setInputText('');
    setSending(true);

    const willTriggerAgent = /@(DeployBot|LogBot|DBAgent)/i.test(text) || !text.startsWith('/');
    if (willTriggerAgent) {
      setAgentThinking(true);
    }

    try {
      const res = await postCardThreadMessage(incidentId, cardId, {
        text,
        sender: CURRENT_USER_ID,
        triggerAgent: willTriggerAgent,
      });

      setMessages(res.messages);
      onThreadCountChanged?.(cardId, res.threadCount);
    } catch (err) {
      console.error('Failed to post thread message:', err);
    } finally {
      setSending(false);
      setAgentThinking(false);
    }
  };

  const handleSaveAnnotation = async () => {
    if (!annotationText.trim() || savingAnnotation) return;
    setSavingAnnotation(true);
    try {
      const res = await saveCardAnnotation(incidentId, cardId, {
        note: annotationText.trim(),
        author: CURRENT_USER_ID,
      });
      setIsEditingAnnotation(false);
      onAnnotationSaved?.(cardId, res.annotation);
    } catch (err) {
      console.error('Failed to save annotation:', err);
    } finally {
      setSavingAnnotation(false);
    }
  };

  const getQuickPrompts = () => {
    if (agentName.includes('LogBot')) {
      return [
        'Explain offending line and stack frame',
        'Show last 20 lines from ring buffer',
        'Is this error isolated or cascading?',
      ];
    }
    if (agentName.includes('DBAgent')) {
      return [
        'Why did connection pool saturate?',
        'Explain row lock contention on orders table',
        'Simulate impact if we restart pool',
      ];
    }
    return [
      'Change risk to LOW with safe drain',
      'Add pre-flight dry-run validation flag',
      'Show rollback verification commands',
    ];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in">
      {/* Backdrop overlay dismiss */}
      <div className="flex-1 cursor-pointer" onClick={onClose} />

      {/* Slide-over Container */}
      <div className="w-full max-w-lg h-full bg-[#0d1222] border-l border-white/[0.1] shadow-2xl flex flex-col relative z-10 animate-slide-left font-sans">
        {/* Drawer Header */}
        <div className="p-4 border-b border-white/[0.08] bg-[#090d19] flex items-start justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 font-bold">
                Card Thread
              </span>
              <span className="text-xs font-mono font-bold text-slate-300">{agentName}</span>
            </div>
            <h3 className="text-sm font-bold text-white tracking-tight">{cardTitle}</h3>
            {cardSubtitle && (
              <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate max-w-md">
                {cardSubtitle}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition cursor-pointer"
            title="Close thread (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Pinned Annotation Section */}
        <div className="p-3 bg-[#11182c] border-b border-white/[0.06] shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 font-mono">
              <span>📌</span> Pinned SRE Annotation
            </span>
            {!isEditingAnnotation ? (
              <button
                onClick={() => {
                  setAnnotationText(annotation?.note || '');
                  setIsEditingAnnotation(true);
                }}
                className="text-[10px] font-mono text-slate-400 hover:text-amber-300 transition cursor-pointer"
              >
                {annotation ? 'Edit Note' : '+ Add Note'}
              </button>
            ) : (
              <button
                onClick={() => setIsEditingAnnotation(false)}
                className="text-[10px] font-mono text-slate-400 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>

          {isEditingAnnotation ? (
            <div className="space-y-2 mt-2">
              <textarea
                value={annotationText}
                onChange={(e) => setAnnotationText(e.target.value)}
                placeholder="Pin a note to this finding (e.g. 'Verified pool saturated in Grafana')..."
                className="w-full h-16 bg-[#080c16] text-xs text-slate-200 p-2.5 rounded-xl border border-amber-500/30 focus:outline-none focus:border-amber-400 font-mono resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleSaveAnnotation}
                  disabled={savingAnnotation || !annotationText.trim()}
                  className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                >
                  {savingAnnotation ? 'Pinning...' : 'Pin Note'}
                </button>
              </div>
            </div>
          ) : annotation ? (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-2.5 text-xs text-amber-200 flex items-start gap-2 font-mono">
              <span className="text-sm">📌</span>
              <div className="flex-1 min-w-0">
                <p className="leading-relaxed">{annotation.note}</p>
                <div className="text-[10px] text-amber-300/70 mt-1">
                  Pinned by @{annotation.author} • {new Date(annotation.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-slate-400 italic">
              No annotation pinned to this card. Click &quot;+ Add Note&quot; to attach findings.
            </div>
          )}
        </div>

        {/* Quick Agent Prompts Bar */}
        <div className="px-4 py-2.5 bg-[#090e1c] border-b border-white/[0.06] shrink-0">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Suggested Inquiries for {agentName}:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {getQuickPrompts().map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(prompt)}
                className="text-[10px] font-mono px-2 py-1 rounded-lg bg-white/[0.05] hover:bg-blue-600/20 text-slate-300 hover:text-blue-300 border border-white/[0.08] hover:border-blue-500/30 transition cursor-pointer text-left"
              >
                ⚡ {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !agentThinking && (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <span className="text-3xl mb-2">💬</span>
              <p className="text-xs font-semibold text-slate-300 mb-1">
                Start a Focused Thread
              </p>
              <p className="text-[11px] max-w-xs text-slate-400 leading-relaxed">
                Ask {agentName} clarifying questions or coordinate with other on-call engineers regarding this specific finding.
              </p>
            </div>
          )}

          {messages.map((m) => {
            const isUser = !m.isAgent;
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
              >
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                  <span className={m.isAgent ? 'text-blue-400 font-bold' : 'text-slate-300 font-bold'}>
                    {m.isAgent ? m.agentName : `@${m.sender}`}
                  </span>
                  <span>•</span>
                  <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </div>

                <div
                  className={`p-3 rounded-2xl text-xs max-w-[90%] leading-relaxed ${
                    isUser
                      ? 'bg-blue-600/90 text-white rounded-tr-none shadow-md'
                      : 'bg-[#151c30] text-slate-200 border border-white/[0.08] rounded-tl-none font-mono whitespace-pre-wrap'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            );
          })}

          {/* Agent Thinking Indicator in Thread */}
          {agentThinking && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-950/30 border border-blue-500/30 text-blue-300 text-xs shadow-md animate-pulse">
              <span className="animate-spin h-3.5 w-3.5 border-2 border-blue-400 border-t-transparent rounded-full shrink-0 mt-0.5" />
              <div className="font-mono text-[11px]">
                <span className="font-bold">{agentName}</span> is analyzing thread context and formulating response...
              </div>
            </div>
          )}

          <div ref={threadEndRef} className="h-1" />
        </div>

        {/* Thread Input Bar */}
        <div className="p-3 bg-[#090d19] border-t border-white/[0.08] shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Ask ${agentName} or reply in thread...`}
              className="flex-1 bg-[#12192c] text-xs text-white placeholder:text-slate-400 px-3.5 py-2.5 rounded-xl border border-white/[0.1] focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || sending}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                inputText.trim() && !sending
                  ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              Reply ↵
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

