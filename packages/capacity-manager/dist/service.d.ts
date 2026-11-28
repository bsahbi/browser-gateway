/**
 * Capacity Manager Service
 *
 * Manages distributed browser capacity:
 * - Provider instance registry
 * - Health-aware scheduling
 * - Capacity reservations
 * - Load balancing
 */
import { ProviderInstance, CapacityReservation, LoadBalancerConfig, HealthCheck, SchedulingDecision } from './schemas';
export declare function registerProvider(name: string, type: ProviderInstance['type'], host: string, port: number, maxCapacity: number, capabilities?: string[], basePath?: string): ProviderInstance;
export declare function getProviderInstance(id: string): ProviderInstance | undefined;
export declare function getProviderInstances(type?: string): ProviderInstance[];
export declare function updateProviderStatus(id: string, status: ProviderInstance['status']): ProviderInstance | undefined;
export declare function updateProviderLoad(id: string, currentLoad: number): ProviderInstance | undefined;
export declare function heartbeat(id: string): ProviderInstance | undefined;
export declare function recordHealthCheck(check: Omit<HealthCheck, 'timestamp'>): HealthCheck;
export declare function getHealthCheck(providerInstanceId: string): HealthCheck | undefined;
export declare function setLoadBalancerConfig(config: Partial<LoadBalancerConfig>): void;
export declare function selectProvider(capabilities?: string[]): SchedulingDecision | null;
export declare function reserveCapacity(tenantId: string, providerInstanceId: string, capacityUnits: number, durationSeconds: number): CapacityReservation | null;
export declare function releaseReservation(id: string): CapacityReservation | null;
export declare function getReservation(id: string): CapacityReservation | undefined;
export declare function listReservations(tenantId?: string): CapacityReservation[];
export declare function setStickySession(sessionId: string, providerInstanceId: string): void;
export declare function getStickySession(sessionId: string): string | undefined;
export declare function clearStickySession(sessionId: string): void;
