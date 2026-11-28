/**
 * Browser Router
 *
 * Routes browser acquisition requests to appropriate providers.
 * Supports explicit provider selection or auto-resolution based on:
 * - Provider health
 * - Capability matching
 * - Entitlements
 * - Rate limits
 */
import { BrowserProvider, ProviderDescriptor, ExecutionRequest, ExecutionResult, JobStatus, CancelResult } from '@browser-gateway/contracts';
export interface RouterConfig {
    providers: Map<string, BrowserProvider>;
    defaultProvider: string;
}
export declare class BrowserRouter {
    private providers;
    private defaultProvider;
    private providerHealthCache;
    private healthCheckInterval;
    constructor(config: RouterConfig);
    /**
     * Get list of available providers with their capabilities
     */
    getCapabilities(): Promise<ProviderDescriptor[]>;
    /**
     * Resolve provider for a request
     */
    private resolveProvider;
    /**
     * Execute a browser acquisition request
     */
    execute(request: ExecutionRequest): Promise<ExecutionResult>;
    /**
     * Get job status
     */
    getJob(jobId: string, provider?: string): Promise<JobStatus>;
    /**
     * Cancel a job
     */
    cancel(jobId: string, provider?: string): Promise<CancelResult>;
    /**
     * Start periodic health checks for all providers
     */
    private startHealthChecks;
    /**
     * Shutdown router and cleanup
     */
    shutdown(): Promise<void>;
}
export declare const createRouter: (config: RouterConfig) => BrowserRouter;
