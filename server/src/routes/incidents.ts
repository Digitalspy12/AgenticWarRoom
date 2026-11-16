// ============================================
// Incident Routes
// ============================================
// POST /api/incidents/trigger  — Trigger a chaos scenario
// POST /api/incidents/:id/execute — Execute approved remediation
// GET  /api/incidents/:id — Get incident state

import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getScenario, getAllScenarioIds, type ScenarioId } from '../services/chaosEngine.js';
import { runTriagePipeline, type PipelineResult } from '../services/agentPipeline.js';
import {
  createGroupChannel,
  sendGroupMessage,
  addUserToGroupChannel,
  broadcastIncidentSync,
  updateGroupMetadata,
} from '../services/nexconnService.js';
import { promptInteractiveAgent, type IncidentContext } from '../services/llmRouter.js';
import { streamNeuralSpeech, buildVerbalScript } from '../services/ttsService.js';

const router = Router();

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

// In-memory incident store (sufficient for hackathon demo)
interface Incident {
  id: string;
  scenarioId: ScenarioId;
  title: string;
  severity: string;
  status: 'CRITICAL' | 'DIAGNOSING' | 'AWAITING_APPROVAL' | 'MITIGATING' | 'RESOLVED';
  startedAt: number;
  resolvedAt: number | null;
  mttrSeconds: number | null;
  metrics: {
    cpuPercent: number;
    errorRatePercent: number;
    healthyPods: string;
    requestLatencyMs: number;
  };
  pipelineResult: PipelineResult | null;
  commanderId: string | null;
  threads: Record<string, ThreadMessage[]>;
  annotations: Record<string, CardAnnotation>;
}

const incidents = new Map<string, Incident>();

