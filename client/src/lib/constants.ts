// ============================================
// Application Constants
// ============================================
// Single source of truth for shared strings.
// Change here → changes everywhere.

/** Current user identity (Day 2: replace with auth session) */
export const CURRENT_USER_ID = 'lead_dev';

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

