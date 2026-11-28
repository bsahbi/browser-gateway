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

import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  // Tenant
  createTenant,
  getTenant,
  getTenantBySlug,
  updateTenant,
  suspendTenant,
  // User
  createUser,
  authenticateUser,
  getUser,
  // Membership
  createMembership,
  getMembership,
  getTenantMembers,
  // API Key
  createAPIKey,
  authenticateAPIKey,
  revokeAPIKey,
  getAPIKeys,
  // Plan
  createPlan,
  getPlan,
  assignPlan,
  getTenantPlan,
  // Usage
  recordUsage,
  getUsageEvents,
  calculateUsageTotals,
  // Audit
  getAuditEvents,
  // Provider
  createProviderConfig,
  getProviderConfigs,
  updateProviderConfig,
} from '@browser-gateway/control-plane';
import { ERROR_CODES, GatewayError } from '@browser-gateway/contracts';

const router = express.Router();

// ============================================
// Authentication Middleware
// ============================================

interface AuthenticatedRequest extends Request {
  tenantId?: string;
  userId?: string;
  apiKey?: string;
}

async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Check for API key
  if (authHeader.startsWith('Bearer ')) {
    const key = authHeader.substring(7);
    const apiKey = await authenticateAPIKey(key);

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
    const user = getUser(userId);

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
const CreateTenantSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  ownerId: z.string().uuid(),
});

router.post('/tenants', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, slug, ownerId } = CreateTenantSchema.parse(req.body);
    const tenant = await createTenant(name, slug, ownerId);
    res.status(201).json(tenant);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to create tenant' });
    }
  }
});

// GET /admin/tenants/:id - Get tenant
router.get('/tenants/:id', async (req: AuthenticatedRequest, res: Response) => {
  const tenant = getTenant(req.params.id as string);
  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }
  res.json(tenant);
});

// PATCH /admin/tenants/:id - Update tenant
router.patch('/tenants/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenant = await updateTenant(req.params.id as string, req.body);
    res.json(tenant);
  } catch (error) {
    res.status(404).json({ error: 'Tenant not found' });
  }
});

// POST /admin/tenants/:id/suspend - Suspend tenant
router.post('/tenants/:id/suspend', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenant = await suspendTenant(req.params.id as string, req.userId || 'system');
    res.json(tenant);
  } catch (error) {
    res.status(404).json({ error: 'Tenant not found' });
  }
});

// ============================================
// User Routes
// ============================================

// POST /admin/users - Create user
const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(255),
});

router.post('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password, name } = CreateUserSchema.parse(req.body);
    const user = await createUser(email, password, name);
    // Don't return password hash
    res.status(201).json({ id: user.id, email: user.email, name: user.name });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
});

// POST /admin/users/login - Authenticate user
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post('/users/login', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);
    const user = await authenticateUser(email, password);

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Return session token (simplified)
    res.json({
      token: `session-${user.id}`,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.errors });
    } else {
      res.status(500).json({ error: 'Login failed' });
    }
  }
});

// ============================================
// Membership Routes
// ============================================

// GET /admin/tenants/:tenantId/members - List members
router.get('/tenants/:tenantId/members', async (req: AuthenticatedRequest, res: Response) => {
  const members = getTenantMembers(req.params.tenantId as string);
  res.json(members);
});

// POST /admin/tenants/:tenantId/members - Add member
const AddMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
});

router.post('/tenants/:tenantId/members', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, role } = AddMemberSchema.parse(req.body);
    const membership = await createMembership(req.params.tenantId as string, userId, role);
    res.status(201).json(membership);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to add member' });
    }
  }
});

// ============================================
// API Key Routes
// ============================================

