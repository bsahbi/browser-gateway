/**
 * Mobile Provider
 * 
 * Mobile browser automation using Playwright device emulation:
 * - Android Chrome (various devices)
 * - iOS Safari (various devices)
 * - Device-specific viewport, user-agent, touch support
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
import { chromium, webkit, Browser, BrowserContext, Page, devices } from 'playwright';

export interface MobileProviderConfig {
  headless?: boolean;
  maxConcurrentPages?: number;
  timeoutMs?: number;
}

// Supported mobile devices
export const MOBILE_DEVICES = {
  // Android Chrome
  'Android Chrome': {
    'Pixel 5': devices['Pixel 5'],
    'Pixel 4': devices['Pixel 4'],
    'Pixel 3': devices['Pixel 3'],
    'Galaxy S20': devices['Galaxy S20'],
    'Galaxy S10': devices['Galaxy S10'],
    'OnePlus 8': devices['OnePlus 8'],
  },
  // iOS Safari
  'iOS Safari': {
    'iPhone 14 Pro': devices['iPhone 14 Pro'],
    'iPhone 14': devices['iPhone 14'],
    'iPhone 13': devices['iPhone 13'],
    'iPhone 12': devices['iPhone 12'],
    'iPhone SE': devices['iPhone SE'],
    'iPad Pro 12.9': devices['iPad Pro 12.9'],
    'iPad Air': devices['iPad Air'],
  },
} as const;

export type MobileDevice = keyof typeof MOBILE_DEVICES['Android Chrome'] | 
                          keyof typeof MOBILE_DEVICES['iOS Safari'];

export type Platform = 'android' | 'ios';

interface ScrapeResult {
  markdown: string;
  html: string;
  title: string;
  url: string;
  screenshot?: string;
  deviceInfo: {
    platform: Platform;
    device: string;
    viewport: { width: number; height: number };
    userAgent: string;
  };
}

export class MobileProvider implements BrowserProvider {
  private config: Required<MobileProviderConfig>;
  private descriptor: ProviderDescriptor;
  private androidBrowser: Browser | null = null;
  private iosBrowser: Browser | null = null;
  private activePages: number = 0;

  constructor(config: MobileProviderConfig = {}) {
    this.config = {
      headless: config.headless ?? true,
      maxConcurrentPages: config.maxConcurrentPages || 5,
      timeoutMs: config.timeoutMs || 60000,
    };

    this.descriptor = {
      name: 'mobile',
      version: '1.0.0',
      capabilities: [
        'browser.scrape',
        'browser.session.create',
        'browser.session.navigate',
        'browser.session.screenshot',
      ],
      health: 'healthy',
      limits: {
        maxConcurrentJobs: this.config.maxConcurrentPages,
        maxPagesPerCrawl: 20,
        maxTimeoutSeconds: 60,
        maxFileSizeBytes: 50 * 1024 * 1024,
      },
      supportsAsync: false,
      supportsSessions: true,
      metadata: {
        supportedPlatforms: ['android', 'ios'],
        supportedDevices: this.getDeviceList(),
      },
    };
  }

  async describe(): Promise<ProviderDescriptor> {
    return this.descriptor;
  }

  async health(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      // Check Android browser
      if (!this.androidBrowser) {
        await this.initBrowser('android');
      }
      
      // Check iOS browser (may not be available on all platforms)
      try {
        if (!this.iosBrowser) {
          await this.initBrowser('ios');
        }
      } catch (e) {
        // iOS browser not available (Webkit requires macOS)
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
          message: `Mobile provider supports: browser.scrape, browser.session.*`,
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
      
      // Extract device from options
      const platform = request.target.options?.platform as Platform | undefined;
      const device = request.target.options?.device as MobileDevice | undefined;
      
      const result = await this.scrape(
        request.target.url,
        platform,
        device,
        request.target.options
      );
      this.activePages--;

      const durationMs = Date.now() - startedAt.getTime();

      return {
        status: 'completed',
        provider: 'mobile',
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
        provider: 'mobile',
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

  private async initBrowser(platform: 'android' | 'ios'): Promise<void> {
    if (platform === 'android' && this.androidBrowser) return;
    if (platform === 'ios' && this.iosBrowser) return;

    const launchOptions: any = {
      headless: this.config.headless,
    };

    if (platform === 'android') {
      this.androidBrowser = await chromium.launch(launchOptions);
    } else {
      try {
        this.iosBrowser = await webkit.launch(launchOptions);
      } catch (error) {
        throw new Error(`iOS browser (Webkit) not available on this platform: ${error}`);
      }
    }
  }

  private async scrape(
    url: string,
    platform: Platform = 'android',
    device?: MobileDevice,
    options?: { screenshot?: boolean; [key: string]: unknown }
  ): Promise<ScrapeResult> {
    // Select browser based on platform
    const browser = platform === 'android' ? this.androidBrowser : this.iosBrowser;
    
    // Initialize browser if needed
    if (!browser) {
      await this.initBrowser(platform);
    }

    // Get device emulation config
    const deviceDescriptor = device 
      ? this.getDeviceDescriptor(platform, device)
      : this.getDefaultDeviceDescriptor(platform);

    // Create context with device emulation
    const context = await browser!.newContext({
      ...deviceDescriptor,
      viewport: deviceDescriptor.viewport,
      userAgent: deviceDescriptor.userAgent,
      deviceScaleFactor: deviceDescriptor.deviceScaleFactor,
      isMobile: true,
      hasTouch: true,
    });

    let page: Page | null = null;

    try {
      page = await context.newPage();

      // Navigate
      const timeout = options?.waitFor || 30000;
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
        deviceInfo: {
          platform,
          device: device || 'default',
          viewport: deviceDescriptor.viewport,
          userAgent: deviceDescriptor.userAgent,
        },
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

  private getDeviceDescriptor(platform: Platform, device: MobileDevice): any {
    const deviceConfig = MOBILE_DEVICES[platform === 'android' ? 'Android Chrome' : 'iOS Safari'][device];
    
    if (!deviceConfig) {
      // Fallback to default
      return this.getDefaultDeviceDescriptor(platform);
    }

    return {
      viewport: deviceConfig.viewport,
      userAgent: deviceConfig.userAgent,
      deviceScaleFactor: deviceConfig.deviceScaleFactor || 1,
      isMobile: deviceConfig.isMobile || true,
      hasTouch: deviceConfig.hasTouch || true,
    };
  }

  private getDefaultDeviceDescriptor(platform: Platform): any {
    if (platform === 'android') {
      return {
        viewport: { width: 360, height: 640 },
        userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36',
        deviceScaleFactor: 2.75,
        isMobile: true,
        hasTouch: true,
      };
    } else {
      return {
        viewport: { width: 390, height: 844 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      };
    }
  }

  private getDeviceList(): string[] {
    const devices: string[] = [];
    
    for (const [platform, platformDevices] of Object.entries(MOBILE_DEVICES)) {
      for (const device of Object.keys(platformDevices)) {
        devices.push(`${platform} - ${device}`);
      }
    }
    
    return devices;
  }

  private async extractMarkdown(page: Page): Promise<string> {
    return await page.evaluate(() => {
      // Remove scripts and styles
      const scripts = document.querySelectorAll('script, style, noscript');
      scripts.forEach(el => el.remove());

      // Get main content
      const main = document.querySelector('main, [role="main"], .main, #main') || document.body;

      // Extract text
      let text = main.textContent || '';
      
      // Clean up whitespace
      text = text.replace(/\s+/g, ' ').trim();
      
      return text;
    });
  }

  async getJob(): Promise<never> {
    throw {
      code: ERROR_CODES.CANCEL_UNSUPPORTED,
      message: 'Mobile provider does not support async jobs',
    } as GatewayError;
  }

  async cancel(): Promise<never> {
    throw {
      code: ERROR_CODES.CANCEL_UNSUPPORTED,
      message: 'Mobile provider does not support job cancellation',
    } as GatewayError;
  }

  async shutdown(): Promise<void> {
    if (this.androidBrowser) {
      await this.androidBrowser.close();
      this.androidBrowser = null;
    }
    if (this.iosBrowser) {
      await this.iosBrowser.close();
      this.iosBrowser = null;
    }
  }
}

export const createMobileProvider = (config: MobileProviderConfig): MobileProvider => {
  return new MobileProvider(config);
};
