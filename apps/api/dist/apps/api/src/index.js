"use strict";
/**
 * Browser Gateway API Server
 *
 * REST API for browser acquisition gateway.
 * Provides versioned routes for scraping, crawling, and job management.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const uuid_1 = require("uuid");
const router_1 = require("@browser-gateway/router");
const provider_firecrawl_1 = require("@browser-gateway/provider-firecrawl");
const contracts_1 = require("@browser-gateway/contracts");
const app = (0, express_1.default)();
const PORT = process.env.API_PORT || 4000;
// Middleware
app.use(express_1.default.json());
// Request ID tracking
app.use((req, _res, next) => {
    req.headers['x-request-id'] = req.headers['x-request-id'] || (0, uuid_1.v4)();
    next();
});
// Initialize router and providers
const firecrawlProvider = (0, provider_firecrawl_1.createFirecrawlProvider)({
    apiUrl: process.env.FIRECRAWL_API_URL || 'http://localhost:3002',
    apiKey: process.env.FIRECRAWL_API_KEY,
});
const router = (0, router_1.createRouter)({
    providers: new Map([['firecrawl', firecrawlProvider]]),
    defaultProvider: 'firecrawl',
});
// Error handling middleware
app.use((err, req, res, next) => {
    const requestId = req.headers['x-request-id'];
    const receivedAt = new Date();
    const gatewayError = {
        code: contracts_1.ERROR_CODES.INVALID_REQUEST,
        message: err.message || 'Internal server error',
    };
    res.status(500).json((0, contracts_1.errorResponse)(gatewayError, requestId, receivedAt));
});
// ============================================
// Health Routes
// ============================================
app.get('/health/live', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/health/ready', async (req, res) => {
    try {
        const health = await firecrawlProvider.health();
        res.json({
            status: health.status === 'healthy' ? 'ready' : 'not_ready',
            provider: health,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
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
app.get('/v1/capabilities', async (req, res) => {
    const requestId = req.headers['x-request-id'];
    const receivedAt = new Date();
    try {
        const capabilities = await router.getCapabilities();
        res.json((0, contracts_1.successResponse)(capabilities, requestId, receivedAt));
    }
    catch (error) {
        const gatewayError = error;
        res.status(500).json((0, contracts_1.errorResponse)(gatewayError, requestId, receivedAt));
    }
});
// ============================================
// Scrape Route
// ============================================
app.post('/v1/scrape', async (req, res) => {
    const requestId = req.headers['x-request-id'];
    const receivedAt = new Date();
    try {
        const { url, provider, formats, constraints, options } = req.body;
        if (!url) {
            throw {
                code: contracts_1.ERROR_CODES.INVALID_REQUEST,
                message: 'url is required',
            };
        }
        const executionRequest = {
            requestId,
            tenantId: req.headers['x-tenant-id'] || 'default',
            provider: provider,
            capability: 'browser.scrape',
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
        res.json((0, contracts_1.successResponse)(result, requestId, receivedAt));
    }
    catch (error) {
        const gatewayError = error;
        const status = gatewayError.code === contracts_1.ERROR_CODES.INVALID_REQUEST ? 400 : 500;
        res.status(status).json((0, contracts_1.errorResponse)(gatewayError, requestId, receivedAt));
    }
});
// ============================================
// Crawl Route
// ============================================
app.post('/v1/crawls', async (req, res) => {
    const requestId = req.headers['x-request-id'];
    const receivedAt = new Date();
    try {
        const { url, provider, constraints, options } = req.body;
        if (!url) {
            throw {
                code: contracts_1.ERROR_CODES.INVALID_REQUEST,
                message: 'url is required',
            };
        }
        const executionRequest = {
            requestId,
            tenantId: req.headers['x-tenant-id'] || 'default',
            provider: provider,
            capability: 'browser.crawl',
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
        res.status(result.status === 'processing' ? 202 : 200).json((0, contracts_1.successResponse)(result, requestId, receivedAt));
    }
    catch (error) {
        const gatewayError = error;
        const status = gatewayError.code === contracts_1.ERROR_CODES.INVALID_REQUEST ? 400 : 500;
        res.status(status).json((0, contracts_1.errorResponse)(gatewayError, requestId, receivedAt));
    }
});
// ============================================
// Job Status Route
// ============================================
app.get('/v1/jobs/:jobId', async (req, res) => {
    const requestId = req.headers['x-request-id'];
    const receivedAt = new Date();
    try {
        const { jobId } = req.params;
        // Extract provider from query params
        // req.query.provider can be: string | string[] | ParsedQs | ParsedQs[] | undefined
        // We only care if it's a string or first element of string[]
        const provider = Array.isArray(req.query.provider)
            ? req.query.provider[0]
            : req.query.provider;
        // @ts-expect-error - router expects string | undefined, but TypeScript infers string | string[]
        const status = await router.getJob(jobId, provider);
        res.json((0, contracts_1.successResponse)(status, requestId, receivedAt));
    }
    catch (error) {
        const gatewayError = error;
        const status = gatewayError.code === contracts_1.ERROR_CODES.JOB_NOT_FOUND ? 404 : 500;
        res.status(status).json((0, contracts_1.errorResponse)(gatewayError, requestId, receivedAt));
    }
});
// ============================================
// Cancel Job Route
// ============================================
app.post('/v1/jobs/:jobId/cancel', async (req, res) => {
    const requestId = req.headers['x-request-id'];
    const receivedAt = new Date();
    try {
        const { jobId } = req.params;
        // Extract provider from query params
        // req.query.provider can be: string | string[] | ParsedQs | ParsedQs[] | undefined
        // We only care if it's a string or first element of string[]
        const provider = Array.isArray(req.query.provider)
            ? req.query.provider[0]
            : req.query.provider;
        // @ts-expect-error - router expects string | undefined, but TypeScript infers string | string[]
        const result = await router.cancel(jobId, provider);
        res.json((0, contracts_1.successResponse)(result, requestId, receivedAt));
    }
    catch (error) {
        const gatewayError = error;
        const status = gatewayError.code === contracts_1.ERROR_CODES.CANCEL_UNSUPPORTED ? 400 : 500;
        res.status(status).json((0, contracts_1.errorResponse)(gatewayError, requestId, receivedAt));
    }
});
// ============================================
// Artifacts Route
// ============================================
app.get('/v1/artifacts/:artifactId', async (req, res) => {
    const requestId = req.headers['x-request-id'];
    const receivedAt = new Date();
    try {
        const { artifactId } = req.params;
        // For P1, artifacts are returned inline in job results
        // This route is a placeholder for future object storage integration
        throw {
            code: contracts_1.ERROR_CODES.INVALID_REQUEST,
            message: 'Artifact retrieval not yet implemented. Use job status endpoint.',
        };
    }
    catch (error) {
        const gatewayError = error;
        res.status(400).json((0, contracts_1.errorResponse)(gatewayError, requestId, receivedAt));
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
exports.default = app;