// GET /admin/tenants/:tenantId/api-keys - List API keys
router.get('/tenants/:tenantId/api-keys', async (req: AuthenticatedRequest, res: Response) => {
  const keys = getAPIKeys(req.params.tenantId as string);
  // Don't return full keys, just metadata
  const safeKeys = keys.map((k: any) => ({
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
const CreateAPIKeySchema = z.object({
  name: z.string().min(1).max(255),
  scopes: z.array(z.string()).optional(),
});

router.post('/tenants/:tenantId/api-keys', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, scopes } = CreateAPIKeySchema.parse(req.body);
    const result = await createAPIKey(
      req.params.tenantId as string,
      name,
      req.userId || 'system',
      scopes
    );
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to create API key' });
    }
  }
});

// DELETE /admin/api-keys/:id - Revoke API key
router.delete('/api-keys/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await revokeAPIKey(req.params.id as string, req.userId || 'system');
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: 'API key not found' });
  }
});

// ============================================
// Plan Routes
// ============================================

// POST /admin/plans - Create plan
const CreatePlanSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().length(3).default('USD'),
  billingPeriod: z.enum(['monthly', 'yearly', 'one-time']),
  features: z.record(z.boolean()),
  quotas: z.record(z.number()),
  active: z.boolean().default(true),
});

router.post('/plans', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const plan = createPlan(CreatePlanSchema.parse(req.body));
    res.status(201).json(plan);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to create plan' });
    }
  }
});

// GET /admin/plans - List plans
router.get('/plans', async (req: AuthenticatedRequest, res: Response) => {
  const allPlans = Array.from(
    new Map(
      (globalThis as any).plans?.entries()
    ).values()
  );
  res.json(allPlans);
});

// POST /admin/tenants/:tenantId/plan - Assign plan to tenant
const AssignPlanSchema = z.object({
  planId: z.string().uuid(),
});

router.post('/tenants/:tenantId/plan', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { planId } = AssignPlanSchema.parse(req.body);
    const tenantPlan = assignPlan(req.params.tenantId as string, planId);
    res.status(201).json(tenantPlan);
  } catch (error) {
    res.status(400).json({ error: 'Failed to assign plan' });
  }
});

// GET /admin/tenants/:tenantId/plan - Get tenant's plan
router.get('/tenants/:tenantId/plan', async (req: AuthenticatedRequest, res: Response) => {
  const tenantPlan = getTenantPlan(req.params.tenantId as string);
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
router.get('/tenants/:tenantId/usage', async (req: AuthenticatedRequest, res: Response) => {
  const startDateParam = req.query.startDate;
  const startDate = typeof startDateParam === 'string' 
    ? new Date(startDateParam)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days

  const totals = calculateUsageTotals(req.params.tenantId as string, startDate);
  const events = getUsageEvents(req.params.tenantId as string, startDate);

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
router.get('/providers', async (req: AuthenticatedRequest, res: Response) => {
  const providers = getProviderConfigs();
  res.json(providers);
});

// POST /admin/providers - Create provider config
const CreateProviderSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['firecrawl', 'http', 'playwright', 'custom']),
  enabled: z.boolean().default(true),
  config: z.record(z.unknown()),
  capabilities: z.array(z.string()),
  limits: z.object({
    maxConcurrentJobs: z.number().int().nonnegative(),
    maxPagesPerCrawl: z.number().int().nonnegative(),
    maxTimeoutSeconds: z.number().int().nonnegative(),
  }),
  healthCheckUrl: z.string().url().optional(),
});

router.post('/providers', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const provider = createProviderConfig(CreateProviderSchema.parse(req.body));
    res.status(201).json(provider);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to create provider' });
    }
  }
});

// PATCH /admin/providers/:id - Update provider config
router.patch('/providers/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const provider = updateProviderConfig(req.params.id as string, req.body);
    res.json(provider);
  } catch (error) {
    res.status(404).json({ error: 'Provider not found' });
  }
});

// ============================================
// Audit Routes
// ============================================

// GET /admin/tenants/:tenantId/audit - Get audit log
router.get('/tenants/:tenantId/audit', async (req: AuthenticatedRequest, res: Response) => {
  const limitParam = req.query.limit;
  const limit = Math.min(parseInt(typeof limitParam === 'string' ? limitParam : '100') || 100, 500);
  const events = getAuditEvents(req.params.tenantId as string, limit);
  res.json(events);
});

export default router;
