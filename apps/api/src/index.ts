/**
 * Browser Gateway REST API Server
 * 
 * Express server providing REST endpoints for:
 * - Health checks
 * - Browser scraping/crawling
 * - Job management
 * - Admin control plane
 */

import express, { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createRouter } from '@browser-gateway/router';
import { createFirecrawlProvider } from '@browser-gateway/provider-firecrawl';
import { createHttpProvider } from '@browser-gateway/provider-http';
import { createPlaywrightProvider } from '@browser-gateway/provider-playwright';
import adminRoutes from './routes/admin';
import { successResponse, errorResponse, ERROR_CODES, GatewayError } from '@browser-gateway/contracts';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(express.json());

// Request ID middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4();
  next();
});

// Initialize providers
const firecrawlProvider = createFirecrawlProvider({
  apiUrl: process.env.FIRECRAWL_API_URL || 'http://localhost:3002',
});

const httpProvider = createHttpProvider();
const playwrightProvider = createPlaywrightProvider();

// Initialize router
const router = createRouter({
  providers: new Map([
    ['firecrawl', firecrawlProvider],
    ['http', httpProvider],
    ['playwright', playwrightProvider],
  ]),
  defaultProvider: 'firecrawl',
});

// ============================================
// Health Endpoints
// ============================================

app.get('/health/live', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health/ready', async (req: Request, res: Response) => {
  try {
    const firecrawlHealth = await firecrawlProvider.health();
    const ready = firecrawlHealth.status === 'healthy';

    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      providers: {
        firecrawl: firecrawlHealth,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      error: 'Provider health check failed',
    });
  }
});

// ============================================
// Capabilities Endpoint
// ============================================

app.get('/v1/capabilities', async (req: Request, res: Response) => {
  try {
    const descriptor = await router.describe();
    res.json({
      capabilities: descriptor.capabilities,
      providers: descriptor.providers,
      limits: descriptor.limits,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get capabilities' });
  }
});

// ============================================
// Scrape Endpoint
// ============================================

interface ScrapeRequest {
  url: string;
  provider?: 'firecrawl' | 'http' | 'playwright';
  formats?: string[];
  waitFor?: number;
  timeout?: number;
}

app.post('/v1/scrape', async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const body = req.body as ScrapeRequest;

  try {
    const executionRequest = {
      requestId,
      tenantId: 'default',
      provider: body.provider,
      capability: 'browser.scrape' as const,
      target: {
        url: body.url,
        options: {
          formats: body.formats,
          waitFor: body.waitFor,
        },
      },
      constraints: {
        timeoutSeconds: body.timeout,
      },
    };

    const result = await router.execute(executionRequest);
    res.json(result);
  } catch (error) {
    const gatewayError = error as GatewayError;
    res.status(400).json({
      error: gatewayError.message,
      code: gatewayError.code,
    });
  }
});

// ============================================
// Crawl Endpoint
// ============================================

interface CrawlRequest {
  url: string;
  provider?: 'firecrawl';
  formats?: string[];
  maxPages?: number;
  depth?: number;
}

app.post('/v1/crawls', async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const body = req.body as CrawlRequest;

  try {
    const executionRequest = {
      requestId,
      tenantId: 'default',
      provider: body.provider || 'firecrawl',
      capability: 'browser.crawl' as const,
      target: {
        url: body.url,
        options: {
          formats: body.formats,
        },
      },
      constraints: {
        maxPages: body.maxPages,
        depth: body.depth,
      },
    };

    const result = await router.execute(executionRequest);
    res.status(202).json(result);
  } catch (error) {
    const gatewayError = error as GatewayError;
    res.status(400).json({
      error: gatewayError.message,
      code: gatewayError.code,
    });
  }
});

// ============================================
// Job Status Endpoint
// ============================================

app.get('/v1/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const result = await router.getJob(req.params.jobId);
    res.json(result);
  } catch (error) {
    res.status(404).json({ error: 'Job not found' });
  }
});

// ============================================
// Job Cancel Endpoint
// ============================================

app.post('/v1/jobs/:jobId/cancel', async (req: Request, res: Response) => {
  try {
    const result = await router.cancelJob(req.params.jobId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: 'Failed to cancel job' });
  }
});

// ============================================
// Admin Routes
// ============================================

app.use('/admin', adminRoutes);

// ============================================
// Error Handling
// ============================================

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    requestId: req.headers['x-request-id'],
  });
});

// ============================================
// Start Server
// ============================================

app.listen(PORT, () => {
  console.log(`Browser Gateway API listening on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health/live`);
  console.log(`Ready: http://localhost:${PORT}/health/ready`);
  console.log(`Capabilities: http://localhost:${PORT}/v1/capabilities`);
  console.log(`Admin: http://localhost:${PORT}/admin`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await router.shutdown();
  await playwrightProvider.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await router.shutdown();
  await playwrightProvider.shutdown();
  process.exit(0);
});

export default app;
