// ============================================
// Speech Service — Executive Incident Audio Briefings & Chimes
// ============================================
// Uses Web Audio API for guaranteed alert chimes and
// browser-native Web Speech Synthesis API for executive voice debriefs.

import type { Incident } from './types';

/**
 * Generate a crisp, executive verbal debrief script from incident metadata.
 * Short, crisp executive debrief (under 18 words) with zero underscores.
 */
export function generateBriefingScript(incident: Incident): string {
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
 * Play a high-tech synthesized audio chime via Web Audio API.
 * Works 100% reliably across all browsers without external files or TTS engines.
 */
export function playChime(type: 'resolve' | 'alert' = 'resolve'): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'resolve') {
      // Futuristic 2-tone resolution chime: C5 (523.25Hz) -> G5 (783.99Hz)
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(523.25, now);
      osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.15);
      osc2.frequency.setValueAtTime(659.25, now);
      osc2.frequency.exponentialRampToValueAtTime(1046.50, now + 0.15);
    } else {
      // Alert chime: 440Hz -> 880Hz
      osc1.type = 'sine';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(440, now);
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.1);
      osc2.frequency.setValueAtTime(440, now);
      osc2.frequency.exponentialRampToValueAtTime(880, now + 0.1);
    }

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.65);
    osc2.stop(now + 0.65);
  } catch (err) {
    console.debug('[Audio] Web Audio chime note:', err);
  }
}

