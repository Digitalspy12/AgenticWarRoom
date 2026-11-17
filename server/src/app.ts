// ============================================
// Express Application
// ============================================

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import incidentRoutes from './routes/incidents.js';
import authRoutes from './routes/auth.js';
import { healthCheck } from './services/llmRouter.js';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Lightweight keep-alive ping (zero tokens, no LLM call for UptimeRobot)
app.get('/ping', (_req, res) => {
  res.status(200).send('pong');
});

// Routes
app.use('/api/incidents', incidentRoutes);
app.use('/api/auth', authRoutes);

// LLM Health Check
app.get('/api/health', async (_req, res) => {
  const llmHealth = await healthCheck();
  res.json({
    server: 'ok',
    llm: llmHealth,
    timestamp: new Date().toISOString(),
  });
});

// Serve frontend in production, or JSON API info in development
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.json({
      name: 'Agentic WarRoom API',
      version: '1.0.0',
      endpoints: {
        ping: 'GET /ping',
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
}

export default app;

