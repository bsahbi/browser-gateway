/**
 * Control Plane Schemas
 * 
 * Core entities for multi-tenant management:
 * - Tenants, Users, Memberships
 * - API Keys
 * - Plans, Entitlements, Quotas
 * - Usage Events, Pricing
 */

import { z } from 'zod';

// ============================================
// Tenant
// ============================================

export const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  status: z.enum(['active', 'suspended', 'deleted']),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Tenant = z.infer<typeof TenantSchema>;

// ============================================
// User
// ============================================

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(255),
  passwordHash: z.string(),
  status: z.enum(['active', 'suspended', 'deleted']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;

// ============================================
// Membership
// ============================================

export const MembershipRole = z.enum(['owner', 'admin', 'member', 'viewer']);
export type MembershipRole = z.infer<typeof MembershipRole>;

export const MembershipSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  role: MembershipRole,
  invitedAt: z.string().datetime().optional(),
  joinedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});

export type Membership = z.infer<typeof MembershipSchema>;

// ============================================
// API Key
// ============================================

export const APIKeySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(255),
  keyPrefix: z.string().length(8), // First 8 chars of key
  keyHash: z.string(), // Full hashed key
  scopes: z.array(z.string()),
  expiresAt: z.string().datetime().optional(),
  revokedAt: z.string().datetime().optional(),
  lastUsedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  createdBy: z.string().uuid(),
});

export type APIKey = z.infer<typeof APIKeySchema>;

// Create API key response (includes plaintext key once)
export const APIKeyCreateResponseSchema = APIKeySchema.extend({
  plaintextKey: z.string(), // Only returned on creation
});

export type APIKeyCreateResponse = z.infer<typeof APIKeyCreateResponseSchema>;

// ============================================
// Plan & Entitlements
// ============================================

export const PlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().length(3).default('USD'),
  billingPeriod: z.enum(['monthly', 'yearly', 'one-time']),
  features: z.record(z.boolean()),
  quotas: z.record(z.number()),
  active: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Plan = z.infer<typeof PlanSchema>;

export const TenantPlanSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  planId: z.string().uuid(),
  version: z.number().int().positive(), // For pricing versioning
  activatedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});

export type TenantPlan = z.infer<typeof TenantPlanSchema>;

// ============================================
// Quota Policy
// ============================================

export const QuotaPolicySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  limits: z.object({
    requestsPerMinute: z.number().int().nonnegative().optional(),
    requestsPerDay: z.number().int().nonnegative().optional(),
    requestsPerMonth: z.number().int().nonnegative().optional(),
    concurrentJobs: z.number().int().nonnegative().optional(),
    maxPagesPerCrawl: z.number().int().nonnegative().optional(),
    maxDownloadBytes: z.number().int().nonnegative().optional(),
    monthlyByteQuota: z.number().int().nonnegative().optional(),
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type QuotaPolicy = z.infer<typeof QuotaPolicySchema>;

// ============================================
// Usage Events
// ============================================

export const UsageEventType = z.enum([
  'request',
  'page_scraped',
  'page_crawled',
  'byte_downloaded',
  'byte_returned',
  'session_duration',
]);

export const UsageEventSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  jobId: z.string().uuid().optional(),
  provider: z.string(),
  type: UsageEventType,
  quantity: z.number().nonnegative(),
  unit: z.string(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime(),
  eventId: z.string().uuid(), // Idempotency key
});

export type UsageEvent = z.infer<typeof UsageEventSchema>;

// ============================================
// Budget Reservation
// ============================================

export const BudgetReservationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  jobId: z.string().uuid(),
  amountCents: z.number().int().nonnegative(),
  status: z.enum(['reserved', 'settled', 'released', 'expired']),
  reservedAt: z.string().datetime(),
  settledAt: z.string().datetime().optional(),
  releasedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime(),
});

export type BudgetReservation = z.infer<typeof BudgetReservationSchema>;

// ============================================
// Audit Event
// ============================================

export const AuditEventType = z.enum([
  'tenant.created',
  'tenant.updated',
  'tenant.suspended',
  'user.created',
  'user.updated',
  'membership.created',
  'membership.updated',
  'membership.deleted',
  'api_key.created',
  'api_key.revoked',
  'plan.assigned',
  'quota.exceeded',
  'budget.settled',
]);

export const AuditEventSchema = z.object({
  id: z.string().uuid(),
  type: AuditEventType,
  tenantId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  actorId: z.string().uuid(), // Who performed the action
  resourceId: z.string().uuid().optional(),
  resourceName: z.string().optional(),
  before: z.record(z.unknown()).optional(),
  after: z.record(z.unknown()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;

// ============================================
// Provider Configuration
// ============================================

export const ProviderConfigSchema = z.object({
  id: z.string().uuid(),
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
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

// ============================================
// Helper Functions
// ============================================

export function createId(): string {
  return crypto.randomUUID();
}

export function generateAPIKey(): string {
  const prefix = Math.random().toString(36).substring(2, 10);
  const random = crypto.randomBytes(32).toString('hex');
  return `${prefix}_${random}`;
}
