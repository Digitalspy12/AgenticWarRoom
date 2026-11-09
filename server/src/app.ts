// ============================================
// Express Application
// ============================================

import express from 'express';
import cors from 'cors';
import incidentRoutes from './routes/incidents.js';
import { healthCheck } from './services/llmRouter.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/incidents', incidentRoutes);

// LLM Health Check
app.get('/api/health', async (_req, res) => {
  const llmHealth = await healthCheck();
  res.json({
    server: 'ok',
    llm: llmHealth,
    timestamp: new Date().toISOString(),
  });
});

// Root
app.get('/', (_req, res) => {
  res.json({
    name: 'Agentic WarRoom API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      scenarios: 'GET /api/incidents/scenarios',
      trigger: 'POST /api/incidents/trigger',
      getIncident: 'GET /api/incidents/:id',
      listIncidents: 'GET /api/incidents',
      execute: 'POST /api/incidents/:id/execute',
      reject: 'POST /api/incidents/:id/reject',
    },
  });
});

export default app;

