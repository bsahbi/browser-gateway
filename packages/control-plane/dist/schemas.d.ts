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
export declare const TenantSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    slug: z.ZodString;
    status: z.ZodEnum<["active", "suspended", "deleted"]>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    slug: string;
    status: "active" | "suspended" | "deleted";
    createdAt: string;
    updatedAt: string;
    metadata?: Record<string, unknown> | undefined;
}, {
    id: string;
    name: string;
    slug: string;
    status: "active" | "suspended" | "deleted";
    createdAt: string;
    updatedAt: string;
    metadata?: Record<string, unknown> | undefined;
}>;
export type Tenant = z.infer<typeof TenantSchema>;
export declare const UserSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    name: z.ZodString;
    passwordHash: z.ZodString;
    status: z.ZodEnum<["active", "suspended", "deleted"]>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    status: "active" | "suspended" | "deleted";
    createdAt: string;
    updatedAt: string;
    email: string;
    passwordHash: string;
}, {
    id: string;
    name: string;
    status: "active" | "suspended" | "deleted";
    createdAt: string;
    updatedAt: string;
    email: string;
    passwordHash: string;
}>;
export type User = z.infer<typeof UserSchema>;
export declare const MembershipRole: z.ZodEnum<["owner", "admin", "member", "viewer"]>;
export type MembershipRole = z.infer<typeof MembershipRole>;
export declare const MembershipSchema: z.ZodObject<{
    id: z.ZodString;
    tenantId: z.ZodString;
    userId: z.ZodString;
    role: z.ZodEnum<["owner", "admin", "member", "viewer"]>;
    invitedAt: z.ZodOptional<z.ZodString>;
    joinedAt: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    tenantId: string;
    userId: string;
    role: "owner" | "admin" | "member" | "viewer";
    invitedAt?: string | undefined;
    joinedAt?: string | undefined;
}, {
    id: string;
    createdAt: string;
    tenantId: string;
    userId: string;
    role: "owner" | "admin" | "member" | "viewer";
    invitedAt?: string | undefined;
    joinedAt?: string | undefined;
}>;
export type Membership = z.infer<typeof MembershipSchema>;
export declare const APIKeySchema: z.ZodObject<{
    id: z.ZodString;
    tenantId: z.ZodString;
    name: z.ZodString;
    keyPrefix: z.ZodString;
    keyHash: z.ZodString;
    scopes: z.ZodArray<z.ZodString, "many">;
    expiresAt: z.ZodOptional<z.ZodString>;
    revokedAt: z.ZodOptional<z.ZodString>;
    lastUsedAt: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    createdBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    createdAt: string;
    tenantId: string;
    keyPrefix: string;
    keyHash: string;
    scopes: string[];
    createdBy: string;
    expiresAt?: string | undefined;
    revokedAt?: string | undefined;
    lastUsedAt?: string | undefined;
}, {
    id: string;
    name: string;
    createdAt: string;
    tenantId: string;
    keyPrefix: string;
    keyHash: string;
    scopes: string[];
    createdBy: string;
    expiresAt?: string | undefined;
    revokedAt?: string | undefined;
    lastUsedAt?: string | undefined;
}>;
export type APIKey = z.infer<typeof APIKeySchema>;
export declare const APIKeyCreateResponseSchema: z.ZodObject<{
    id: z.ZodString;
    tenantId: z.ZodString;
    name: z.ZodString;
    keyPrefix: z.ZodString;
    keyHash: z.ZodString;
    scopes: z.ZodArray<z.ZodString, "many">;
    expiresAt: z.ZodOptional<z.ZodString>;
    revokedAt: z.ZodOptional<z.ZodString>;
    lastUsedAt: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    createdBy: z.ZodString;
} & {
    plaintextKey: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    createdAt: string;
    tenantId: string;
    keyPrefix: string;
    keyHash: string;
    scopes: string[];
    createdBy: string;
    plaintextKey: string;
    expiresAt?: string | undefined;
    revokedAt?: string | undefined;
    lastUsedAt?: string | undefined;
}, {
    id: string;
    name: string;
    createdAt: string;
    tenantId: string;
    keyPrefix: string;
    keyHash: string;
    scopes: string[];
    createdBy: string;
    plaintextKey: string;
    expiresAt?: string | undefined;
    revokedAt?: string | undefined;
    lastUsedAt?: string | undefined;
}>;
export type APIKeyCreateResponse = z.infer<typeof APIKeyCreateResponseSchema>;
export declare const PlanSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    slug: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    priceCents: z.ZodNumber;
    currency: z.ZodDefault<z.ZodString>;
    billingPeriod: z.ZodEnum<["monthly", "yearly", "one-time"]>;
    features: z.ZodRecord<z.ZodString, z.ZodBoolean>;
    quotas: z.ZodRecord<z.ZodString, z.ZodNumber>;
    active: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    slug: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
    priceCents: number;
    currency: string;
    billingPeriod: "monthly" | "yearly" | "one-time";
    features: Record<string, boolean>;
    quotas: Record<string, number>;
    description?: string | undefined;
}, {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
    updatedAt: string;
    priceCents: number;
    billingPeriod: "monthly" | "yearly" | "one-time";
    features: Record<string, boolean>;
    quotas: Record<string, number>;
    active?: boolean | undefined;
    description?: string | undefined;
    currency?: string | undefined;
}>;
export type Plan = z.infer<typeof PlanSchema>;
export declare const TenantPlanSchema: z.ZodObject<{
    id: z.ZodString;
    tenantId: z.ZodString;
    planId: z.ZodString;
    version: z.ZodNumber;
    activatedAt: z.ZodString;
    expiresAt: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    tenantId: string;
    planId: string;
    version: number;
    activatedAt: string;
    expiresAt?: string | undefined;
}, {
    id: string;
    createdAt: string;
    tenantId: string;
    planId: string;
    version: number;
    activatedAt: string;
    expiresAt?: string | undefined;
}>;
export type TenantPlan = z.infer<typeof TenantPlanSchema>;
export declare const QuotaPolicySchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    limits: z.ZodObject<{
        requestsPerMinute: z.ZodOptional<z.ZodNumber>;
        requestsPerDay: z.ZodOptional<z.ZodNumber>;
        requestsPerMonth: z.ZodOptional<z.ZodNumber>;
        concurrentJobs: z.ZodOptional<z.ZodNumber>;
        maxPagesPerCrawl: z.ZodOptional<z.ZodNumber>;
        maxDownloadBytes: z.ZodOptional<z.ZodNumber>;
        monthlyByteQuota: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        requestsPerMinute?: number | undefined;
        requestsPerDay?: number | undefined;
        requestsPerMonth?: number | undefined;
        concurrentJobs?: number | undefined;
        maxPagesPerCrawl?: number | undefined;
        maxDownloadBytes?: number | undefined;
        monthlyByteQuota?: number | undefined;
    }, {
        requestsPerMinute?: number | undefined;
        requestsPerDay?: number | undefined;
        requestsPerMonth?: number | undefined;
        concurrentJobs?: number | undefined;
        maxPagesPerCrawl?: number | undefined;
        maxDownloadBytes?: number | undefined;
        monthlyByteQuota?: number | undefined;
    }>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    limits: {
        requestsPerMinute?: number | undefined;
        requestsPerDay?: number | undefined;
        requestsPerMonth?: number | undefined;
        concurrentJobs?: number | undefined;
        maxPagesPerCrawl?: number | undefined;
        maxDownloadBytes?: number | undefined;
        monthlyByteQuota?: number | undefined;
    };
}, {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    limits: {
        requestsPerMinute?: number | undefined;
        requestsPerDay?: number | undefined;
        requestsPerMonth?: number | undefined;
        concurrentJobs?: number | undefined;
        maxPagesPerCrawl?: number | undefined;
        maxDownloadBytes?: number | undefined;
        monthlyByteQuota?: number | undefined;
    };
}>;
export type QuotaPolicy = z.infer<typeof QuotaPolicySchema>;
export declare const UsageEventType: z.ZodEnum<["request", "page_scraped", "page_crawled", "byte_downloaded", "byte_returned", "session_duration"]>;
export declare const UsageEventSchema: z.ZodObject<{
    id: z.ZodString;
    tenantId: z.ZodString;
    jobId: z.ZodOptional<z.ZodString>;
    provider: z.ZodString;
    type: z.ZodEnum<["request", "page_scraped", "page_crawled", "byte_downloaded", "byte_returned", "session_duration"]>;
    quantity: z.ZodNumber;
    unit: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    timestamp: z.ZodString;
    eventId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    type: "request" | "page_scraped" | "page_crawled" | "byte_downloaded" | "byte_returned" | "session_duration";
    tenantId: string;
    provider: string;
    quantity: number;
    unit: string;
    timestamp: string;
    eventId: string;
    metadata?: Record<string, unknown> | undefined;
    jobId?: string | undefined;
}, {
    id: string;
    type: "request" | "page_scraped" | "page_crawled" | "byte_downloaded" | "byte_returned" | "session_duration";
    tenantId: string;
    provider: string;
    quantity: number;
    unit: string;
    timestamp: string;
    eventId: string;
    metadata?: Record<string, unknown> | undefined;
    jobId?: string | undefined;
}>;
export type UsageEvent = z.infer<typeof UsageEventSchema>;
export declare const BudgetReservationSchema: z.ZodObject<{
    id: z.ZodString;
    tenantId: z.ZodString;
    jobId: z.ZodString;
    amountCents: z.ZodNumber;
    status: z.ZodEnum<["reserved", "settled", "released", "expired"]>;
    reservedAt: z.ZodString;
    settledAt: z.ZodOptional<z.ZodString>;
    releasedAt: z.ZodOptional<z.ZodString>;
    expiresAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "reserved" | "settled" | "released" | "expired";
    tenantId: string;
    expiresAt: string;
    jobId: string;
    amountCents: number;
    reservedAt: string;
    settledAt?: string | undefined;
    releasedAt?: string | undefined;
}, {
    id: string;
    status: "reserved" | "settled" | "released" | "expired";
    tenantId: string;
    expiresAt: string;
    jobId: string;
    amountCents: number;
    reservedAt: string;
    settledAt?: string | undefined;
    releasedAt?: string | undefined;
}>;
export type BudgetReservation = z.infer<typeof BudgetReservationSchema>;
export declare const AuditEventType: z.ZodEnum<["tenant.created", "tenant.updated", "tenant.suspended", "user.created", "user.updated", "membership.created", "membership.updated", "membership.deleted", "api_key.created", "api_key.revoked", "plan.assigned", "quota.exceeded", "budget.settled"]>;
export declare const AuditEventSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<["tenant.created", "tenant.updated", "tenant.suspended", "user.created", "user.updated", "membership.created", "membership.updated", "membership.deleted", "api_key.created", "api_key.revoked", "plan.assigned", "quota.exceeded", "budget.settled"]>;
    tenantId: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
    actorId: z.ZodString;
    resourceId: z.ZodOptional<z.ZodString>;
    resourceName: z.ZodOptional<z.ZodString>;
    before: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    after: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    ipAddress: z.ZodOptional<z.ZodString>;
    userAgent: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    type: "tenant.created" | "tenant.updated" | "tenant.suspended" | "user.created" | "user.updated" | "membership.created" | "membership.updated" | "membership.deleted" | "api_key.created" | "api_key.revoked" | "plan.assigned" | "quota.exceeded" | "budget.settled";
    createdAt: string;
    actorId: string;
    tenantId?: string | undefined;
    userId?: string | undefined;
    resourceId?: string | undefined;
    resourceName?: string | undefined;
    before?: Record<string, unknown> | undefined;
    after?: Record<string, unknown> | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
}, {
    id: string;
    type: "tenant.created" | "tenant.updated" | "tenant.suspended" | "user.created" | "user.updated" | "membership.created" | "membership.updated" | "membership.deleted" | "api_key.created" | "api_key.revoked" | "plan.assigned" | "quota.exceeded" | "budget.settled";
    createdAt: string;
    actorId: string;
    tenantId?: string | undefined;
    userId?: string | undefined;
    resourceId?: string | undefined;
    resourceName?: string | undefined;
    before?: Record<string, unknown> | undefined;
    after?: Record<string, unknown> | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
}>;
export type AuditEvent = z.infer<typeof AuditEventSchema>;
export declare const ProviderConfigSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<["firecrawl", "http", "playwright", "custom"]>;
    enabled: z.ZodDefault<z.ZodBoolean>;
    config: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    capabilities: z.ZodArray<z.ZodString, "many">;
    limits: z.ZodObject<{
        maxConcurrentJobs: z.ZodNumber;
        maxPagesPerCrawl: z.ZodNumber;
        maxTimeoutSeconds: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        maxPagesPerCrawl: number;
        maxConcurrentJobs: number;
        maxTimeoutSeconds: number;
    }, {
        maxPagesPerCrawl: number;
        maxConcurrentJobs: number;
        maxTimeoutSeconds: number;
    }>;
    healthCheckUrl: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    type: "custom" | "firecrawl" | "http" | "playwright";
    createdAt: string;
    updatedAt: string;
    limits: {
        maxPagesPerCrawl: number;
        maxConcurrentJobs: number;
        maxTimeoutSeconds: number;
    };
    enabled: boolean;
    config: Record<string, unknown>;
    capabilities: string[];
    healthCheckUrl?: string | undefined;
}, {
    id: string;
    name: string;
    type: "custom" | "firecrawl" | "http" | "playwright";
    createdAt: string;
    updatedAt: string;
    limits: {
        maxPagesPerCrawl: number;
        maxConcurrentJobs: number;
        maxTimeoutSeconds: number;
    };
    config: Record<string, unknown>;
    capabilities: string[];
    enabled?: boolean | undefined;
    healthCheckUrl?: string | undefined;
}>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export declare function createId(): string;
export declare function generateAPIKey(): string;
