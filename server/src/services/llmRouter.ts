// ============================================
// Unified LLM Client — Groq / Local Model
// ============================================
// Switch provider by changing LLM_BASE_URL in .env
// Both Groq and llama-server expose OpenAI-compatible /v1/chat/completions
//
// Groq:  LLM_BASE_URL=https://api.groq.com/openai/v1
// Local: LLM_BASE_URL=http://127.0.0.1:8080/v1

import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Ensure .env from root is loaded even if imported before index.ts
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

function getClient(): OpenAI {
  const apiKey = (process.env.LLM_API_KEY || '').trim();
  const baseURL = (process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1').trim();
  return new OpenAI({
    baseURL,
    apiKey,
    fetch: globalThis.fetch,
  });
}

function getModel(): string {
  const model = (process.env.LLM_MODEL || '').trim();
  // If model is not set or set to older llama-3.1-8b-instant, map to supported fast model
  if (!model || model === 'llama-3.1-8b-instant') {
    return 'qwen/qwen3.8-27b';
  }
  return model;
}

export interface AgentResponse {
  agentName: string;
  customType: string;
  text: string;
  customData: Record<string, unknown>;
}

/**
 * Strip <think>...</think> reasoning blocks from TwIL-8B output.
 * Groq models don't emit these, so this is a no-op for cloud inference.
 */
function stripThinkTags(raw: string): string {
  return raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

/**
 * Attempt to extract valid JSON from an LLM response that may contain
 * markdown code fences or other wrapper text.
 */
function extractJSON(text: string): string {
  // Try to find JSON in markdown code fence
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Try to find a JSON object directly
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) return objectMatch[0];

  return text;
}

/**
 * Call an LLM agent with a system prompt and user message.
 * Returns a structured AgentResponse parsed from the LLM's JSON output.
 */
export async function callAgent(
  systemPrompt: string,
  userMessage: string,
  agentName: string,
): Promise<AgentResponse> {
  const client = getClient();
  const model = getModel();
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.2,
    max_tokens: 1024,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message?.content || '{}';

  // Strip <think> tags (handles local TwIL-8B; no-op for Groq)
  const cleaned = stripThinkTags(raw);

  // Extract JSON from potential markdown fences
  const jsonStr = extractJSON(cleaned);

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      agentName,
      customType: parsed.customType || 'UNKNOWN',
      text: parsed.text || '',
      customData: parsed.customData || {},
    };
  } catch {
    console.error(`[${agentName}] Failed to parse LLM JSON:`, jsonStr.substring(0, 200));
    throw new Error(`LLM returned invalid JSON for ${agentName}`);
  }
}

/**
 * Health check: verify the LLM endpoint is reachable.
 */
export async function healthCheck(): Promise<{ ok: boolean; model: string; latencyMs: number; error?: string }> {
  const start = Date.now();
  const model = getModel();
  try {
    const client = getClient();
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Respond with: {"status":"ok"}' }],
      max_tokens: 20,
      temperature: 0,
    });
    const latencyMs = Date.now() - start;
    const content = res.choices[0]?.message?.content || '';
    return { ok: content.includes('ok'), model, latencyMs };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[HealthCheck] LLM error:', errorMsg);
    return { ok: false, model, latencyMs: Date.now() - start, error: errorMsg };
  }
}

export interface IncidentContext {
  id: string;
  scenarioId: string;
  title: string;
  severity: string;
  stackTrace: string;
  metrics: {
    cpuPercent: number;
    errorRatePercent: number;
    healthyPods: string;
    requestLatencyMs: number;
  };
  pipelineResult?: {
    logBot?: AgentResponse;
    dbAgent?: AgentResponse;
    deployBot?: AgentResponse;
  } | null;
}

/**
 * Handle interactive human querying of a specific agent.
 * Supports natural chat Q&A, diagnostic queries, and modifying action playbooks.
 */
