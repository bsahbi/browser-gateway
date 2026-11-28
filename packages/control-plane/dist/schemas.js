"use strict";
/**
 * Control Plane Schemas
 *
 * Core entities for multi-tenant management:
 * - Tenants, Users, Memberships
 * - API Keys
 * - Plans, Entitlements, Quotas
 * - Usage Events, Pricing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderConfigSchema = exports.AuditEventSchema = exports.AuditEventType = exports.BudgetReservationSchema = exports.UsageEventSchema = exports.UsageEventType = exports.QuotaPolicySchema = exports.TenantPlanSchema = exports.PlanSchema = exports.APIKeyCreateResponseSchema = exports.APIKeySchema = exports.MembershipSchema = exports.MembershipRole = exports.UserSchema = exports.TenantSchema = void 0;
exports.createId = createId;
exports.generateAPIKey = generateAPIKey;
const crypto_1 = require("crypto");
const zod_1 = require("zod");
// ============================================
// Tenant
// ============================================
exports.TenantSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1).max(255),
    slug: zod_1.z.string().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
    status: zod_1.z.enum(['active', 'suspended', 'deleted']),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
// ============================================
// User
// ============================================
exports.UserSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    email: zod_1.z.string().email(),
    name: zod_1.z.string().min(1).max(255),
    passwordHash: zod_1.z.string(),
    status: zod_1.z.enum(['active', 'suspended', 'deleted']),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
// ============================================
// Membership
// ============================================
exports.MembershipRole = zod_1.z.enum(['owner', 'admin', 'member', 'viewer']);
exports.MembershipSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    tenantId: zod_1.z.string().uuid(),
    userId: zod_1.z.string().uuid(),
    role: exports.MembershipRole,
    invitedAt: zod_1.z.string().datetime().optional(),
    joinedAt: zod_1.z.string().datetime().optional(),
    createdAt: zod_1.z.string().datetime(),
});
// ============================================
// API Key
// ============================================
exports.APIKeySchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    tenantId: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1).max(255),
    keyPrefix: zod_1.z.string().length(8), // First 8 chars of key
    keyHash: zod_1.z.string(), // Full hashed key
    scopes: zod_1.z.array(zod_1.z.string()),
    expiresAt: zod_1.z.string().datetime().optional(),
    revokedAt: zod_1.z.string().datetime().optional(),
    lastUsedAt: zod_1.z.string().datetime().optional(),
    createdAt: zod_1.z.string().datetime(),
    createdBy: zod_1.z.string().uuid(),
});
// Create API key response (includes plaintext key once)
exports.APIKeyCreateResponseSchema = exports.APIKeySchema.extend({
    plaintextKey: zod_1.z.string(), // Only returned on creation
});
// ============================================
// Plan & Entitlements
// ============================================
exports.PlanSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1).max(255),
    slug: zod_1.z.string().regex(/^[a-z0-9-]+$/),
    description: zod_1.z.string().optional(),
    priceCents: zod_1.z.number().int().nonnegative(),
    currency: zod_1.z.string().length(3).default('USD'),
    billingPeriod: zod_1.z.enum(['monthly', 'yearly', 'one-time']),
    features: zod_1.z.record(zod_1.z.boolean()),
    quotas: zod_1.z.record(zod_1.z.number()),
    active: zod_1.z.boolean().default(true),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.TenantPlanSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    tenantId: zod_1.z.string().uuid(),
    planId: zod_1.z.string().uuid(),
    version: zod_1.z.number().int().positive(), // For pricing versioning
    activatedAt: zod_1.z.string().datetime(),
    expiresAt: zod_1.z.string().datetime().optional(),
    createdAt: zod_1.z.string().datetime(),
});
// ============================================
// Quota Policy
// ============================================
exports.QuotaPolicySchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1).max(255),
    limits: zod_1.z.object({
        requestsPerMinute: zod_1.z.number().int().nonnegative().optional(),
        requestsPerDay: zod_1.z.number().int().nonnegative().optional(),
        requestsPerMonth: zod_1.z.number().int().nonnegative().optional(),
        concurrentJobs: zod_1.z.number().int().nonnegative().optional(),
        maxPagesPerCrawl: zod_1.z.number().int().nonnegative().optional(),
        maxDownloadBytes: zod_1.z.number().int().nonnegative().optional(),
        monthlyByteQuota: zod_1.z.number().int().nonnegative().optional(),
    }),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
// ============================================
// Usage Events
// ============================================
exports.UsageEventType = zod_1.z.enum([
    'request',
    'page_scraped',
    'page_crawled',
    'byte_downloaded',
    'byte_returned',
    'session_duration',
]);
exports.UsageEventSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    tenantId: zod_1.z.string().uuid(),
    jobId: zod_1.z.string().uuid().optional(),
    provider: zod_1.z.string(),
    type: exports.UsageEventType,
    quantity: zod_1.z.number().nonnegative(),
    unit: zod_1.z.string(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
    timestamp: zod_1.z.string().datetime(),
    eventId: zod_1.z.string().uuid(), // Idempotency key
});
// ============================================
// Budget Reservation
// ============================================
exports.BudgetReservationSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    tenantId: zod_1.z.string().uuid(),
    jobId: zod_1.z.string().uuid(),
    amountCents: zod_1.z.number().int().nonnegative(),
    status: zod_1.z.enum(['reserved', 'settled', 'released', 'expired']),
    reservedAt: zod_1.z.string().datetime(),
    settledAt: zod_1.z.string().datetime().optional(),
    releasedAt: zod_1.z.string().datetime().optional(),
    expiresAt: zod_1.z.string().datetime(),
});
// ============================================
// Audit Event
// ============================================
exports.AuditEventType = zod_1.z.enum([
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
exports.AuditEventSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    type: exports.AuditEventType,
    tenantId: zod_1.z.string().uuid().optional(),
    userId: zod_1.z.string().uuid().optional(),
    actorId: zod_1.z.string().uuid(), // Who performed the action
    resourceId: zod_1.z.string().uuid().optional(),
    resourceName: zod_1.z.string().optional(),
    before: zod_1.z.record(zod_1.z.unknown()).optional(),
    after: zod_1.z.record(zod_1.z.unknown()).optional(),
    ipAddress: zod_1.z.string().optional(),
    userAgent: zod_1.z.string().optional(),
    createdAt: zod_1.z.string().datetime(),
});
// ============================================
// Provider Configuration
// ============================================
exports.ProviderConfigSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
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
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
// ============================================
// Helper Functions
// ============================================
function createId() {
    return crypto.randomUUID();
}
function generateAPIKey() {
    const prefix = Math.random().toString(36).substring(2, 10);
    const random = (0, crypto_1.randomBytes)(32).toString('hex');
    return `${prefix}_${random}`;
}
