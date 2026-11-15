// ============================================
// API Client
// ============================================

import type {
  Scenario,
  Incident,
  TriggerPayload,
  TriggerResponse,
  ThreadMessage,
  CardAnnotation,
  AgentResponse,
} from './types';

const API_BASE = '/api';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** List available chaos scenarios */
export async function getScenarios(): Promise<Scenario[]> {
  const data = await fetchJSON<{ scenarios: Scenario[] }>('/incidents/scenarios');
  return data.scenarios;
}

/** Trigger a new incident */
export async function triggerIncident(payload: TriggerPayload): Promise<TriggerResponse> {
  return fetchJSON<TriggerResponse>('/incidents/trigger', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Get incident state */
export async function getIncident(id: string): Promise<Incident> {
  return fetchJSON<Incident>(`/incidents/${id}`);
}

/** List all incidents */
export async function listIncidents(): Promise<Incident[]> {
  const data = await fetchJSON<{ incidents: Incident[] }>('/incidents');
  return data.incidents;
}

/** Approve and execute remediation */
export async function executeRemediation(
  incidentId: string,
  userId: string,
): Promise<{ status: string; message: string }> {
  return fetchJSON(`/incidents/${incidentId}/execute`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

/** Reject proposed fix */
export async function rejectFix(
  incidentId: string,
  reason: string,
): Promise<{ status: string; message: string }> {
  return fetchJSON(`/incidents/${incidentId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

/** Health check */
export async function healthCheck(): Promise<{
  server: string;
  llm: { ok: boolean; model: string; latencyMs: number };
}> {
  return fetchJSON('/health');
}

/** Prompt an agent interactively via in-channel command or mention */
export async function promptAgent(
  incidentId: string,
  payload: { text: string; sender?: string; threadId?: string; targetAgent?: string },
): Promise<{ success: boolean; agentName: string; response: AgentResponse }> {
  return fetchJSON(`/incidents/${incidentId}/prompt`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Get all thread message counts and threads for an incident */
export async function getCardThreads(
  incidentId: string,
): Promise<{ counts: Record<string, number>; threads: Record<string, ThreadMessage[]> }> {
  return fetchJSON(`/incidents/${incidentId}/threads`);
}

/** Get messages in a specific card thread */
export async function getCardThread(
  incidentId: string,
  cardId: string,
): Promise<{ cardId: string; messages: ThreadMessage[] }> {
  return fetchJSON(`/incidents/${incidentId}/threads/${encodeURIComponent(cardId)}`);
}

/** Post a reply message in a card thread */
export async function postCardThreadMessage(
  incidentId: string,
  cardId: string,
  payload: { text: string; sender?: string; triggerAgent?: boolean },
): Promise<{ message: ThreadMessage; threadCount: number; messages: ThreadMessage[] }> {
  return fetchJSON(`/incidents/${incidentId}/threads/${encodeURIComponent(cardId)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Get all card annotations for an incident */
export async function getCardAnnotations(
  incidentId: string,
): Promise<{ annotations: Record<string, CardAnnotation> }> {
  return fetchJSON(`/incidents/${incidentId}/annotations`);
}

/** Set or update a pinned annotation on a card */
export async function saveCardAnnotation(
  incidentId: string,
  cardId: string,
  payload: { note: string; author?: string },
): Promise<{ annotation: CardAnnotation }> {
  return fetchJSON(`/incidents/${incidentId}/annotations/${encodeURIComponent(cardId)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Invite an on-call responder to the active war room */
export async function inviteResponder(
  incidentId: string,
  payload?: { targetUserId?: string; invitedBy?: string },
): Promise<{
  success: boolean;
  incidentId: string;
  targetUserId: string;
  invitedBy: string;
  inviteLink: string;
}> {
  return fetchJSON(`/incidents/${incidentId}/invite`, {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
}