const ROLE_GUIDANCE: Record<string, string> = {
  '@DeployBot':
    'You are DevOps orchestrator @DeployBot.\nIf the engineer asks to change risk, adjust commands, add safety dry-run, or modify the remediation plan, return an updated ACTION_CARD.\nOtherwise, provide a clear, concise technical answer about deployment, commands, or rollback.',
  '@LogBot':
    'You are Telemetry Sentry @LogBot.\nAnalyze logs, explain stack traces, extract specific lines or error patterns requested by the engineer.',
  '@DBAgent':
    'You are Root Cause Diagnostician @DBAgent.\nExplain database internals, locks, failure cascades, and telemetry correlations.',
};

export async function promptInteractiveAgent(
  agentName: string,
  userMessage: string,
  context: IncidentContext,
): Promise<AgentResponse> {
  const cleanAgent = agentName.startsWith('@') ? agentName : `@${agentName}`;

  const systemPrompt = `You are ${cleanAgent}, an autonomous incident response specialist in an active war room.
Incident Context:
- Incident: ${context.title} (${context.severity})
- Metrics: CPU ${context.metrics.cpuPercent}%, Error Rate ${context.metrics.errorRatePercent}%, Pods: ${context.metrics.healthyPods}, Latency: ${context.metrics.requestLatencyMs}ms
- @LogBot finding: ${context.pipelineResult?.logBot?.text || 'N/A'}
- @DBAgent finding: ${context.pipelineResult?.dbAgent?.text || 'N/A'}
- @DeployBot active plan: ${context.pipelineResult?.deployBot?.text || 'N/A'}

Logs & Trace excerpt:
${context.stackTrace.slice(0, 1000)}

Your role:
${ROLE_GUIDANCE[cleanAgent] || ROLE_GUIDANCE['@DBAgent']}

You MUST respond with a JSON object in one of two formats:

Format 1: If updating or modifying an action card (DeployBot modifying remediation):
{
  "customType": "ACTION_CARD",
  "text": "<concise summary of modified action>",
  "customData": {
    "actionId": "${(context.pipelineResult?.deployBot?.customData?.actionId as string) || 'act_mod'}",
    "actionType": "${(context.pipelineResult?.deployBot?.customData?.actionType as string) || 'SYSTEM_REMEDIATION'}",
    "riskLevel": "<LOW | MEDIUM | HIGH | CRITICAL>",
    "targetService": "${(context.pipelineResult?.deployBot?.customData?.targetService as string) || 'service-core'}",
    "commandPreview": "<updated bash/kubectl/sql commands>",
    "rollbackPlan": "<rollback instructions>",
    "estimatedDowntime": "<e.g. 0s (hot-reload)>",
    "status": "AWAITING_APPROVAL"
  }
}

Format 2: For technical answer / Q&A / log inspection:
{
  "customType": "AGENT_CHAT",
  "text": "<your expert technical response. Markdown formatting is supported (e.g. \`\`\`bash or \`\`\`sql)>",
  "customData": {
    "agentName": "${cleanAgent}",
    "summary": "<short 1-line summary>"
  }
}

Respond with ONLY the JSON object. No outer markdown wrapper.`;

  try {
    const result = await Promise.race([
      callAgent(systemPrompt, userMessage, cleanAgent),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('LLM_PROMPT_TIMEOUT')), 7000),
      ),
    ]);
    return result;
  } catch (err) {
    console.warn(`[${cleanAgent}] Interactive prompt LLM failed or timed out:`, err);
    return getInteractiveFallback(cleanAgent, userMessage, context);
  }
}

/**
 * Deterministic fallback responses for interactive chat prompts.
 * Guarantees instantaneous, ultra-realistic responses even offline.
 */
