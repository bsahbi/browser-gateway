"use strict";
/**
 * Distributed System Service
 *
 * Multi-host browser gateway orchestration:
 * - Provider registration across hosts
 * - Health-aware scheduling
 * - Capacity management with Redis
 * - Load balancing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDistributedSystem = exports.DistributedSystem = void 0;
const ioredis_1 = require("ioredis");
const uuid_1 = require("uuid");
// Redis keys
const KEYS = {
    PROVIDERS: 'gateway:providers',
    PROVIDER: (id) => `gateway:providers:${id}`,
    HEALTH: (id) => `gateway:health:${id}`,
    RESERVATIONS: 'gateway:reservations',
    RESERVATION: (id) => `gateway:reservations:${id}`,
    HOSTS: 'gateway:hosts',
    HOST: (id) => `gateway:hosts:${id}`,
};
class DistributedSystem {
    config;
    redis;
    hostId = '';
    constructor(config) {
        this.config = {
            redisUrl: config.redisUrl,
            hostId: config.hostId || (0, uuid_1.v4)(),
            hostName: config.hostName || `host-${(0, uuid_1.v4)().substring(0, 8)}`,
            heartbeatIntervalMs: config.heartbeatIntervalMs || 30000,
            reservationTTLSeconds: config.reservationTTLSeconds || 300,
        };
        this.redis = new ioredis_1.Redis(this.config.redisUrl, {
            maxRetriesPerRequest: 3,
        });
        // Start heartbeat
        this.startHeartbeat();
    }
    // ============================================
    // Provider Registration
    // ============================================
    async registerProvider(name, type, host, port, maxCapacity, capabilities = [], basePath) {
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
        // Store in Redis
        await this.redis.set(KEYS.PROVIDER(id), JSON.stringify(instance), 'EX', 3600 // 1 hour TTL
        );
        await this.redis.sadd(KEYS.PROVIDERS, id);
        return instance;
    }
    async getProvider(id) {
        const data = await this.redis.get(KEYS.PROVIDER(id));
        return data ? JSON.parse(data) : null;
    }
    async listProviders(type) {
        const ids = await this.redis.smembers(KEYS.PROVIDERS);
        const providers = [];
        for (const id of ids) {
            const data = await this.redis.get(KEYS.PROVIDER(id));
            if (data) {
                const provider = JSON.parse(data);
                if (!type || provider.type === type) {
                    if (provider.status !== 'unhealthy') {
                        providers.push(provider);
                    }
                }
            }
        }
        return providers;
    }
    async updateProviderStatus(id, status) {
        const provider = await this.getProvider(id);
        if (provider) {
            provider.status = status;
            provider.updatedAt = new Date().toISOString();
            await this.redis.set(KEYS.PROVIDER(id), JSON.stringify(provider), 'EX', 3600);
        }
    }
    async updateProviderLoad(id, currentLoad) {
        const provider = await this.getProvider(id);
        if (provider) {
            provider.currentLoad = currentLoad;
            provider.updatedAt = new Date().toISOString();
            await this.redis.set(KEYS.PROVIDER(id), JSON.stringify(provider), 'EX', 3600);
        }
    }
    // ============================================
    // Health Monitoring
    // ============================================
    async recordHealthCheck(check) {
        const healthCheck = {
            ...check,
            timestamp: new Date().toISOString(),
        };
        await this.redis.set(KEYS.HEALTH(check.providerInstanceId), JSON.stringify(healthCheck), 'EX', 300 // 5 min TTL
        );
        // Update provider status
        if (check.status === 'unhealthy') {
            await this.updateProviderStatus(check.providerInstanceId, 'unhealthy');
        }
        else if (check.status === 'healthy') {
            await this.updateProviderStatus(check.providerInstanceId, 'healthy');
        }
        return healthCheck;
    }
    async getHealthCheck(providerInstanceId) {
        const data = await this.redis.get(KEYS.HEALTH(providerInstanceId));
        return data ? JSON.parse(data) : null;
    }
    // ============================================
    // Capacity Reservations
    // ============================================
    async reserveCapacity(tenantId, providerInstanceId, capacityUnits) {
        const provider = await this.getProvider(providerInstanceId);
        if (!provider) {
            return null;
        }
        // Check available capacity (atomic check in production)
        const availableCapacity = provider.maxCapacity - provider.currentLoad;
        if (availableCapacity < capacityUnits) {
            return null;
        }
        const id = (0, uuid_1.v4)();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + this.config.reservationTTLSeconds * 1000);
        const reservation = {
            id,
            tenantId,
            providerInstanceId,
            capacityUnits,
            status: 'active',
            reservedAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
        };
        // Store reservation
        await this.redis.set(KEYS.RESERVATION(id), JSON.stringify(reservation), 'EX', this.config.reservationTTLSeconds);
        await this.redis.sadd(KEYS.RESERVATIONS, id);
        // Update provider load
        provider.currentLoad += capacityUnits;
        await this.redis.set(KEYS.PROVIDER(providerInstanceId), JSON.stringify(provider), 'EX', 3600);
        return reservation;
    }
    async releaseReservation(id) {
        const data = await this.redis.get(KEYS.RESERVATION(id));
        if (!data) {
            return null;
        }
        const reservation = JSON.parse(data);
        if (reservation.status !== 'active') {
            return null;
        }
        // Release capacity
        const provider = await this.getProvider(reservation.providerInstanceId);
        if (provider) {
            provider.currentLoad = Math.max(0, provider.currentLoad - reservation.capacityUnits);
            await this.redis.set(KEYS.PROVIDER(reservation.providerInstanceId), JSON.stringify(provider), 'EX', 3600);
        }
        // Update reservation status
        reservation.status = 'completed';
        reservation.completedAt = new Date().toISOString();
        await this.redis.set(KEYS.RESERVATION(id), JSON.stringify(reservation), 'EX', 3600);
        return reservation;
    }
    async getReservation(id) {
        const data = await this.redis.get(KEYS.RESERVATION(id));
        return data ? JSON.parse(data) : null;
    }
    // ============================================
    // Host Management
    // ============================================
    async registerHost() {
        const host = {
            id: this.config.hostId,
            name: this.config.hostName,
            registeredAt: new Date().toISOString(),
            lastHeartbeat: new Date().toISOString(),
        };
        await this.redis.set(KEYS.HOST(this.config.hostId), JSON.stringify(host), 'EX', 300 // 5 min TTL
        );
        await this.redis.sadd(KEYS.HOSTS, this.config.hostId);
    }
    async startHeartbeat() {
        await this.registerHost();
        setInterval(async () => {
            try {
                await this.registerHost();
                console.log(`Heartbeat sent for host ${this.config.hostName}`);
            }
            catch (error) {
                console.error('Heartbeat failed:', error);
            }
        }, this.config.heartbeatIntervalMs);
    }
    async listHosts() {
        const ids = await this.redis.smembers(KEYS.HOSTS);
        const hosts = [];
        for (const id of ids) {
            const data = await this.redis.get(KEYS.HOST(id));
            if (data) {
                hosts.push(JSON.parse(data));
            }
        }
        return hosts;
    }
    // ============================================
    // Load Balancing
    // ============================================
    async selectProvider(capabilities = [], strategy = 'least_loaded') {
        const providers = await this.listProviders();
        if (providers.length === 0) {
            return null;
        }
        // Filter by capabilities
        const capableProviders = providers.filter(p => capabilities.every(cap => p.capabilities.includes(cap)));
        if (capableProviders.length === 0) {
            return null;
        }
        // Apply strategy
        switch (strategy) {
            case 'round_robin':
                return capableProviders[0];
            case 'least_loaded':
                return capableProviders.reduce((min, p) => {
                    const loadPercent = p.currentLoad / p.maxCapacity;
                    const minPercent = min.currentLoad / min.maxCapacity;
                    return loadPercent < minPercent ? p : min;
                });
            case 'weighted':
                // Simple implementation - could be enhanced with weight config
                return capableProviders[0];
            case 'sticky':
                return capableProviders[0];
            default:
                return capableProviders[0];
        }
    }
    // ============================================
    // Cleanup
    // ============================================
    async shutdown() {
        await this.redis.quit();
    }
}
exports.DistributedSystem = DistributedSystem;
const createDistributedSystem = (config) => {
    return new DistributedSystem(config);
};
exports.createDistributedSystem = createDistributedSystem;
