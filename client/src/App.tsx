import { useState, useEffect, useCallback } from 'react';
import { ChaosDrawer } from './components/ChaosDrawer';
import { IncidentBanner } from './components/IncidentBanner';
import { ChatPane } from './components/ChatPane';
import { TelemetryPane } from './components/TelemetryPane';
import { healthCheck } from './lib/api';
import type { Incident } from './lib/types';
import './App.css';

function App() {
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [llmLatency, setLlmLatency] = useState<number | null>(null);

  // Health check on mount
  useEffect(() => {
    healthCheck()
      .then((health) => {
        setConnectionStatus(health.llm.ok ? 'connected' : 'error');
        setLlmLatency(health.llm.latencyMs);
      })
      .catch(() => setConnectionStatus('error'));
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
        <div className="w-72 border-r border-[var(--color-border)] flex flex-col bg-[var(--color-bg-panel)]">
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
        <div className="flex-1 flex flex-col">
          <ChatPane
            incident={activeIncident}
            onIncidentUpdated={handleIncidentUpdated}
          />
        </div>

        {/* Right Pane: Telemetry & AI Reasoning */}
        <div className="w-80 border-l border-[var(--color-border)] bg-[var(--color-bg-panel)]">
          <TelemetryPane incident={activeIncident} />
        </div>
      </div>
    </div>
  );
}

export default App;
