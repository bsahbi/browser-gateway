"use strict";
/**
 * Capacity Manager Service
 *
 * Manages distributed browser capacity:
 * - Provider instance registry
 * - Health-aware scheduling
 * - Capacity reservations
 * - Load balancing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerProvider = registerProvider;
exports.getProviderInstance = getProviderInstance;
exports.getProviderInstances = getProviderInstances;
exports.updateProviderStatus = updateProviderStatus;
exports.updateProviderLoad = updateProviderLoad;
exports.heartbeat = heartbeat;
exports.recordHealthCheck = recordHealthCheck;
exports.getHealthCheck = getHealthCheck;
exports.setLoadBalancerConfig = setLoadBalancerConfig;
exports.selectProvider = selectProvider;
exports.reserveCapacity = reserveCapacity;
exports.releaseReservation = releaseReservation;
exports.getReservation = getReservation;
exports.listReservations = listReservations;
exports.setStickySession = setStickySession;
exports.getStickySession = getStickySession;
exports.clearStickySession = clearStickySession;
const uuid_1 = require("uuid");
// In-memory stores (replace with Redis in production)
const providerInstances = new Map();
const reservations = new Map();
const healthChecks = new Map();
const stickySessions = new Map(); // sessionId -> providerInstanceId
// Default load balancer config
const DEFAULT_CONFIG = {
    strategy: 'least_loaded',
    healthCheckInterval: 30000, // 30s
    unhealthyThreshold: 3,
};
let loadBalancerConfig = DEFAULT_CONFIG;
// ============================================
// Provider Instance Management
// ============================================
function registerProvider(name, type, host, port, maxCapacity, capabilities = [], basePath) {
    const id = (0, uuid_1.v4)();
    const now = new Date().toISOString();
    const instance = {
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
function getProviderInstance(id) {
    return providerInstances.get(id);
}
function getProviderInstances(type) {
    let instances = Array.from(providerInstances.values());
    if (type) {
        instances = instances.filter(i => i.type === type);
    }
    return instances.filter(i => i.status !== 'unhealthy');
}
function updateProviderStatus(id, status) {
    const instance = providerInstances.get(id);
    if (!instance) {
        return undefined;
    }
    instance.status = status;
    instance.updatedAt = new Date().toISOString();
    providerInstances.set(id, instance);
    return instance;
}
function updateProviderLoad(id, currentLoad) {
    const instance = providerInstances.get(id);
    if (!instance) {
        return undefined;
    }
    instance.currentLoad = currentLoad;
    instance.updatedAt = new Date().toISOString();
    providerInstances.set(id, instance);
    return instance;
}
function heartbeat(id) {
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
function recordHealthCheck(check) {
    const healthCheck = {
        ...check,
        timestamp: new Date().toISOString(),
    };
    healthChecks.set(check.providerInstanceId, healthCheck);
    // Update provider status based on health check
    const instance = providerInstances.get(check.providerInstanceId);
    if (instance) {
        if (check.status === 'unhealthy') {
            instance.status = 'unhealthy';
        }
        else if (check.status === 'degraded') {
            instance.status = 'degraded';
        }
        instance.updatedAt = new Date().toISOString();
        providerInstances.set(check.providerInstanceId, instance);
    }
    return healthCheck;
}
function getHealthCheck(providerInstanceId) {
    return healthChecks.get(providerInstanceId);
}
// ============================================
// Load Balancing & Scheduling
// ============================================
function setLoadBalancerConfig(config) {
    loadBalancerConfig = { ...loadBalancerConfig, ...config };
}
function selectProvider(capabilities = []) {
    const instances = getProviderInstances();
    if (instances.length === 0) {
        return null;
    }
    // Filter by capabilities
    const capableInstances = instances.filter(instance => capabilities.every(cap => instance.capabilities.includes(cap)));
    if (capableInstances.length === 0) {
        return null;
    }
    // Apply load balancing strategy
    let selected;
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
function roundRobinSelect(instances) {
    // Simple round-robin: select first (in production, maintain index)
    return instances[0];
}
function leastLoadedSelect(instances) {
    // Select instance with lowest load percentage
    return instances.reduce((min, instance) => {
        const loadPercent = instance.currentLoad / instance.maxCapacity;
        const minPercent = min.currentLoad / min.maxCapacity;
        return loadPercent < minPercent ? instance : min;
    });
}
function weightedSelect(instances) {
    // Select based on weights (higher weight = more likely)
    const weights = loadBalancerConfig.weights || {};
    // Sort by weight descending, then select first
    return instances.sort((a, b) => {
        const weightA = weights[a.id] || 1;
        const weightB = weights[b.id] || 1;
        return weightB - weightA;
    })[0];
}
function stickySelect(instances) {
    // Check for sticky session (simplified - no session ID passed)
    // In production, extract session ID from request
    return instances[0];
}
// ============================================
// Capacity Reservations
// ============================================
function reserveCapacity(tenantId, providerInstanceId, capacityUnits, durationSeconds) {
    const instance = providerInstances.get(providerInstanceId);
    if (!instance) {
        return null;
    }
    // Check available capacity
    const availableCapacity = instance.maxCapacity - instance.currentLoad;
    if (availableCapacity < capacityUnits) {
        return null;
    }
    const id = (0, uuid_1.v4)();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationSeconds * 1000);
    const reservation = {
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
function releaseReservation(id) {
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
function getReservation(id) {
    return reservations.get(id);
}
function listReservations(tenantId) {
    let result = Array.from(reservations.values());
    if (tenantId) {
        result = result.filter(r => r.tenantId === tenantId);
    }
    return result.filter(r => r.status === 'active');
}
// ============================================
// Sticky Sessions
// ============================================
function setStickySession(sessionId, providerInstanceId) {
    stickySessions.set(sessionId, providerInstanceId);
}
function getStickySession(sessionId) {
    return stickySessions.get(sessionId);
}
function clearStickySession(sessionId) {
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
