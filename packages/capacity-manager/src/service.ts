/**
 * Capacity Manager Service
 * 
 * Manages distributed browser capacity:
 * - Provider instance registry
 * - Health-aware scheduling
 * - Capacity reservations
 * - Load balancing
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ProviderInstance,
  CapacityReservation,
  ReservationStatus,
  LoadBalanceStrategy,
  LoadBalancerConfig,
  HealthCheck,
  SchedulingDecision,
  createId,
} from './schemas';

// In-memory stores (replace with Redis in production)
const providerInstances = new Map<string, ProviderInstance>();
const reservations = new Map<string, CapacityReservation>();
const healthChecks = new Map<string, HealthCheck>();
const stickySessions = new Map<string, string>(); // sessionId -> providerInstanceId

// Default load balancer config
const DEFAULT_CONFIG: LoadBalancerConfig = {
  strategy: 'least_loaded',
  healthCheckInterval: 30000, // 30s
  unhealthyThreshold: 3,
};

let loadBalancerConfig = DEFAULT_CONFIG;

// ============================================
// Provider Instance Management
// ============================================

export function registerProvider(
  name: string,
  type: ProviderInstance['type'],
  host: string,
  port: number,
  maxCapacity: number,
  capabilities: string[] = [],
  basePath?: string
): ProviderInstance {
  const id = uuidv4();
  const now = new Date().toISOString();

  const instance: ProviderInstance = {
    id,
    name,
    type,
    host,
    port,
    basePath,
    status: 'healthy',
    capabilities,
    currentLoad: 0,
    maxCapacity,
    lastHeartbeat: now,
    createdAt: now,
    updatedAt: now,
  };

  providerInstances.set(id, instance);
  return instance;
}

export function getProviderInstance(id: string): ProviderInstance | undefined {
  return providerInstances.get(id);
}

export function getProviderInstances(type?: string): ProviderInstance[] {
  let instances = Array.from(providerInstances.values());
  
  if (type) {
    instances = instances.filter(i => i.type === type);
  }

  return instances.filter(i => i.status !== 'unhealthy');
}

export function updateProviderStatus(
  id: string,
  status: ProviderInstance['status']
): ProviderInstance | undefined {
  const instance = providerInstances.get(id);
  if (!instance) {
    return undefined;
  }

  instance.status = status;
  instance.updatedAt = new Date().toISOString();
  providerInstances.set(id, instance);

  return instance;
}

export function updateProviderLoad(
  id: string,
  currentLoad: number
): ProviderInstance | undefined {
  const instance = providerInstances.get(id);
  if (!instance) {
    return undefined;
  }

  instance.currentLoad = currentLoad;
  instance.updatedAt = new Date().toISOString();
  providerInstances.set(id, instance);

  return instance;
}

export function heartbeat(id: string): ProviderInstance | undefined {
  const instance = providerInstances.get(id);
  if (!instance) {
    return undefined;
  }

  instance.lastHeartbeat = new Date().toISOString();
  instance.updatedAt = new Date().toISOString();
  providerInstances.set(id, instance);

  return instance;
}

// ============================================
// Health Monitoring
// ============================================

export function recordHealthCheck(check: Omit<HealthCheck, 'timestamp'>): HealthCheck {
  const healthCheck: HealthCheck = {
    ...check,
    timestamp: new Date().toISOString(),
  };

  healthChecks.set(check.providerInstanceId, healthCheck);

  // Update provider status based on health check
  const instance = providerInstances.get(check.providerInstanceId);
  if (instance) {
    if (check.status === 'unhealthy') {
      instance.status = 'unhealthy';
    } else if (check.status === 'degraded') {
      instance.status = 'degraded';
    }
    instance.updatedAt = new Date().toISOString();
    providerInstances.set(check.providerInstanceId, instance);
  }

  return healthCheck;
}

export function getHealthCheck(providerInstanceId: string): HealthCheck | undefined {
  return healthChecks.get(providerInstanceId);
}

// ============================================
// Load Balancing & Scheduling
// ============================================

export function setLoadBalancerConfig(config: Partial<LoadBalancerConfig>): void {
  loadBalancerConfig = { ...loadBalancerConfig, ...config };
}

export function selectProvider(capabilities: string[] = []): SchedulingDecision | null {
  const instances = getProviderInstances();
  
  if (instances.length === 0) {
    return null;
  }

  // Filter by capabilities
  const capableInstances = instances.filter(instance =>
    capabilities.every(cap => instance.capabilities.includes(cap))
  );

  if (capableInstances.length === 0) {
    return null;
  }

  // Apply load balancing strategy
  let selected: ProviderInstance;

  switch (loadBalancerConfig.strategy) {
    case 'round_robin':
      selected = roundRobinSelect(capableInstances);
      break;
    case 'least_loaded':
      selected = leastLoadedSelect(capableInstances);
      break;
    case 'weighted':
      selected = weightedSelect(capableInstances);
      break;
    case 'sticky':
      selected = stickySelect(capableInstances);
      break;
    default:
      selected = leastLoadedSelect(capableInstances);
  }

  return {
    providerInstanceId: selected.id,
    providerName: selected.name,
    reason: `Selected via ${loadBalancerConfig.strategy} strategy`,
    estimatedLatencyMs: 50, // Placeholder
    timestamp: new Date().toISOString(),
  };
}

function roundRobinSelect(instances: ProviderInstance[]): ProviderInstance {
  // Simple round-robin: select first (in production, maintain index)
  return instances[0];
}

function leastLoadedSelect(instances: ProviderInstance[]): ProviderInstance {
  // Select instance with lowest load percentage
  return instances.reduce((min, instance) => {
    const loadPercent = instance.currentLoad / instance.maxCapacity;
    const minPercent = min.currentLoad / min.maxCapacity;
    return loadPercent < minPercent ? instance : min;
  });
}

function weightedSelect(instances: ProviderInstance[]): ProviderInstance {
  // Select based on weights (higher weight = more likely)
  const weights = loadBalancerConfig.weights || {};
  
  // Sort by weight descending, then select first
  return instances.sort((a, b) => {
    const weightA = weights[a.id] || 1;
    const weightB = weights[b.id] || 1;
    return weightB - weightA;
  })[0];
}

function stickySelect(instances: ProviderInstance[]): ProviderInstance {
  // Check for sticky session (simplified - no session ID passed)
  // In production, extract session ID from request
  return instances[0];
}

// ============================================
// Capacity Reservations
// ============================================

export function reserveCapacity(
  tenantId: string,
  providerInstanceId: string,
  capacityUnits: number,
  durationSeconds: number
): CapacityReservation | null {
  const instance = providerInstances.get(providerInstanceId);
  if (!instance) {
    return null;
  }

  // Check available capacity
  const availableCapacity = instance.maxCapacity - instance.currentLoad;
  if (availableCapacity < capacityUnits) {
    return null;
  }

  const id = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationSeconds * 1000);

  const reservation: CapacityReservation = {
    id,
    tenantId,
    providerInstanceId,
    capacityUnits,
    status: 'active',
    reservedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  reservations.set(id, reservation);

  // Update instance load
  instance.currentLoad += capacityUnits;
  providerInstances.set(providerInstanceId, instance);

  return reservation;
}

export function releaseReservation(id: string): CapacityReservation | null {
  const reservation = reservations.get(id);
  if (!reservation || reservation.status !== 'active') {
    return null;
  }

  const instance = providerInstances.get(reservation.providerInstanceId);
  if (instance) {
    instance.currentLoad = Math.max(0, instance.currentLoad - reservation.capacityUnits);
    providerInstances.set(reservation.providerInstanceId, instance);
  }

  reservation.status = 'completed';
  reservation.completedAt = new Date().toISOString();
  reservations.set(id, reservation);

  return reservation;
}

export function getReservation(id: string): CapacityReservation | undefined {
  return reservations.get(id);
}

export function listReservations(tenantId?: string): CapacityReservation[] {
  let result = Array.from(reservations.values());
  
  if (tenantId) {
    result = result.filter(r => r.tenantId === tenantId);
  }

  return result.filter(r => r.status === 'active');
}

// ============================================
// Sticky Sessions
// ============================================

export function setStickySession(sessionId: string, providerInstanceId: string): void {
  stickySessions.set(sessionId, providerInstanceId);
}

export function getStickySession(sessionId: string): string | undefined {
  return stickySessions.get(sessionId);
}

export function clearStickySession(sessionId: string): void {
  stickySessions.delete(sessionId);
}

// ============================================
// Health Check Sweep
// ============================================

// Mark instances as unhealthy if no heartbeat
setInterval(() => {
  const now = Date.now();
  const heartbeatTimeout = loadBalancerConfig.healthCheckInterval * 2;

  for (const [id, instance] of providerInstances.entries()) {
    const lastHeartbeat = new Date(instance.lastHeartbeat).getTime();
    if (now - lastHeartbeat > heartbeatTimeout) {
      instance.status = 'unhealthy';
      instance.updatedAt = new Date().toISOString();
      providerInstances.set(id, instance);
      console.log(`Provider ${instance.name} marked unhealthy (no heartbeat)`);
    }
  }
}, loadBalancerConfig.healthCheckInterval);
