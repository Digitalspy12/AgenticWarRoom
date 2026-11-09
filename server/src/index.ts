// ============================================
// Server Entry Point
// ============================================

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from project root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import app from './app.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║        ⚡ AGENTIC WARROOM API SERVER         ║
╠══════════════════════════════════════════════╣
║  Port:      ${String(PORT).padEnd(33)}║
║  Mode:      ${(process.env.NODE_ENV || 'development').padEnd(33)}║
║  LLM URL:   ${(process.env.LLM_BASE_URL || 'not set').substring(0, 32).padEnd(33)}║
║  LLM Model: ${(process.env.LLM_MODEL || 'not set').padEnd(33)}║
╚══════════════════════════════════════════════╝
  `);
});