function param(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

function requireIncident(req: Request, res: Response): Incident | null {
  const incident = incidents.get(param(req.params.id));
  if (!incident) {
    res.status(404).json({ error: 'Incident not found' });
    return null;
  }
  return incident;
}

async function sendTyping(
  channelId: string,
  agentName: string,
  status: 'typing' | 'done',
  statusText?: string,
  threadId?: string,
) {
  try {
    await sendGroupMessage({
      channelId,
      text: status === 'typing' ? statusText || `${agentName} is analyzing...` : '',
      customType: 'TYPING_INDICATOR',
      customData: { agentName, status, statusText, threadId },
      agentName,
    });
  } catch (err) {
    console.warn(`[Nexconn] Typing indicator (${status}) warning for ${agentName}:`, err);
  }
}

async function runAgentReply(
  incident: Incident,
  targetAgent: string,
  text: string,
  threadId?: string,
) {
  await sendTyping(
    incident.id,
    targetAgent,
    'typing',
    threadId ? `${targetAgent} is formulating thread reply...` : `${targetAgent} is analyzing your instruction...`,
    threadId,
  );

  const context: IncidentContext = {
    id: incident.id,
    scenarioId: incident.scenarioId,
    title: incident.title,
    severity: incident.severity,
    stackTrace: getScenario(incident.scenarioId).stackTrace,
    metrics: incident.metrics,
    pipelineResult: incident.pipelineResult,
  };

  try {
    const agentResponse = await promptInteractiveAgent(targetAgent, text, context);

    // Sync revised Action Card to incident state so Approve executes the updated plan
    if (agentResponse.customType === 'ACTION_CARD' && targetAgent === '@DeployBot') {
      if (!incident.pipelineResult) {
        incident.pipelineResult = {
          logBot: { agentName: '@LogBot', customType: 'DIAGNOSTIC_LOG', text: '', customData: {} },
          dbAgent: { agentName: '@DBAgent', customType: 'ROOT_CAUSE_ANALYSIS', text: '', customData: {} },
          deployBot: agentResponse,
          usedFallback: false,
        };
      } else {
        incident.pipelineResult.deployBot = agentResponse;
      }
      incident.status = 'AWAITING_APPROVAL';
    }

    if (threadId) {
      if (!incident.threads[threadId]) incident.threads[threadId] = [];
      incident.threads[threadId].push({
        id: `th-${Date.now()}-${uuidv4().slice(0, 4)}`,
        cardId: threadId,
        sender: targetAgent,
        text: agentResponse.text,
        timestamp: Date.now(),
        isAgent: true,
        agentName: targetAgent,
      });
    }

    const broadcastType =
      threadId && agentResponse.customType !== 'ACTION_CARD' ? 'THREAD_REPLY' : agentResponse.customType;

    try {
      await sendGroupMessage({
        channelId: incident.id,
        text: agentResponse.text,
        customType: broadcastType,
        customData: {
          ...agentResponse.customData,
          ...(threadId
            ? { threadId, agentName: targetAgent, isThreadReply: true, threadCount: incident.threads[threadId].length }
            : {}),
        },
        agentName: targetAgent,
      });
    } catch (err) {
      console.warn(`[Nexconn] Failed to broadcast agent reply:`, err);
    }

    return agentResponse;
  } finally {
    await sendTyping(incident.id, targetAgent, 'done', undefined, threadId);
  }
}

/**
 * GET /api/incidents/scenarios
 * List available chaos scenarios
 */
router.get('/scenarios', (_req: Request, res: Response) => {
  const ids = getAllScenarioIds();
  const scenarios = ids.map((id) => {
    const s = getScenario(id);
    return { id: s.id, title: s.title, severity: s.severity, description: s.description };
  });
  res.json({ scenarios });
});

/**
 * POST /api/incidents/trigger
 * Trigger a new chaos scenario → runs the full agent triage pipeline
 */
router.post('/trigger', async (req: Request, res: Response) => {
  const { scenarioId, commanderId } = req.body as {
    scenarioId: ScenarioId;
    commanderId?: string;
  };

  if (!scenarioId) {
    res.status(400).json({ error: 'scenarioId is required' });
    return;
  }

  let scenario;
  try {
    scenario = getScenario(scenarioId);
  } catch {
    res.status(400).json({ error: `Invalid scenarioId: ${scenarioId}` });
    return;
  }

  const incidentId = `inc-${Date.now()}-${uuidv4().slice(0, 4)}`;
  const incident: Incident = {
    id: incidentId,
    scenarioId,
    title: scenario.title,
    severity: scenario.severity,
    status: 'CRITICAL',
    startedAt: Date.now(),
    resolvedAt: null,
    mttrSeconds: null,
    metrics: { ...scenario.metrics },
    pipelineResult: null,
    commanderId: commanderId || null,
    threads: {},
    annotations: {},
  };

  incidents.set(incidentId, incident);
  console.log(`[Incident] Created ${incidentId}: ${scenario.title}`);

  // Immediately respond with incident metadata
  // (the agent pipeline runs async and results are polled/pushed via SSE)
  res.status(201).json({
    incidentId,
    title: scenario.title,
    severity: scenario.severity,
    status: 'CRITICAL',
    startedAt: incident.startedAt,
    stackTrace: scenario.stackTrace,
    metrics: scenario.metrics,
  });

  // Run agent pipeline asynchronously
  incident.status = 'DIAGNOSING';
  (async () => {
    // 1. Provision Nexconn Group Channel & post system alert (invites all on-call engineers)
    try {
      const activeResponders = Array.from(new Set([commanderId || 'lead_dev', 'lead_dev', 'sre_oncall', 'sec_ops']));
      await createGroupChannel(incidentId, `Incident: ${scenario.title}`, activeResponders);
      await sendGroupMessage({
        channelId: incidentId,
        text: `🚨 ALERT: ${scenario.title}\n\nSeverity: ${scenario.severity}`,
        customType: 'SYSTEM_ALERT',
        customData: {
          incidentId,
          title: scenario.title,
          severity: scenario.severity,
          metrics: scenario.metrics,
        },
        agentName: '⚡ SYSTEM',
      });
    } catch (nErr) {
      console.warn(`[Nexconn] Initial channel setup warning:`, nErr);
    }

    // 2. Run sequential AI agent pipeline with typing indicators
    try {
      const result = await runTriagePipeline(
        scenario,
        async (agentName, statusText) => {
          console.log(`[Pipeline] ${incidentId}: ${agentName} started (${statusText})`);
          await sendTyping(incidentId, agentName, 'typing', statusText);
        },
        async (response) => {
          console.log(`[Pipeline] ${incidentId}: ${response.agentName} completed (${response.customType})`);
          await sendTyping(incidentId, response.agentName, 'done');
          try {
            await sendGroupMessage({
              channelId: incidentId,
              text: response.text,
              customType: response.customType,
              customData: response.customData,
              agentName: response.agentName,
            });
          } catch (mErr) {
            console.warn(`[Nexconn] Failed to send agent message:`, mErr);
          }
        },
      );
      incident.pipelineResult = result;
      incident.status = 'AWAITING_APPROVAL';
      console.log(`[Pipeline] ${incidentId}: Pipeline complete. usedFallback=${result.usedFallback}`);

      // Broadcast AWAITING_APPROVAL state to all open tabs
      broadcastIncidentSync(incidentId, {
        incidentId,
        status: 'AWAITING_APPROVAL',
        startedAt: incident.startedAt,
      }).catch((err) => console.warn('[Nexconn] AWAITING_APPROVAL broadcast failed:', err));
    } catch (err) {
      console.error(`[Pipeline] ${incidentId}: Pipeline failed`, err);
    }
  })();
});

/**
 * GET /api/incidents/:id
 * Get current incident state (polled by frontend)
 */
router.get('/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const incident = incidents.get(id);
  if (!incident) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }

  res.json({
    ...incident,
    // Compute live MTTR on the fly (client should also compute locally)
    currentMttrSeconds: incident.resolvedAt
      ? incident.mttrSeconds
      : Math.floor((Date.now() - incident.startedAt) / 1000),
  });
});

