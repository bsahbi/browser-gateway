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

// ============================================
// Provider Instance
// ============================================

export const ProviderInstanceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  type: z.enum(['firecrawl', 'http', 'playwright', 'custom']),
  host: z.string(),
  port: z.number().int().positive(),
  basePath: z.string().optional(),
  status: z.enum(['healthy', 'degraded', 'unhealthy', 'draining']),
  capabilities: z.array(z.string()),
  currentLoad: z.number().int().nonnegative(),
  maxCapacity: z.number().int().positive(),
  metadata: z.record(z.unknown()).optional(),
  lastHeartbeat: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ProviderInstance = z.infer<typeof ProviderInstanceSchema>;

// ============================================
// Capacity Reservation
// ============================================

export const ReservationStatus = z.enum(['active', 'completed', 'cancelled', 'expired']);

export const CapacityReservationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  jobId: z.string().uuid().optional(),
  providerInstanceId: z.string().uuid(),
  capacityUnits: z.number().int().positive(),
  status: ReservationStatus,
  reservedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CapacityReservation = z.infer<typeof CapacityReservationSchema>;

// ============================================
// Load Balancing Strategy
// ============================================

export const LoadBalanceStrategy = z.enum([
  'round_robin',
  'least_loaded',
  'weighted',
  'sticky',
]);

export type LoadBalanceStrategy = z.infer<typeof LoadBalanceStrategy>;

export const LoadBalancerConfigSchema = z.object({
  strategy: LoadBalanceStrategy,
  weights: z.record(z.number().int().positive()).optional(),
  stickySessionTTL: z.number().int().positive().optional(),
  healthCheckInterval: z.number().int().positive(),
  unhealthyThreshold: z.number().int().positive(),
});

export type LoadBalancerConfig = z.infer<typeof LoadBalancerConfigSchema>;

// ============================================
// Health Check
// ============================================

export const HealthCheckSchema = z.object({
  providerInstanceId: z.string().uuid(),
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  latencyMs: z.number().int().nonnegative(),
  timestamp: z.string().datetime(),
  error: z.string().optional(),
  metrics: z.record(z.unknown()).optional(),
});

export type HealthCheck = z.infer<typeof HealthCheckSchema>;

// ============================================
// Scheduling Decision
// ============================================

export const SchedulingDecisionSchema = z.object({
  providerInstanceId: z.string().uuid(),
  providerName: z.string(),
  reason: z.string(),
  estimatedLatencyMs: z.number().int().nonnegative(),
  timestamp: z.string().datetime(),
});

export type SchedulingDecision = z.infer<typeof SchedulingDecisionSchema>;

// ============================================
// Helper Functions
// ============================================

export function createId(): string {
  return crypto.randomUUID();
}