class SpeechService {
  private utterance: SpeechSynthesisUtterance | null = null;
  private currentVoice: SpeechSynthesisVoice | null = null;
  private voicesInitialized = false;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private audioCtx: AudioContext | null = null;
  private isPlayingAudio = false;
  private listeners = new Set<(playing: boolean) => void>();

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.initVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => this.initVoices();
      }
    }
  }

  getAudioContext(): AudioContext {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx!;
  }

  /**
   * Subscribe to speech playback state changes.
   */
  subscribe(fn: (playing: boolean) => void): () => void {
    this.listeners.add(fn);
    fn(this.isSpeaking());
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify(playing: boolean): void {
    this.listeners.forEach((fn) => {
      try {
        fn(playing);
      } catch (err) {
        console.error('[Voice] Listener notification error:', err);
      }
    });
  }

  /**
   * Unlock browser audio playback policy on user gesture.
   * Resumes AudioContext and starts a silent buffer so subsequent
   * audio playback is never blocked by browser autoplay policy.
   */
  unlockAudio(): void {
    if (typeof window === 'undefined') return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch {
      // ignore
    }
  }

  /**
   * Play the complete executive audio debrief:
   * 1. High-tech resolution chime
   * 2. Microsoft Azure Neural studio MP3 decoded and played via Web Audio API (unblockable)
   * 3. Fallback to Web Speech API
   */
  async playBriefing(incident: Incident): Promise<boolean> {
    this.stop();
    const script = generateBriefingScript(incident);
    console.log('[Debrief] Auto-executing debrief speech:\n', script);

    // 1. Play chime
    playChime('resolve');

    this.isPlayingAudio = true;
    this.notify(true);

    try {
      const ctx = this.getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }

      // 2. Fetch Azure Neural studio MP3 stream from backend
      const audioUrl = `/api/incidents/${encodeURIComponent(incident.id)}/audio?script=${encodeURIComponent(script)}`;
      const res = await fetch(audioUrl);
      if (!res.ok) throw new Error(`Neural audio endpoint HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();

      // 3. Decode MP3 with Web Audio API (cannot be blocked by HTML5 audio restrictions)
      if (ctx) {
        const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
          ctx.decodeAudioData(arrayBuffer.slice(0), resolve, reject);
        });

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        this.currentSource = source;

        source.onended = () => {
          if (this.currentSource === source) {
            console.log('[Debrief] Audio briefing completed');
            this.currentSource = null;
            this.isPlayingAudio = false;
            this.notify(false);
          }
        };

        source.start(0);
        console.log('[Debrief] Web Audio neural stream playing successfully');
        return true;
      }

      throw new Error('AudioContext unavailable');
    } catch (err) {
      console.warn('[Debrief] Web Audio playback failed, attempting speech synthesis fallback:', err);
      this.isPlayingAudio = false;
      return this.speak(script);
    }
  }

  private initVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return;

    // Prefer high-quality, natural English voices
    const preferred =
      voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Natural') ||
            v.name.includes('Google') ||
            v.name.includes('Samantha') ||
            v.name.includes('Daniel') ||
            v.name.includes('Enhanced')),
      ) ||
      voices.find((v) => v.lang === 'en-US') ||
      voices.find((v) => v.lang.startsWith('en')) ||
      voices[0];

    if (preferred) {
      this.currentVoice = preferred;
      this.voicesInitialized = true;
      console.log('[Voice] Initialized voice:', preferred.name, `(${preferred.lang})`);
    }
  }

  /**
   * Check if speech synthesis is supported in current browser environment.
   */
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /**
   * Speak a text string with lifecycle callbacks.
   */
  speak(
    text: string,
    callbacks?: {
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: unknown) => void;
    },
  ): boolean {
    if (!this.isSupported()) {
      console.warn('[Voice] Speech synthesis not supported in this browser');
      callbacks?.onError?.(new Error('Speech synthesis not supported'));
      return false;
    }

    // Always play Web Audio chime first so audio feedback is guaranteed
    playChime('resolve');

    // Clear any previous utterance & cancel safely
    this.stop();

    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US'; // Explicit lang is required for Linux Chromium fallback
      u.rate = 1.02;
      u.pitch = 1.0;
      u.volume = 1.0;

      if (!this.voicesInitialized) this.initVoices();
      if (this.currentVoice) u.voice = this.currentVoice;

      u.onstart = () => {
        console.log('[Voice] Debrief speech started');
        this.notify(true);
        callbacks?.onStart?.();

        // Chromium bug workaround: speech synthesis pauses after ~15s if resume is not called
        if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
        this.keepAliveTimer = setInterval(() => {
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          } else {
            this.clearKeepAlive();
          }
        }, 8000);
      };

      u.onend = () => {
        console.log('[Voice] Debrief speech ended');
        this.clearKeepAlive();
        this.utterance = null;
        this.notify(false);
        callbacks?.onEnd?.();
      };

      u.onerror = (e) => {
        console.warn('[Voice] Debrief speech error event:', e);
        this.clearKeepAlive();
        this.utterance = null;
        this.notify(false);
        callbacks?.onError?.(e);
      };

      this.utterance = u;

      // Chrome cancel() is asynchronous: a 25ms delay prevents Chrome from
      // dropping the new speak() command immediately after cancel()
      setTimeout(() => {
        try {
          window.speechSynthesis.resume(); // Ensure engine is unpaused
          window.speechSynthesis.speak(u);
        } catch (innerErr) {
          console.error('[Voice] Failed to invoke speak():', innerErr);
          callbacks?.onError?.(innerErr);
        }
      }, 25);

      return true;
    } catch (err) {
      console.error('[Voice] Exception in speech speak():', err);
      callbacks?.onError?.(err);
      return false;
    }
  }

  private clearKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  /** Stop speaking immediately (Web Audio stream, HTML5 audio, and Web Speech) */
  stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop(0);
        this.currentSource.disconnect();
      } catch {
        // ignore
      }
      this.currentSource = null;
    }

    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.onplay = null;
        this.currentAudio.onended = null;
        this.currentAudio.onerror = null;
        this.currentAudio.src = '';
      } catch {
        // ignore
      }
      this.currentAudio = null;
    }

    this.isPlayingAudio = false;
    this.clearKeepAlive();
    this.notify(false);

    if (this.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch (err) {
        console.debug('[Voice] cancel error:', err);
      }
      if (this.utterance) {
        this.utterance.onstart = null;
        this.utterance.onend = null;
        this.utterance.onerror = null;
        this.utterance = null;
      }
    }
  }

  /** Current active utterance reference */
  getActiveUtterance(): SpeechSynthesisUtterance | null {
    return this.utterance;
  }

  /** Pause speaking */
  pause(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
    }
    if (this.isSupported()) {
      window.speechSynthesis.pause();
    }
  }

  /** Resume speaking */
  resume(): void {
    if (this.currentAudio && this.currentAudio.paused) {
      this.currentAudio.play().catch(() => {});
    }
    if (this.isSupported()) {
      window.speechSynthesis.resume();
    }
  }

  /** Check if currently speaking */
  isSpeaking(): boolean {
    const isWebAudioPlaying = this.isPlayingAudio;
    const isHtml5AudioPlaying = Boolean(this.currentAudio && !this.currentAudio.paused && !this.currentAudio.ended);
    const isWebSpeechSpeaking = Boolean(this.isSupported() && this.utterance && window.speechSynthesis.speaking && !window.speechSynthesis.paused);
    return isWebAudioPlaying || isHtml5AudioPlaying || isWebSpeechSpeaking;
  }

  /** Check if speech is currently paused */
  isPaused(): boolean {
    if (this.currentAudio) return this.currentAudio.paused;
    if (!this.isSupported()) return false;
    return window.speechSynthesis.paused;
  }
}

export const speechService = new SpeechService();

// Prime Web Audio API on the very first user interaction anywhere in the tab
if (typeof window !== 'undefined') {
  const primeAudioContext = () => {
    speechService.unlockAudio();
    ['click', 'pointerdown', 'keydown', 'touchstart'].forEach((evt) => {
      window.removeEventListener(evt, primeAudioContext, true);
    });
  };
  ['click', 'pointerdown', 'keydown', 'touchstart'].forEach((evt) => {
    window.addEventListener(evt, primeAudioContext, { capture: true, passive: true });
  });
}
