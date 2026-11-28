/**
 * Firecrawl Provider Adapter
 * 
 * Implements the BrowserProvider interface for Firecrawl API.
 * Maps gateway requests to Firecrawl v2 API endpoints.
 */

import {
  BrowserProvider,
  ProviderDescriptor,
  ProviderHealth,
  ProviderHealthStatus,
  ExecutionRequest,
  ExecutionResult,
  JobStatus,
  CancelResult,
  ERROR_CODES,
  GatewayError,
} from '@browser-gateway/contracts';

export interface FirecrawlProviderConfig {
  apiUrl: string;
  apiKey?: string;
  timeoutMs?: number;
}

interface FirecrawlScrapeRequest {
  url: string;
  formats?: string[];
  waitFor?: number;
  timeout?: number;
  [key: string]: unknown;
}

interface FirecrawlCrawlRequest {
  url: string;
  limit?: number;
  scrapeOptions?: {
    formats?: string[];
    waitFor?: number;
  };
  [key: string]: unknown;
}

interface FirecrawlScrapeResponse {
  success: boolean;
  data?: {
    markdown?: string;
    html?: string;
    content?: string;
    [key: string]: unknown;
  };
  error?: string;
}

interface FirecrawlCrawlResponse {
  success: boolean;
  id?: string;
  error?: string;
}

interface FirecrawlJobStatus {
  success: boolean;
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  data?: unknown;
  error?: string;
  current?: number;
  total?: number;
}

export class FirecrawlProvider implements BrowserProvider {
  private config: FirecrawlProviderConfig;
  private descriptor: ProviderDescriptor;

  constructor(config: FirecrawlProviderConfig) {
    this.config = {
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
      timeoutMs: config.timeoutMs || 60000,
    };

    this.descriptor = {
      name: 'firecrawl',
      version: '2.11.162',
      capabilities: [
        'browser.scrape',
        'browser.crawl',
        'browser.job.get',
      ],
      health: 'healthy',
      limits: {
        maxConcurrentJobs: 3,
        maxPagesPerCrawl: 100,
        maxTimeoutSeconds: 300,
        maxFileSizeBytes: 10 * 1024 * 1024, // 10MB
      },
      supportsAsync: true,
      supportsSessions: false,
    };
  }

  async describe(): Promise<ProviderDescriptor> {
    return this.descriptor;
  }

  async health(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      const response = await fetch(
        `${this.config.apiUrl}/v0/health/readiness`,
        { method: 'GET', timeout: 5000 }
      );
      const status = response.ok ? 'healthy' : 'degraded';
      return {
        status,
        lastCheck: new Date(),
        latencyMs: Date.now() - start,
        ...(status !== 'healthy' && { error: 'Health check failed' }),
      };
    } catch (error) {
      return {
        status: 'unavailable',
        lastCheck: new Date(),
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const startedAt = new Date();

    try {
      switch (request.capability) {
        case 'browser.scrape':
          return await this.scrape(request, startedAt);
        case 'browser.crawl':
          return await this.crawl(request, startedAt);
        case 'browser.job.get':
          return await this.getJobStatus(request, startedAt);
        default:
          throw {
            code: ERROR_CODES.UNSUPPORTED_CAPABILITY,
            message: `Capability '${request.capability}' not supported`,
          } as GatewayError;
      }
    } catch (error) {
      const gatewayError = error as GatewayError;
      return {
        status: 'failed',
        provider: 'firecrawl',
        error: {
          code: gatewayError.code,
          message: gatewayError.message,
        },
        timestamps: {
          startedAt: startedAt.toISOString(),
        },
        provenance: {
          requestId: request.requestId,
          tenantId: request.tenantId,
        },
      };
    }
  }

  private async scrape(
    request: ExecutionRequest,
    startedAt: Date
  ): Promise<ExecutionResult> {
    const body: FirecrawlScrapeRequest = {
      url: request.target.url,
      formats: request.target.options?.formats || ['markdown'],
    };

    if (request.constraints?.timeoutSeconds) {
      body.timeout = request.constraints.timeoutSeconds * 1000;
    }
    if (request.target.options?.waitFor) {
      body.waitFor = request.target.options.waitFor;
    }

    const response = await fetch(`${this.config.apiUrl}/v2/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });

    const data: FirecrawlScrapeResponse = await response.json();

    if (!data.success) {
      throw {
        code: ERROR_CODES.INVALID_REQUEST,
        message: data.error || 'Scrape failed',
      } as GatewayError;
    }

    const durationMs = Date.now() - startedAt.getTime();
    return {
      status: 'completed',
      provider: 'firecrawl',
      result: data.data,
      usage: {
        pages: 1,
        bytesDownloaded: 0,
        bytesReturned: JSON.stringify(data.data).length,
        durationMs,
      },
      timestamps: {
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
      },
      provenance: {
        requestId: request.requestId,
        tenantId: request.tenantId,
      },
    };
  }

  private async crawl(
    request: ExecutionRequest,
    startedAt: Date
  ): Promise<ExecutionResult> {
    const body: FirecrawlCrawlRequest = {
      url: request.target.url,
      limit: request.constraints?.maxPages || 100,
      scrapeOptions: {
        formats: request.target.options?.formats || ['markdown'],
      },
    };

    const response = await fetch(`${this.config.apiUrl}/v2/crawl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });

    const data: FirecrawlCrawlResponse = await response.json();

    if (!data.success) {
      throw {
        code: ERROR_CODES.INVALID_REQUEST,
        message: data.error || 'Crawl failed',
      } as GatewayError;
    }

    return {
      status: 'processing',
      provider: 'firecrawl',
      jobId: data.id,
      timestamps: {
        startedAt: startedAt.toISOString(),
      },
      provenance: {
        requestId: request.requestId,
        tenantId: request.tenantId,
      },
    };
  }

