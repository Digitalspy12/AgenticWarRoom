// ============================================
// Application Constants
// ============================================
// Single source of truth for shared strings.
// Change here → changes everywhere.

/** Multi-user identities supported on the Singapore cluster */
export const WARROOM_USERS = [
  { id: 'lead_dev', name: 'Lead Dev', role: 'Commander', initials: 'LD', gradient: 'from-indigo-500 to-purple-500' },
  { id: 'sre_oncall', name: 'SRE On-Call', role: 'Responder', initials: 'SO', gradient: 'from-emerald-500 to-teal-500' },
] as const;

export type WarRoomUserId = (typeof WARROOM_USERS)[number]['id'];

/** Resolve per-tab user identity from URL query param ?as= / ?user= or sessionStorage */
export function getSessionUserId(): string {
  if (typeof window === 'undefined') return 'lead_dev';
  const params = new URLSearchParams(window.location.search);
  const urlUser = params.get('as') || params.get('user');
  if (urlUser) {
    window.sessionStorage.setItem('warroom_user_id', urlUser);
    return urlUser;
  }
  const stored = window.sessionStorage.getItem('warroom_user_id');
  if (stored) return stored;

  const fallback = 'lead_dev';
  window.sessionStorage.setItem('warroom_user_id', fallback);
  return fallback;
}

export function setSessionUserId(userId: string): void {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem('warroom_user_id', userId);
    window.location.reload();
  }
}

/** Current user identity for this browser tab session */
export const CURRENT_USER_ID = getSessionUserId();

/** Nexconn customType values for agent messages */
export const MSG_TYPE = {
  DIAGNOSTIC_LOG: 'DIAGNOSTIC_LOG',
  ROOT_CAUSE_ANALYSIS: 'ROOT_CAUSE_ANALYSIS',
  ACTION_CARD: 'ACTION_CARD',
  SYSTEM_ALERT: 'SYSTEM_ALERT',
  TYPING_INDICATOR: 'TYPING_INDICATOR',
  AGENT_CHAT: 'AGENT_CHAT',
  THREAD_REPLY: 'THREAD_REPLY',
  CARD_ANNOTATION: 'CARD_ANNOTATION',
  INCIDENT_SYNC: 'INCIDENT_SYNC',
} as const;

/** Agent display names */
export const AGENT_NAME = {
  LOG_BOT: '@LogBot',
  DB_AGENT: '@DBAgent',
  DEPLOY_BOT: '@DeployBot',
} as const;

/** Polling intervals (ms) */
export const POLL_INTERVAL_MS = 1500;
export const POLL_BACKOFF_MS = 3000;

