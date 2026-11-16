// ============================================
// Chat Pane — Center Panel (Real-Time War Room)
// ============================================

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  executeRemediation,
  rejectFix,
  promptAgent,
  getIncident,
  getCardThreads,
  getCardAnnotations,
} from '../lib/api';
import { CURRENT_USER_ID } from '../lib/constants';
import { speechService } from '../lib/speechService';
import { nexconn, type ParsedChatMessage } from '../lib/nexconnClient';
import { DiagnosticLogCard } from './cards/DiagnosticLogCard';
import { ActionCard } from './cards/ActionCard';
import { RootCauseCard } from './cards/RootCauseCard';
import { CardThreadDrawer } from './CardThreadDrawer';
import type { Incident, AgentResponse, CustomMessageType, CardAnnotation } from '../lib/types';

interface ChatPaneProps {
  incident: Incident | null;
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

interface TypingAgentInfo {
  statusText: string;
  timestamp: number;
}

export function ChatPane({ incident, onIncidentUpdated }: ChatPaneProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [executing, setExecuting] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [showScrollBottomButton, setShowScrollBottomButton] = useState(false);

  // Day 3: Typing Indicators & Interactivity
  const [typingAgents, setTypingAgents] = useState<Record<string, TypingAgentInfo>>({});

  // Day 3: Thread & Annotation State
  const [threadCounts, setThreadCounts] = useState<Record<string, number>>({});
  const [annotations, setAnnotations] = useState<Record<string, CardAnnotation>>({});
  const [threadDrawer, setThreadDrawer] = useState<{
    isOpen: boolean;
    cardId: string;
    title: string;
    subtitle?: string;
    agentName: string;
  }>({
    isOpen: false,
    cardId: '',
    title: '',
    agentName: '',
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef(false);
  const incidentRef = useRef(incident);
  const onIncidentUpdatedRef = useRef(onIncidentUpdated);

  useEffect(() => {
    incidentRef.current = incident;
    onIncidentUpdatedRef.current = onIncidentUpdated;
  }, [incident, onIncidentUpdated]);

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

  // Auto-expire stale typing indicators after 18 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setTypingAgents((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [name, info] of Object.entries(next)) {
          if (now - info.timestamp > 18000) {
            delete next[name];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 3000);

    return () => clearInterval(timer);
  }, []);

  const incidentId = incident?.id;

  // Load threads and annotations when incident changes
  useEffect(() => {
    if (!incidentId) return;

    getCardThreads(incidentId)
      .then((data) => {
        if (data?.counts) setThreadCounts(data.counts);
      })
      .catch((err) => console.warn('Could not load threads:', err));

    getCardAnnotations(incidentId)
      .then((data) => {
        if (data?.annotations) setAnnotations(data.annotations);
      })
      .catch((err) => console.warn('Could not load annotations:', err));
  }, [incidentId]);

  // Subscribe to real-time Nexconn messages for active channel
  useEffect(() => {
    if (!incidentId) return;

    const CONTROL_TYPES = new Set([
      'TYPING_INDICATOR',
      'THREAD_REPLY',
      'CARD_ANNOTATION',
      'INCIDENT_SYNC',
    ]);

    // Load channel history
    nexconn.loadHistory(incidentId).then((history) => {
      if (history.length > 0) {
        setMessages((prev) => {
          const map = new Map(prev.map((m) => [m.id, m]));
          let added = false;
          history.forEach((h) => {
            if (CONTROL_TYPES.has(h.customType)) return;
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
    const unsubscribe = nexconn.subscribe(incidentId, (incoming) => {
      // 1. Live Typing Indicator Handling
      if (incoming.customType === 'TYPING_INDICATOR') {
        const agentName = (incoming.customData?.agentName as string) || incoming.senderName;
        const status = (incoming.customData?.status as string) || 'typing';
        const statusText =
          (incoming.customData?.statusText as string) || `${agentName} is analyzing...`;

        setTypingAgents((prev) => {
          const next = { ...prev };
          if (status === 'done') {
            delete next[agentName];
          } else {
            next[agentName] = { statusText, timestamp: Date.now() };
          }
          return next;
        });
        return;
      }

      // 2. Live Card Annotation Sync (syncs card badge without cluttering main stream)
      if (incoming.customType === 'CARD_ANNOTATION' && incoming.customData) {
        const cardId = incoming.customData.cardId as string;
        const note = incoming.customData.note as string;
        const author = incoming.customData.author as string;
        const timestamp = (incoming.customData.timestamp as number) || Date.now();
        if (cardId && note) {
          setAnnotations((prev) => ({
            ...prev,
            [cardId]: { cardId, note, author, timestamp },
          }));
        }
        return;
      }

      // 3. Live Thread Reply Sync (idempotent count update, stays out of main stream)
      if (incoming.customType === 'THREAD_REPLY' && incoming.customData?.threadId) {
        const cardId = incoming.customData.threadId as string;
        const serverCount = incoming.customData.threadCount;
        setThreadCounts((prev) => ({
          ...prev,
          [cardId]: typeof serverCount === 'number' ? serverCount : (prev[cardId] || 0) + 1,
        }));
        return;
      }

      // 4. Live Multi-Device Incident State Sync (cross-tab state, MTTR lock, and ActionCard execution status)
      if (incoming.customType === 'INCIDENT_SYNC' && incoming.customData) {
        const sync = incoming.customData;
        const targetIncidentId = (sync.incidentId as string) || incidentId;

        if (targetIncidentId === incidentId) {
          const cur = incidentRef.current;
          if (cur) {
            onIncidentUpdatedRef.current({
              ...cur,
              status: (sync.status as Incident['status']) || cur.status,
              startedAt: (sync.startedAt as number) || cur.startedAt,
              resolvedAt: (sync.resolvedAt as number) ?? cur.resolvedAt,
              mttrSeconds: (sync.mttrSeconds as number) ?? cur.mttrSeconds,
            });
          }

          if (sync.actionCardStatus || sync.status === 'MITIGATING' || sync.status === 'RESOLVED') {
            const nextCardStatus =
              (sync.actionCardStatus as string) ||
              (sync.status === 'RESOLVED'
                ? 'EXECUTED_BY_HUMAN'
                : sync.status === 'MITIGATING'
                  ? 'EXECUTING'
                  : undefined);

            setMessages((prev) =>
              prev.map((m) => {
                if (m.agentResponse?.customType === 'ACTION_CARD' && m.agentResponse.customData) {
                  return {
                    ...m,
                    agentResponse: {
                      ...m.agentResponse,
                      customData: {
                        ...m.agentResponse.customData,
                        status: nextCardStatus || m.agentResponse.customData.status,
                        approvedBy: (sync.approvedBy as string) || m.agentResponse.customData.approvedBy,
                      },
                    },
                  };
                }
                return m;
              }),
            );
          }
        }
        return;
      }

      // Clear typing indicator for the agent that just posted a message
      if (incoming.senderName) {
        setTypingAgents((prev) => {
          if (!prev[incoming.senderName]) return prev;
          const next = { ...prev };
          delete next[incoming.senderName];
          return next;
        });
      }

      const converted = convertNexconnMessage(incoming);
      setMessages((prev) => {
        // If an Action Card was revised by @DeployBot, replace in place
        if (converted.agentResponse?.customType === 'ACTION_CARD') {
          const existingIndex = prev.findIndex(
            (m) => m.agentResponse?.customType === 'ACTION_CARD',
          );
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = converted;
            return updated;
          }
        }

        if (prev.some((m) => m.id === converted.id)) return prev;
        return [...prev, converted].sort((a, b) => a.timestamp - b.timestamp);
      });
    });

    return () => unsubscribe();
  }, [incidentId, convertNexconnMessage]);

  // Populate pipeline results into message list (ensures zero data loss if WS misses one)
  useEffect(() => {
    if (!incident) return;

    setMessages((prev) => {
      const msgs = [...prev];
      const hasId = (id: string) => msgs.some((m) => m.id === id);
      let changed = false;

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

        if (deployBot) {
          const actionMsgIdx = msgs.findIndex((m) => m.agentResponse?.customType === 'ACTION_CARD');
          if (actionMsgIdx >= 0) {
            if (JSON.stringify(msgs[actionMsgIdx].agentResponse) !== JSON.stringify(deployBot)) {
              msgs[actionMsgIdx] = { ...msgs[actionMsgIdx], agentResponse: deployBot };
              changed = true;
            }
          } else if (!hasId(`${incident.id}-deploybot`)) {
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
      }

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

      if (!changed) return prev;
      return msgs.sort((a, b) => a.timestamp - b.timestamp);
    });
  }, [incident]);

  // Controlled Auto-scroll: Only scroll if user is NOT viewing earlier messages
  useEffect(() => {
    if (messages.length === 0) return;
    if (!isUserScrolledUpRef.current) {
      scrollToBottom(true);
    }
  }, [messages, scrollToBottom]);

  const handleApprove = async () => {
    if (!incident) return;
    speechService.unlockAudio();
    setExecuting(true);
    try {
      await executeRemediation(incident.id, CURRENT_USER_ID);
      onIncidentUpdated({ ...incident, status: 'MITIGATING' });

      // Fast-poll every 500ms to guarantee resolution detection within 2s even if remote WebSocket is delayed
      const targetId = incident.id;
      const startTime = Date.now();
      const pollTimer = setInterval(async () => {
        try {
          const fresh = await getIncident(targetId);
          onIncidentUpdated(fresh);
          if (fresh.status === 'RESOLVED' || Date.now() - startTime > 10000) {
            clearInterval(pollTimer);
          }
        } catch {
          // ignore
        }
      }, 500);
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

  // Human-to-Agent Interactive Prompting
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || !incident || sending) return;

    setInputText('');
    setSending(true);

    try {
      // 1. Send human message to Nexconn channel
      await nexconn.sendMessage(incident.id, text);
      scrollToBottom(true);

      // 2. Check if an agent is mentioned or prompted
      const mentionsAgent = /@(DeployBot|LogBot|DBAgent)/i.test(text);
      if (mentionsAgent) {
        const promptRes = await promptAgent(incident.id, {
          text,
          sender: CURRENT_USER_ID,
        });

        // If DeployBot modified an Action Card, sync state to incident
        if (promptRes.response?.customType === 'ACTION_CARD' && incident.pipelineResult) {
          const updatedIncident: Incident = {
            ...incident,
            pipelineResult: {
              ...incident.pipelineResult,
              deployBot: promptRes.response,
            },
          };
          onIncidentUpdated(updatedIncident);
        }
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleThreadCountChanged = useCallback((cardId: string, count: number) => {
    setThreadCounts((prev) => (prev[cardId] === count ? prev : { ...prev, [cardId]: count }));
  }, []);

  const handleOpenThread = (
    cardId: string,
    title: string,
    subtitle: string,
    agentName: string,
  ) => {
    setThreadDrawer({
      isOpen: true,
      cardId,
      title,
      subtitle,
      agentName,
    });
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
        return (
          <DiagnosticLogCard
            data={msg.agentResponse.customData}
            text={msg.agentResponse.text}
            cardId="card-logbot"
            threadCount={threadCounts['card-logbot'] || 0}
            annotation={annotations['card-logbot']}
            onOpenThread={handleOpenThread}
          />
        );

      case 'ROOT_CAUSE_ANALYSIS':
        return (
          <RootCauseCard
            data={msg.agentResponse.customData}
            text={msg.agentResponse.text}
            cardId="card-dbagent"
            threadCount={threadCounts['card-dbagent'] || 0}
            annotation={annotations['card-dbagent']}
            onOpenThread={handleOpenThread}
          />
        );

      case 'ACTION_CARD':
        return (
          <ActionCard
            data={msg.agentResponse.customData}
            text={msg.agentResponse.text}
            onApprove={handleApprove}
            onReject={handleReject}
            executing={executing}
            incidentStatus={incident?.status || 'CRITICAL'}
            cardId="card-deploybot"
            threadCount={threadCounts['card-deploybot'] || 0}
            annotation={annotations['card-deploybot']}
            onOpenThread={handleOpenThread}
          />
        );

      case 'AGENT_CHAT': {
        const count = threadCounts[msg.id] || 0;
        return (
          <div className="bg-[#101728]/95 border border-blue-500/30 rounded-2xl p-4 shadow-xl text-sm space-y-2.5 max-w-2xl font-sans">
            <div className="text-slate-200 leading-relaxed whitespace-pre-wrap font-sans text-xs sm:text-sm">
              {msg.agentResponse.text}
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-white/[0.06] text-[10px] font-mono text-slate-400">
              <span className="text-blue-400 font-bold">Autonomous Swarm Response</span>
              <button
                type="button"
                onClick={() =>
                  handleOpenThread(
                    msg.id,
                    `Inquiry: ${msg.agentResponse?.agentName || 'Agent'}`,
                    msg.agentResponse?.text?.slice(0, 60) || '',
                    msg.agentResponse?.agentName || '@Agent',
                  )
                }
                className="text-slate-400 hover:text-blue-300 transition cursor-pointer"
              >
                {count > 0 ? `💬 ${count} Replies` : '💬 Discuss in Thread'}
              </button>
            </div>
          </div>
        );
      }

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

  const activeTypingList = Object.entries(typingAgents);

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
        <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Nexconn WebSocket Active</span>
          </div>
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

        {/* Live Agent Typing Indicators (Day 3 Feature) */}
        {activeTypingList.map(([agentName, info]) => {
          const badge = getSenderBadge(agentName);
          return (
            <div
              key={agentName}
              className="flex items-start gap-3 animate-fade-in transition-all"
            >
              <div
                className={`w-8 h-8 rounded-xl bg-gradient-to-br ${badge.avatarBg} flex items-center justify-center text-sm shadow-md shrink-0 mt-0.5`}
              >
                {badge.icon}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${badge.textColor}`}>{badge.name}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${badge.badgeBg}`}>
                    {badge.role}
                  </span>
                </div>

                <div className="flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-[#11192e]/90 border border-white/[0.08] text-xs text-slate-300 shadow-lg">
                  <div className="flex items-center gap-1">
                    <span className={`typing-dot ${badge.textColor.replace('text-', 'bg-')}`} />
                    <span className={`typing-dot ${badge.textColor.replace('text-', 'bg-')}`} />
                    <span className={`typing-dot ${badge.textColor.replace('text-', 'bg-')}`} />
                  </div>
                  <span className="font-mono text-[11px] text-slate-300">{info.statusText}</span>
                </div>
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
          className="absolute bottom-28 right-8 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xl shadow-black/50 border border-blue-400/40 backdrop-blur-md transition-all cursor-pointer transform active:scale-95 animate-fade-in"
        >
          <span>↓</span>
          <span>Jump to latest</span>
        </button>
      )}

      {/* Modern Interactive Command Bar with Quick Prompts */}
      <div className="border-t border-white/[0.08] p-3 bg-[#0a0f1d] shrink-0 z-10">
        {/* Quick Action Chips & Mentions (Day 3 Feature) */}
        <div className="flex items-center gap-1.5 mb-2 px-1 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider shrink-0 mr-1">
            Agent Actions:
          </span>

          <button
            type="button"
            onClick={() => handleSendMessage('@DeployBot change risk to LOW')}
            className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 border border-orange-500/25 transition cursor-pointer shrink-0"
          >
            ⚡ @DeployBot change risk to LOW
          </button>

          <button
            type="button"
            onClick={() => handleSendMessage('@LogBot show last 20 lines')}
            className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/25 transition cursor-pointer shrink-0"
          >
            ⚡ @LogBot show last 20 lines
          </button>

          <button
            type="button"
            onClick={() => handleSendMessage('@DBAgent explain deadlock')}
            className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/25 transition cursor-pointer shrink-0"
          >
            ⚡ @DBAgent explain deadlock
          </button>

          <div className="h-3 w-px bg-white/[0.1] mx-1 shrink-0" />

          <button
            type="button"
            onClick={() => setInputText((prev) => `${prev}@LogBot `)}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500/20 transition cursor-pointer shrink-0"
          >
            @LogBot
          </button>
          <button
            type="button"
            onClick={() => setInputText((prev) => `${prev}@DBAgent `)}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition cursor-pointer shrink-0"
          >
            @DBAgent
          </button>
          <button
            type="button"
            onClick={() => setInputText((prev) => `${prev}@DeployBot `)}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition cursor-pointer shrink-0"
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
              placeholder="Prompt agents (@DeployBot change risk to LOW, @LogBot show last 20 lines, @DBAgent why)..."
              className="w-full bg-[#12192a] text-sm text-slate-100 placeholder:text-slate-400 px-4 py-2.5 rounded-xl border border-white/[0.1] focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/40 shadow-inner transition font-sans"
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

      {/* Slide-over Card Thread Drawer (Day 3 Feature) */}
      <CardThreadDrawer
        isOpen={threadDrawer.isOpen}
        onClose={() => setThreadDrawer((prev) => ({ ...prev, isOpen: false }))}
        incidentId={incident.id}
        cardId={threadDrawer.cardId}
        cardTitle={threadDrawer.title}
        cardSubtitle={threadDrawer.subtitle}
        agentName={threadDrawer.agentName}
        annotation={annotations[threadDrawer.cardId]}
        onAnnotationSaved={(cardId, savedAnnotation) => {
          setAnnotations((prev) => ({ ...prev, [cardId]: savedAnnotation }));
        }}
        onThreadCountChanged={handleThreadCountChanged}
      />
    </div>
  );
}
