// ============================================
// API Client
// ============================================

import type {
  Scenario,
  Incident,
  TriggerPayload,
  TriggerResponse,
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

