/**
 * Capacity Manager Schemas
 *
 * Core entities for distributed capacity:
 * - Provider Registry (multi-host)
 * - Capacity Reservations
 * - Load Balancing
 * - Health Monitoring
 */
import { z } from 'zod';
export declare const ProviderInstanceSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<["firecrawl", "http", "playwright", "custom"]>;
    host: z.ZodString;
    port: z.ZodNumber;
    basePath: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<["healthy", "degraded", "unhealthy", "draining"]>;
    capabilities: z.ZodArray<z.ZodString, "many">;
    currentLoad: z.ZodNumber;
    maxCapacity: z.ZodNumber;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    lastHeartbeat: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    type: "custom" | "firecrawl" | "http" | "playwright";
    status: "healthy" | "degraded" | "unhealthy" | "draining";
    host: string;
    port: number;
    capabilities: string[];
    currentLoad: number;
    maxCapacity: number;
    lastHeartbeat: string;
    createdAt: string;
    updatedAt: string;
    basePath?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
}, {
    id: string;
    name: string;
    type: "custom" | "firecrawl" | "http" | "playwright";
    status: "healthy" | "degraded" | "unhealthy" | "draining";
    host: string;
    port: number;
    capabilities: string[];
    currentLoad: number;
    maxCapacity: number;
    lastHeartbeat: string;
    createdAt: string;
    updatedAt: string;
    basePath?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
}>;
export type ProviderInstance = z.infer<typeof ProviderInstanceSchema>;
export declare const ReservationStatus: z.ZodEnum<["active", "completed", "cancelled", "expired"]>;
export declare const CapacityReservationSchema: z.ZodObject<{
    id: z.ZodString;
    tenantId: z.ZodString;
    jobId: z.ZodOptional<z.ZodString>;
    providerInstanceId: z.ZodString;
    capacityUnits: z.ZodNumber;
    status: z.ZodEnum<["active", "completed", "cancelled", "expired"]>;
    reservedAt: z.ZodString;
    expiresAt: z.ZodString;
    completedAt: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "active" | "completed" | "cancelled" | "expired";
    tenantId: string;
    providerInstanceId: string;
    capacityUnits: number;
    reservedAt: string;
    expiresAt: string;
    metadata?: Record<string, unknown> | undefined;
    jobId?: string | undefined;
    completedAt?: string | undefined;
}, {
    id: string;
    status: "active" | "completed" | "cancelled" | "expired";
    tenantId: string;
    providerInstanceId: string;
    capacityUnits: number;
    reservedAt: string;
    expiresAt: string;
    metadata?: Record<string, unknown> | undefined;
    jobId?: string | undefined;
    completedAt?: string | undefined;
}>;
export type CapacityReservation = z.infer<typeof CapacityReservationSchema>;
export declare const LoadBalanceStrategy: z.ZodEnum<["round_robin", "least_loaded", "weighted", "sticky"]>;
export type LoadBalanceStrategy = z.infer<typeof LoadBalanceStrategy>;
export declare const LoadBalancerConfigSchema: z.ZodObject<{
    strategy: z.ZodEnum<["round_robin", "least_loaded", "weighted", "sticky"]>;
    weights: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>;
    stickySessionTTL: z.ZodOptional<z.ZodNumber>;
    healthCheckInterval: z.ZodNumber;
    unhealthyThreshold: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    strategy: "round_robin" | "least_loaded" | "weighted" | "sticky";
    healthCheckInterval: number;
    unhealthyThreshold: number;
    weights?: Record<string, number> | undefined;
    stickySessionTTL?: number | undefined;
}, {
    strategy: "round_robin" | "least_loaded" | "weighted" | "sticky";
    healthCheckInterval: number;
    unhealthyThreshold: number;
    weights?: Record<string, number> | undefined;
    stickySessionTTL?: number | undefined;
}>;
export type LoadBalancerConfig = z.infer<typeof LoadBalancerConfigSchema>;
export declare const HealthCheckSchema: z.ZodObject<{
    providerInstanceId: z.ZodString;
    status: z.ZodEnum<["healthy", "degraded", "unhealthy"]>;
    latencyMs: z.ZodNumber;
    timestamp: z.ZodString;
    error: z.ZodOptional<z.ZodString>;
    metrics: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    status: "healthy" | "degraded" | "unhealthy";
    providerInstanceId: string;
    latencyMs: number;
    timestamp: string;
    error?: string | undefined;
    metrics?: Record<string, unknown> | undefined;
}, {
    status: "healthy" | "degraded" | "unhealthy";
    providerInstanceId: string;
    latencyMs: number;
    timestamp: string;
    error?: string | undefined;
    metrics?: Record<string, unknown> | undefined;
}>;
export type HealthCheck = z.infer<typeof HealthCheckSchema>;
export declare const SchedulingDecisionSchema: z.ZodObject<{
    providerInstanceId: z.ZodString;
    providerName: z.ZodString;
    reason: z.ZodString;
    estimatedLatencyMs: z.ZodNumber;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    providerInstanceId: string;
    timestamp: string;
    providerName: string;
    reason: string;
    estimatedLatencyMs: number;
}, {
    providerInstanceId: string;
    timestamp: string;
    providerName: string;
    reason: string;
    estimatedLatencyMs: number;
}>;
export type SchedulingDecision = z.infer<typeof SchedulingDecisionSchema>;
export declare function createId(): string;
