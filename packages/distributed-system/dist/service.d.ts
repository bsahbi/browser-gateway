/**
 * Distributed System Service
 *
 * Multi-host browser gateway orchestration:
 * - Provider registration across hosts
 * - Health-aware scheduling
 * - Capacity management with Redis
 * - Load balancing
 */
import { ProviderInstance, CapacityReservation, LoadBalanceStrategy, HealthCheck } from '@browser-gateway/capacity-manager';
export interface DistributedSystemConfig {
    redisUrl: string;
    hostId?: string;
    hostName?: string;
    heartbeatIntervalMs?: number;
    reservationTTLSeconds?: number;
}
export declare class DistributedSystem {
    private config;
    private redis;
    private hostId;
    constructor(config: DistributedSystemConfig);
    registerProvider(name: string, type: ProviderInstance['type'], host: string, port: number, maxCapacity: number, capabilities?: string[], basePath?: string): Promise<ProviderInstance>;
    getProvider(id: string): Promise<ProviderInstance | null>;
    listProviders(type?: string): Promise<ProviderInstance[]>;
    updateProviderStatus(id: string, status: ProviderInstance['status']): Promise<void>;
    updateProviderLoad(id: string, currentLoad: number): Promise<void>;
    recordHealthCheck(check: Omit<HealthCheck, 'timestamp'>): Promise<HealthCheck>;
    getHealthCheck(providerInstanceId: string): Promise<HealthCheck | null>;
    reserveCapacity(tenantId: string, providerInstanceId: string, capacityUnits: number): Promise<CapacityReservation | null>;
    releaseReservation(id: string): Promise<CapacityReservation | null>;
    getReservation(id: string): Promise<CapacityReservation | null>;
    registerHost(): Promise<void>;
    private startHeartbeat;
    listHosts(): Promise<any[]>;
    selectProvider(capabilities?: string[], strategy?: LoadBalanceStrategy): Promise<ProviderInstance | null>;
    shutdown(): Promise<void>;
}
export declare const createDistributedSystem: (config: DistributedSystemConfig) => DistributedSystem;
