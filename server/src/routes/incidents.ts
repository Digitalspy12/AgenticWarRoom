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
import { createGroupChannel, sendGroupMessage } from '../services/nexconnService.js';

const router = Router();

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
}

const incidents = new Map<string, Incident>();

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
    // 1. Provision Nexconn Group Channel & post system alert
    try {
      await createGroupChannel(incidentId, `Incident: ${scenario.title}`, [
        commanderId || 'lead_dev',
      ]);
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

    // 2. Run sequential AI agent pipeline
    try {
      const result = await runTriagePipeline(
        scenario,
        (agentName) => console.log(`[Pipeline] ${incidentId}: ${agentName} started`),
        async (response) => {
          console.log(`[Pipeline] ${incidentId}: ${response.agentName} completed (${response.customType})`);
          // Dispatch response to Nexconn group channel
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
    });
    return;
  }

  const { userId } = req.body as { userId?: string };

  // State transition: AWAITING_APPROVAL → MITIGATING → RESOLVED
  incident.status = 'MITIGATING';
  console.log(`[Incident] ${incident.id}: Remediation approved by ${userId || 'unknown'}`);

  // Simulate remediation execution (2 seconds)
  setTimeout(() => {
    incident.status = 'RESOLVED';
    incident.resolvedAt = Date.now();
    incident.mttrSeconds = Math.floor((incident.resolvedAt - incident.startedAt) / 1000);

    // Update the action card status
    if (incident.pipelineResult?.deployBot?.customData) {
      incident.pipelineResult.deployBot.customData.status = 'EXECUTED_BY_HUMAN';
      incident.pipelineResult.deployBot.customData.approvedBy = userId || 'lead_dev';
      incident.pipelineResult.deployBot.customData.executedAt = new Date().toISOString();
    }

    // Broadcast resolution message to Nexconn channel
    sendGroupMessage({
      channelId: incident.id,
      text: `✅ INCIDENT RESOLVED — Remediation executed by ${userId || 'lead_dev'}. MTTR: ${incident.mttrSeconds}s`,
      customType: 'SYSTEM_ALERT',
      agentName: '⚡ SYSTEM',
    }).catch((err) => console.warn('[Nexconn] Resolution broadcast failed:', err));

    console.log(`[Incident] ${incident.id}: RESOLVED in ${incident.mttrSeconds}s`);
  }, 2000);

  res.json({
    incidentId: incident.id,
    status: 'MITIGATING',
    message: 'Remediation executing...',
  });
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

export default router;

