// ============================================
// Shared Type Definitions
// ============================================

export type ScenarioId = 'db_deadlock' | 'pod_crashloop' | 'redis_502';

export type IncidentStatus =
  | 'CRITICAL'
  | 'DIAGNOSING'
  | 'AWAITING_APPROVAL'
  | 'MITIGATING'
  | 'RESOLVED';

export type CustomMessageType =
  | 'DIAGNOSTIC_LOG'
  | 'ROOT_CAUSE_ANALYSIS'
  | 'ACTION_CARD'
  | 'RCA_SUMMARY'
  | 'SYSTEM_ALERT'
  | 'TYPING_INDICATOR'
  | 'AGENT_CHAT'
  | 'THREAD_REPLY'
  | 'CARD_ANNOTATION';

export interface ThreadMessage {
  id: string;
  cardId: string;
  sender: string;
  text: string;
  timestamp: number;
  isAgent: boolean;
  agentName?: string;
}

export interface CardAnnotation {
  cardId: string;
  note: string;
  author: string;
  timestamp: number;
}

export interface TypingStatus {
  agentName: string;
  status: 'typing' | 'done';
  statusText?: string;
  timestamp?: number;
  threadId?: string;
}

export interface Scenario {
  id: ScenarioId;
  title: string;
  severity: string;
  description: string;
}

export interface IncidentMetrics {
  cpuPercent: number;
  errorRatePercent: number;
  healthyPods: string;
  requestLatencyMs: number;
}

export interface AgentResponse {
  agentName: string;
  customType: CustomMessageType;
  text: string;
  customData: Record<string, unknown>;
}

export interface Incident {
  id: string;
  scenarioId: ScenarioId;
  title: string;
  severity: string;
  status: IncidentStatus;
  startedAt: number;
  resolvedAt: number | null;
  mttrSeconds: number | null;
  metrics: IncidentMetrics;
  pipelineResult: {
    logBot: AgentResponse;
    dbAgent: AgentResponse;
    deployBot: AgentResponse;
    usedFallback: boolean;
  } | null;
  commanderId: string | null;
  currentMttrSeconds: number;
}

// Chaos scenario trigger payload
export interface TriggerPayload {
  scenarioId: ScenarioId;
  commanderId?: string;
}

// Trigger response from server
export interface TriggerResponse {
  incidentId: string;
  title: string;
  severity: string;
  status: IncidentStatus;
  startedAt: number;
  stackTrace: string;
  metrics: IncidentMetrics;
}

