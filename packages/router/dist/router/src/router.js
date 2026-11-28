"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRouter = exports.BrowserRouter = void 0;
const contracts_1 = require("@browser-gateway/contracts");
class BrowserRouter {
    providers;
    defaultProvider;
    providerHealthCache = new Map();
    healthCheckInterval = null;
    constructor(config) {
        this.providers = config.providers;
        this.defaultProvider = config.defaultProvider;
        this.startHealthChecks();
    }
    /**
     * Get list of available providers with their capabilities
     */
    async getCapabilities() {
        const descriptors = [];
        for (const [name, provider] of this.providers.entries()) {
            try {
                descriptors.push(await provider.describe());
            }
            catch (error) {
                descriptors.push({
                    name,
                    version: 'unknown',
                    capabilities: [],
                    health: 'unavailable',
                    limits: {
                        maxConcurrentJobs: 0,
                        maxPagesPerCrawl: 0,
                        maxTimeoutSeconds: 0,
                        maxFileSizeBytes: 0,
                    },
                    supportsAsync: false,
                    supportsSessions: false,
                });
            }
        }
        return descriptors;
    }
    /**
     * Resolve provider for a request
     */
    async resolveProvider(requestedProvider, capability) {
        // Explicit provider selection
        if (requestedProvider) {
            const provider = this.providers.get(requestedProvider);
            if (!provider) {
                throw {
                    code: contracts_1.ERROR_CODES.PROVIDER_UNAVAILABLE,
                    message: `Provider '${requestedProvider}' not found`,
                };
            }
            const descriptor = await provider.describe();
            if (capability && !descriptor.capabilities.includes(capability)) {
                throw {
                    code: contracts_1.ERROR_CODES.UNSUPPORTED_CAPABILITY,
                    message: `Provider '${requestedProvider}' does not support '${capability}'`,
                };
            }
            if (descriptor.health === 'unavailable') {
                throw {
                    code: contracts_1.ERROR_CODES.PROVIDER_UNAVAILABLE,
                    message: `Provider '${requestedProvider}' is unavailable`,
                };
            }
            return provider;
        }
        // Auto-resolution: find best healthy provider with capability
        for (const [name, provider] of this.providers.entries()) {
            try {
                const descriptor = await provider.describe();
                if (descriptor.health !== 'unavailable' &&
                    (!capability || descriptor.capabilities.includes(capability))) {
                    return provider;
                }
            }
            catch {
                // Skip unhealthy providers
                continue;
            }
        }
        throw {
            code: contracts_1.ERROR_CODES.PROVIDER_UNAVAILABLE,
            message: 'No healthy provider available for requested capability',
        };
    }
    /**
     * Execute a browser acquisition request
     */
    async execute(request) {
        const provider = await this.resolveProvider(request.provider, request.capability);
        return provider.execute(request);
    }
    /**
     * Get job status
     */
    async getJob(jobId, provider) {
        let targetProvider;
        if (provider) {
            targetProvider = this.providers.get(provider);
            if (!targetProvider) {
                throw {
                    code: contracts_1.ERROR_CODES.PROVIDER_UNAVAILABLE,
                    message: `Provider '${provider}' not found`,
                };
            }
        }
        else {
            // Try default provider
            targetProvider = this.providers.get(this.defaultProvider);
            if (!targetProvider) {
                throw {
                    code: contracts_1.ERROR_CODES.PROVIDER_UNAVAILABLE,
                    message: 'No default provider configured',
                };
            }
        }
        if (!targetProvider.getJob) {
            throw {
                code: contracts_1.ERROR_CODES.CANCEL_UNSUPPORTED,
                message: 'Job status not supported by provider',
            };
        }
        const status = await targetProvider.getJob(jobId);
        if (!status) {
            throw {
                code: contracts_1.ERROR_CODES.JOB_NOT_FOUND,
                message: `Job '${jobId}' not found`,
            };
        }
        return status;
    }
    /**
     * Cancel a job
     */
    async cancel(jobId, provider) {
        let targetProvider;
        if (provider) {
            targetProvider = this.providers.get(provider);
            if (!targetProvider) {
                throw {
                    code: contracts_1.ERROR_CODES.PROVIDER_UNAVAILABLE,
                    message: `Provider '${provider}' not found`,
                };
            }
        }
        else {
            targetProvider = this.providers.get(this.defaultProvider);
            if (!targetProvider) {
                throw {
                    code: contracts_1.ERROR_CODES.PROVIDER_UNAVAILABLE,
                    message: 'No default provider configured',
                };
            }
        }
        if (!targetProvider.cancel) {
            throw {
                code: contracts_1.ERROR_CODES.CANCEL_UNSUPPORTED,
                message: 'Job cancellation not supported by provider',
            };
        }
        return targetProvider.cancel(jobId);
    }
    /**
     * Start periodic health checks for all providers
     */
    startHealthChecks() {
        this.healthCheckInterval = setInterval(async () => {
            for (const [name, provider] of this.providers.entries()) {
                try {
                    const health = await provider.health();
                    this.providerHealthCache.set(name, {
                        name,
                        version: 'unknown',
                        capabilities: [],
                        health: health.status,
                        limits: {
                            maxConcurrentJobs: 0,
                            maxPagesPerCrawl: 0,
                            maxTimeoutSeconds: 0,
                            maxFileSizeBytes: 0,
                        },
                        supportsAsync: false,
                        supportsSessions: false,
                    });
                }
                catch {
                    this.providerHealthCache.set(name, {
                        name,
                        version: 'unknown',
                        capabilities: [],
                        health: 'unavailable',
                        limits: {
                            maxConcurrentJobs: 0,
                            maxPagesPerCrawl: 0,
                            maxTimeoutSeconds: 0,
                            maxFileSizeBytes: 0,
                        },
                        supportsAsync: false,
                        supportsSessions: false,
                    });
                }
            }
        }, 30000); // Check every 30 seconds
    }
    /**
     * Shutdown router and cleanup
     */
    async shutdown() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }
}
exports.BrowserRouter = BrowserRouter;
const createRouter = (config) => {
    return new BrowserRouter(config);
};
exports.createRouter = createRouter;
