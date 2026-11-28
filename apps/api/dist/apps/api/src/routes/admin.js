"use strict";
/**
 * Admin API Routes
 *
 * REST endpoints for tenant administration:
 * - Tenant CRUD
 * - User management
 * - API key management
 * - Plan assignment
 * - Usage reporting
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const control_plane_1 = require("@browser-gateway/control-plane");
const router = express_1.default.Router();
async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    // Check for API key
    if (authHeader.startsWith('Bearer ')) {
        const key = authHeader.substring(7);
        const apiKey = await (0, control_plane_1.authenticateAPIKey)(key);
        if (!apiKey) {
            res.status(401).json({ error: 'Invalid or expired API key' });
            return;
        }
        req.apiKey = key;
        req.tenantId = apiKey.tenantId;
        next();
        return;
    }
    // Check for session token (simplified - in production use JWT)
    if (authHeader.startsWith('Bearer session-')) {
        const userId = authHeader.substring(15);
        const user = (0, control_plane_1.getUser)(userId);
        if (!user || user.status !== 'active') {
            res.status(401).json({ error: 'Invalid session' });
            return;
        }
        req.userId = userId;
        req.tenantId = userId; // For user-scoped operations
        next();
        return;
    }
    res.status(401).json({ error: 'Unsupported auth type' });
}
// ============================================
// Tenant Routes
// ============================================
// POST /admin/tenants - Create tenant
const CreateTenantSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    slug: zod_1.z.string().regex(/^[a-z0-9-]+$/),
    ownerId: zod_1.z.string().uuid(),
});
router.post('/tenants', async (req, res) => {
    try {
        const { name, slug, ownerId } = CreateTenantSchema.parse(req.body);
        const tenant = await (0, control_plane_1.createTenant)(name, slug, ownerId);
        res.status(201).json(tenant);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'Invalid request', details: error.errors });
        }
        else {
            res.status(500).json({ error: 'Failed to create tenant' });
        }
    }
});
// GET /admin/tenants/:id - Get tenant
router.get('/tenants/:id', async (req, res) => {
    const tenant = (0, control_plane_1.getTenant)(req.params.id);
    if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
    }
    res.json(tenant);
});
// PATCH /admin/tenants/:id - Update tenant
router.patch('/tenants/:id', async (req, res) => {
    try {
        const tenant = await (0, control_plane_1.updateTenant)(req.params.id, req.body);
        res.json(tenant);
    }
    catch (error) {
        res.status(404).json({ error: 'Tenant not found' });
    }
});
// POST /admin/tenants/:id/suspend - Suspend tenant
router.post('/tenants/:id/suspend', async (req, res) => {
    try {
        const tenant = await (0, control_plane_1.suspendTenant)(req.params.id, req.userId || 'system');
        res.json(tenant);
    }
    catch (error) {
        res.status(404).json({ error: 'Tenant not found' });
    }
});
// ============================================
// User Routes
// ============================================
// POST /admin/users - Create user
const CreateUserSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    name: zod_1.z.string().min(1).max(255),
});
router.post('/users', async (req, res) => {
    try {
        const { email, password, name } = CreateUserSchema.parse(req.body);
        const user = await (0, control_plane_1.createUser)(email, password, name);
        // Don't return password hash
        res.status(201).json({ id: user.id, email: user.email, name: user.name });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'Invalid request', details: error.errors });
        }
        else {
            res.status(500).json({ error: 'Failed to create user' });
        }
    }
});
// POST /admin/users/login - Authenticate user
const LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string(),
});
router.post('/users/login', async (req, res) => {
    try {
        const { email, password } = LoginSchema.parse(req.body);
        const user = await (0, control_plane_1.authenticateUser)(email, password);
        if (!user) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        // Return session token (simplified)
        res.json({
            token: `session-${user.id}`,
            user: { id: user.id, email: user.email, name: user.name },
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'Invalid request', details: error.errors });
        }
        else {
            res.status(500).json({ error: 'Login failed' });
        }
    }
});
// ============================================
// Membership Routes
// ============================================
// GET /admin/tenants/:tenantId/members - List members
router.get('/tenants/:tenantId/members', async (req, res) => {
    const members = (0, control_plane_1.getTenantMembers)(req.params.tenantId);
    res.json(members);
});
// POST /admin/tenants/:tenantId/members - Add member
const AddMemberSchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
    role: zod_1.z.enum(['owner', 'admin', 'member', 'viewer']),
});
router.post('/tenants/:tenantId/members', async (req, res) => {
    try {
        const { userId, role } = AddMemberSchema.parse(req.body);
        const membership = await (0, control_plane_1.createMembership)(req.params.tenantId, userId, role);
        res.status(201).json(membership);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'Invalid request', details: error.errors });
        }
        else {
            res.status(500).json({ error: 'Failed to add member' });
        }
    }
});
// ============================================
// API Key Routes
// ============================================
// GET /admin/tenants/:tenantId/api-keys - List API keys
router.get('/tenants/:tenantId/api-keys', async (req, res) => {
    const keys = (0, control_plane_1.getAPIKeys)(req.params.tenantId);
    // Don't return full keys, just metadata
    const safeKeys = keys.map((k) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        scopes: k.scopes,
        expiresAt: k.expiresAt,
        revokedAt: k.revokedAt,
        lastUsedAt: k.lastUsedAt,
        createdAt: k.createdAt,
    }));
    res.json(safeKeys);
});
// POST /admin/tenants/:tenantId/api-keys - Create API key
const CreateAPIKeySchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    scopes: zod_1.z.array(zod_1.z.string()).optional(),
});
router.post('/tenants/:tenantId/api-keys', async (req, res) => {
    try {
        const { name, scopes } = CreateAPIKeySchema.parse(req.body);
        const result = await (0, control_plane_1.createAPIKey)(req.params.tenantId, name, req.userId || 'system', scopes);
        res.status(201).json(result);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'Invalid request', details: error.errors });
        }
        else {
            res.status(500).json({ error: 'Failed to create API key' });
        }
    }
});
// DELETE /admin/api-keys/:id - Revoke API key
router.delete('/api-keys/:id', async (req, res) => {
    try {
        await (0, control_plane_1.revokeAPIKey)(req.params.id, req.userId || 'system');
        res.status(204).send();
    }
    catch (error) {
        res.status(404).json({ error: 'API key not found' });
    }
});
// ============================================
// Plan Routes
// ============================================
// POST /admin/plans - Create plan
const CreatePlanSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    slug: zod_1.z.string().regex(/^[a-z0-9-]+$/),
    description: zod_1.z.string().optional(),
    priceCents: zod_1.z.number().int().nonnegative(),
    currency: zod_1.z.string().length(3).default('USD'),
    billingPeriod: zod_1.z.enum(['monthly', 'yearly', 'one-time']),
    features: zod_1.z.record(zod_1.z.boolean()),
    quotas: zod_1.z.record(zod_1.z.number()),
    active: zod_1.z.boolean().default(true),
});
router.post('/plans', async (req, res) => {
    try {
        const plan = (0, control_plane_1.createPlan)(CreatePlanSchema.parse(req.body));
        res.status(201).json(plan);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'Invalid request', details: error.errors });
        }
        else {
            res.status(500).json({ error: 'Failed to create plan' });
        }
    }
});
// GET /admin/plans - List plans
router.get('/plans', async (req, res) => {
    const allPlans = Array.from(new Map(globalThis.plans?.entries()).values());
    res.json(allPlans);
});
// POST /admin/tenants/:tenantId/plan - Assign plan to tenant
const AssignPlanSchema = zod_1.z.object({
    planId: zod_1.z.string().uuid(),
});
router.post('/tenants/:tenantId/plan', async (req, res) => {
    try {
        const { planId } = AssignPlanSchema.parse(req.body);
        const tenantPlan = (0, control_plane_1.assignPlan)(req.params.tenantId, planId);
        res.status(201).json(tenantPlan);
    }
    catch (error) {
        res.status(400).json({ error: 'Failed to assign plan' });
    }
});
// GET /admin/tenants/:tenantId/plan - Get tenant's plan
router.get('/tenants/:tenantId/plan', async (req, res) => {
    const tenantPlan = (0, control_plane_1.getTenantPlan)(req.params.tenantId);
    if (!tenantPlan) {
        res.status(404).json({ error: 'No plan assigned' });
        return;
    }
    res.json(tenantPlan);
});
// ============================================
// Usage Routes
// ============================================
// GET /tenants/:tenantId/usage - Get usage report
router.get('/tenants/:tenantId/usage', async (req, res) => {
    const startDateParam = req.query.startDate;
    const startDate = typeof startDateParam === 'string'
        ? new Date(startDateParam)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
    const totals = (0, control_plane_1.calculateUsageTotals)(req.params.tenantId, startDate);
    const events = (0, control_plane_1.getUsageEvents)(req.params.tenantId, startDate);
    res.json({
        period: {
            start: startDate.toISOString(),
            end: new Date().toISOString(),
        },
        totals,
        events: events.slice(-50), // Last 50 events
    });
});
// ============================================
// Provider Routes
// ============================================
// GET /admin/providers - List provider configs
router.get('/providers', async (req, res) => {
    const providers = (0, control_plane_1.getProviderConfigs)();
    res.json(providers);
});
// POST /admin/providers - Create provider config
const CreateProviderSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    type: zod_1.z.enum(['firecrawl', 'http', 'playwright', 'custom']),
    enabled: zod_1.z.boolean().default(true),
    config: zod_1.z.record(zod_1.z.unknown()),
    capabilities: zod_1.z.array(zod_1.z.string()),
    limits: zod_1.z.object({
        maxConcurrentJobs: zod_1.z.number().int().nonnegative(),
        maxPagesPerCrawl: zod_1.z.number().int().nonnegative(),
        maxTimeoutSeconds: zod_1.z.number().int().nonnegative(),
    }),
    healthCheckUrl: zod_1.z.string().url().optional(),
});
router.post('/providers', async (req, res) => {
    try {
        const provider = (0, control_plane_1.createProviderConfig)(CreateProviderSchema.parse(req.body));
        res.status(201).json(provider);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: 'Invalid request', details: error.errors });
        }
        else {
            res.status(500).json({ error: 'Failed to create provider' });
        }
    }
});
// PATCH /admin/providers/:id - Update provider config
router.patch('/providers/:id', async (req, res) => {
    try {
        const provider = (0, control_plane_1.updateProviderConfig)(req.params.id, req.body);
        res.json(provider);
    }
    catch (error) {
        res.status(404).json({ error: 'Provider not found' });
    }
});
// ============================================
// Audit Routes
// ============================================
// GET /admin/tenants/:tenantId/audit - Get audit log
router.get('/tenants/:tenantId/audit', async (req, res) => {
    const limitParam = req.query.limit;
    const limit = Math.min(parseInt(typeof limitParam === 'string' ? limitParam : '100') || 100, 500);
    const events = (0, control_plane_1.getAuditEvents)(req.params.tenantId, limit);
    res.json(events);
});
exports.default = router;
