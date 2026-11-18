// ============================================
// Incident Banner — Cockpit Navigation & Status Bar
// ============================================

import { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Radio,
  AlertTriangle,
  Users,
  ExternalLink,
  X,
  Check,
} from 'lucide-react';
import { CURRENT_USER_ID, WARROOM_USERS, setSessionUserId } from '../lib/constants';
import { inviteResponder } from '../lib/api';
import { AudioBriefingPill } from './AudioBriefingPill';
import type { Incident } from '../lib/types';
import type { NexconnConnectionState } from '../lib/nexconnClient';

interface IncidentBannerProps {
  incident: Incident | null;
  connectionStatus: 'connecting' | 'connected' | 'error';
  nexconnStatus?: NexconnConnectionState;
  llmLatency: number | null;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function IncidentBanner({
  incident,
  connectionStatus,
  nexconnStatus = 'connected',
  llmLatency,
}: IncidentBannerProps) {
  const [liveElapsed, setLiveElapsed] = useState(() =>
    incident && !incident.resolvedAt
      ? Math.floor((Date.now() - incident.startedAt) / 1000)
      : 0,
  );
  const [paging, setPaging] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [inviteToast, setInviteToast] = useState<{
    link: string;
    target: string;
    copied: boolean;
  } | null>(null);

  // Close mini user window on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showUserMenu]);

  const elapsed = incident?.resolvedAt
    ? (incident.mttrSeconds ?? Math.floor((incident.resolvedAt - incident.startedAt) / 1000))
    : liveElapsed;

  const currentUser = WARROOM_USERS.find((u) => u.id === CURRENT_USER_ID) || {
    id: CURRENT_USER_ID,
    name: CURRENT_USER_ID,
    role: 'Engineer',
    initials: CURRENT_USER_ID.slice(0, 2).toUpperCase(),
    gradient: 'from-slate-700 to-slate-800',
  };

  const userIdx = WARROOM_USERS.findIndex((u) => u.id === CURRENT_USER_ID);
  const nextUser = WARROOM_USERS[(userIdx >= 0 ? userIdx + 1 : 0) % WARROOM_USERS.length];

  const handlePageResponder = async () => {
    if (!incident || paging) return;
    setPaging(true);
    const targetUserId = nextUser.id;

    try {
      const res = await inviteResponder(incident.id, {
        targetUserId,
        invitedBy: CURRENT_USER_ID,
      });

      const link =
        res.inviteLink ||
        `${window.location.origin}/?inc=${incident.id}&as=${targetUserId}`;

      try {
        await navigator.clipboard.writeText(link);
      } catch {
        // clipboard might be restricted in some browsers
      }

      setInviteToast({
        link,
        target: targetUserId,
        copied: true,
      });

      setTimeout(() => {
        setInviteToast(null);
      }, 8000);
    } catch (err) {
      console.error('Failed to page responder:', err);
    } finally {
      setPaging(false);
    }
  };

  // Live MTTR timer — computed client-side from startedAt
  useEffect(() => {
    if (!incident || incident.resolvedAt) return;

    const interval = setInterval(() => {
      setLiveElapsed(Math.floor((Date.now() - incident.startedAt) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [incident]);

  const getStatusBadge = () => {
    if (!incident) return null;

    switch (incident.status) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-500/10 text-rose-300 border border-rose-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            Critical outage
          </span>
        );
      case 'DIAGNOSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-sky-500/10 text-sky-300 border border-sky-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-spin" />
            Diagnosing
          </span>
        );
      case 'AWAITING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Awaiting approval
          </span>
        );
      case 'MITIGATING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            Mitigating
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Resolved
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <header className="h-14 bg-[#11151d] border-b border-white/[0.08] px-4 flex items-center justify-between z-20 shrink-0">
      {/* Brand & Workspace title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-[#1c222e] border border-white/[0.1] flex items-center justify-center text-[#58a6ff]">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-[#f0f3f6]">
                Agentic WarRoom
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/[0.06] text-slate-400 border border-white/[0.08]">
                v2.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Autonomous incident triage</p>
          </div>
        </div>

        {incident && (
          <>
            <div className="h-4 w-px bg-white/[0.08] hidden md:block mx-1" />
            <div className="hidden lg:flex items-center gap-2 text-xs">
              <span className="font-mono text-slate-400">#{incident.id}</span>
              <span className="text-slate-300 font-medium truncate max-w-[280px]">
                {incident.title}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Center Status / MTTR Stopwatch */}
      <div className="flex items-center gap-3">
        {incident ? (
          <div className="flex items-center gap-2 bg-[#161b24] px-3 py-1 rounded-lg border border-white/[0.08]">
            {/* Severity Chip */}
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                incident.severity === 'SEV-1'
                  ? 'bg-rose-500/10 text-rose-300 border border-rose-500/25'
                  : 'bg-amber-500/10 text-amber-300 border border-amber-500/25'
              }`}
            >
              {incident.severity}
            </span>

            {/* Dynamic Status Pill */}
            {getStatusBadge()}

            {/* Digital MTTR Stopwatch */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-white/[0.08]">
              <span className="text-[10px] font-mono text-slate-400">MTTR</span>
              <span className={`font-mono text-xs tabular-nums px-1.5 py-0.5 rounded ${
                incident.status === 'RESOLVED'
                  ? 'bg-emerald-500/10 text-emerald-300'
                  : 'bg-[#1c222e] text-slate-200'
              }`}>
                {formatTime(elapsed)}
              </span>
            </div>

            {/* Context Action */}
            {incident.status === 'RESOLVED' ? (
              <div className="ml-1">
                <AudioBriefingPill incident={incident} />
              </div>
            ) : (
              <button
                type="button"
                onClick={handlePageResponder}
                disabled={paging}
                className="flex items-center gap-1.5 ml-1 px-2.5 py-1 rounded-md bg-[#1c222e] hover:bg-[#222938] text-slate-200 border border-white/[0.08] text-[11px] font-medium transition cursor-pointer disabled:opacity-50"
                title={`Page @${nextUser.id} & share direct War Room invite`}
              >
                <Radio className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {paging ? 'Paging...' : `Page @${nextUser.id}`}
                </span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-[#161b24] px-3 py-1 rounded-lg border border-white/[0.08]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-slate-300 font-medium">Cockpit ready</span>
            <span className="text-slate-400">• All systems nominal</span>
          </div>
        )}
      </div>

      {/* Right Telemetry & Presence */}
      <div className="flex items-center gap-2.5">
        {/* LLM Status pill */}
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] bg-[#161b24] px-2.5 py-1 rounded-md border border-white/[0.08] font-mono">
          <span className={`w-1.5 h-1.5 rounded-full ${
            connectionStatus === 'connected' ? 'bg-emerald-400' : 'bg-rose-400'
          }`} />
          <span className="text-slate-400">Groq:</span>
          <span className="text-slate-200 tabular-nums">
            {llmLatency ? `${llmLatency}ms` : 'ready'}
          </span>
        </div>

        {/* Nexconn status & Kicked warning */}
        {nexconnStatus === 'kicked' ? (
          <div
            className="flex items-center gap-1.5 text-[11px] bg-rose-500/10 border border-rose-500/30 text-rose-300 px-2.5 py-1 rounded-md"
            title="Another tab connected with this same userId"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span className="font-medium">Socket dropped</span>
            <span className="hidden lg:inline text-rose-300/80">(kick: same user in 2 tabs)</span>
          </div>
        ) : nexconnStatus === 'disconnected' ? (
          <div className="flex items-center gap-1.5 text-[11px] bg-amber-500/10 border border-amber-500/25 text-amber-300 px-2.5 py-1 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Reconnecting...</span>
          </div>
        ) : (
          <div className="hidden md:flex items-center gap-1.5 text-[11px] bg-[#161b24] px-2.5 py-1 rounded-md border border-white/[0.08] text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Nexconn IM</span>
          </div>
        )}

        {/* Current user chip & Interactive Roster Switcher */}
        <div className="relative pl-2 border-l border-white/[0.08]" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setShowUserMenu((v) => !v)}
            className="flex items-center gap-2 px-2 py-1 rounded-md bg-[#161b24] hover:bg-[#1c222e] border border-white/[0.08] transition cursor-pointer select-none"
            title="Click to switch persona or launch dedicated tab"
          >
            <div className="w-6 h-6 rounded bg-[#202734] border border-white/[0.1] flex items-center justify-center text-[10px] font-mono text-slate-200">
              {currentUser.initials}
            </div>
            <div className="hidden xl:block text-left">
              <div className="text-xs font-medium text-slate-200 flex items-center gap-1">
                <span>@{currentUser.id}</span>
                <span className="text-[10px] text-slate-400">▾</span>
              </div>
              <div className="text-[10px] text-slate-400">
                {currentUser.role}
              </div>
            </div>
          </button>

          {/* Mini Window — Persona Selector & Multi-Tab Launcher */}
          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-[#11151d] border border-white/[0.1] rounded-lg shadow-xl p-3 z-50 text-slate-200">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.08]">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-medium text-slate-200">War room personas</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/[0.06] text-slate-400 border border-white/[0.08]">
                  {WARROOM_USERS.length} roles
                </span>
              </div>

              <div className="space-y-1">
                {WARROOM_USERS.map((user) => {
                  const isActive = user.id === CURRENT_USER_ID;
                  return (
                    <div
                      key={user.id}
                      className={`p-2 rounded-md transition flex items-center justify-between gap-2 border ${
                        isActive
                          ? 'bg-[#1c222e] border-white/[0.14]'
                          : 'bg-transparent border-transparent hover:bg-[#161b24]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (!isActive) setSessionUserId(user.id);
                          setShowUserMenu(false);
                        }}
                        className="flex items-center gap-2.5 text-left flex-1 min-w-0 cursor-pointer"
                        title={isActive ? 'Currently active' : `Switch this tab to @${user.id}`}
                      >
                        <div className="w-6 h-6 rounded bg-[#202734] border border-white/[0.08] flex items-center justify-center text-[10px] font-mono text-slate-200 shrink-0">
                          {user.initials}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                            <span className="truncate">{user.name}</span>
                            {isActive && (
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                            <span>@{user.id}</span>
                            <span>•</span>
                            <span className="text-slate-400">{user.role}</span>
                          </div>
                        </div>
                      </button>

                      {/* Open in New Tab action */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const targetUrl = incident
                            ? `${window.location.origin}/?inc=${incident.id}&as=${user.id}`
                            : `${window.location.origin}/?as=${user.id}`;
                          window.open(targetUrl, '_blank');
                          setShowUserMenu(false);
                        }}
                        className="p-1.5 rounded-md hover:bg-white/[0.08] text-slate-400 hover:text-slate-200 transition cursor-pointer"
                        title={`Open new browser tab as @${user.id}`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 pt-2 border-t border-white/[0.08] text-[10px] text-slate-400 text-center">
                Click role to switch, or launch tab with icon
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 1-Click Responder Invite Toast Modal */}
      {inviteToast && (
        <div className="fixed top-16 right-6 z-50 flex items-center gap-3 bg-[#161b24] border border-white/[0.12] rounded-lg px-4 py-3 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <span className="w-5 h-5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 flex items-center justify-center">
              <Check className="w-3.5 h-3.5" />
            </span>
            <div>
              <p className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                <span>Paged @{inviteToast.target} into War Room</span>
                <span className="text-[10px] font-mono text-emerald-400">
                  (Link copied)
                </span>
              </p>
              <p className="text-[10px] text-slate-400 font-mono truncate max-w-[240px]">
                {inviteToast.link}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pl-2 border-l border-white/[0.08]">
            <button
              type="button"
              onClick={() => window.open(inviteToast.link, '_blank')}
              className="px-2.5 py-1 rounded-md bg-[#202734] hover:bg-[#283142] text-slate-200 text-xs font-medium transition cursor-pointer border border-white/[0.08] flex items-center gap-1"
            >
              <span>Open tab</span>
              <ExternalLink className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setInviteToast(null)}
              className="text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
