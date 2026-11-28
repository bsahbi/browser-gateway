/**
 * Control Plane Service
 * 
 * Manages tenants, users, API keys, quotas, and usage.
 * This is a service interface - actual persistence depends on implementation.
 */

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import {
  Tenant,
  User,
  Membership,
  APIKey,
  APIKeyCreateResponse,
  Plan,
  TenantPlan,
  QuotaPolicy,
  UsageEvent,
  BudgetReservation,
  AuditEvent,
  ProviderConfig,
  createId,
  generateAPIKey,
} from './schemas';

// In-memory stores (replace with database in production)
const tenants = new Map<string, Tenant>();
const users = new Map<string, User>();
const memberships = new Map<string, Membership>();
const apiKeys = new Map<string, APIKey>();
const plans = new Map<string, Plan>();
const tenantPlans = new Map<string, TenantPlan>();
const quotaPolicies = new Map<string, QuotaPolicy>();
const usageEvents: UsageEvent[] = [];
const budgetReservations = new Map<string, BudgetReservation>();
const auditEvents: AuditEvent[] = [];
const providerConfigs = new Map<string, ProviderConfig>();

// ============================================
// Tenant Management
// ============================================

export async function createTenant(
  name: string,
  slug: string,
  ownerId: string
): Promise<Tenant> {
  const id = createId();
  const now = new Date().toISOString();

  const tenant: Tenant = {
    id,
    name,
    slug,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  tenants.set(id, tenant);

  // Create owner membership
  await createMembership(id, ownerId, 'owner');

  // Create audit event
  await createAuditEvent('tenant.created', ownerId, id, tenant.name);

  return tenant;
}

export function getTenant(id: string): Tenant | undefined {
  return tenants.get(id);
}

export function getTenantBySlug(slug: string): Tenant | undefined {
  return Array.from(tenants.values()).find(t => t.slug === slug);
}

export async function updateTenant(
  id: string,
  updates: Partial<Omit<Tenant, 'id' | 'createdAt'>>
): Promise<Tenant> {
  const tenant = tenants.get(id);
  if (!tenant) {
    throw new Error(`Tenant ${id} not found`);
  }

  const updated: Tenant = {
    ...tenant,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  tenants.set(id, updated);
  await createAuditEvent('tenant.updated', updated.id, id, updated.name);

  return updated;
}

export async function suspendTenant(id: string, actorId: string): Promise<Tenant> {
  const tenant = tenants.get(id);
  if (!tenant) {
    throw new Error(`Tenant ${id} not found`);
  }

  const updated: Tenant = {
    ...tenant,
    status: 'suspended',
    updatedAt: new Date().toISOString(),
  };

  tenants.set(id, updated);
  await createAuditEvent('tenant.suspended', actorId, id, updated.name);

  return updated;
}

// ============================================
// User Management
// ============================================

export async function createUser(
  email: string,
  password: string,
  name: string
): Promise<User> {
  const id = createId();
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date().toISOString();

  const user: User = {
    id,
    email,
    name,
    passwordHash,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  users.set(id, user);
  await createAuditEvent('user.created', id, undefined, email);

  return user;
}

export async function authenticateUser(
  email: string,
  password: string
): Promise<User | null> {
  const user = Array.from(users.values()).find(u => u.email === email);
  if (!user || user.status !== 'active') {
    return null;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  return valid ? user : null;
}

export function getUser(id: string): User | undefined {
  return users.get(id);
}

// ============================================
// Membership Management
// ============================================

export async function createMembership(
  tenantId: string,
  userId: string,
  role: 'owner' | 'admin' | 'member' | 'viewer'
): Promise<Membership> {
  const id = createId();
  const now = new Date().toISOString();

  const membership: Membership = {
    id,
    tenantId,
    userId,
    role,
    joinedAt: now,
    createdAt: now,
  };

  memberships.set(id, membership);
  await createAuditEvent('membership.created', userId, tenantId, undefined, { role });

  return membership;
}

export function getMembership(tenantId: string, userId: string): Membership | undefined {
  return Array.from(memberships.values()).find(
    m => m.tenantId === tenantId && m.userId === userId
  );
}

export function getTenantMembers(tenantId: string): Membership[] {
  return Array.from(memberships.values()).filter(m => m.tenantId === tenantId);
}

// ============================================
// API Key Management
// ============================================

export async function createAPIKey(
  tenantId: string,
  name: string,
  createdBy: string,
  scopes: string[] = ['browser:*']
): Promise<APIKeyCreateResponse> {
  const id = createId();
  const plaintextKey = generateAPIKey();
  const keyPrefix = plaintextKey.substring(0, 8);
  const keyHash = await bcrypt.hash(plaintextKey, 12);
  const now = new Date().toISOString();

  const apiKey: APIKey = {
    id,
    tenantId,
    name,
    keyPrefix,
    keyHash,
    scopes,
    createdAt: now,
    createdBy,
  };

  apiKeys.set(id, apiKey);
  await createAuditEvent('api_key.created', createdBy, tenantId, name);

  return {
    ...apiKey,
    plaintextKey,
  };
}

export async function authenticateAPIKey(key: string): Promise<APIKey | null> {
  // Find by prefix first (optimization)
  const prefix = key.substring(0, 8);
  const candidates = Array.from(apiKeys.values()).filter(k => k.keyPrefix === prefix);

  for (const apiKey of candidates) {
    if (apiKey.revokedAt) continue;
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) continue;

    const valid = await bcrypt.compare(key, apiKey.keyHash);
    if (valid) {
      // Update last used
      const updated: APIKey = {
        ...apiKey,
        lastUsedAt: new Date().toISOString(),
      };
      apiKeys.set(apiKey.id, updated);
      return updated;
    }
  }

  return null;
}

export async function revokeAPIKey(id: string, actorId: string): Promise<void> {
  const apiKey = apiKeys.get(id);
  if (!apiKey) {
    throw new Error(`API Key ${id} not found`);
  }

  const updated: APIKey = {
    ...apiKey,
    revokedAt: new Date().toISOString(),
  };

  apiKeys.set(id, updated);
  await createAuditEvent('api_key.revoked', actorId, apiKey.tenantId, apiKey.name);
}

export function getAPIKeys(tenantId: string): APIKey[] {
  return Array.from(apiKeys.values()).filter(k => k.tenantId === tenantId);
}

// ============================================
// Plan & Quota Management
// ============================================

export function createPlan(plan: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>): Plan {
  const id = createId();
  const now = new Date().toISOString();

  const newPlan: Plan = {
    ...plan,
    id,
    createdAt: now,
    updatedAt: now,
  };

  plans.set(id, newPlan);
  return newPlan;
}

export function getPlan(id: string): Plan | undefined {
  return plans.get(id);
}

export function assignPlan(tenantId: string, planId: string): TenantPlan {
  const id = createId();
  const plan = plans.get(planId);
  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  const tenantPlan: TenantPlan = {
    id,
    tenantId,
    planId,
    version: 1,
    activatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  tenantPlans.set(id, tenantPlan);
  return tenantPlan;
}

export function getTenantPlan(tenantId: string): TenantPlan | undefined {
  return Array.from(tenantPlans.values()).find(tp => tp.tenantId === tenantId);
}

// ============================================
// Usage Tracking
// ============================================

export function recordUsage(event: Omit<UsageEvent, 'id' | 'eventId'>): UsageEvent {
  const usageEvent: UsageEvent = {
    ...event,
    id: createId(),
    eventId: uuidv4(),
  };

  usageEvents.push(usageEvent);
  return usageEvent;
}

export function getUsageEvents(
  tenantId: string,
  startDate?: Date,
  endDate?: Date
): UsageEvent[] {
  let events = usageEvents.filter(e => e.tenantId === tenantId);

  if (startDate) {
    events = events.filter(e => new Date(e.timestamp) >= startDate);
  }
  if (endDate) {
    events = events.filter(e => new Date(e.timestamp) <= endDate);
  }

  return events;
}

export function calculateUsageTotals(tenantId: string, startDate: Date): {
  requests: number;
  pagesScraped: number;
  pagesCrawled: number;
  bytesDownloaded: number;
  bytesReturned: number;
} {
  const events = getUsageEvents(tenantId, startDate);

  return events.reduce(
    (totals, event) => {
      switch (event.type) {
        case 'request':
          totals.requests += event.quantity;
          break;
        case 'page_scraped':
          totals.pagesScraped += event.quantity;
          break;
        case 'page_crawled':
          totals.pagesCrawled += event.quantity;
          break;
        case 'byte_downloaded':
          totals.bytesDownloaded += event.quantity;
          break;
        case 'byte_returned':
          totals.bytesReturned += event.quantity;
          break;
      }
      return totals;
    },
    { requests: 0, pagesScraped: 0, pagesCrawled: 0, bytesDownloaded: 0, bytesReturned: 0 }
  );
}

// ============================================
// Budget Reservation
// ============================================

export function reserveBudget(
  tenantId: string,
  jobId: string,
  amountCents: number,
  expiresAt: Date
): BudgetReservation {
  const id = createId();
  const now = new Date().toISOString();

  const reservation: BudgetReservation = {
    id,
    tenantId,
    jobId,
    amountCents,
    status: 'reserved',
    reservedAt: now,
    expiresAt: expiresAt.toISOString(),
  };

  budgetReservations.set(id, reservation);
  return reservation;
}

export function settleReservation(id: string, actualAmountCents: number): BudgetReservation {
  const reservation = budgetReservations.get(id);
  if (!reservation) {
    throw new Error(`Reservation ${id} not found`);
  }

  const updated: BudgetReservation = {
    ...reservation,
    status: 'settled',
    settledAt: new Date().toISOString(),
    amountCents: actualAmountCents,
  };

  budgetReservations.set(id, updated);
  return updated;
}

// ============================================
// Audit Logging
// ============================================

export async function createAuditEvent(
  type: AuditEvent['type'],
  actorId: string,
  tenantId?: string,
  resourceName?: string,
  _metadata?: Record<string, unknown>
): Promise<AuditEvent> {
  const event: AuditEvent = {
    id: createId(),
    type,
    tenantId,
    actorId,
    resourceName,
    createdAt: new Date().toISOString(),
  };

  auditEvents.push(event);
  return event;
}

export function getAuditEvents(tenantId?: string, limit = 100): AuditEvent[] {
  let events = auditEvents;
  if (tenantId) {
    events = events.filter(e => e.tenantId === tenantId);
  }
  return events.slice(-limit).reverse();
}

// ============================================
// Provider Configuration
// ============================================

export function createProviderConfig(
  config: Omit<ProviderConfig, 'id' | 'createdAt' | 'updatedAt'>
): ProviderConfig {
  const id = createId();
  const now = new Date().toISOString();

  const provider: ProviderConfig = {
    ...config,
    id,
    createdAt: now,
    updatedAt: now,
  };

  providerConfigs.set(id, provider);
  return provider;
}

export function getProviderConfigs(): ProviderConfig[] {
  return Array.from(providerConfigs.values());
}

export function updateProviderConfig(
  id: string,
  updates: Partial<ProviderConfig>
): ProviderConfig {
  const config = providerConfigs.get(id);
  if (!config) {
    throw new Error(`Provider config ${id} not found`);
  }

  const updated: ProviderConfig = {
    ...config,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  providerConfigs.set(id, updated);
  return updated;
}
