// ============================================
// Audio Briefing Pill — Executive Voice Debrief Player
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { speechService, generateBriefingScript } from '../lib/speechService';
import type { Incident } from '../lib/types';

interface AudioBriefingPillProps {
  incident: Incident | null;
  autoPlayOnResolved?: boolean;
}

export function AudioBriefingPill({ incident }: AudioBriefingPillProps) {
  const [isPlaying, setIsPlaying] = useState(() => speechService.isSpeaking());
  const [showSubtitle, setShowSubtitle] = useState(false);

  // Sync isPlaying across multiple components via SpeechService subscription
  useEffect(() => {
    return speechService.subscribe((playing) => {
      setIsPlaying(playing);
    });
  }, []);

  const scriptText =
    incident && incident.status === 'RESOLVED' ? generateBriefingScript(incident) : '';

  const handleToggle = useCallback(() => {
    if (!incident || incident.status !== 'RESOLVED') return;

    if (speechService.isSpeaking()) {
      speechService.stop();
    } else {
      setShowSubtitle(true);
      speechService.playBriefing(incident);
    }
  }, [incident]);

  if (!incident || incident.status !== 'RESOLVED') {
    return null;
  }

  return (
    <div className="relative inline-flex items-center">
      <div className="flex items-center gap-1.5 bg-[#0b1329] border border-blue-500/40 hover:border-blue-500/70 px-2.5 py-1 rounded-xl shadow-lg shadow-blue-950/40 text-xs font-sans transition">
        {/* Animated Waveform Equalizer */}
        <div className="flex items-end gap-[2px] h-3.5 w-4 shrink-0">
          <span
            className={`w-[2px] bg-blue-400 rounded-full transition-all duration-150 ${
              isPlaying ? 'h-3.5 animate-pulse' : 'h-1.5 opacity-50'
            }`}
          />
          <span
            className={`w-[2px] bg-emerald-400 rounded-full transition-all duration-150 delay-75 ${
              isPlaying ? 'h-2 animate-bounce' : 'h-2 opacity-50'
            }`}
          />
          <span
            className={`w-[2px] bg-indigo-400 rounded-full transition-all duration-150 delay-150 ${
              isPlaying ? 'h-3 animate-pulse' : 'h-1 opacity-50'
            }`}
          />
          <span
            className={`w-[2px] bg-teal-400 rounded-full transition-all duration-150 ${
              isPlaying ? 'h-2.5 animate-bounce' : 'h-2 opacity-50'
            }`}
          />
        </div>

        {/* Play / Stop Button */}
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-1.5 font-bold text-[11px] text-blue-300 hover:text-white transition cursor-pointer select-none active:scale-95"
          title="Play synthesized audio debrief"
        >
          <span>{isPlaying ? '■' : '▶'}</span>
          <span>{isPlaying ? 'Stop Voice' : 'Voice Debrief'}</span>
        </button>

        {/* Subtitle Toggle */}
        <button
          type="button"
          onClick={() => setShowSubtitle((v) => !v)}
          className={`text-[9px] font-mono px-1.5 py-0.5 rounded transition cursor-pointer ${
            showSubtitle ? 'bg-blue-500/30 text-blue-200' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle transcript text"
        >
          TXT
        </button>
      </div>

      {/* Floating Transcript Bubble when toggled or playing */}
      {showSubtitle && scriptText && (
        <div className="absolute left-0 top-full mt-2 w-80 max-w-sm bg-[#080d19]/98 border border-blue-500/40 rounded-xl p-3 shadow-2xl shadow-black/90 backdrop-blur-md z-50 text-slate-200 text-xs space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between text-[10px] font-mono text-blue-400 font-bold border-b border-white/[0.08] pb-1">
            <span className="flex items-center gap-1">
              <span>🎙️</span>
              <span>EXECUTIVE VERBAL DEBRIEF</span>
            </span>
            <button
              type="button"
              onClick={() => setShowSubtitle(false)}
              className="text-slate-400 hover:text-white cursor-pointer px-1"
            >
              ✕
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-200 font-sans">
            &ldquo;{scriptText}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