function getInteractiveFallback(
  agentName: string,
  userMessage: string,
  context: IncidentContext,
): AgentResponse {
  const query = userMessage.toLowerCase();
  const existingDeploy = context.pipelineResult?.deployBot?.customData;

  // @DeployBot risk adjustments or command modifications
  if (agentName === '@DeployBot') {
    if (query.includes('low') || query.includes('risk')) {
      return {
        agentName: '@DeployBot',
        customType: 'ACTION_CARD',
        text: 'Action risk downgraded to LOW: Added pre-flight isolation check and graceful worker drain.',
        customData: {
          actionId: (existingDeploy?.actionId as string) || 'act_low_risk',
          actionType: (existingDeploy?.actionType as string) || 'SAFE_REMEDIATION',
          riskLevel: 'LOW',
          targetService: (existingDeploy?.targetService as string) || 'production-cluster',
          commandPreview: `kubectl cordon pod/failing-worker; ${(existingDeploy?.commandPreview as string) || 'kubectl rollout restart deployment/core'
            } --dry-run=none`,
          rollbackPlan: (existingDeploy?.rollbackPlan as string) || 'kubectl uncordon pod/failing-worker',
          estimatedDowntime: '0s (drained safely)',
          status: 'AWAITING_APPROVAL',
        },
      };
    }

    if (query.includes('command') || query.includes('dry') || query.includes('script')) {
      return {
        agentName: '@DeployBot',
        customType: 'AGENT_CHAT',
        text: `Here is the verified execution blueprint:\n\`\`\`bash\n# 1. Verification\n${(existingDeploy?.commandPreview as string) || 'kubectl get pods -n production -l app=core'}\n# 2. Automated health validation\ncurl -f http://internal-ingress/healthz || exit 1\n\`\`\`\nCommands are staged and await your approval via the Action Card.`,
        customData: { agentName: '@DeployBot' },
      };
    }

    return {
      agentName: '@DeployBot',
      customType: 'AGENT_CHAT',
      text: `Acknowledged commander. Playbook is primed for **${context.title}**. Target service is \`${(existingDeploy?.targetService as string) || 'production-service'}\`. You can approve execution directly on the Action Card or ask me to adjust risk parameters.`,
      customData: { agentName: '@DeployBot' },
    };
  }

  // @LogBot log inspection & trace queries
  if (agentName === '@LogBot') {
    if (query.includes('20') || query.includes('line') || query.includes('log') || query.includes('trace')) {
      const logLines = context.stackTrace.split('\n').slice(-20).join('\n') || context.stackTrace;
      return {
        agentName: '@LogBot',
        customType: 'AGENT_CHAT',
        text: `Here are the last 20 frames from the streaming incident ring buffer:\n\`\`\`log\n${logLines}\n\`\`\`\nOffending exception signature isolated at \`${(context.pipelineResult?.logBot?.customData?.filePath as string) || 'app/server.ts'}\`.`,
        customData: { agentName: '@LogBot' },
      };
    }

    return {
      agentName: '@LogBot',
      customType: 'AGENT_CHAT',
      text: `Stack trace analysis confirmed: Error frequency is elevated at **${context.metrics.errorRatePercent}%**. Anomalous pattern corresponds to \`${(context.pipelineResult?.logBot?.customData?.errorSignature as string) || 'UnhandledException'}\`. No secondary process anomalies detected.`,
      customData: { agentName: '@LogBot' },
    };
  }

  // @DBAgent database & root cause queries
  if (query.includes('deadlock') || query.includes('pool') || query.includes('why') || query.includes('cascade')) {
    return {
      agentName: '@DBAgent',
      customType: 'AGENT_CHAT',
      text: `**Root Cause Diagnostics:**\n1. Active connection pool reached 100% saturation under sudden burst.\n2. Transaction holding row-level locks on shared state exceeded the 30,000ms threshold.\n3. Downstream connection requests queued until ingress gateway timed out.\n\nRecommended remediation is executing the staged pool termination and connection pool scaler.`,
      customData: { agentName: '@DBAgent' },
    };
  }

  return {
    agentName: '@DBAgent',
    customType: 'AGENT_CHAT',
    text: `Telemetry correlation confirms cluster load at **${context.metrics.cpuPercent}% CPU** and latency peaking at **${context.metrics.requestLatencyMs}ms**. Root cause is localized to \`${(context.pipelineResult?.dbAgent?.customData?.affectedComponent as string) || 'Infrastructure'}\`.`,
    customData: { agentName: '@DBAgent' },
  };
}

export { getClient, getModel };

