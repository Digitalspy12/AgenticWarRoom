// ============================================
// Nexconn Server Service
// ============================================
// Server-side integration with Nexconn Platform Chat API
// Handles token issuance, group channel provisioning, and server-side message dispatch.

import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

function getCredentials() {
  const appKey = (process.env.NEXCONN_APP_KEY || '').trim();
  const appSecret = (process.env.NEXCONN_APP_SECRET || '').trim();
  const botUserId = (process.env.NEXCONN_BOT_USER_ID || 'warroom_bot').trim();
  const baseUrl = (process.env.NEXCONN_API_URL || 'https://api.sg-light-api.com').trim().replace(/\/$/, '');

  return { appKey, appSecret, botUserId, baseUrl };
}

/**
 * Generate Nexconn API request headers including SHA-1 signature.
 * Formula: SHA1(AppSecret + Nonce + Timestamp)
 */
function getHeaders() {
  const { appKey, appSecret } = getCredentials();
  const nonce = Math.floor(Math.random() * 1000000).toString();
  const timestamp = Date.now().toString();
  const signature = crypto
    .createHash('sha1')
    .update(`${appSecret}${nonce}${timestamp}`)
    .digest('hex');

  return {
    'App-Key': appKey,
    'Nonce': nonce,
    'Timestamp': timestamp,
    'Signature': signature,
    'Content-Type': 'application/json',
  };
}

export interface IssueTokenResult {
  userId: string;
  token: string;
}

/**
 * Issue or retrieve a user access token from Nexconn.
 * POST /v4/auth/access-token/issue
 */
export async function issueToken(userId: string, name?: string): Promise<string> {
  const { baseUrl } = getCredentials();
  const url = `${baseUrl}/v4/auth/access-token/issue`;

  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      userId,
      name: name || userId,
    }),
  });

  const data = (await res.json()) as {
    code: number;
    result?: { userId: string; accessToken: string };
    msg?: string;
  };

  if (data.code !== 0 || !data.result?.accessToken) {
    throw new Error(`Failed to issue token: ${data.msg || `code ${data.code}`}`);
  }

  return data.result.accessToken;
}

/**
 * Create a group channel for an incident.
 * POST /v4/group-channel/create
 */
export async function createGroupChannel(
  channelId: string,
  name: string,
  inviteUserIds: string[] = [],
): Promise<void> {
  const { baseUrl, botUserId } = getCredentials();
  const url = `${baseUrl}/v4/group-channel/create`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        channelId,
        name: name.slice(0, 64),
        owner: botUserId,
        userIds: inviteUserIds,
        permissions: {
          joinPerm: 1, // Anyone with ID can join without approval
          invitePerm: 0,
        },
      }),
    });

    const data = (await res.json()) as { code: number; msg?: string };
    // Code 0 = success, Code 20007 / 20008 = group already exists, safe to ignore
    if (data.code !== 0 && data.code !== 20007 && data.code !== 20008) {
      console.warn(`[Nexconn] createGroupChannel response:`, data);
    } else {
      console.log(`[Nexconn] Group channel created: ${channelId} (${name})`);
    }
  } catch (err) {
    console.error(`[Nexconn] Failed to create group channel ${channelId}:`, err);
  }
}

/**
 * Send a message into a group channel on behalf of a bot.
 * POST /v4/group-channel/message/send
 */
export async function sendGroupMessage(params: {
  channelId: string;
  text: string;
  customType?: string;
  customData?: Record<string, unknown>;
  agentName?: string;
}): Promise<void> {
  const { baseUrl, botUserId } = getCredentials();
  const url = `${baseUrl}/v4/group-channel/message/send`;

  const extraPayload = {
    customType: params.customType || 'TEXT',
    customData: params.customData || {},
    agentName: params.agentName || 'WarRoom Bot',
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        fromUserId: botUserId,
        toChannelIds: [params.channelId],
        messageType: 'RC:TxtMsg',
        content: JSON.stringify({
          content: params.text,
          extra: JSON.stringify(extraPayload),
        }),
      }),
    });

    const data = (await res.json()) as { code: number; msg?: string };
    if (data.code !== 0) {
      console.warn(`[Nexconn] sendGroupMessage warning:`, data);
    } else {
      console.log(`[Nexconn] Message sent to ${params.channelId} by ${extraPayload.agentName}`);
    }
  } catch (err) {
    console.error(`[Nexconn] Failed to send message to ${params.channelId}:`, err);
  }
}

/**
 * Add user(s) to an existing group channel directly.
 * POST /v4/group-channel/join
 */
export async function addUserToGroupChannel(
  channelId: string,
  userIds: string[],
): Promise<void> {
  const { baseUrl } = getCredentials();
  const url = `${baseUrl}/v4/group-channel/join`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        channelId,
        userIds,
      }),
    });

    const data = (await res.json()) as { code: number; msg?: string };
    if (data.code !== 0) {
      console.warn(`[Nexconn] addUserToGroupChannel warning for ${channelId}:`, data);
    } else {
      console.log(`[Nexconn] Added users to ${channelId}:`, userIds);
    }
  } catch (err) {
    console.error(`[Nexconn] Failed to add users to ${channelId}:`, err);
  }
}

/**
 * Broadcast incident state sync event over the group channel WebSocket.
 */
export async function broadcastIncidentSync(
  channelId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await sendGroupMessage({
    channelId,
    text: `⚡ INCIDENT STATE SYNC: ${payload.status || 'UPDATE'}`,
    customType: 'INCIDENT_SYNC',
    customData: payload,
    agentName: '⚡ SYSTEM',
  });
}

/**
 * Update group channel metadata / profile introduction.
 * POST /v4/group-channel/profile/update
 */
export async function updateGroupMetadata(
  channelId: string,
  meta: Record<string, string>,
): Promise<void> {
  const { baseUrl } = getCredentials();
  const url = `${baseUrl}/v4/group-channel/profile/update`;

  try {
    const summary = Object.entries(meta)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    const res = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        channelId,
        groupProfile: {
          introduction: `Incident State: ${summary}`.slice(0, 500),
        },
      }),
    });

    const data = (await res.json()) as { code: number; msg?: string };
    if (data.code !== 0) {
      console.debug(`[Nexconn] updateGroupMetadata note for ${channelId}:`, data.msg || data.code);
    }
  } catch (err) {
    console.debug(`[Nexconn] Failed to update group profile for ${channelId}:`, err);
  }
}

export function getPublicConfig() {
  const { appKey } = getCredentials();
  return { appKey };
}

