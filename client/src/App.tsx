import { useState, useEffect, useCallback, useRef } from 'react';
import { ChaosDrawer } from './components/ChaosDrawer';
import { IncidentBanner } from './components/IncidentBanner';
import { ChatPane } from './components/ChatPane';
import { TelemetryPane } from './components/TelemetryPane';
import { healthCheck, getIncident, listIncidents } from './lib/api';
import { nexconn, type NexconnConnectionState } from './lib/nexconnClient';
import { CURRENT_USER_ID } from './lib/constants';
import { speechService } from './lib/speechService';
import type { Incident } from './lib/types';
import './App.css';

function App() {
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [nexconnStatus, setNexconnStatus] = useState<NexconnConnectionState>('connecting');
  const [llmLatency, setLlmLatency] = useState<number | null>(null);

  // Health check & Nexconn connect on mount
  useEffect(() => {
    healthCheck()
      .then((health) => {
        setConnectionStatus(health.llm.ok ? 'connected' : 'error');
        setLlmLatency(health.llm.latencyMs);
      })
      .catch(() => setConnectionStatus('error'));

    // Listen to real-time Nexconn connection status & kicked states
    const unsubStatus = nexconn.onConnectionStatus((state) => {
      setNexconnStatus(state);
    });

    // Connect user to Nexconn Chat
    nexconn.connect(CURRENT_USER_ID).catch((err) => {
      console.warn('[Nexconn] Connect error on start:', err);
    });

    return () => unsubStatus();
  }, []);

  // Track incident in the list
  const handleIncidentCreated = useCallback((incident: Incident) => {
    setActiveIncident(incident);
    setIncidents((prev) => {
      const exists = prev.find((i) => i.id === incident.id);
      if (exists) return prev.map((i) => (i.id === incident.id ? incident : i));
      return [incident, ...prev];
    });
  }, []);

  // Auto-load incident from URL parameter (?inc=<id>) or load existing incidents
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const incId = params.get('inc') || params.get('incident');

    if (incId) {
      getIncident(incId)
        .then((inc) => {
          handleIncidentCreated(inc);
        })
        .catch((err) => console.warn('Could not load incident from URL:', err));
    }

    listIncidents()
      .then((list) => {
        if (list && list.length > 0) {
          setIncidents((prev) => {
            const map = new Map(prev.map((i) => [i.id, i]));
            list.forEach((item) => {
              if (!map.has(item.id)) {
                map.set(item.id, item as Incident);
              }
            });
            return Array.from(map.values());
          });

          // If no URL param, load latest incident if none active
          if (!incId) {
            getIncident(list[0].id)
              .then((latest) => setActiveIncident((cur) => cur ?? latest))
              .catch(() => {});
          }
        }
      })
      .catch((err) => console.warn('Could not list incidents:', err));
  }, [handleIncidentCreated]);

  // Update incident state
  const handleIncidentUpdated = useCallback((incident: Incident) => {
    setActiveIncident(incident);
    setIncidents((prev) => prev.map((i) => (i.id === incident.id ? incident : i)));
  }, []);

  // Guaranteed top-level audio debrief auto-play on incident resolution
  const lastResolvedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeIncident && activeIncident.status === 'RESOLVED') {
      if (lastResolvedIdRef.current !== activeIncident.id) {
        lastResolvedIdRef.current = activeIncident.id;
        console.log('[WarRoom] Active incident resolved! Auto-activating executive audio briefing for:', activeIncident.id);
        speechService.playBriefing(activeIncident);
      }
    } else if (activeIncident && activeIncident.status !== 'RESOLVED') {
      lastResolvedIdRef.current = null;
    }
  }, [activeIncident]);

  return (
    <div className="h-screen flex flex-col bg-[var(--color-bg-dark)] text-[var(--color-text-primary)] overflow-hidden">
      {/* ---- Top Banner ---- */}
      <IncidentBanner
        incident={activeIncident}
        connectionStatus={connectionStatus}
        nexconnStatus={nexconnStatus}
        llmLatency={llmLatency}
      />

      {/* ---- 3-Pane Cockpit ---- */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane: Chaos Simulator + Incident List */}
        <div className="w-72 border-r border-white/[0.08] flex flex-col bg-[#0d1117] shrink-0">
          <ChaosDrawer
            onIncidentCreated={handleIncidentCreated}
            incidents={incidents}
            activeIncidentId={activeIncident?.id ?? null}
            onSelectIncident={(id) => {
              const inc = incidents.find((i) => i.id === id);
              if (inc) setActiveIncident(inc);
            }}
          />
        </div>

        {/* Center Pane: War Room Chat */}
        <div className="flex-1 flex flex-col bg-[#090d13] min-w-0 min-h-0">
          <ChatPane
            key={activeIncident?.id ?? 'empty'}
            incident={activeIncident}
            onIncidentUpdated={handleIncidentUpdated}
          />
        </div>

        {/* Right Pane: Telemetry & AI Reasoning */}
        <div className="w-80 border-l border-white/[0.08] bg-[#0d1117] shrink-0 hidden lg:block">
          <TelemetryPane incident={activeIncident} />
        </div>
      </div>
    </div>
  );
}

export default App;
