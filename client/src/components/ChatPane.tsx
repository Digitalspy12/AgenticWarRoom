// ============================================
// Chat Pane — Center Panel (Real-Time War Room)
// ============================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { executeRemediation, rejectFix } from '../lib/api';
import { CURRENT_USER_ID } from '../lib/constants';
import { nexconn, type ParsedChatMessage } from '../lib/nexconnClient';
import { DiagnosticLogCard } from './cards/DiagnosticLogCard';
import { ActionCard } from './cards/ActionCard';
import { RootCauseCard } from './cards/RootCauseCard';
import type { Incident, AgentResponse, CustomMessageType } from '../lib/types';

interface ChatPaneProps {
  incident: Incident | null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onIncidentUpdated: (incident: Incident) => void;
}

interface ChatMessage {
  id: string;
  timestamp: number;
  sender: string;
  type: 'system' | 'agent' | 'user';
  agentResponse?: AgentResponse;
  text?: string;
}

export function ChatPane({ incident, onIncidentUpdated: _onIncidentUpdated }: ChatPaneProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [executing, setExecuting] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [showScrollBottomButton, setShowScrollBottomButton] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef(false);
  const prevMessagesLengthRef = useRef(0);
  const currentIncidentIdRef = useRef<string | null>(null);

  // Convert incoming Nexconn message to local format
  const convertNexconnMessage = useCallback((msg: ParsedChatMessage): ChatMessage => {
    const isAgent = msg.customType !== 'TEXT' && msg.customType !== 'SYSTEM_ALERT';
    const isUser = msg.senderUserId === CURRENT_USER_ID;
    return {
      id: msg.id,
      timestamp: msg.sentTime,
      sender: msg.senderName,
      type: msg.isSystem ? 'system' : isUser ? 'user' : 'agent',
      text: msg.text,
      agentResponse: isAgent
        ? {
            agentName: msg.senderName,
            customType: msg.customType as CustomMessageType,
            text: msg.text,
            customData: msg.customData,
          }
        : undefined,
    };
  }, []);

  // Detect user scroll position
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isScrolledUp = distanceFromBottom > 100;
    isUserScrolledUpRef.current = isScrolledUp;
    setShowScrollBottomButton(isScrolledUp);
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    isUserScrolledUpRef.current = false;
    setShowScrollBottomButton(false);
  }, []);

  // Subscribe to real-time Nexconn messages for active channel
  useEffect(() => {
    if (!incident) return;

    // Load channel history
    nexconn.loadHistory(incident.id).then((history) => {
      if (history.length > 0) {
        setMessages((prev) => {
          const map = new Map(prev.map((m) => [m.id, m]));
          let added = false;
          history.forEach((h) => {
            if (!map.has(h.id)) {
              map.set(h.id, convertNexconnMessage(h));
              added = true;
            }
          });
          if (!added) return prev;
          return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
        });
      }
    });

    // Real-time subscription
    const unsubscribe = nexconn.subscribe(incident.id, (incoming) => {
      const converted = convertNexconnMessage(incoming);
      setMessages((prev) => {
        if (prev.some((m) => m.id === converted.id)) return prev;
        return [...prev, converted].sort((a, b) => a.timestamp - b.timestamp);
      });
    });

    return () => unsubscribe();
  }, [incident?.id, convertNexconnMessage]);

  // Initial population from pipeline results (ensures zero data loss)
  useEffect(() => {
    if (!incident) {
      setMessages([]);
      prevMessagesLengthRef.current = 0;
      currentIncidentIdRef.current = null;
      return;
    }

    // Reset scroll state on new incident
    if (currentIncidentIdRef.current !== incident.id) {
      currentIncidentIdRef.current = incident.id;
      isUserScrolledUpRef.current = false;
      setShowScrollBottomButton(false);
    }

    setMessages((prev) => {
      const msgs = [...prev];
      const hasId = (id: string) => msgs.some((m) => m.id === id);
      let changed = false;

      // System alert
      if (!hasId(`${incident.id}-alert`)) {
        msgs.push({
          id: `${incident.id}-alert`,
          timestamp: incident.startedAt,
          sender: '⚡ SYSTEM',
          type: 'system',
          text: `🚨 ALERT: ${incident.title}`,
        });
        changed = true;
      }

      // Agent responses from pipeline
      if (incident.pipelineResult) {
        const { logBot, dbAgent, deployBot } = incident.pipelineResult;

        if (logBot && !hasId(`${incident.id}-logbot`)) {
          msgs.push({
            id: `${incident.id}-logbot`,
            timestamp: incident.startedAt + 2000,
            sender: logBot.agentName,
            type: 'agent',
            agentResponse: logBot,
          });
          changed = true;
        }

        if (dbAgent && !hasId(`${incident.id}-dbagent`)) {
          msgs.push({
            id: `${incident.id}-dbagent`,
            timestamp: incident.startedAt + 5000,
            sender: dbAgent.agentName,
            type: 'agent',
            agentResponse: dbAgent,
          });
          changed = true;
        }

        if (deployBot && !hasId(`${incident.id}-deploybot`)) {
          msgs.push({
            id: `${incident.id}-deploybot`,
            timestamp: incident.startedAt + 8000,
            sender: deployBot.agentName,
            type: 'agent',
            agentResponse: deployBot,
          });
          changed = true;
        }
      }

      // Resolution message
      if (incident.status === 'RESOLVED' && !hasId(`${incident.id}-resolved`)) {
        msgs.push({
          id: `${incident.id}-resolved`,
          timestamp: incident.resolvedAt || Date.now(),
          sender: '⚡ SYSTEM',
          type: 'system',
          text: `✅ INCIDENT RESOLVED — Remediated in ${incident.mttrSeconds}s`,
        });
        changed = true;
      }

      // If nothing new was added, return previous reference to avoid unnecessary re-render & auto-scroll
      if (!changed) return prev;
      return msgs.sort((a, b) => a.timestamp - b.timestamp);
    });
  }, [incident]);

  // Controlled Auto-scroll: Only scroll if user is NOT viewing earlier messages
  useEffect(() => {
    if (messages.length === 0) return;

    // If new messages arrived AND user is not scrolled up, auto-scroll smoothly
    if (!isUserScrolledUpRef.current) {
      scrollToBottom(true);
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, scrollToBottom]);

  const handleApprove = async () => {
    if (!incident) return;
    setExecuting(true);
    try {
      await executeRemediation(incident.id, CURRENT_USER_ID);
    } catch (err) {
      console.error('Execute failed:', err);
    } finally {
      setExecuting(false);
    }
  };

  const handleReject = async () => {
    if (!incident) return;
    try {
      await rejectFix(incident.id, 'Commander requested alternative playbook');
    } catch (err) {
      console.error('Reject failed:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !incident || sending) return;
    const text = inputText.trim();
    setInputText('');
    setSending(true);
    try {
      await nexconn.sendMessage(incident.id, text);
      // Ensure commander sees their own new message
      scrollToBottom(true);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const getSenderBadge = (sender: string) => {
    if (sender.includes('LogBot')) {
      return {
        name: '@LogBot',
        role: 'Telemetry Sentry',
        avatarBg: 'from-sky-500 to-blue-600',
        textColor: 'text-sky-300',
        badgeBg: 'bg-sky-500/15 text-sky-300 border-sky-500/25',
        icon: '🤖',
      };
    }
    if (sender.includes('DBAgent')) {
      return {
        name: '@DBAgent',
        role: 'Root Cause Engine',
        avatarBg: 'from-purple-500 to-fuchsia-600',
        textColor: 'text-purple-300',
        badgeBg: 'bg-purple-500/15 text-purple-300 border-purple-500/25',
        icon: '🧠',
      };
    }
    if (sender.includes('DeployBot')) {
      return {
        name: '@DeployBot',
        role: 'Orchestrator',
        avatarBg: 'from-orange-500 to-amber-600',
        textColor: 'text-orange-300',
        badgeBg: 'bg-orange-500/15 text-orange-300 border-orange-500/25',
        icon: '🛠️',
      };
    }
    if (sender.includes('SYSTEM')) {
      return {
        name: '⚡ SYSTEM ALERT',
        role: 'Cluster Kernel',
        avatarBg: 'from-rose-500 to-red-600',
        textColor: 'text-rose-400',
        badgeBg: 'bg-rose-500/15 text-rose-300 border-rose-500/25',
        icon: '⚡',
      };
    }
    return {
      name: sender || '@lead_dev',
      role: 'Commander',
      avatarBg: 'from-indigo-500 to-blue-600',
      textColor: 'text-indigo-300',
      badgeBg: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
      icon: '👤',
    };
  };

  const renderCard = (msg: ChatMessage) => {
    if (!msg.agentResponse) {
      return (
        <div className="bg-[#12192b]/80 border border-white/[0.08] rounded-2xl px-4 py-2.5 text-sm text-slate-200 leading-relaxed shadow-sm max-w-2xl font-sans">
          {msg.text}
        </div>
      );
    }

    switch (msg.agentResponse.customType) {
      case 'DIAGNOSTIC_LOG':
        return <DiagnosticLogCard data={msg.agentResponse.customData} text={msg.agentResponse.text} />;
      case 'ROOT_CAUSE_ANALYSIS':
        return <RootCauseCard data={msg.agentResponse.customData} text={msg.agentResponse.text} />;
      case 'ACTION_CARD':
        return (
          <ActionCard
            data={msg.agentResponse.customData}
            text={msg.agentResponse.text}
            onApprove={handleApprove}
            onReject={handleReject}
            executing={executing}
            incidentStatus={incident?.status || 'CRITICAL'}
          />
        );
      default:
        return (
          <div className="bg-[#12192b]/80 border border-white/[0.08] rounded-xl p-3 text-sm text-slate-200">
            {msg.agentResponse.text}
          </div>
        );
    }
  };

  // Empty State (No incident active)
  if (!incident) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center p-8 bg-[#070b14] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

        <div className="text-center max-w-md relative z-10">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-blue-600/30 to-indigo-600/30 border border-blue-500/30 flex items-center justify-center shadow-xl shadow-blue-500/10">
            <span className="text-3xl">⚡</span>
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight mb-2">
            Mission Control Cockpit
          </h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">
            All services are currently healthy. Trigger a chaos failure scenario from the left panel to simulate an active production outage.
          </p>

          <div className="grid grid-cols-3 gap-2 text-left">
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/[0.06]">
              <span className="text-xs">🤖</span>
              <div className="text-[11px] font-bold text-slate-200 mt-1">@LogBot</div>
              <div className="text-[10px] text-slate-400">Stack parser</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/[0.06]">
              <span className="text-xs">🧠</span>
              <div className="text-[11px] font-bold text-slate-200 mt-1">@DBAgent</div>
              <div className="text-[10px] text-slate-400">Root cause RCA</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/[0.06]">
              <span className="text-xs">🛠️</span>
              <div className="text-[11px] font-bold text-slate-200 mt-1">@DeployBot</div>
              <div className="text-[10px] text-slate-400">HITL Playbook</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#080d19] relative">
      {/* Subheader: Active War Room Channel bar */}
      <div className="h-10 border-b border-white/[0.06] bg-[#0c1222] px-4 flex items-center justify-between text-xs shrink-0 z-10">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">#</span>
          <span className="font-mono font-bold text-slate-200">{incident.id}</span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400 truncate max-w-xs">{incident.title}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Nexconn WebSocket Channel</span>
        </div>
      </div>

      {/* Messages Stream — Scrollable container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-5"
      >
        {/* Active AI Diagnosing Banner */}
        {incident.status === 'DIAGNOSING' && !incident.pipelineResult && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-sky-950/30 border border-sky-500/30 text-sky-300 text-xs shadow-lg animate-pulse">
            <span className="animate-spin h-4 w-4 border-2 border-sky-400 border-t-transparent rounded-full shrink-0" />
            <div>
              <span className="font-bold block">Autonomous Agent Swarm Active</span>
              <span className="text-sky-300/80 text-[11px]">
                @LogBot, @DBAgent, and @DeployBot are analyzing error logs, database metrics, and formulating remediation.
              </span>
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const badge = getSenderBadge(msg.sender);
          const isSystem = msg.type === 'system';

          return (
            <div key={msg.id} className="flex items-start gap-3 group">
              {/* Avatar Icon */}
              <div
                className={`w-8 h-8 rounded-xl bg-gradient-to-br ${badge.avatarBg} flex items-center justify-center text-sm shadow-md shrink-0 mt-0.5`}
              >
                {badge.icon}
              </div>

              {/* Message Payload */}
              <div className="flex-1 min-w-0 space-y-1.5">
                {/* Header metadata */}
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${badge.textColor}`}>{badge.name}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${badge.badgeBg}`}>
                    {badge.role}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formatTimestamp(msg.timestamp)}
                  </span>
                </div>

                {/* Content */}
                {isSystem ? (
                  <div
                    className={`text-xs p-3 rounded-xl border-l-4 font-mono shadow-sm ${
                      msg.text?.includes('RESOLVED')
                        ? 'border-emerald-500 bg-emerald-950/20 text-emerald-300 border-emerald-500/40'
                        : 'border-rose-500 bg-rose-950/20 text-rose-300 border-rose-500/40'
                    }`}
                  >
                    {msg.text}
                  </div>
                ) : (
                  renderCard(msg)
                )}
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} className="h-1" />
      </div>

      {/* Floating Jump to Latest Button */}
      {showScrollBottomButton && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-24 right-8 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xl shadow-black/50 border border-blue-400/40 backdrop-blur-md transition-all cursor-pointer transform active:scale-95 animate-fade-in"
        >
          <span>↓</span>
          <span>Jump to latest</span>
        </button>
      )}

      {/* Modern Interactive Command Bar */}
      <div className="border-t border-white/[0.08] p-3 bg-[#0a0f1d] shrink-0 z-10">
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
            Quick Mentions:
          </span>
          <button
            type="button"
            onClick={() => setInputText((prev) => `${prev}@LogBot `)}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition cursor-pointer"
          >
            @LogBot
          </button>
          <button
            type="button"
            onClick={() => setInputText((prev) => `${prev}@DBAgent `)}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition cursor-pointer"
          >
            @DBAgent
          </button>
          <button
            type="button"
            onClick={() => setInputText((prev) => `${prev}@DeployBot `)}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition cursor-pointer"
          >
            @DeployBot
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2 relative"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Send message to war room or prompt agents (@LogBot, @DBAgent, @DeployBot)..."
              className="w-full bg-[#12192a] text-sm text-slate-100 placeholder:text-slate-400 px-4 py-2.5 rounded-xl border border-white/[0.1] focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/40 shadow-inner transition"
            />
          </div>

          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
              inputText.trim() && !sending
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 cursor-pointer active:scale-95'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {sending ? (
              <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <span>Send ↵</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
