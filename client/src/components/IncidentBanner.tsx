// ============================================
// Incident Banner — Cockpit Navigation & Status Bar
// ============================================

import { useState, useEffect, useRef } from 'react';
import { CURRENT_USER_ID, WARROOM_USERS, setSessionUserId } from '../lib/constants';
import { inviteResponder } from '../lib/api';
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
    gradient: 'from-indigo-500 to-purple-500',
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
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
            </span>
            CRITICAL OUTAGE
          </span>
        );
      case 'DIAGNOSING':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
            <span className="animate-spin h-2 w-2 border-2 border-sky-400 border-t-transparent rounded-full" />
            AI DIAGNOSING
          </span>
        );
      case 'AWAITING_APPROVAL':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            AWAITING APPROVAL
          </span>
        );
      case 'MITIGATING':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
            <span className="animate-pulse h-2 w-2 rounded-full bg-indigo-400" />
            MITIGATING FIX
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            RESOLVED
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <header className="h-14 bg-[#0a0f1d]/90 backdrop-blur-md border-b border-white/[0.08] px-4 flex items-center justify-between z-20 shrink-0">
      {/* Brand & Workspace title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-black text-sm">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm tracking-tight bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent">
                AGENTIC WARROOM
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                v2.0
              </span>
            </div>
            <p className="text-[10px] text-slate-400 -mt-0.5">Real-time SRE Incident Triage</p>
          </div>
        </div>

        {incident && (
          <>
            <div className="h-5 w-px bg-white/[0.08] hidden md:block" />
            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-300">
              <span className="font-mono text-slate-500">#{incident.id}</span>
              <span className="text-slate-400 font-medium truncate max-w-[280px]">
                {incident.title}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Center Status / MTTR Stopwatch */}
      <div className="flex items-center gap-3">
        {incident ? (
          <div className="flex items-center gap-2.5 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-white/[0.06] shadow-inner">
            {/* Severity Chip */}
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                incident.severity === 'SEV-1'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}
            >
              {incident.severity}
            </span>

            {/* Dynamic Status Pill */}
            {getStatusBadge()}

            {/* Digital MTTR Stopwatch */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-white/[0.08]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">MTTR</span>
              <span className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${
                incident.status === 'RESOLVED'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-slate-800 text-amber-400'
              }`}>
                {formatTime(elapsed)}
              </span>
            </div>

            {/* Page Responder CTA */}
            <button
              type="button"
              onClick={handlePageResponder}
              disabled={paging}
              className="flex items-center gap-1.5 ml-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/35 text-[11px] font-bold transition cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
              title={`Page @${nextUser.id} & share direct War Room invite`}
            >
              <span>📟</span>
              <span>
                {paging ? 'Paging...' : `+ Page @${nextUser.id}`}
              </span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-white/[0.06]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
            <span className="font-medium text-slate-300">Cockpit Ready</span>
            <span className="text-[11px] text-slate-500">• Systems Nominal</span>
          </div>
        )}
      </div>

      {/* Right Telemetry & Presence */}
      <div className="flex items-center gap-3">
        {/* LLM Status pill */}
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] bg-slate-900/60 px-2.5 py-1 rounded-lg border border-white/[0.06] font-mono">
          <span className={`w-1.5 h-1.5 rounded-full ${
            connectionStatus === 'connected' ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-rose-400'
          }`} />
          <span className="text-slate-400">Groq:</span>
          <span className="text-slate-200 font-semibold">
            {llmLatency ? `${llmLatency}ms` : 'ready'}
          </span>
        </div>

        {/* Nexconn status & Kicked warning */}
        {nexconnStatus === 'kicked' ? (
          <div
            className="flex items-center gap-1.5 text-[11px] bg-rose-500/20 border border-rose-500/40 text-rose-300 px-2.5 py-1 rounded-lg animate-pulse"
            title="Another tab connected with this same userId"
          >
            <span>⚠️</span>
            <span className="font-bold">Socket Dropped</span>
            <span className="hidden lg:inline text-rose-400/80">(kick: same user in 2 tabs)</span>
          </div>
        ) : nexconnStatus === 'disconnected' ? (
          <div className="flex items-center gap-1.5 text-[11px] bg-amber-500/15 border border-amber-500/30 text-amber-300 px-2.5 py-1 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Reconnecting...</span>
          </div>
        ) : (
          <div className="hidden md:flex items-center gap-1.5 text-[11px] bg-blue-950/30 px-2.5 py-1 rounded-lg border border-blue-500/20 text-blue-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
            <span className="font-medium">Nexconn IM</span>
          </div>
        )}

        {/* Current user chip & Interactive Roster Switcher */}
        <div className="relative pl-2 border-l border-white/[0.08]" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setShowUserMenu((v) => !v)}
            className="flex items-center gap-2 px-2 py-1 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition cursor-pointer select-none"
            title="Click to switch persona or launch dedicated tab"
          >
            <div
              className={`w-7 h-7 rounded-full bg-gradient-to-tr ${currentUser.gradient} flex items-center justify-center text-[11px] font-bold text-white shadow`}
            >
              {currentUser.initials}
            </div>
            <div className="hidden xl:block text-left">
              <div className="text-xs font-semibold text-slate-200 flex items-center gap-1">
                <span>@{currentUser.id}</span>
                <span className="text-[10px] text-slate-400">▾</span>
              </div>
              <div className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                {currentUser.role}
              </div>
            </div>
          </button>

          {/* Mini Window — Persona Selector & Multi-Tab Launcher */}
          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-[#0c1222]/98 backdrop-blur-xl border border-white/[0.12] rounded-2xl shadow-2xl shadow-black/90 p-3 z-50 text-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.08]">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">👥</span>
                  <span className="text-xs font-bold text-slate-100">War Room Personas</span>
                </div>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 font-bold border border-blue-500/25">
                  {WARROOM_USERS.length} Roles
                </span>
              </div>

              <div className="space-y-1.5">
                {WARROOM_USERS.map((user) => {
                  const isActive = user.id === CURRENT_USER_ID;
                  return (
                    <div
                      key={user.id}
                      className={`p-2 rounded-xl transition flex items-center justify-between gap-2 border ${
                        isActive
                          ? 'bg-blue-500/10 border-blue-500/40 shadow-inner shadow-blue-500/10'
                          : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.06]'
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
                        <div
                          className={`w-7 h-7 rounded-full bg-gradient-to-tr ${user.gradient} flex items-center justify-center text-[11px] font-black text-white shrink-0 shadow`}
                        >
                          {user.initials}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                            <span className="truncate">{user.name}</span>
                            {isActive && (
                              <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                            <span>@{user.id}</span>
                            <span>•</span>
                            <span className="text-indigo-400 font-semibold">{user.role}</span>
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
                        className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.12] text-slate-400 hover:text-white text-[11px] transition cursor-pointer"
                        title={`Open new browser tab as @${user.id}`}
                      >
                        ↗
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2.5 pt-2 border-t border-white/[0.06] text-[10px] text-slate-400 text-center flex items-center justify-center gap-1.5">
                <span>Click role to switch, or</span>
                <span className="font-mono text-indigo-300 font-bold">↗</span>
                <span>to open in new tab</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 1-Click Responder Invite Toast Modal */}
      {inviteToast && (
        <div className="fixed top-16 right-6 z-50 flex items-center gap-3 bg-[#0d1322]/95 border border-indigo-500/40 rounded-xl px-4 py-3 shadow-2xl shadow-black/80 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-xs font-black">
              ✓
            </span>
            <div>
              <p className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                <span>Paged @{inviteToast.target} into War Room</span>
                <span className="text-[10px] font-mono text-emerald-400 font-normal">
                  (Link Copied)
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
              className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-black transition cursor-pointer shadow shadow-emerald-500/20 flex items-center gap-1"
            >
              <span>Open Tab ↗</span>
            </button>
            <button
              type="button"
              onClick={() => setInviteToast(null)}
              className="text-slate-400 hover:text-white text-xs px-1.5 py-1 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
