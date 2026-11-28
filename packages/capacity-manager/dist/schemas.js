"use strict";
/**
 * Capacity Manager Schemas
 *
 * Core entities for distributed capacity:
 * - Provider Registry (multi-host)
 * - Capacity Reservations
 * - Load Balancing
 * - Health Monitoring
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulingDecisionSchema = exports.HealthCheckSchema = exports.LoadBalancerConfigSchema = exports.LoadBalanceStrategy = exports.CapacityReservationSchema = exports.ReservationStatus = exports.ProviderInstanceSchema = void 0;
exports.createId = createId;
const zod_1 = require("zod");
// ============================================
// Provider Instance
// ============================================
exports.ProviderInstanceSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1).max(255),
    type: zod_1.z.enum(['firecrawl', 'http', 'playwright', 'custom']),
    host: zod_1.z.string(),
    port: zod_1.z.number().int().positive(),
    basePath: zod_1.z.string().optional(),
    status: zod_1.z.enum(['healthy', 'degraded', 'unhealthy', 'draining']),
    capabilities: zod_1.z.array(zod_1.z.string()),
    currentLoad: zod_1.z.number().int().nonnegative(),
    maxCapacity: zod_1.z.number().int().positive(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
    lastHeartbeat: zod_1.z.string().datetime(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
// ============================================
// Capacity Reservation
// ============================================
exports.ReservationStatus = zod_1.z.enum(['active', 'completed', 'cancelled', 'expired']);
exports.CapacityReservationSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    tenantId: zod_1.z.string().uuid(),
    jobId: zod_1.z.string().uuid().optional(),
    providerInstanceId: zod_1.z.string().uuid(),
    capacityUnits: zod_1.z.number().int().positive(),
    status: exports.ReservationStatus,
    reservedAt: zod_1.z.string().datetime(),
    expiresAt: zod_1.z.string().datetime(),
    completedAt: zod_1.z.string().datetime().optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
});
// ============================================
// Load Balancing Strategy
// ============================================
exports.LoadBalanceStrategy = zod_1.z.enum([
    'round_robin',
    'least_loaded',
    'weighted',
    'sticky',
]);
exports.LoadBalancerConfigSchema = zod_1.z.object({
    strategy: exports.LoadBalanceStrategy,
    weights: zod_1.z.record(zod_1.z.number().int().positive()).optional(),
    stickySessionTTL: zod_1.z.number().int().positive().optional(),
    healthCheckInterval: zod_1.z.number().int().positive(),
    unhealthyThreshold: zod_1.z.number().int().positive(),
});
// ============================================
// Health Check
// ============================================
exports.HealthCheckSchema = zod_1.z.object({
    providerInstanceId: zod_1.z.string().uuid(),
    status: zod_1.z.enum(['healthy', 'degraded', 'unhealthy']),
    latencyMs: zod_1.z.number().int().nonnegative(),
    timestamp: zod_1.z.string().datetime(),
    error: zod_1.z.string().optional(),
    metrics: zod_1.z.record(zod_1.z.unknown()).optional(),
});
// ============================================
// Scheduling Decision
// ============================================
exports.SchedulingDecisionSchema = zod_1.z.object({
    providerInstanceId: zod_1.z.string().uuid(),
    providerName: zod_1.z.string(),
    reason: zod_1.z.string(),
    estimatedLatencyMs: zod_1.z.number().int().nonnegative(),
    timestamp: zod_1.z.string().datetime(),
});
// ============================================
// Helper Functions
// ============================================
function createId() {
    return crypto.randomUUID();
}
