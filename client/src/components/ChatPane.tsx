// ============================================
// Chat Pane — Center Panel
// ============================================
// Displays the incident chat stream with custom card renderers.
// Day 1: Shows agent responses from REST polling.
// Day 2: Will use Nexconn Chat SDK for real-time WebSocket messages.

import { useState, useEffect, useRef } from 'react';
import { executeRemediation, rejectFix, getIncident } from '../lib/api';
import { DiagnosticLogCard } from './cards/DiagnosticLogCard';
import { ActionCard } from './cards/ActionCard';
import { RootCauseCard } from './cards/RootCauseCard';
import type { Incident, AgentResponse } from '../lib/types';

interface ChatPaneProps {
  incident: Incident | null;
  onIncidentUpdated: (incident: Incident) => void;
}

interface ChatMessage {
  id: string;
  timestamp: number;
  sender: string;
  type: 'system' | 'agent';
  agentResponse?: AgentResponse;
  text?: string;
}

export function ChatPane({ incident, onIncidentUpdated }: ChatPaneProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [executing, setExecuting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Build message list from incident pipeline results
  useEffect(() => {
    if (!incident) {
      setMessages([]);
      return;
    }

    const msgs: ChatMessage[] = [];

    // System alert
    msgs.push({
      id: `${incident.id}-alert`,
      timestamp: incident.startedAt,
      sender: '⚡ SYSTEM',
      type: 'system',
      text: `ALERT: ${incident.title}`,
    });

    // Agent responses
    if (incident.pipelineResult) {
      const { logBot, dbAgent, deployBot } = incident.pipelineResult;

      if (logBot) {
        msgs.push({
          id: `${incident.id}-logbot`,
          timestamp: incident.startedAt + 3000,
          sender: logBot.agentName,
          type: 'agent',
          agentResponse: logBot,
        });
      }

      if (dbAgent) {
        msgs.push({
          id: `${incident.id}-dbagent`,
          timestamp: incident.startedAt + 7000,
          sender: dbAgent.agentName,
          type: 'agent',
          agentResponse: dbAgent,
        });
      }

      if (deployBot) {
        msgs.push({
          id: `${incident.id}-deploybot`,
          timestamp: incident.startedAt + 11000,
          sender: deployBot.agentName,
          type: 'agent',
          agentResponse: deployBot,
        });
      }
    }

    // Resolution message
    if (incident.status === 'RESOLVED') {
      msgs.push({
        id: `${incident.id}-resolved`,
        timestamp: incident.resolvedAt || Date.now(),
        sender: '⚡ SYSTEM',
        type: 'system',
        text: `✅ INCIDENT RESOLVED — MTTR: ${incident.mttrSeconds}s`,
      });
    }

    setMessages(msgs);
  }, [incident]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleApprove = async () => {
    if (!incident) return;
    setExecuting(true);
    try {
      await executeRemediation(incident.id, 'lead_dev');
      // Poll for updated state
      setTimeout(async () => {
        const updated = await getIncident(incident.id);
        onIncidentUpdated(updated);
        // Poll again for RESOLVED
        setTimeout(async () => {
          const resolved = await getIncident(incident.id);
          onIncidentUpdated(resolved);
          setExecuting(false);
        }, 3000);
      }, 1000);
    } catch (err) {
      console.error('Execute failed:', err);
      setExecuting(false);
    }
  };

  const handleReject = async () => {
    if (!incident) return;
    try {
      await rejectFix(incident.id, 'Needs further analysis');
      const updated = await getIncident(incident.id);
      onIncidentUpdated(updated);
    } catch (err) {
      console.error('Reject failed:', err);
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

  const renderCard = (msg: ChatMessage) => {
    if (!msg.agentResponse) return null;

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
        return <p className="text-sm">{msg.agentResponse.text}</p>;
    }
  };

  const senderColor = (sender: string) => {
    if (sender.includes('LogBot')) return 'text-blue-400';
    if (sender.includes('DBAgent')) return 'text-purple-400';
    if (sender.includes('DeployBot')) return 'text-orange-400';
    if (sender.includes('SYSTEM')) return 'text-red-400';
    return 'text-green-400';
  };

  if (!incident) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--color-text-secondary)]">
        <div className="text-center">
          <div className="text-4xl mb-4">⚡</div>
          <h2 className="text-lg font-semibold mb-2">Agentic WarRoom</h2>
          <p className="text-sm">Trigger a chaos scenario from the left panel to begin</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Diagnosing indicator */}
        {incident.status === 'DIAGNOSING' && !incident.pipelineResult && (
          <div className="flex items-center gap-2 text-sm text-yellow-400 animate-pulse">
            <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full animate-bounce" />
            AI agents analyzing incident...
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="group">
            {/* Message header */}
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-sm font-semibold ${senderColor(msg.sender)}`}>
                {msg.sender}
              </span>
              {msg.agentResponse && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] uppercase tracking-wider">
                  {msg.agentResponse.customType.replace(/_/g, ' ')}
                </span>
              )}
              <span className="text-xs text-[var(--color-text-secondary)]">
                {formatTimestamp(msg.timestamp)}
              </span>
            </div>

            {/* Message content */}
            {msg.type === 'system' ? (
              <div className={`text-sm px-3 py-2 rounded border-l-4
                ${msg.text?.includes('RESOLVED')
                  ? 'border-green-500 bg-green-900/20 text-green-300'
                  : 'border-red-500 bg-red-900/20 text-red-300'
                }`}>
                {msg.text}
              </div>
            ) : (
              renderCard(msg)
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input Bar (placeholder — Day 2 with Nexconn) */}
      <div className="border-t border-[var(--color-border)] p-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Type a command or @mention an agent..."
            className="flex-1 bg-[var(--color-bg-card)] text-sm text-[var(--color-text-primary)] px-4 py-2 rounded-lg border border-[var(--color-border)] focus:outline-none focus:border-blue-500 placeholder:text-[var(--color-text-secondary)]"
            disabled
          />
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium opacity-50 cursor-not-allowed"
            disabled
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

