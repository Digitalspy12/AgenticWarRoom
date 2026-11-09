// ============================================
// Agent Pipeline Orchestrator
// ============================================
// Sequential chaining: LogBot → DBAgent → DeployBot
// With timeout-based fallback to pre-baked responses.

import { callAgent, type AgentResponse } from './llmRouter.js';
import { LOG_BOT_SYSTEM_PROMPT } from '../agents/logBot.js';
import { DB_AGENT_SYSTEM_PROMPT } from '../agents/dbAgent.js';
import { DEPLOY_BOT_SYSTEM_PROMPT } from '../agents/deployBot.js';
import { getFallback } from '../data/fallbackResponses.js';
import type { ChaosScenario, ScenarioId } from './chaosEngine.js';

const LLM_TIMEOUT_MS = 8000; // 8 second timeout before fallback

export interface PipelineResult {
  logBot: AgentResponse;
  dbAgent: AgentResponse;
  deployBot: AgentResponse;
  usedFallback: boolean;
}

/**
 * Race an LLM call against a timeout. Returns fallback on timeout or error.
 */
async function callWithFallback(
  systemPrompt: string,
  userMessage: string,
  agentName: string,
  scenarioId: ScenarioId,
  fallbackKey: 'logBot' | 'dbAgent' | 'deployBot',
): Promise<{ response: AgentResponse; wasFallback: boolean }> {
  try {
    const response = await Promise.race([
      callAgent(systemPrompt, userMessage, agentName),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LLM_TIMEOUT')), LLM_TIMEOUT_MS),
      ),
    ]);
    return { response, wasFallback: false };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`[${agentName}] LLM failed (${errMsg}), using fallback response`);
    return { response: getFallback(scenarioId, fallbackKey), wasFallback: true };
  }
}

/**
 * Run the full 3-agent triage pipeline for an incident scenario.
 *
 * Flow: Stack trace → @LogBot → @DBAgent → @DeployBot
 *
 * Each agent receives the previous agent's output as context.
 * If any agent times out or returns bad JSON, the pre-baked fallback is used.
 *
 * @param onAgentStart - Callback fired when each agent starts processing (for typing indicators)
 * @param onAgentComplete - Callback fired when each agent finishes (for posting to channel)
 */
export async function runTriagePipeline(
  scenario: ChaosScenario,
  onAgentStart?: (agentName: string) => void,
  onAgentComplete?: (response: AgentResponse) => void,
): Promise<PipelineResult> {
  let usedFallback = false;

  // ---- Stage 1: @LogBot ----
  onAgentStart?.('@LogBot');
  const logBotInput = `INCIDENT: ${scenario.title}\n\nStack Trace & Error Logs:\n${scenario.stackTrace}\n\nSystem Metrics:\n- CPU: ${scenario.metrics.cpuPercent}%\n- Error Rate: ${scenario.metrics.errorRatePercent}%\n- Healthy Pods: ${scenario.metrics.healthyPods}\n- Avg Latency: ${scenario.metrics.requestLatencyMs}ms`;

  const logBotResult = await callWithFallback(
    LOG_BOT_SYSTEM_PROMPT,
    logBotInput,
    '@LogBot',
    scenario.id,
    'logBot',
  );
  if (logBotResult.wasFallback) usedFallback = true;
  onAgentComplete?.(logBotResult.response);

  // ---- Stage 2: @DBAgent ----
  onAgentStart?.('@DBAgent');
  const dbAgentInput = `INCIDENT: ${scenario.title}\n\n@LogBot Diagnostic Report:\n${JSON.stringify(logBotResult.response.customData, null, 2)}\n\nSystem Metrics:\n- CPU: ${scenario.metrics.cpuPercent}%\n- Error Rate: ${scenario.metrics.errorRatePercent}%\n- Healthy Pods: ${scenario.metrics.healthyPods}\n- Avg Latency: ${scenario.metrics.requestLatencyMs}ms`;

  const dbAgentResult = await callWithFallback(
    DB_AGENT_SYSTEM_PROMPT,
    dbAgentInput,
    '@DBAgent',
    scenario.id,
    'dbAgent',
  );
  if (dbAgentResult.wasFallback) usedFallback = true;
  onAgentComplete?.(dbAgentResult.response);

  // ---- Stage 3: @DeployBot ----
  onAgentStart?.('@DeployBot');
  const deployBotInput = `INCIDENT: ${scenario.title}\n\n@LogBot Diagnostic:\n${JSON.stringify(logBotResult.response.customData, null, 2)}\n\n@DBAgent Root Cause Analysis:\n${JSON.stringify(dbAgentResult.response.customData, null, 2)}\n\nPropose a concrete remediation plan with executable commands.`;

  const deployBotResult = await callWithFallback(
    DEPLOY_BOT_SYSTEM_PROMPT,
    deployBotInput,
    '@DeployBot',
    scenario.id,
    'deployBot',
  );
  if (deployBotResult.wasFallback) usedFallback = true;
  onAgentComplete?.(deployBotResult.response);

  return {
    logBot: logBotResult.response,
    dbAgent: dbAgentResult.response,
    deployBot: deployBotResult.response,
    usedFallback,
  };
}

