/**
 * Distributed System Service
 * 
 * Multi-host browser gateway orchestration:
 * - Provider registration across hosts
 * - Health-aware scheduling
 * - Capacity management with Redis
 * - Load balancing
 */

import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import {
  ProviderInstance,
  CapacityReservation,
  LoadBalanceStrategy,
  HealthCheck,
  createId,
} from '@browser-gateway/capacity-manager';

// Redis keys
const KEYS = {
  PROVIDERS: 'gateway:providers',
  PROVIDER: (id: string) => `gateway:providers:${id}`,
  HEALTH: (id: string) => `gateway:health:${id}`,
  RESERVATIONS: 'gateway:reservations',
  RESERVATION: (id: string) => `gateway:reservations:${id}`,
  HOSTS: 'gateway:hosts',
  HOST: (id: string) => `gateway:hosts:${id}`,
};

export interface DistributedSystemConfig {
  redisUrl: string;
  hostId?: string;
  hostName?: string;
  heartbeatIntervalMs?: number;
  reservationTTLSeconds?: number;
}

export class DistributedSystem {
  private config: Required<DistributedSystemConfig>;
  private redis: Redis;
  private hostId: string;

  constructor(config: DistributedSystemConfig) {
    this.config = {
      redisUrl: config.redisUrl,
      hostId: config.hostId || uuidv4(),
      hostName: config.hostName || `host-${uuidv4().substring(0, 8)}`,
      heartbeatIntervalMs: config.heartbeatIntervalMs || 30000,
      reservationTTLSeconds: config.reservationTTLSeconds || 300,
    };

    this.redis = new Redis(this.config.redisUrl, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
    });

    // Start heartbeat
    this.startHeartbeat();
  }

  // ============================================
  // Provider Registration
  // ============================================

  async registerProvider(
    name: string,
    type: ProviderInstance['type'],
    host: string,
    port: number,
    maxCapacity: number,
    capabilities: string[] = [],
    basePath?: string
  ): Promise<ProviderInstance> {
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

    // Store in Redis
    await this.redis.set(
      KEYS.PROVIDER(id),
      JSON.stringify(instance),
      'EX',
      3600 // 1 hour TTL
    );
    await this.redis.sadd(KEYS.PROVIDERS, id);

    return instance;
  }

  async getProvider(id: string): Promise<ProviderInstance | null> {
    const data = await this.redis.get(KEYS.PROVIDER(id));
    return data ? JSON.parse(data) : null;
  }

  async listProviders(type?: string): Promise<ProviderInstance[]> {
    const ids = await this.redis.smembers(KEYS.PROVIDERS);
    const providers: ProviderInstance[] = [];

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

  async updateProviderStatus(id: string, status: ProviderInstance['status']): Promise<void> {
    const provider = await this.getProvider(id);
    if (provider) {
      provider.status = status;
      provider.updatedAt = new Date().toISOString();
      await this.redis.set(KEYS.PROVIDER(id), JSON.stringify(provider), 'EX', 3600);
    }
  }

  async updateProviderLoad(id: string, currentLoad: number): Promise<void> {
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

  async recordHealthCheck(check: Omit<HealthCheck, 'timestamp'>): Promise<HealthCheck> {
    const healthCheck: HealthCheck = {
      ...check,
      timestamp: new Date().toISOString(),
    };

    await this.redis.set(
      KEYS.HEALTH(check.providerInstanceId),
      JSON.stringify(healthCheck),
      'EX',
      300 // 5 min TTL
    );

    // Update provider status
    if (check.status === 'unhealthy') {
      await this.updateProviderStatus(check.providerInstanceId, 'unhealthy');
    } else if (check.status === 'healthy') {
      await this.updateProviderStatus(check.providerInstanceId, 'healthy');
    }

    return healthCheck;
  }

  async getHealthCheck(providerInstanceId: string): Promise<HealthCheck | null> {
    const data = await this.redis.get(KEYS.HEALTH(providerInstanceId));
    return data ? JSON.parse(data) : null;
  }

  // ============================================
  // Capacity Reservations
  // ============================================

  async reserveCapacity(
    tenantId: string,
    providerInstanceId: string,
    capacityUnits: number
  ): Promise<CapacityReservation | null> {
    const provider = await this.getProvider(providerInstanceId);
    if (!provider) {
      return null;
    }

    // Check available capacity (atomic check in production)
    const availableCapacity = provider.maxCapacity - provider.currentLoad;
    if (availableCapacity < capacityUnits) {
      return null;
    }

    const id = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.reservationTTLSeconds * 1000);

    const reservation: CapacityReservation = {
      id,
      tenantId,
      providerInstanceId,
      capacityUnits,
      status: 'active',
      reservedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    // Store reservation
    await this.redis.set(
      KEYS.RESERVATION(id),
      JSON.stringify(reservation),
      'EX',
      this.config.reservationTTLSeconds
    );
    await this.redis.sadd(KEYS.RESERVATIONS, id);

    // Update provider load
    provider.currentLoad += capacityUnits;
    await this.redis.set(KEYS.PROVIDER(providerInstanceId), JSON.stringify(provider), 'EX', 3600);

    return reservation;
  }

  async releaseReservation(id: string): Promise<CapacityReservation | null> {
    const data = await this.redis.get(KEYS.RESERVATION(id));
    if (!data) {
      return null;
    }

    const reservation: CapacityReservation = JSON.parse(data);
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

  async getReservation(id: string): Promise<CapacityReservation | null> {
    const data = await this.redis.get(KEYS.RESERVATION(id));
    return data ? JSON.parse(data) : null;
  }

  // ============================================
  // Host Management
  // ============================================

  async registerHost(): Promise<void> {
    const host = {
      id: this.config.hostId,
      name: this.config.hostName,
      registeredAt: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString(),
    };

    await this.redis.set(
      KEYS.HOST(this.config.hostId),
      JSON.stringify(host),
      'EX',
      300 // 5 min TTL
    );
    await this.redis.sadd(KEYS.HOSTS, this.config.hostId);
  }

  private async startHeartbeat(): Promise<void> {
    await this.registerHost();

    setInterval(async () => {
      try {
        await this.registerHost();
        console.log(`Heartbeat sent for host ${this.config.hostName}`);
      } catch (error) {
        console.error('Heartbeat failed:', error);
      }
    }, this.config.heartbeatIntervalMs);
  }

  async listHosts(): Promise<any[]> {
    const ids = await this.redis.smembers(KEYS.HOSTS);
    const hosts: any[] = [];

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

  async selectProvider(
    capabilities: string[] = [],
    strategy: LoadBalanceStrategy = 'least_loaded'
  ): Promise<ProviderInstance | null> {
    const providers = await this.listProviders();

    if (providers.length === 0) {
      return null;
    }

    // Filter by capabilities
    const capableProviders = providers.filter(p =>
      capabilities.every(cap => p.capabilities.includes(cap))
    );

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

  async shutdown(): Promise<void> {
    await this.redis.quit();
  }
}

export const createDistributedSystem = (config: DistributedSystemConfig): DistributedSystem => {
  return new DistributedSystem(config);
};