  private async getJobStatus(
    request: ExecutionRequest,
    startedAt: Date
  ): Promise<ExecutionResult> {
    if (!request.target.url) {
      throw {
        code: ERROR_CODES.INVALID_REQUEST,
        message: 'Job ID required in target.url',
      } as GatewayError;
    }

    const response = await fetch(
      `${this.config.apiUrl}/v2/crawl/${request.target.url}`,
      {
        method: 'GET',
        headers: {
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
        },
        signal: AbortSignal.timeout(this.config.timeoutMs),
      }
    );

    const data: FirecrawlJobStatus = await response.json();

    if (!data.success) {
      throw {
        code: ERROR_CODES.JOB_NOT_FOUND,
        message: data.error || 'Job not found',
      } as GatewayError;
    }

    const statusMap: Record<string, ExecutionResult['status']> = {
      pending: 'processing',
      processing: 'processing',
      completed: 'completed',
      failed: 'failed',
      cancelled: 'cancelled',
    };

    return {
      status: statusMap[data.status || 'pending'],
      provider: 'firecrawl',
      result: data.data,
      timestamps: {
        startedAt: startedAt.toISOString(),
      },
      provenance: {
        requestId: request.requestId,
        tenantId: request.tenantId,
      },
    };
  }

  async getJob(jobId: string): Promise<JobStatus | null> {
    try {
      const response = await fetch(
        `${this.config.apiUrl}/v2/crawl/${jobId}`,
        {
          method: 'GET',
          headers: {
            ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
          },
          signal: AbortSignal.timeout(10000),
        }
      );

      const data: FirecrawlJobStatus = await response.json();

      if (!data.success) {
        return null;
      }

      const statusMap: Record<string, JobStatus['status']> = {
        pending: 'pending',
        processing: 'processing',
        completed: 'completed',
        failed: 'failed',
        cancelled: 'cancelled',
      };

      return {
        jobId,
        status: statusMap[data.status || 'pending'],
        provider: 'firecrawl',
        progress: data.current !== undefined ? {
          current: data.current,
          total: data.total,
        } : undefined,
        result: data.data,
        error: data.error ? {
          code: 'UNKNOWN',
          message: data.error,
        } : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  async cancel(jobId: string): Promise<CancelResult> {
    // Firecrawl v2 does not support cancel
    return {
      success: false,
      message: 'Job cancellation not supported by Firecrawl',
    };
  }
}

export const createFirecrawlProvider = (
  config: FirecrawlProviderConfig
): FirecrawlProvider => {
  return new FirecrawlProvider(config);
};
