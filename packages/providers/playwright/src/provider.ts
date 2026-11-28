/**
 * Playwright Provider
 * 
 * Browser automation provider using Playwright.
 * Supports isolated browser contexts for tenant isolation.
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
/// <reference lib="dom" />
import { chromium, Browser, Page, BrowserContext } from 'playwright';

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

interface ScrapeResult {
  markdown: string;
  html: string;
  title: string;
  url: string;
  screenshot?: string;
}

export class PlaywrightProvider implements BrowserProvider {
  private config: Required<PlaywrightProviderConfig>;
  private descriptor: ProviderDescriptor;
  private browser: Browser | null = null;
  private contextPool: BrowserContext[] = [];
  private activePages: number = 0;

  constructor(config: PlaywrightProviderConfig = {}) {
    this.config = {
      browserUrl: config.browserUrl || '',
      headless: config.headless ?? true,
      maxConcurrentPages: config.maxConcurrentPages || 5,
      timeoutMs: config.timeoutMs || 60000,
      proxy: config.proxy || { server: '' },
    };

    this.descriptor = {
      name: 'playwright',
      version: '1.50.0',
      capabilities: [
        'browser.scrape',
        'browser.session.create',
        'browser.session.navigate',
        'browser.session.screenshot',
      ],
      health: 'healthy',
      limits: {
        maxConcurrentJobs: this.config.maxConcurrentPages,
        maxPagesPerCrawl: 50,
        maxTimeoutSeconds: 60,
        maxFileSizeBytes: 50 * 1024 * 1024, // 50MB
      },
      supportsAsync: false,
      supportsSessions: true,
    };
  }

  async describe(): Promise<ProviderDescriptor> {
    return this.descriptor;
  }

  async health(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      if (!this.browser) {
        await this.initBrowser();
      }
      return {
        status: 'healthy',
        lastCheck: new Date(),
        latencyMs: Date.now() - start,
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
      if (request.capability !== 'browser.scrape') {
        throw {
          code: ERROR_CODES.UNSUPPORTED_CAPABILITY,
          message: `Playwright provider supports: browser.scrape, browser.session.*`,
        } as GatewayError;
      }

      // Check concurrency limit
      if (this.activePages >= this.config.maxConcurrentPages) {
        throw {
          code: ERROR_CODES.INVALID_REQUEST,
          message: 'Maximum concurrent pages reached',
        } as GatewayError;
      }

      this.activePages++;
      const result = await this.scrape(request.target.url, request.target.options);
      this.activePages--;

      const durationMs = Date.now() - startedAt.getTime();

      return {
        status: 'completed',
        provider: 'playwright',
        result,
        usage: {
          pages: 1,
          bytesDownloaded: 0,
          bytesReturned: JSON.stringify(result).length,
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
      this.activePages = Math.max(0, this.activePages - 1);
      const gatewayError = error as GatewayError;
      return {
        status: 'failed',
        provider: 'playwright',
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

  private async initBrowser(): Promise<void> {
    if (this.browser) return;

    const launchOptions: any = {
      headless: this.config.headless,
    };

    if (this.config.browserUrl) {
      launchOptions.channel = 'chromium';
    }

    if (this.config.proxy.server) {
      launchOptions.proxy = {
        server: this.config.proxy.server,
        username: this.config.proxy.username,
        password: this.config.proxy.password,
      };
    }

    this.browser = await chromium.launch(launchOptions);
  }

  private async createContext(): Promise<BrowserContext> {
    if (!this.browser) {
      await this.initBrowser();
    }

    // Create isolated context per tenant
    const context = await this.browser!.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    });

    return context;
  }

  private async scrape(
    url: string,
    options?: { waitFor?: number; screenshot?: boolean; [key: string]: unknown }
  ): Promise<ScrapeResult> {
    const context = await this.createContext();
    let page: Page | null = null;

    try {
      page = await context.newPage();

      // Set navigation timeout
      const timeout = typeof options?.waitFor === 'number' ? options.waitFor : 30000;

      // Navigate to URL
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout,
      });

      // Wait for content to stabilize
      if (options?.waitFor) {
        await page.waitForTimeout(Number(options.waitFor));
      }

      // Extract content
      const [title, html, markdown] = await Promise.all([
        page.title(),
        page.content(),
        this.extractMarkdown(page),
      ]);

      const result: ScrapeResult = {
        title,
        html,
        markdown,
        url: page.url(),
      };

      // Optional screenshot
      if (options?.screenshot) {
        const screenshot = await page.screenshot({ type: 'png', fullPage: true });
        result.screenshot = screenshot.toString('base64');
      }

      return result;
    } finally {
      if (page) {
        await page.close();
      }
      await context.close();
    }
  }

  private async extractMarkdown(page: Page): Promise<string> {
    return await page.evaluate(() => {
      // Remove scripts and styles
      const scripts = document.querySelectorAll('script, style, noscript');
      scripts.forEach((el: Element) => el.remove());

      // Get main content
      const main = document.querySelector('main, [role="main"], .main, #main') as HTMLElement || document.body;

      // Extract text and convert to simple markdown
      let text = main.textContent || '';
      
      // Clean up whitespace
      text = text.replace(/\s+/g, ' ').trim();
      
      // Basic heading detection
      const lines = text.split('\n').filter((l: string) => l.trim());
      return lines.join('\n\n');
    });
  }

  async getJob(): Promise<never> {
    throw {
      code: ERROR_CODES.CANCEL_UNSUPPORTED,
      message: 'Playwright provider does not support async jobs',
    } as GatewayError;
  }

  async cancel(): Promise<never> {
    throw {
      code: ERROR_CODES.CANCEL_UNSUPPORTED,
      message: 'Playwright provider does not support job cancellation',
    } as GatewayError;
  }

  async shutdown(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export const createPlaywrightProvider = (
  config: PlaywrightProviderConfig
): PlaywrightProvider => {
  return new PlaywrightProvider(config);
};
