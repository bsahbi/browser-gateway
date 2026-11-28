"use strict";
/**
 * Control Plane Service
 *
 * Manages tenants, users, API keys, quotas, and usage.
 * This is a service interface - actual persistence depends on implementation.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTenant = createTenant;
exports.getTenant = getTenant;
exports.getTenantBySlug = getTenantBySlug;
exports.updateTenant = updateTenant;
exports.suspendTenant = suspendTenant;
exports.createUser = createUser;
exports.authenticateUser = authenticateUser;
exports.getUser = getUser;
exports.createMembership = createMembership;
exports.getMembership = getMembership;
exports.getTenantMembers = getTenantMembers;
exports.createAPIKey = createAPIKey;
exports.authenticateAPIKey = authenticateAPIKey;
exports.revokeAPIKey = revokeAPIKey;
exports.getAPIKeys = getAPIKeys;
exports.createPlan = createPlan;
exports.getPlan = getPlan;
exports.assignPlan = assignPlan;
exports.getTenantPlan = getTenantPlan;
exports.recordUsage = recordUsage;
exports.getUsageEvents = getUsageEvents;
exports.calculateUsageTotals = calculateUsageTotals;
exports.reserveBudget = reserveBudget;
exports.settleReservation = settleReservation;
exports.createAuditEvent = createAuditEvent;
exports.getAuditEvents = getAuditEvents;
exports.createProviderConfig = createProviderConfig;
exports.getProviderConfigs = getProviderConfigs;
exports.updateProviderConfig = updateProviderConfig;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const uuid_1 = require("uuid");
const schemas_1 = require("./schemas");
// In-memory stores (replace with database in production)
const tenants = new Map();
const users = new Map();
const memberships = new Map();
const apiKeys = new Map();
const plans = new Map();
const tenantPlans = new Map();
const quotaPolicies = new Map();
const usageEvents = [];
const budgetReservations = new Map();
const auditEvents = [];
const providerConfigs = new Map();
// ============================================
// Tenant Management
// ============================================
async function createTenant(name, slug, ownerId) {
    const id = (0, schemas_1.createId)();
    const now = new Date().toISOString();
    const tenant = {
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
function getTenant(id) {
    return tenants.get(id);
}
function getTenantBySlug(slug) {
    return Array.from(tenants.values()).find(t => t.slug === slug);
}
async function updateTenant(id, updates) {
    const tenant = tenants.get(id);
    if (!tenant) {
        throw new Error(`Tenant ${id} not found`);
    }
    const updated = {
        ...tenant,
        ...updates,
        updatedAt: new Date().toISOString(),
    };
    tenants.set(id, updated);
    await createAuditEvent('tenant.updated', updated.id, id, updated.name);
    return updated;
}
async function suspendTenant(id, actorId) {
    const tenant = tenants.get(id);
    if (!tenant) {
        throw new Error(`Tenant ${id} not found`);
    }
    const updated = {
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
async function createUser(email, password, name) {
    const id = (0, schemas_1.createId)();
    const passwordHash = await bcryptjs_1.default.hash(password, 12);
    const now = new Date().toISOString();
    const user = {
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
async function authenticateUser(email, password) {
    const user = Array.from(users.values()).find(u => u.email === email);
    if (!user || user.status !== 'active') {
        return null;
    }
    const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
    return valid ? user : null;
}
function getUser(id) {
    return users.get(id);
}
// ============================================
// Membership Management
// ============================================
async function createMembership(tenantId, userId, role) {
    const id = (0, schemas_1.createId)();
    const now = new Date().toISOString();
    const membership = {
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
function getMembership(tenantId, userId) {
    return Array.from(memberships.values()).find(m => m.tenantId === tenantId && m.userId === userId);
}
function getTenantMembers(tenantId) {
    return Array.from(memberships.values()).filter(m => m.tenantId === tenantId);
}
// ============================================
// API Key Management
// ============================================
async function createAPIKey(tenantId, name, createdBy, scopes = ['browser:*']) {
    const id = (0, schemas_1.createId)();
    const plaintextKey = (0, schemas_1.generateAPIKey)();
    const keyPrefix = plaintextKey.substring(0, 8);
    const keyHash = await bcryptjs_1.default.hash(plaintextKey, 12);
    const now = new Date().toISOString();
    const apiKey = {
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
async function authenticateAPIKey(key) {
    // Find by prefix first (optimization)
    const prefix = key.substring(0, 8);
    const candidates = Array.from(apiKeys.values()).filter(k => k.keyPrefix === prefix);
    for (const apiKey of candidates) {
        if (apiKey.revokedAt)
            continue;
        if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date())
            continue;
        const valid = await bcryptjs_1.default.compare(key, apiKey.keyHash);
        if (valid) {
            // Update last used
            const updated = {
                ...apiKey,
                lastUsedAt: new Date().toISOString(),
            };
            apiKeys.set(apiKey.id, updated);
            return updated;
        }
    }
    return null;
}
async function revokeAPIKey(id, actorId) {
    const apiKey = apiKeys.get(id);
    if (!apiKey) {
        throw new Error(`API Key ${id} not found`);
    }
    const updated = {
        ...apiKey,
        revokedAt: new Date().toISOString(),
    };
    apiKeys.set(id, updated);
    await createAuditEvent('api_key.revoked', actorId, apiKey.tenantId, apiKey.name);
}
function getAPIKeys(tenantId) {
    return Array.from(apiKeys.values()).filter(k => k.tenantId === tenantId);
}
// ============================================
// Plan & Quota Management
// ============================================
function createPlan(plan) {
    const id = (0, schemas_1.createId)();
    const now = new Date().toISOString();
    const newPlan = {
        ...plan,
        id,
        createdAt: now,
        updatedAt: now,
    };
    plans.set(id, newPlan);
    return newPlan;
}
function getPlan(id) {
    return plans.get(id);
}
function assignPlan(tenantId, planId) {
    const id = (0, schemas_1.createId)();
    const plan = plans.get(planId);
    if (!plan) {
        throw new Error(`Plan ${planId} not found`);
    }
    const tenantPlan = {
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
function getTenantPlan(tenantId) {
    return Array.from(tenantPlans.values()).find(tp => tp.tenantId === tenantId);
}
// ============================================
// Usage Tracking
// ============================================
function recordUsage(event) {
    const usageEvent = {
        ...event,
        id: (0, schemas_1.createId)(),
        eventId: (0, uuid_1.v4)(),
    };
    usageEvents.push(usageEvent);
    return usageEvent;
}
function getUsageEvents(tenantId, startDate, endDate) {
    let events = usageEvents.filter(e => e.tenantId === tenantId);
    if (startDate) {
        events = events.filter(e => new Date(e.timestamp) >= startDate);
    }
    if (endDate) {
        events = events.filter(e => new Date(e.timestamp) <= endDate);
    }
    return events;
}
function calculateUsageTotals(tenantId, startDate) {
    const events = getUsageEvents(tenantId, startDate);
    return events.reduce((totals, event) => {
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
    }, { requests: 0, pagesScraped: 0, pagesCrawled: 0, bytesDownloaded: 0, bytesReturned: 0 });
}
// ============================================
// Budget Reservation
// ============================================
function reserveBudget(tenantId, jobId, amountCents, expiresAt) {
    const id = (0, schemas_1.createId)();
    const now = new Date().toISOString();
    const reservation = {
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
function settleReservation(id, actualAmountCents) {
    const reservation = budgetReservations.get(id);
    if (!reservation) {
        throw new Error(`Reservation ${id} not found`);
    }
    const updated = {
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
async function createAuditEvent(type, actorId, tenantId, resourceName, _metadata) {
    const event = {
        id: (0, schemas_1.createId)(),
        type,
        tenantId,
        actorId,
        resourceName,
        createdAt: new Date().toISOString(),
    };
    auditEvents.push(event);
    return event;
}
function getAuditEvents(tenantId, limit = 100) {
    let events = auditEvents;
    if (tenantId) {
        events = events.filter(e => e.tenantId === tenantId);
    }
    return events.slice(-limit).reverse();
}
// ============================================
// Provider Configuration
// ============================================
function createProviderConfig(config) {
    const id = (0, schemas_1.createId)();
    const now = new Date().toISOString();
    const provider = {
        ...config,
        id,
        createdAt: now,
        updatedAt: now,
    };
    providerConfigs.set(id, provider);
    return provider;
}
function getProviderConfigs() {
    return Array.from(providerConfigs.values());
}
function updateProviderConfig(id, updates) {
    const config = providerConfigs.get(id);
    if (!config) {
        throw new Error(`Provider config ${id} not found`);
    }
    const updated = {
        ...config,
        ...updates,
        updatedAt: new Date().toISOString(),
    };
    providerConfigs.set(id, updated);
    return updated;
}
