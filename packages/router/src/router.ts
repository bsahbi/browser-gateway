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

import {
  BrowserProvider,
  ProviderDescriptor,
  ExecutionRequest,
  ExecutionResult,
  ERROR_CODES,
  GatewayError,
  JobStatus,
  CancelResult,
} from '@browser-gateway/contracts';

export interface RouterConfig {
  providers: Map<string, BrowserProvider>;
  defaultProvider: string;
}

export class BrowserRouter {
  private providers: Map<string, BrowserProvider>;
  private defaultProvider: string;
  private providerHealthCache: Map<string, ProviderDescriptor> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: RouterConfig) {
    this.providers = config.providers;
    this.defaultProvider = config.defaultProvider;
    this.startHealthChecks();
  }

  /**
   * Get list of available providers with their capabilities
   */
  async getCapabilities(): Promise<ProviderDescriptor[]> {
    const descriptors: ProviderDescriptor[] = [];
    for (const [name, provider] of this.providers.entries()) {
      try {
        descriptors.push(await provider.describe());
      } catch (error) {
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
  private async resolveProvider(
    requestedProvider?: string,
    capability?: string
  ): Promise<BrowserProvider> {
    // Explicit provider selection
    if (requestedProvider) {
      const provider = this.providers.get(requestedProvider);
      if (!provider) {
        throw {
          code: ERROR_CODES.PROVIDER_UNAVAILABLE,
          message: `Provider '${requestedProvider}' not found`,
        } as GatewayError;
      }
      const descriptor = await provider.describe();
      if (capability && !descriptor.capabilities.includes(capability as any)) {
        throw {
          code: ERROR_CODES.UNSUPPORTED_CAPABILITY,
          message: `Provider '${requestedProvider}' does not support '${capability}'`,
        } as GatewayError;
      }
      if (descriptor.health === 'unavailable') {
        throw {
          code: ERROR_CODES.PROVIDER_UNAVAILABLE,
          message: `Provider '${requestedProvider}' is unavailable`,
        } as GatewayError;
      }
      return provider;
    }

    // Auto-resolution: find best healthy provider with capability
    for (const [name, provider] of this.providers.entries()) {
      try {
        const descriptor = await provider.describe();
        if (
          descriptor.health !== 'unavailable' &&
          (!capability || descriptor.capabilities.includes(capability as any))
        ) {
          return provider;
        }
      } catch {
        // Skip unhealthy providers
        continue;
      }
    }

    throw {
      code: ERROR_CODES.PROVIDER_UNAVAILABLE,
      message: 'No healthy provider available for requested capability',
    } as GatewayError;
  }

  /**
   * Execute a browser acquisition request
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const provider = await this.resolveProvider(request.provider, request.capability);
    return provider.execute(request);
  }

  /**
   * Get job status
   */
  async getJob(jobId: string, provider?: string): Promise<JobStatus> {
    let targetProvider: BrowserProvider;

    if (provider) {
      targetProvider = this.providers.get(provider)!;
      if (!targetProvider) {
        throw {
          code: ERROR_CODES.PROVIDER_UNAVAILABLE,
          message: `Provider '${provider}' not found`,
        } as GatewayError;
      }
    } else {
      // Try default provider
      targetProvider = this.providers.get(this.defaultProvider)!;
      if (!targetProvider) {
        throw {
          code: ERROR_CODES.PROVIDER_UNAVAILABLE,
          message: 'No default provider configured',
        } as GatewayError;
      }
    }

    if (!targetProvider.getJob) {
      throw {
        code: ERROR_CODES.CANCEL_UNSUPPORTED,
        message: 'Job status not supported by provider',
      } as GatewayError;
    }

    const status = await targetProvider.getJob(jobId);
    if (!status) {
      throw {
        code: ERROR_CODES.JOB_NOT_FOUND,
        message: `Job '${jobId}' not found`,
      } as GatewayError;
    }

    return status;
  }

  /**
   * Cancel a job
   */
  async cancel(jobId: string, provider?: string): Promise<CancelResult> {
    let targetProvider: BrowserProvider;

    if (provider) {
      targetProvider = this.providers.get(provider)!;
      if (!targetProvider) {
        throw {
          code: ERROR_CODES.PROVIDER_UNAVAILABLE,
          message: `Provider '${provider}' not found`,
        } as GatewayError;
      }
    } else {
      targetProvider = this.providers.get(this.defaultProvider)!;
      if (!targetProvider) {
        throw {
          code: ERROR_CODES.PROVIDER_UNAVAILABLE,
          message: 'No default provider configured',
        } as GatewayError;
      }
    }

    if (!targetProvider.cancel) {
      throw {
        code: ERROR_CODES.CANCEL_UNSUPPORTED,
        message: 'Job cancellation not supported by provider',
      } as GatewayError;
    }

    return targetProvider.cancel(jobId);
  }

  /**
   * Start periodic health checks for all providers
   */
  private startHealthChecks(): void {
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
        } catch {
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
  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

export const createRouter = (config: RouterConfig): BrowserRouter => {
  return new BrowserRouter(config);
};