/**
 * GET /api/incidents/:id/audio
 * Stream realistic studio-quality neural MP3 audio debrief
 */
router.get('/:id/audio', async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const incident = incidents.get(id);
  const customScript = typeof req.query.script === 'string' ? req.query.script : null;

  if (!incident && !customScript) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }

  const script = incident ? buildVerbalScript(incident) : (customScript ?? '');
  if (!script.trim()) {
    res.status(400).json({ error: 'No script text available for audio debrief' });
    return;
  }

  try {
    const { stream, close } = await streamNeuralSpeech(script);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=1800');
    stream.pipe(res);

    stream.on('end', () => {
      close();
    });
    stream.on('error', (err) => {
      console.error('[TTS] Stream error:', err);
      close();
      if (!res.headersSent) res.status(500).end();
    });
  } catch (err) {
    console.error('[TTS] Neural synthesis failed:', err);
    res.status(500).json({ error: 'Neural speech synthesis failed' });
  }
});

/**
 * GET /api/incidents/:id/script
 * Get cleaned verbal debrief script text
 */
router.get('/:id/script', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const incident = incidents.get(id);
  if (!incident) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }

  res.json({ script: buildVerbalScript(incident) });
});

/**
 * GET /api/incidents
 * List all incidents
 */
router.get('/', (_req: Request, res: Response) => {
  const all = Array.from(incidents.values()).map((inc) => ({
    id: inc.id,
    title: inc.title,
    severity: inc.severity,
    status: inc.status,
    startedAt: inc.startedAt,
    resolvedAt: inc.resolvedAt,
    mttrSeconds: inc.mttrSeconds,
  }));
  res.json({ incidents: all });
});

/**
 * POST /api/incidents/:id/execute
 * Human approves the remediation → resolve the incident
 */
