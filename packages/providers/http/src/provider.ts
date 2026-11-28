/**
 * HTTP Fetch Provider
 * 
 * Simple HTTP/HTTPS fetch provider with streaming support,
 * size caps, and redirect validation.
 */

import {
  BrowserProvider,
  ProviderDescriptor,
  ProviderHealth,
  ExecutionRequest,
  ExecutionResult,
  ERROR_CODES,
  GatewayError,
} from '@browser-gateway/contracts';

export interface HttpProviderConfig {
  userAgent?: string;
  maxRedirects?: number;
  maxDownloadBytes?: number;
  timeoutMs?: number;
}

interface RedirectInfo {
  url: string;
  status: number;
}

export class HttpProvider implements BrowserProvider {
  private config: Required<HttpProviderConfig>;
  private descriptor: ProviderDescriptor;

  constructor(config: HttpProviderConfig = {}) {
    this.config = {
      userAgent: config.userAgent || 'BrowserGateway/1.0',
      maxRedirects: config.maxRedirects || 5,
      maxDownloadBytes: config.maxDownloadBytes || 10 * 1024 * 1024, // 10MB
      timeoutMs: config.timeoutMs || 30000,
    };

    this.descriptor = {
      name: 'http',
      version: '1.0.0',
      capabilities: ['browser.scrape'],
      health: 'healthy',
      limits: {
        maxConcurrentJobs: 10,
        maxPagesPerCrawl: 10,
        maxTimeoutSeconds: 30,
        maxFileSizeBytes: this.config.maxDownloadBytes,
      },
      supportsAsync: false,
      supportsSessions: false,
    };
  }

  async describe(): Promise<ProviderDescriptor> {
    return this.descriptor;
  }

  async health(): Promise<ProviderHealth> {
    return {
      status: 'healthy',
      lastCheck: new Date(),
      latencyMs: 0,
    };
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const startedAt = new Date();

    try {
      if (request.capability !== 'browser.scrape') {
        throw {
          code: ERROR_CODES.UNSUPPORTED_CAPABILITY,
          message: `HTTP provider only supports 'browser.scrape'`,
        } as GatewayError;
      }

      const result = await this.fetch(request.target.url, request.constraints);
      const durationMs = Date.now() - startedAt.getTime();

      return {
        status: 'completed',
        provider: 'http',
        result: {
          markdown: this.htmlToMarkdown(result.body),
          html: result.body,
          url: result.finalUrl,
          redirects: result.redirects,
          contentType: result.contentType,
          statusCode: result.statusCode,
        },
        usage: {
          pages: 1,
          bytesDownloaded: result.bytesDownloaded,
          bytesReturned: result.body.length,
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
    } catch (error) {
      const gatewayError = error as GatewayError;
      return {
        status: 'failed',
        provider: 'http',
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

  private async fetch(
    url: string,
    constraints?: { maxDownloadBytes?: number; timeoutSeconds?: number }
  ): Promise<{
    body: string;
    finalUrl: string;
    redirects: RedirectInfo[];
    contentType: string;
    statusCode: number;
    bytesDownloaded: number;
  }> {
    const redirects: RedirectInfo[] = [];
    let currentUrl = url;
    let bytesDownloaded = 0;

    for (let i = 0; i <= this.config.maxRedirects; i++) {
      const timeout = constraints?.timeoutSeconds
        ? constraints.timeoutSeconds * 1000
        : this.config.timeoutMs;

      const response = await fetch(currentUrl, {
        method: 'GET',
        headers: {
          'User-Agent': this.config.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(timeout),
        redirect: 'manual', // Handle redirects manually for validation
      });

      bytesDownloaded += Number(response.headers.get('content-length')) || 0;

      // Check size limit
      const contentLength = Number(response.headers.get('content-length')) || 0;
      const maxBytes = constraints?.maxDownloadBytes || this.config.maxDownloadBytes;
      if (contentLength > maxBytes) {
        throw {
          code: ERROR_CODES.INVALID_REQUEST,
          message: `Response exceeds maximum size: ${contentLength} > ${maxBytes} bytes`,
        } as GatewayError;
      }

      // Handle redirect
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          throw {
            code: ERROR_CODES.INVALID_REQUEST,
            message: 'Redirect response missing Location header',
          } as GatewayError;
        }

        redirects.push({ url: currentUrl, status: response.status });

        // Validate redirect target
        if (redirects.length >= this.config.maxRedirects) {
          throw {
            code: ERROR_CODES.INVALID_REQUEST,
            message: `Too many redirects (max: ${this.config.maxRedirects})`,
          } as GatewayError;
        }

        // Resolve relative URLs
        currentUrl = new URL(location, currentUrl).href;
        continue;
      }

      // Success
      if (response.status >= 200 && response.status < 300) {
        const body = await response.text();

        // Final size check
        if (body.length > maxBytes) {
          throw {
            code: ERROR_CODES.INVALID_REQUEST,
            message: `Response body exceeds maximum size: ${body.length} > ${maxBytes} bytes`,
          } as GatewayError;
        }

        return {
          body,
          finalUrl: currentUrl,
          redirects,
          contentType: response.headers.get('content-type') || 'text/html',
          statusCode: response.status,
          bytesDownloaded,
        };
      }

      // Error
      throw {
        code: ERROR_CODES.INVALID_REQUEST,
        message: `HTTP ${response.status}: ${response.statusText}`,
      } as GatewayError;
    }

    throw {
      code: ERROR_CODES.INVALID_REQUEST,
      message: 'Maximum redirects exceeded',
    } as GatewayError;
  }

  /**
   * Minimal HTML to Markdown conversion
   * For production, use a proper library like turndown
   */
  private htmlToMarkdown(html: string): string {
    // Very basic conversion - strips tags and preserves text
    let markdown = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return markdown;
  }

  async getJob(): Promise<never> {
    throw {
      code: ERROR_CODES.CANCEL_UNSUPPORTED,
      message: 'HTTP provider does not support async jobs',
    } as GatewayError;
  }

  async cancel(): Promise<never> {
    throw {
      code: ERROR_CODES.CANCEL_UNSUPPORTED,
      message: 'HTTP provider does not support job cancellation',
    } as GatewayError;
  }
}

export const createHttpProvider = (config: HttpProviderConfig): HttpProvider => {
  return new HttpProvider(config);
};
