// ============================================
// Neural TTS Service — Ultra-Realistic Studio Voices
// ============================================
// Uses Microsoft Edge Read Aloud API (Azure Neural) to generate
// warm, natural, human studio speech (MP3) without any API keys.

import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { Readable } from 'stream';

/**
 * Available high-fidelity neural voices.
 * en-US-AriaNeural: Crisp, warm, professional executive SRE female voice.
 * en-US-GuyNeural: Calm, natural, authoritative male SRE voice.
 */
export const DEFAULT_NEURAL_VOICE = 'en-US-AriaNeural';

/**
 * Clean and format human-sounding verbal incident script.
 * Short, crisp executive debrief (under 18 words) with zero underscores.
 */
export function buildVerbalScript(incident: {
  title: string;
  mttrSeconds?: number | null;
  startedAt: number;
  resolvedAt?: number | null;
  commanderId?: string | null;
  pipelineResult?: {
    dbAgent?: { customData?: Record<string, unknown> };
    deployBot?: { customData?: Record<string, unknown> };
  } | null;
}): string {
  const mttr = incident.mttrSeconds ?? Math.max(1, Math.floor(((incident.resolvedAt || Date.now()) - incident.startedAt) / 1000));
  
  // Clean approver name: strip leading @ and replace all underscores
  const rawApprover = (incident.pipelineResult?.deployBot?.customData?.approvedBy as string) || incident.commanderId || 'lead dev';
  const approver = rawApprover.replace(/^@/, '').replace(/_/g, ' ').trim();

  // Shorten root cause: strip version tags, parentheses, take primary clause, replace underscores
  let rawRoot = (incident.pipelineResult?.dbAgent?.customData?.rootCause as string) || incident.title;
  rawRoot = rawRoot.replace(/v\d+(\.\d+)*/g, '').replace(/\([^)]*\)/g, '').trim();
  const rootCause = (rawRoot.split(/[—–-]/)[0] || rawRoot).replace(/_/g, ' ').trim();

  // Shorten action
  let rawAction = (incident.pipelineResult?.deployBot?.customData?.actionTitle as string) || 
                  (incident.pipelineResult?.deployBot?.customData?.actionType as string) || 
                  'Remediation';
  let action = rawAction.replace(/_/g, ' ').replace(/^remediation\s*/i, '').replace(/playbook$/i, '').trim();
  if (!action) action = 'Remediation';

  // Short, crisp debrief with zero underscores
  const script = `War Room, incident resolved in ${mttr} seconds. Root cause: ${rootCause}. ${action} executed by ${approver}. Systems nominal.`;
  return script.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Generate audio MP3 stream for verbal script.
 */
export async function streamNeuralSpeech(
  text: string,
  voice: string = DEFAULT_NEURAL_VOICE,
): Promise<{ stream: Readable; close: () => void }> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text);

  return {
    stream: audioStream,
    close: () => tts.close(),
  };
}

