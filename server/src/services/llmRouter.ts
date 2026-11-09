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

export { getClient, getModel };

