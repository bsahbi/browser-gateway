/**
 * Firecrawl Provider Adapter
 *
 * Implements the BrowserProvider interface for Firecrawl API.
 * Maps gateway requests to Firecrawl v2 API endpoints.
 */
import { BrowserProvider, ProviderDescriptor, ProviderHealth, ExecutionRequest, ExecutionResult, JobStatus, CancelResult } from '@browser-gateway/contracts';
export interface FirecrawlProviderConfig {
    apiUrl: string;
    apiKey?: string;
    timeoutMs?: number;
}
export declare class FirecrawlProvider implements BrowserProvider {
    private config;
    private descriptor;
    constructor(config: FirecrawlProviderConfig);
    describe(): Promise<ProviderDescriptor>;
    health(): Promise<ProviderHealth>;
    execute(request: ExecutionRequest): Promise<ExecutionResult>;
    private scrape;
    private crawl;
    private getJobStatus;
    getJob(jobId: string): Promise<JobStatus | null>;
    cancel(jobId: string): Promise<CancelResult>;
}
export declare const createFirecrawlProvider: (config: FirecrawlProviderConfig) => FirecrawlProvider;
