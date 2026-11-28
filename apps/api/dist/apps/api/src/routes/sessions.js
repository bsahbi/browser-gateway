"use strict";
/**
 * Session Routes
 *
 * REST endpoints for browser session management:
 * - Create/close/extend sessions
 * - Execute session commands
 * - Manage profiles
 * - View history
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const session_manager_1 = require("@browser-gateway/session-manager");
const router = express_1.default.Router();
function requireAuth(req, res, next) {
    // In production, verify API key or session token
    // For now, extract from header or use default
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        // In production: validate token and extract tenantId
        req.tenantId = token || 'default';
    }
    else {
        req.tenantId = 'default';
    }
    next();
}
router.use(requireAuth);
// ============================================
// Session Routes
// ============================================
// POST /sessions - Create session
const CreateSessionSchema = zod_1.z.object({
    provider: zod_1.z.string(),
    profileId: zod_1.z.string().uuid().optional(),
    ttlMinutes: zod_1.z.number().int().positive().optional(),
});
router.post('/sessions', (req, res) => {
    try {
        const { provider, profileId, ttlMinutes } = CreateSessionSchema.parse(req.body);
        const session = (0, session_manager_1.createSession)(req.tenantId, provider, profileId, ttlMinutes);
        res.status(201).json(session);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'Invalid request', details: error.errors });
        }
        else {
            res.status(500).json({ error: 'Failed to create session' });
        }
    }
});
// GET /sessions - List sessions
router.get('/sessions', (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const sessions = (0, session_manager_1.listSessions)(req.tenantId, status);
    res.json(sessions);
});
// GET /sessions/:id - Get session
router.get('/sessions/:id', (req, res) => {
    const session = (0, session_manager_1.getSession)(req.params.id);
    if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
    }
    res.json(session);
});
// POST /sessions/:id/close - Close session
router.post('/sessions/:id/close', (req, res) => {
    const session = (0, session_manager_1.closeSession)(req.params.id);
    if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
    }
    res.json(session);
});
// POST /sessions/:id/extend - Extend session
const ExtendSessionSchema = zod_1.z.object({
    minutes: zod_1.z.number().int().positive(),
});
router.post('/sessions/:id/extend', (req, res) => {
    try {
        const { minutes } = ExtendSessionSchema.parse(req.body);
        const session = (0, session_manager_1.extendSession)(req.params.id, minutes);
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }
        res.json(session);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'Invalid request', details: error.errors });
        }
        else {
            res.status(500).json({ error: 'Failed to extend session' });
        }
    }
});
// ============================================
// Session Actions
// ============================================
// GET /sessions/:id/actions - Get session actions
router.get('/sessions/:id/actions', (req, res) => {
    const limitParam = req.query.limit;
    const limit = parseInt(typeof limitParam === 'string' ? limitParam : '50') || 50;
    const actions = (0, session_manager_1.getActions)(req.params.id, limit);
    res.json(actions);
});
// POST /sessions/:id/navigate - Navigate session
const NavigateSchema = zod_1.z.object({
    url: zod_1.z.string().url(),
    waitUntil: zod_1.z.enum(['load', 'domcontentloaded', 'networkidle']).optional(),
    timeout: zod_1.z.number().int().positive().optional(),
});
router.post('/sessions/:id/navigate', (req, res) => {
    try {
        const { url, waitUntil, timeout } = NavigateSchema.parse(req.body);
        // Record navigation action
        const action = (0, session_manager_1.recordAction)(req.params.id, {
            type: 'navigate',
            payload: { url, waitUntil, timeout },
        });
        if (!action) {
            res.status(400).json({ error: 'Session not active or action limit reached' });
            return;
        }
        // Record navigation state
        (0, session_manager_1.recordNavigation)(req.params.id, {
            url,
            title: 'Loading...',
        });
        res.json({ action, message: 'Navigation queued' });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'Invalid request', details: error.errors });
        }
        else {
            res.status(500).json({ error: 'Navigation failed' });
        }
    }
});
// POST /sessions/:id/click - Click element
const ClickSchema = zod_1.z.object({
    selector: zod_1.z.string(),
    timeout: zod_1.z.number().int().positive().optional(),
});
router.post('/sessions/:id/click', (req, res) => {
    try {
        const { selector, timeout } = ClickSchema.parse(req.body);
        const action = (0, session_manager_1.recordAction)(req.params.id, {
            type: 'click',
            payload: { selector, timeout },
        });
        if (!action) {
            res.status(400).json({ error: 'Session not active or action limit reached' });
            return;
        }
        res.json({ action });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'Invalid request', details: error.errors });
        }
        else {
            res.status(500).json({ error: 'Click failed' });
        }
    }
});
// POST /sessions/:id/screenshot - Take screenshot
const ScreenshotSchema = zod_1.z.object({
    fullPage: zod_1.z.boolean().optional(),
    type: zod_1.z.enum(['png', 'jpeg']).optional(),
    quality: zod_1.z.number().int().min(0).max(100).optional(),
});
router.post('/sessions/:id/screenshot', (req, res) => {
    try {
        const { fullPage, type, quality } = ScreenshotSchema.parse(req.body);
        const action = (0, session_manager_1.recordAction)(req.params.id, {
            type: 'screenshot',
            payload: { fullPage, type, quality },
        });
        if (!action) {
            res.status(400).json({ error: 'Session not active or action limit reached' });
            return;
        }
        res.json({ action });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'Invalid request', details: error.errors });
        }
        else {
            res.status(500).json({ error: 'Screenshot failed' });
        }
    }
});
// GET /sessions/:id/history - Get navigation history
router.get('/sessions/:id/history', (req, res) => {
    const history = (0, session_manager_1.getNavigationHistory)(req.params.id);
    res.json(history);
});
// ============================================
// Profile Routes
// ============================================
// POST /profiles - Create profile
const CreateProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    userAgent: zod_1.z.string().optional(),
    viewport: zod_1.z.object({
        width: zod_1.z.number().int().positive(),
        height: zod_1.z.number().int().positive(),
    }).optional(),
    timezone: zod_1.z.string().optional(),
    locale: zod_1.z.string().optional(),
});
router.post('/profiles', (req, res) => {
    try {
        const { name, userAgent, viewport, timezone, locale } = CreateProfileSchema.parse(req.body);
        const profile = (0, session_manager_1.createProfile)(req.tenantId, name, {
            userAgent,
            viewport,
            timezone,
            locale,
        });
        res.status(201).json(profile);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'Invalid request', details: error.errors });
        }
        else {
            res.status(500).json({ error: 'Failed to create profile' });
        }
    }
});
// GET /profiles - List profiles
router.get('/profiles', (req, res) => {
    const profiles = (0, session_manager_1.listProfiles)(req.tenantId);
    res.json(profiles);
});
// GET /profiles/:id - Get profile
router.get('/profiles/:id', (req, res) => {
    const profile = (0, session_manager_1.getProfile)(req.params.id);
    if (!profile) {
        res.status(404).json({ error: 'Profile not found' });
        return;
    }
    res.json(profile);
});
// PATCH /profiles/:id - Update profile
router.patch('/profiles/:id', (req, res) => {
    const profile = (0, session_manager_1.updateProfile)(req.params.id, req.body);
    if (!profile) {
        res.status(404).json({ error: 'Profile not found' });
        return;
    }
    res.json(profile);
});
// DELETE /profiles/:id - Delete profile
router.delete('/profiles/:id', (req, res) => {
    const deleted = (0, session_manager_1.deleteProfile)(req.params.id);
    if (!deleted) {
        res.status(404).json({ error: 'Profile not found' });
        return;
    }
    res.status(204).send();
});
exports.default = router;