router.post('/:id/execute', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const incident = incidents.get(id);
  if (!incident) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }

  if (incident.status !== 'AWAITING_APPROVAL') {
    res.status(409).json({
      error: `Cannot execute: incident is in ${incident.status} state`,
      status: incident.status,
    });
    return;
  }

  const { userId } = req.body as { userId?: string };
  const approver = userId || 'lead_dev';

  // State transition: AWAITING_APPROVAL → MITIGATING → RESOLVED
  incident.status = 'MITIGATING';
  console.log(`[Incident] ${incident.id}: Remediation approved by ${approver}`);

  // Immediately broadcast MITIGATING state so all open tabs lock buttons and update banner
  broadcastIncidentSync(incident.id, {
    incidentId: incident.id,
    status: 'MITIGATING',
    approvedBy: approver,
    startedAt: incident.startedAt,
    actionCardStatus: 'EXECUTING',
  }).catch((err) => console.warn('[Nexconn] MITIGATING sync broadcast failed:', err));

  // Also update group channel metadata for persistent state
  updateGroupMetadata(incident.id, {
    ext_status: 'MITIGATING',
    ext_approver: approver,
  }).catch((err) => console.warn('[Nexconn] updateGroupMetadata MITIGATING failed:', err));

  // Simulate remediation execution (2 seconds)
  setTimeout(() => {
    incident.status = 'RESOLVED';
    incident.resolvedAt = Date.now();
    incident.mttrSeconds = Math.floor((incident.resolvedAt - incident.startedAt) / 1000);

    // Update the action card status
    if (incident.pipelineResult?.deployBot?.customData) {
      incident.pipelineResult.deployBot.customData.status = 'EXECUTED_BY_HUMAN';
      incident.pipelineResult.deployBot.customData.approvedBy = approver;
      incident.pipelineResult.deployBot.customData.executedAt = new Date().toISOString();
    }

    // Broadcast resolution message to Nexconn channel
    sendGroupMessage({
      channelId: incident.id,
      text: `✅ INCIDENT RESOLVED — Remediation executed by @${approver}. MTTR: ${incident.mttrSeconds}s`,
      customType: 'SYSTEM_ALERT',
      agentName: '⚡ SYSTEM',
    }).catch((err) => console.warn('[Nexconn] Resolution broadcast failed:', err));

    // Broadcast INCIDENT_SYNC for RESOLVED
    broadcastIncidentSync(incident.id, {
      incidentId: incident.id,
      status: 'RESOLVED',
      approvedBy: approver,
      startedAt: incident.startedAt,
      resolvedAt: incident.resolvedAt,
      mttrSeconds: incident.mttrSeconds,
      actionCardStatus: 'EXECUTED_BY_HUMAN',
    }).catch((err) => console.warn('[Nexconn] RESOLVED sync broadcast failed:', err));

    // Update group channel metadata
    updateGroupMetadata(incident.id, {
      ext_status: 'RESOLVED',
      ext_approver: approver,
      ext_mttr: String(incident.mttrSeconds),
    }).catch((err) => console.warn('[Nexconn] updateGroupMetadata RESOLVED failed:', err));

    console.log(`[Incident] ${incident.id}: RESOLVED in ${incident.mttrSeconds}s`);
  }, 2000);

  res.json({
    incidentId: incident.id,
    status: 'MITIGATING',
    message: 'Remediation executing...',
    approvedBy: approver,
  });
});

/**
 * POST /api/incidents/:id/invite
 * Invite a responder into the war room (e.g. Lead Dev invites SRE On-Call)
 */
