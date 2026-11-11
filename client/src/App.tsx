import { useState, useEffect, useCallback } from 'react';
import { ChaosDrawer } from './components/ChaosDrawer';
import { IncidentBanner } from './components/IncidentBanner';
import { ChatPane } from './components/ChatPane';
import { TelemetryPane } from './components/TelemetryPane';
import { healthCheck } from './lib/api';
import { nexconn } from './lib/nexconnClient';
import { CURRENT_USER_ID } from './lib/constants';
import type { Incident } from './lib/types';
import './App.css';

function App() {
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [llmLatency, setLlmLatency] = useState<number | null>(null);

  // Health check & Nexconn connect on mount
  useEffect(() => {
    healthCheck()
      .then((health) => {
        setConnectionStatus(health.llm.ok ? 'connected' : 'error');
        setLlmLatency(health.llm.latencyMs);
      })
      .catch(() => setConnectionStatus('error'));

    // Connect user to Nexconn Chat
    nexconn.connect(CURRENT_USER_ID).catch((err) => {
      console.warn('[Nexconn] Connect error on start:', err);
    });
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

  // Update incident state
  const handleIncidentUpdated = useCallback((incident: Incident) => {
    setActiveIncident(incident);
    setIncidents((prev) => prev.map((i) => (i.id === incident.id ? incident : i)));
  }, []);

  return (
    <div className="h-screen flex flex-col bg-[var(--color-bg-dark)] text-[var(--color-text-primary)] overflow-hidden">
      {/* ---- Top Banner ---- */}
      <IncidentBanner
        incident={activeIncident}
        connectionStatus={connectionStatus}
        llmLatency={llmLatency}
      />

      {/* ---- 3-Pane Cockpit ---- */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane: Chaos Simulator + Incident List */}
        <div className="w-80 border-r border-white/[0.08] flex flex-col bg-[#0a0e1a]/95 shrink-0">
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
        <div className="flex-1 flex flex-col bg-[#080d19] min-w-0 min-h-0">
          <ChatPane
            incident={activeIncident}
            onIncidentUpdated={handleIncidentUpdated}
          />
        </div>

        {/* Right Pane: Telemetry & AI Reasoning */}
        <div className="w-80 border-l border-white/[0.08] bg-[#0a0f1d]/95 shrink-0 hidden lg:block">
          <TelemetryPane incident={activeIncident} />
        </div>
      </div>
    </div>
  );
}

export default App;
