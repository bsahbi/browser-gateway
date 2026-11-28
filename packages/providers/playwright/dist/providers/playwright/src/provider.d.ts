/**
 * Playwright Provider
 *
 * Browser automation provider using Playwright.
 * Supports isolated browser contexts for tenant isolation.
 */
import { BrowserProvider, ProviderDescriptor, ProviderHealth, ExecutionRequest, ExecutionResult } from '@browser-gateway/contracts';
export interface PlaywrightProviderConfig {
    browserUrl?: string;
    headless?: boolean;
    maxConcurrentPages?: number;
    timeoutMs?: number;
    proxy?: {
        server: string;
        username?: string;
        password?: string;
    };
}
export declare class PlaywrightProvider implements BrowserProvider {
    private config;
    private descriptor;
    private browser;
    private contextPool;
    private activePages;
    constructor(config?: PlaywrightProviderConfig);
    describe(): Promise<ProviderDescriptor>;
    health(): Promise<ProviderHealth>;
    execute(request: ExecutionRequest): Promise<ExecutionResult>;
    private initBrowser;
    private createContext;
    private scrape;
    private extractMarkdown;
    getJob(): Promise<never>;
    cancel(): Promise<never>;
    shutdown(): Promise<void>;
}
export declare const createPlaywrightProvider: (config: PlaywrightProviderConfig) => PlaywrightProvider;