router.post('/:id/invite', async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const incident = incidents.get(id);
  if (!incident) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }

  const { targetUserId = 'sre_oncall', invitedBy = 'lead_dev' } = req.body as {
    targetUserId?: string;
    invitedBy?: string;
  };

  try {
    // 1. Add user to Nexconn group channel
    await addUserToGroupChannel(incident.id, [targetUserId]);

    // 2. Post visible chat announcement in the channel
    await sendGroupMessage({
      channelId: incident.id,
      text: `📟 @${invitedBy} paged @${targetUserId} into the war room.`,
      customType: 'SYSTEM_ALERT',
      agentName: '⚡ SYSTEM',
    });

    // 3. Broadcast INCIDENT_SYNC snapshot
    await broadcastIncidentSync(incident.id, {
      incidentId: incident.id,
      status: incident.status,
      startedAt: incident.startedAt,
      resolvedAt: incident.resolvedAt,
      mttrSeconds: incident.mttrSeconds,
      title: incident.title,
      severity: incident.severity,
      metrics: incident.metrics,
      actionCardStatus: incident.pipelineResult?.deployBot?.customData?.status,
    });

    // Construct direct 1-click link
    const host = req.get('host') || 'localhost:5173';
    const clientHost = host.includes(':3001') ? host.replace(':3001', ':5173') : host;
    const protocol = req.protocol || 'http';
    const inviteLink = `${protocol}://${clientHost}/?inc=${incident.id}&as=${targetUserId}`;

    console.log(`[Incident] ${incident.id}: @${invitedBy} paged @${targetUserId} -> ${inviteLink}`);

    res.json({
      success: true,
      incidentId: incident.id,
      targetUserId,
      invitedBy,
      inviteLink,
    });
  } catch (err) {
    console.error(`[Incident] Failed to invite responder to ${incident.id}:`, err);
    res.status(500).json({ error: 'Failed to invite responder' });
  }
});

/**
 * POST /api/incidents/:id/reject
 * Human rejects the fix → loop back to DIAGNOSING
 */
router.post('/:id/reject', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const incident = incidents.get(id);
  if (!incident) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }

  incident.status = 'DIAGNOSING';
  const { reason } = req.body as { reason?: string };
  console.log(`[Incident] ${incident.id}: Fix rejected. Reason: ${reason || 'not specified'}`);

  res.json({
    incidentId: incident.id,
    status: 'DIAGNOSING',
    message: 'Fix rejected. Agents will re-analyze.',
  });
});

/**
 * Helper to identify which agent is targeted in a message.
 */
function resolveTargetAgent(text: string, cardIdHint?: string): string {
  if (/@DeployBot/i.test(text)) return '@DeployBot';
  if (/@LogBot/i.test(text)) return '@LogBot';
  if (/@DBAgent/i.test(text)) return '@DBAgent';

  if (cardIdHint) {
    if (cardIdHint.includes('log')) return '@LogBot';
    if (cardIdHint.includes('db') || cardIdHint.includes('cause')) return '@DBAgent';
    if (cardIdHint.includes('action') || cardIdHint.includes('deploy')) return '@DeployBot';
  }

  const lower = text.toLowerCase();
  if (/(rollback|scale|deploy|risk|command|fix|playbook|script|apply|action)/.test(lower)) {
    return '@DeployBot';
  }
  if (/(database|deadlock|pool|cascade|why|metrics|latency|cpu|connection|query)/.test(lower)) {
    return '@DBAgent';
  }
  if (/(log|trace|error|stack|file|line|exception|frame)/.test(lower)) {
    return '@LogBot';
  }

  return '@DeployBot';
}

/**
 * POST /api/incidents/:id/prompt
 * Prompt a specific agent interactively from chat or quick mention
 */
router.post('/:id/prompt', async (req: Request, res: Response) => {
  const incident = requireIncident(req, res);
  if (!incident) return;

  const { text, threadId, targetAgent: requestedAgent } = req.body as {
    text: string;
    sender?: string;
    threadId?: string;
    targetAgent?: string;
  };

  if (!text?.trim()) {
    res.status(400).json({ error: 'Prompt text is required' });
    return;
  }

  const targetAgent = requestedAgent || resolveTargetAgent(text, threadId);

  try {
    const response = await runAgentReply(incident, targetAgent, text, threadId);
    res.json({ success: true, agentName: targetAgent, response });
  } catch (err) {
    console.error(`[Prompt] Failed for ${targetAgent}:`, err);
    res.status(500).json({ error: 'Failed to process prompt' });
  }
});

/**
 * GET /api/incidents/:id/threads
 * Get reply counts for all cards in this incident
 */
