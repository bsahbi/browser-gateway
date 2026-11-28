"use strict";
/**
 * Firecrawl Provider Adapter
 *
 * Implements the BrowserProvider interface for Firecrawl API.
 * Maps gateway requests to Firecrawl v2 API endpoints.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFirecrawlProvider = exports.FirecrawlProvider = void 0;
const contracts_1 = require("@browser-gateway/contracts");
class FirecrawlProvider {
    config;
    descriptor;
    constructor(config) {
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
    async describe() {
        return this.descriptor;
    }
    async health() {
        const start = Date.now();
        try {
            const response = await fetch(`${this.config.apiUrl}/v0/health/readiness`, { method: 'GET' });
            const status = response.ok ? 'healthy' : 'degraded';
            return {
                status,
                lastCheck: new Date(),
                latencyMs: Date.now() - start,
                ...(status !== 'healthy' && { error: 'Health check failed' }),
            };
        }
        catch (error) {
            return {
                status: 'unavailable',
                lastCheck: new Date(),
                latencyMs: Date.now() - start,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    async execute(request) {
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
                        code: contracts_1.ERROR_CODES.UNSUPPORTED_CAPABILITY,
                        message: `Capability '${request.capability}' not supported`,
                    };
            }
        }
        catch (error) {
            const gatewayError = error;
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
    async scrape(request, startedAt) {
        const body = {
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
            signal: this.config.timeoutMs ? AbortSignal.timeout(this.config.timeoutMs) : undefined,
        });
        const data = await response.json();
        if (!data.success) {
            throw {
                code: contracts_1.ERROR_CODES.INVALID_REQUEST,
                message: data.error || 'Scrape failed',
            };
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
    async crawl(request, startedAt) {
        const body = {
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
            signal: this.config.timeoutMs ? AbortSignal.timeout(this.config.timeoutMs) : undefined,
        });
        const data = await response.json();
        if (!data.success) {
            throw {
                code: contracts_1.ERROR_CODES.INVALID_REQUEST,
                message: data.error || 'Crawl failed',
            };
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
    async getJobStatus(request, startedAt) {
        if (!request.target.url) {
            throw {
                code: contracts_1.ERROR_CODES.INVALID_REQUEST,
                message: 'Job ID required in target.url',
            };
        }
        const response = await fetch(`${this.config.apiUrl}/v2/crawl/${request.target.url}`, {
            method: 'GET',
            headers: {
                ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
            },
            signal: this.config.timeoutMs ? AbortSignal.timeout(this.config.timeoutMs) : undefined,
        });
        const data = await response.json();
        if (!data.success) {
            throw {
                code: contracts_1.ERROR_CODES.JOB_NOT_FOUND,
                message: data.error || 'Job not found',
            };
        }
        const statusMap = {
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
    async getJob(jobId) {
        try {
            const response = await fetch(`${this.config.apiUrl}/v2/crawl/${jobId}`, {
                method: 'GET',
                headers: {
                    ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
                },
                signal: AbortSignal.timeout(10000),
            });
            const data = await response.json();
            if (!data.success) {
                return null;
            }
            const statusMap = {
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
        }
        catch {
            return null;
        }
    }
    async cancel(jobId) {
        // Firecrawl v2 does not support cancel
        return {
            success: false,
            message: 'Job cancellation not supported by Firecrawl',
        };
    }
}
exports.FirecrawlProvider = FirecrawlProvider;
const createFirecrawlProvider = (config) => {
    return new FirecrawlProvider(config);
};
exports.createFirecrawlProvider = createFirecrawlProvider;
