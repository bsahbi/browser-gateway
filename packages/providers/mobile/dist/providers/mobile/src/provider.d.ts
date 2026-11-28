/**
 * Mobile Provider
 *
 * Mobile browser automation using Playwright device emulation:
 * - Android Chrome (various devices)
 * - iOS Safari (various devices)
 * - Device-specific viewport, user-agent, touch support
 */
import { BrowserProvider, ProviderDescriptor, ProviderHealth, ExecutionRequest, ExecutionResult } from '@browser-gateway/contracts';
export interface MobileProviderConfig {
    headless?: boolean;
    maxConcurrentPages?: number;
    timeoutMs?: number;
}
export declare const MOBILE_DEVICES: {
    readonly 'Android Chrome': {
        readonly 'Pixel 5': {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        readonly 'Pixel 4': {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        readonly 'Pixel 3': {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        readonly 'Galaxy S20': {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        readonly 'Galaxy S10': {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        readonly 'OnePlus 8': {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
    };
    readonly 'iOS Safari': {
        readonly 'iPhone 14 Pro': {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        readonly 'iPhone 14': {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        readonly 'iPhone 13': {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        readonly 'iPhone 12': {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        readonly 'iPhone SE': {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        readonly 'iPad Pro 12.9': {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
        readonly 'iPad Air': {
            viewport: import("playwright").ViewportSize;
            userAgent: string;
            deviceScaleFactor: number;
            isMobile: boolean;
            hasTouch: boolean;
            defaultBrowserType: "chromium" | "firefox" | "webkit";
        };
    };
};
export type MobileDevice = keyof typeof MOBILE_DEVICES['Android Chrome'] | keyof typeof MOBILE_DEVICES['iOS Safari'];
export type Platform = 'android' | 'ios';
export declare class MobileProvider implements BrowserProvider {
    private config;
    private descriptor;
    private androidBrowser;
    private iosBrowser;
    private activePages;
    constructor(config?: MobileProviderConfig);
    describe(): Promise<ProviderDescriptor>;
    health(): Promise<ProviderHealth>;
    execute(request: ExecutionRequest): Promise<ExecutionResult>;
    private initBrowser;
    private scrape;
    private getDeviceDescriptor;
    private getDefaultDeviceDescriptor;
    private getDeviceList;
    private extractMarkdown;
    getJob(): Promise<never>;
    cancel(): Promise<never>;
    shutdown(): Promise<void>;
}
export declare const createMobileProvider: (config: MobileProviderConfig) => MobileProvider;