router.get('/:id/threads', (req: Request, res: Response) => {
  const incident = requireIncident(req, res);
  if (!incident) return;

  const counts: Record<string, number> = {};
  for (const [cardId, list] of Object.entries(incident.threads)) {
    counts[cardId] = list.length;
  }
  res.json({ counts, threads: incident.threads });
});

/**
 * GET /api/incidents/:id/threads/:cardId
 * Get thread history for a specific card
 */
router.get('/:id/threads/:cardId', (req: Request, res: Response) => {
  const incident = requireIncident(req, res);
  if (!incident) return;

  const cardId = param(req.params.cardId);
  res.json({ cardId, messages: incident.threads[cardId] || [] });
});

/**
 * POST /api/incidents/:id/threads/:cardId
 * Post a reply in a card's thread (and optionally trigger agent reasoning)
 */
router.post('/:id/threads/:cardId', async (req: Request, res: Response) => {
  const incident = requireIncident(req, res);
  if (!incident) return;

  const cardId = param(req.params.cardId);
  const { text, sender, triggerAgent } = req.body as {
    text: string;
    sender?: string;
    triggerAgent?: boolean;
  };

  if (!text?.trim()) {
    res.status(400).json({ error: 'Message text is required' });
    return;
  }

  if (!incident.threads[cardId]) {
    incident.threads[cardId] = [];
  }

  const userMsg: ThreadMessage = {
    id: `th-${Date.now()}-${uuidv4().slice(0, 4)}`,
    cardId,
    sender: sender || 'lead_dev',
    text: text.trim(),
    timestamp: Date.now(),
    isAgent: false,
  };
  incident.threads[cardId].push(userMsg);

  try {
    await sendGroupMessage({
      channelId: incident.id,
      text: `${userMsg.sender}: ${userMsg.text}`,
      customType: 'THREAD_REPLY',
      customData: {
        threadId: cardId,
        sender: userMsg.sender,
        isThreadReply: true,
        threadCount: incident.threads[cardId].length,
      },
      agentName: userMsg.sender,
    });
  } catch (err) {
    console.warn('[Nexconn] Failed to broadcast thread reply:', err);
  }

  if (/@(DeployBot|LogBot|DBAgent)/i.test(text) || triggerAgent) {
    const targetAgent = resolveTargetAgent(text, cardId);
    try {
      await runAgentReply(incident, targetAgent, text, cardId);
    } catch (err) {
      console.warn(`[Thread Agent] Failed to reply:`, err);
    }
  }

  res.status(201).json({
    message: userMsg,
    threadCount: incident.threads[cardId].length,
    messages: incident.threads[cardId],
  });
});

/**
 * GET /api/incidents/:id/annotations
 * Get all card annotations for an incident
 */
router.get('/:id/annotations', (req: Request, res: Response) => {
  const incident = requireIncident(req, res);
  if (!incident) return;
  res.json({ annotations: incident.annotations || {} });
});

/**
 * POST /api/incidents/:id/annotations/:cardId
 * Set or update a pinned annotation on a card
 */
router.post('/:id/annotations/:cardId', async (req: Request, res: Response) => {
  const incident = requireIncident(req, res);
  if (!incident) return;

  const cardId = param(req.params.cardId);
  const { note, author } = req.body as { note: string; author?: string };
  if (!note?.trim()) {
    res.status(400).json({ error: 'Annotation note is required' });
    return;
  }

  const annotation: CardAnnotation = {
    cardId,
    note: note.trim(),
    author: author || 'lead_dev',
    timestamp: Date.now(),
  };

  if (!incident.annotations) incident.annotations = {};
  incident.annotations[cardId] = annotation;

  try {
    await sendGroupMessage({
      channelId: incident.id,
      text: `📌 [Annotation] ${annotation.author} pinned a note on ${cardId}: "${annotation.note}"`,
      customType: 'CARD_ANNOTATION',
      customData: { ...annotation },
      agentName: '⚡ SYSTEM',
    });
  } catch (err) {
    console.warn('[Nexconn] Failed to broadcast annotation:', err);
  }

  res.json({ annotation });
});

export default router;

