// ============================================
// Audio Briefing Pill — Executive Voice Debrief Player
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { Play, Square, X, Mic } from 'lucide-react';
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
      <div className="flex items-center gap-2 bg-[#1c222e] border border-white/[0.08] hover:border-white/[0.14] px-2.5 py-1 rounded-md text-xs font-sans transition">
        {/* Monochromatic Equalizer indicator */}
        <div className="flex items-end gap-[2px] h-3 w-3 shrink-0">
          <span
            className={`w-[2px] bg-slate-300 rounded-full transition-all duration-150 ${
              isPlaying ? 'h-3 animate-pulse' : 'h-1.5 opacity-40'
            }`}
          />
          <span
            className={`w-[2px] bg-slate-300 rounded-full transition-all duration-150 delay-75 ${
              isPlaying ? 'h-2' : 'h-2 opacity-40'
            }`}
          />
          <span
            className={`w-[2px] bg-slate-300 rounded-full transition-all duration-150 delay-150 ${
              isPlaying ? 'h-2.5 animate-pulse' : 'h-1 opacity-40'
            }`}
          />
        </div>

        {/* Play / Stop Button */}
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-1.5 font-medium text-[11px] text-slate-200 hover:text-white transition cursor-pointer select-none"
          title="Play synthesized audio debrief"
        >
          {isPlaying ? <Square className="w-3 h-3 text-rose-400" /> : <Play className="w-3 h-3 text-emerald-400" />}
          <span>{isPlaying ? 'Stop briefing' : 'Voice briefing'}</span>
        </button>

        {/* Subtitle Toggle */}
        <button
          type="button"
          onClick={() => setShowSubtitle((v) => !v)}
          className={`text-[10px] font-mono px-1 py-0.2 rounded transition cursor-pointer ${
            showSubtitle ? 'bg-white/[0.1] text-slate-100' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle transcript text"
        >
          TXT
        </button>
      </div>

      {/* Floating Transcript Bubble when toggled or playing */}
      {showSubtitle && scriptText && (
        <div className="absolute left-0 top-full mt-2 w-80 max-w-sm bg-[#161b24] border border-white/[0.1] rounded-lg p-3 shadow-xl z-50 text-slate-200 text-xs space-y-1.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-b border-white/[0.08] pb-1">
            <span className="flex items-center gap-1.5">
              <Mic className="w-3 h-3 text-slate-400" />
              <span>Executive voice debrief</span>
            </span>
            <button
              type="button"
              onClick={() => setShowSubtitle(false)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-300 font-sans">
            &ldquo;{scriptText}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
