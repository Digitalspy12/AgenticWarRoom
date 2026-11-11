// ============================================
// Auth & Nexconn Session Routes
// ============================================

import { Router, type Request, type Response } from 'express';
import { issueToken, getPublicConfig } from '../services/nexconnService.js';

const router = Router();

/**
 * GET /api/auth/config
 * Expose Nexconn App Key to the frontend
 */
router.get('/config', (_req: Request, res: Response) => {
  res.json(getPublicConfig());
});

/**
 * GET /api/auth/token?userId=...
 * Issue or retrieve a session token for the user
 */
router.get('/token', async (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || 'lead_dev';
  const name = (req.query.name as string) || userId;

  try {
    const token = await issueToken(userId, name);
    res.json({ userId, token });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Auth] Failed to get token for ${userId}:`, msg);
    res.status(500).json({ error: msg });
  }
});

export default router;

