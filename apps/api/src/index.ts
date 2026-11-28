/**
 * Browser Gateway API Server
 * 
 * REST API for browser acquisition gateway.
 * Provides versioned routes for scraping, crawling, and job management.
 */

import express, { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createRouter } from '@browser-gateway/router';
import { createFirecrawlProvider } from '@browser-gateway/provider-firecrawl';
import {
  successResponse,
  errorResponse,
  ERROR_CODES,
  GatewayError,
} from '@browser-gateway/contracts';

const app = express();
const PORT = process.env.API_PORT || 4000;

// Middleware
app.use(express.json());

// Request ID tracking
app.use((req: Request, _res: Response, next: NextFunction) => {
  (req.headers as any)['x-request-id'] = (req.headers as any)['x-request-id'] || uuidv4();
  next();
});

// Initialize router and providers
const firecrawlProvider = createFirecrawlProvider({
  apiUrl: process.env.FIRECRAWL_API_URL || 'http://localhost:3002',
  apiKey: process.env.FIRECRAWL_API_KEY,
});

const router = createRouter({
  providers: new Map([['firecrawl', firecrawlProvider]]),
  defaultProvider: 'firecrawl',
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string;
  const receivedAt = new Date();
  
  const gatewayError: GatewayError = {
    code: ERROR_CODES.INVALID_REQUEST,
    message: err.message || 'Internal server error',
  };

  res.status(500).json(errorResponse(gatewayError, requestId, receivedAt));
});

// ============================================
// Health Routes
// ============================================

app.get('/health/live', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/health/ready', async (req: Request, res: Response) => {
  try {
    const health = await firecrawlProvider.health();
    res.json({
      status: health.status === 'healthy' ? 'ready' : 'not_ready',
      provider: health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not_ready',
      error: 'Provider unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================
// Capabilities Route
// ============================================

app.get('/v1/capabilities', async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] as string;
  const receivedAt = new Date();

  try {
    const capabilities = await router.getCapabilities();
    res.json(successResponse(capabilities, requestId, receivedAt));
  } catch (error) {
    const gatewayError = error as GatewayError;
    res.status(500).json(errorResponse(gatewayError, requestId, receivedAt));
  }
});

// ============================================
// Scrape Route
// ============================================

app.post('/v1/scrape', async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] as string;
  const receivedAt = new Date();

  try {
    const { url, provider, formats, constraints, options } = req.body;

    if (!url) {
      throw {
        code: ERROR_CODES.INVALID_REQUEST,
        message: 'url is required',
      } as GatewayError;
    }

    const executionRequest = {
      requestId,
      tenantId: req.headers['x-tenant-id'] as string || 'default',
      provider: provider as 'firecrawl' | 'http' | 'playwright' | undefined,
      capability: 'browser.scrape' as const,
      target: {
        url,
        options: { formats, ...options },
      },
      constraints: {
        timeoutSeconds: constraints?.timeoutSeconds,
        maxDownloadBytes: constraints?.maxDownloadBytes,
      },
    };

    const result = await router.execute(executionRequest);
    res.json(successResponse(result, requestId, receivedAt));
  } catch (error) {
    const gatewayError = error as GatewayError;
    const status = gatewayError.code === ERROR_CODES.INVALID_REQUEST ? 400 : 500;
    res.status(status).json(errorResponse(gatewayError, requestId, receivedAt));
  }
});

// ============================================
// Crawl Route
// ============================================

app.post('/v1/crawls', async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] as string;
  const receivedAt = new Date();

  try {
    const { url, provider, constraints, options } = req.body;

    if (!url) {
      throw {
        code: ERROR_CODES.INVALID_REQUEST,
        message: 'url is required',
      } as GatewayError;
    }

    const executionRequest = {
      requestId,
      tenantId: req.headers['x-tenant-id'] as string || 'default',
      provider: provider as 'firecrawl' | 'http' | 'playwright' | undefined,
      capability: 'browser.crawl' as const,
      target: {
        url,
        options,
      },
      constraints: {
        maxPages: constraints?.maxPages || 100,
        depth: constraints?.depth,
        timeoutSeconds: constraints?.timeoutSeconds,
      },
    };

    const result = await router.execute(executionRequest);
    res.status(result.status === 'processing' ? 202 : 200).json(
      successResponse(result, requestId, receivedAt)
    );
  } catch (error) {
    const gatewayError = error as GatewayError;
    const status = gatewayError.code === ERROR_CODES.INVALID_REQUEST ? 400 : 500;
    res.status(status).json(errorResponse(gatewayError, requestId, receivedAt));
  }
});

// ============================================
// Job Status Route
// ============================================

app.get('/v1/jobs/:jobId', async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] as string;
  const receivedAt = new Date();

  try {
    const { jobId } = req.params;
    // Extract provider from query params
    // req.query.provider can be: string | string[] | ParsedQs | ParsedQs[] | undefined
    // We only care if it's a string or first element of string[]
    const provider = Array.isArray(req.query.provider)
      ? req.query.provider[0]
      : req.query.provider;

    // Force type assertion - router expects string | undefined
    const providerStr = provider as unknown as string | undefined;

    const status = await router.getJob(jobId, providerStr);
    res.json(successResponse(status, requestId, receivedAt));
  } catch (error) {
    const gatewayError = error as GatewayError;
    const status = gatewayError.code === ERROR_CODES.JOB_NOT_FOUND ? 404 : 500;
    res.status(status).json(errorResponse(gatewayError, requestId, receivedAt));
  }
});

// ============================================
// Cancel Job Route
// ============================================

app.post('/v1/jobs/:jobId/cancel', async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] as string;
  const receivedAt = new Date();

  try {
    const { jobId } = req.params;
    // Extract provider from query params
    // req.query.provider can be: string | string[] | ParsedQs | ParsedQs[] | undefined
    // We only care if it's a string or first element of string[]
    const provider = Array.isArray(req.query.provider)
      ? req.query.provider[0]
      : req.query.provider;

    // Force type assertion - router expects string | undefined
    const providerStr = provider as unknown as string | undefined;

    const result = await router.cancel(jobId, providerStr);
    res.json(successResponse(result, requestId, receivedAt));
  } catch (error) {
    const gatewayError = error as GatewayError;
    const status = gatewayError.code === ERROR_CODES.CANCEL_UNSUPPORTED ? 400 : 500;
    res.status(status).json(errorResponse(gatewayError, requestId, receivedAt));
  }
});

// ============================================
// Artifacts Route
// ============================================

app.get('/v1/artifacts/:artifactId', async (req: Request, res: Response) => {
  const requestId = req.headers['x-request-id'] as string;
  const receivedAt = new Date();

  try {
    const { artifactId } = req.params;
    
    // For P1, artifacts are returned inline in job results
    // This route is a placeholder for future object storage integration
    throw {
      code: ERROR_CODES.INVALID_REQUEST,
      message: 'Artifact retrieval not yet implemented. Use job status endpoint.',
    } as GatewayError;
  } catch (error) {
    const gatewayError = error as GatewayError;
    res.status(400).json(errorResponse(gatewayError, requestId, receivedAt));
  }
});

// ============================================
// Start Server
// ============================================

app.listen(PORT, () => {
  console.log(`Browser Gateway API listening on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health/live`);
  console.log(`Ready: http://localhost:${PORT}/health/ready`);
  console.log(`Capabilities: http://localhost:${PORT}/v1/capabilities`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await router.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await router.shutdown();
  process.exit(0);
});

export default app;
