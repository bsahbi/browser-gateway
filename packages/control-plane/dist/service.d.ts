/**
 * Control Plane Service
 *
 * Manages tenants, users, API keys, quotas, and usage.
 * This is a service interface - actual persistence depends on implementation.
 */
import { Tenant, User, Membership, APIKey, APIKeyCreateResponse, Plan, TenantPlan, UsageEvent, BudgetReservation, AuditEvent, ProviderConfig } from './schemas';
export declare function createTenant(name: string, slug: string, ownerId: string): Promise<Tenant>;
export declare function getTenant(id: string): Tenant | undefined;
export declare function getTenantBySlug(slug: string): Tenant | undefined;
export declare function updateTenant(id: string, updates: Partial<Omit<Tenant, 'id' | 'createdAt'>>): Promise<Tenant>;
export declare function suspendTenant(id: string, actorId: string): Promise<Tenant>;
export declare function createUser(email: string, password: string, name: string): Promise<User>;
export declare function authenticateUser(email: string, password: string): Promise<User | null>;
export declare function getUser(id: string): User | undefined;
export declare function createMembership(tenantId: string, userId: string, role: 'owner' | 'admin' | 'member' | 'viewer'): Promise<Membership>;
export declare function getMembership(tenantId: string, userId: string): Membership | undefined;
export declare function getTenantMembers(tenantId: string): Membership[];
export declare function createAPIKey(tenantId: string, name: string, createdBy: string, scopes?: string[]): Promise<APIKeyCreateResponse>;
export declare function authenticateAPIKey(key: string): Promise<APIKey | null>;
export declare function revokeAPIKey(id: string, actorId: string): Promise<void>;
export declare function getAPIKeys(tenantId: string): APIKey[];
export declare function createPlan(plan: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>): Plan;
export declare function getPlan(id: string): Plan | undefined;
export declare function assignPlan(tenantId: string, planId: string): TenantPlan;
export declare function getTenantPlan(tenantId: string): TenantPlan | undefined;
export declare function recordUsage(event: Omit<UsageEvent, 'id' | 'eventId'>): UsageEvent;
export declare function getUsageEvents(tenantId: string, startDate?: Date, endDate?: Date): UsageEvent[];
export declare function calculateUsageTotals(tenantId: string, startDate: Date): {
    requests: number;
    pagesScraped: number;
    pagesCrawled: number;
    bytesDownloaded: number;
    bytesReturned: number;
};
export declare function reserveBudget(tenantId: string, jobId: string, amountCents: number, expiresAt: Date): BudgetReservation;
export declare function settleReservation(id: string, actualAmountCents: number): BudgetReservation;
export declare function createAuditEvent(type: AuditEvent['type'], actorId: string, tenantId?: string, resourceName?: string, _metadata?: Record<string, unknown>): Promise<AuditEvent>;
export declare function getAuditEvents(tenantId?: string, limit?: number): AuditEvent[];
export declare function createProviderConfig(config: Omit<ProviderConfig, 'id' | 'createdAt' | 'updatedAt'>): ProviderConfig;
export declare function getProviderConfigs(): ProviderConfig[];
export declare function updateProviderConfig(id: string, updates: Partial<ProviderConfig>): ProviderConfig;
