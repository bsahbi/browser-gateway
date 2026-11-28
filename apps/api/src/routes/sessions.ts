/**
 * Session Routes
 * 
 * REST endpoints for browser session management:
 * - Create/close/extend sessions
 * - Execute session commands
 * - Manage profiles
 * - View history
 */

import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  createSession,
  getSession,
  closeSession,
  extendSession,
  listSessions,
  recordAction,
  getActions,
  recordNavigation,
  getNavigationHistory,
  createProfile,
  getProfile,
  listProfiles,
  updateProfile,
  deleteProfile,
  SessionStatus,
  SessionCommandSchema,
} from '@browser-gateway/session-manager';

const router = express.Router();

// ============================================
// Authentication Middleware
// ============================================

interface AuthenticatedRequest extends Request {
  tenantId?: string;
}

function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  // In production, verify API key or session token
  // For now, extract from header or use default
  const authHeader = req.headers.authorization;
  
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // In production: validate token and extract tenantId
    req.tenantId = token || 'default';
  } else {
    req.tenantId = 'default';
  }
  
  next();
}

router.use(requireAuth);

// ============================================
// Session Routes
// ============================================

// POST /sessions - Create session
const CreateSessionSchema = z.object({
  provider: z.string(),
  profileId: z.string().uuid().optional(),
  ttlMinutes: z.number().int().positive().optional(),
});

router.post('/sessions', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { provider, profileId, ttlMinutes } = CreateSessionSchema.parse(req.body);
    const session = createSession(
      req.tenantId!,
      provider,
      profileId,
      ttlMinutes
    );
    res.status(201).json(session);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to create session' });
    }
  }
});

// GET /sessions - List sessions
router.get('/sessions', (req: AuthenticatedRequest, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status as SessionStatus : undefined;
  const sessions = listSessions(req.tenantId!, status);
  res.json(sessions);
});

// GET /sessions/:id - Get session
router.get('/sessions/:id', (req: AuthenticatedRequest, res: Response) => {
  const session = getSession(req.params.id as string);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json(session);
});

// POST /sessions/:id/close - Close session
router.post('/sessions/:id/close', (req: AuthenticatedRequest, res: Response) => {
  const session = closeSession(req.params.id as string);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json(session);
});

// POST /sessions/:id/extend - Extend session
const ExtendSessionSchema = z.object({
  minutes: z.number().int().positive(),
});

router.post('/sessions/:id/extend', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { minutes } = ExtendSessionSchema.parse(req.body);
    const session = extendSession(req.params.id as string, minutes);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json(session);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to extend session' });
    }
  }
});

// ============================================
// Session Actions
// ============================================

// GET /sessions/:id/actions - Get session actions
router.get('/sessions/:id/actions', (req: AuthenticatedRequest, res: Response) => {
  const limitParam = req.query.limit;
  const limit = parseInt(typeof limitParam === 'string' ? limitParam : '50') || 50;
  const actions = getActions(req.params.id as string, limit);
  res.json(actions);
});

// POST /sessions/:id/navigate - Navigate session
const NavigateSchema = z.object({
  url: z.string().url(),
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional(),
  timeout: z.number().int().positive().optional(),
});

router.post('/sessions/:id/navigate', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { url, waitUntil, timeout } = NavigateSchema.parse(req.body);
    
    // Record navigation action
    const action = recordAction(req.params.id as string, {
      type: 'navigate',
      payload: { url, waitUntil, timeout },
    });

    if (!action) {
      res.status(400).json({ error: 'Session not active or action limit reached' });
      return;
    }

    // Record navigation state
    recordNavigation(req.params.id as string, {
      url,
      title: 'Loading...',
    });

    res.json({ action, message: 'Navigation queued' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.errors });
    } else {
      res.status(500).json({ error: 'Navigation failed' });
    }
  }
});

// POST /sessions/:id/click - Click element
const ClickSchema = z.object({
  selector: z.string(),
  timeout: z.number().int().positive().optional(),
});

router.post('/sessions/:id/click', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { selector, timeout } = ClickSchema.parse(req.body);
    
    const action = recordAction(req.params.id as string, {
      type: 'click',
      payload: { selector, timeout },
    });

    if (!action) {
      res.status(400).json({ error: 'Session not active or action limit reached' });
      return;
    }

    res.json({ action });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.errors });
    } else {
      res.status(500).json({ error: 'Click failed' });
    }
  }
});

// POST /sessions/:id/screenshot - Take screenshot
const ScreenshotSchema = z.object({
  fullPage: z.boolean().optional(),
  type: z.enum(['png', 'jpeg']).optional(),
  quality: z.number().int().min(0).max(100).optional(),
});

router.post('/sessions/:id/screenshot', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fullPage, type, quality } = ScreenshotSchema.parse(req.body);
    
    const action = recordAction(req.params.id as string, {
      type: 'screenshot',
      payload: { fullPage, type, quality },
    });

    if (!action) {
      res.status(400).json({ error: 'Session not active or action limit reached' });
      return;
    }

    res.json({ action });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.errors });
    } else {
      res.status(500).json({ error: 'Screenshot failed' });
    }
  }
});

// GET /sessions/:id/history - Get navigation history
router.get('/sessions/:id/history', (req: AuthenticatedRequest, res: Response) => {
  const history = getNavigationHistory(req.params.id as string);
  res.json(history);
});

// ============================================
// Profile Routes
// ============================================

// POST /profiles - Create profile
const CreateProfileSchema = z.object({
  name: z.string().min(1).max(255),
  userAgent: z.string().optional(),
  viewport: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }).optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
});

router.post('/profiles', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, userAgent, viewport, timezone, locale } = CreateProfileSchema.parse(req.body);
    const profile = createProfile(req.tenantId!, name, {
      userAgent,
      viewport,
      timezone,
      locale,
    });
    res.status(201).json(profile);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to create profile' });
    }
  }
});

// GET /profiles - List profiles
router.get('/profiles', (req: AuthenticatedRequest, res: Response) => {
  const profiles = listProfiles(req.tenantId!);
  res.json(profiles);
});

// GET /profiles/:id - Get profile
router.get('/profiles/:id', (req: AuthenticatedRequest, res: Response) => {
  const profile = getProfile(req.params.id as string);
  if (!profile) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }
  res.json(profile);
});

// PATCH /profiles/:id - Update profile
router.patch('/profiles/:id', (req: AuthenticatedRequest, res: Response) => {
  const profile = updateProfile(req.params.id as string, req.body);
  if (!profile) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }
  res.json(profile);
});

// DELETE /profiles/:id - Delete profile
router.delete('/profiles/:id', (req: AuthenticatedRequest, res: Response) => {
  const deleted = deleteProfile(req.params.id as string);
  if (!deleted) {
    res.status(404).json({ error: 'Profile not found' });
    return;
  }
  res.status(204).send();
});

export default router;
