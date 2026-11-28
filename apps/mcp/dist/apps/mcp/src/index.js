"use strict";
/**
 * MCP Server - Streamable HTTP Transport
 *
 * Implements the Model Context Protocol with HTTP streaming.
 * Provides browser tools for AI agents.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const uuid_1 = require("uuid");
const router_1 = require("@browser-gateway/router");
const provider_firecrawl_1 = require("@browser-gateway/provider-firecrawl");
const provider_http_1 = require("@browser-gateway/provider-http");
const provider_playwright_1 = require("@browser-gateway/provider-playwright");
const contracts_1 = require("@browser-gateway/contracts");
const app = (0, express_1.default)();
const PORT = process.env.MCP_PORT || 3001;
const ALLOWED_HOSTS = (process.env.MCP_ALLOWED_HOSTS || 'localhost').split(',');
// Middleware
app.use(express_1.default.json());
// Authentication middleware
app.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    // Allow localhost without auth for testing
    const clientHost = req.hostname;
    if (clientHost === 'localhost' || clientHost === '127.0.0.1') {
        next();
        return;
    }
    // Require BasicAuth for external hosts
    if (!authHeader || !authHeader.startsWith('Basic ')) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    // Verify against allowed hosts
    if (!ALLOWED_HOSTS.includes(clientHost)) {
        res.status(403).json({ error: 'Host not allowed' });
        return;
    }
    next();
});
// Initialize providers and router
const firecrawlProvider = (0, provider_firecrawl_1.createFirecrawlProvider)({
    apiUrl: process.env.FIRECRAWL_API_URL || 'http://localhost:3002',
});
const httpProvider = (0, provider_http_1.createHttpProvider)();
const playwrightProvider = (0, provider_playwright_1.createPlaywrightProvider)();
const router = (0, router_1.createRouter)({
    providers: new Map([
        ['firecrawl', firecrawlProvider],
        ['http', httpProvider],
        ['playwright', playwrightProvider],
    ]),
    defaultProvider: 'firecrawl',
});
// MCP Tools definition
const TOOLS = [
    {
        name: 'browser_scrape',
        description: 'Scrape a single URL and extract content',
        inputSchema: {
            type: 'object',
            properties: {
                url: { type: 'string', description: 'The URL to scrape' },
                provider: {
                    type: 'string',
                    enum: ['firecrawl', 'http', 'playwright'],
                    description: 'Provider to use (default: firecrawl)'
                },
                formats: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Output formats: markdown, html, text, screenshot'
                },
                waitFor: {
                    type: 'number',
                    description: 'Time to wait for dynamic content (ms)'
                },
                timeout: {
                    type: 'number',
                    description: 'Request timeout in seconds'
                }
            },
            required: ['url']
        }
    },
    {
        name: 'browser_crawl',
        description: 'Crawl a website and extract content from multiple pages',
        inputSchema: {
            type: 'object',
            properties: {
                url: { type: 'string', description: 'The starting URL to crawl' },
                provider: {
                    type: 'string',
                    enum: ['firecrawl'],
                    description: 'Provider (currently only firecrawl supports crawling)'
                },
                maxPages: {
                    type: 'number',
                    description: 'Maximum number of pages to crawl (default: 100)'
                },
                depth: {
                    type: 'number',
                    description: 'Maximum crawl depth (default: 10)'
                },
                formats: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Output formats'
                }
            },
            required: ['url']
        }
    },
    {
        name: 'browser_job_status',
        description: 'Get the status of an async job',
        inputSchema: {
            type: 'object',
            properties: {
                jobId: { type: 'string', description: 'The job ID to check' },
                provider: {
                    type: 'string',
                    description: 'Provider that created the job'
                }
            },
            required: ['jobId']
        }
    },
    {
        name: 'browser_job_cancel',
        description: 'Cancel an in-progress job',
        inputSchema: {
            type: 'object',
            properties: {
                jobId: { type: 'string', description: 'The job ID to cancel' }
            },
            required: ['jobId']
        }
    }
];
// ============================================
// MCP Protocol Handlers
// ============================================
// Initialize endpoint
app.post('/mcp', async (req, res) => {
    const { method, params, id, jsonrpc } = req.body;
    if (method === 'initialize') {
        res.json({
            jsonrpc,
            id,
            result: {
                protocolVersion: '2025-03-26',
                capabilities: {
                    tools: {},
                },
                serverInfo: {
                    name: 'browser-gateway',
                    version: '1.0.0',
                },
            },
        });
        return;
    }
    if (method === 'tools/list') {
        res.json({
            jsonrpc,
            id,
            result: { tools: TOOLS },
        });
        return;
    }
    if (method === 'tools/call') {
        try {
            const result = await handleToolCall(params);
            res.json({
                jsonrpc,
                id,
                result: {
                    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                },
            });
        }
        catch (error) {
            const gatewayError = error;
            res.json({
                jsonrpc,
                id,
                error: {
                    code: -32000,
                    message: gatewayError.message,
                },
            });
        }
        return;
    }
    // Unknown method
    res.json({
        jsonrpc: req.body.jsonrpc,
        id: req.body.id,
        error: {
            code: -32601,
            message: 'Method not found',
        },
    });
});
// ============================================
// Tool Call Handler
// ============================================
async function handleToolCall(params) {
    const { name, arguments: args } = params;
    switch (name) {
        case 'browser_scrape':
            return await handleScrape(args);
        case 'browser_crawl':
            return await handleCrawl(args);
        case 'browser_job_status':
            return await handleJobStatus(args);
        case 'browser_job_cancel':
            return await handleJobCancel(args);
        default:
            throw {
                code: contracts_1.ERROR_CODES.UNSUPPORTED_CAPABILITY,
                message: `Unknown tool: ${name}`,
            };
    }
}
async function handleScrape(args) {
    const requestId = (0, uuid_1.v4)();
    const executionRequest = {
        requestId,
        tenantId: 'mcp-client',
        provider: args.provider,
        capability: 'browser.scrape',
        target: {
            url: args.url,
            options: {
                formats: args.formats,
                waitFor: args.waitFor,
            },
        },
        constraints: {
            timeoutSeconds: args.timeout,
        },
    };
    const result = await router.execute(executionRequest);
    return result;
}
async function handleCrawl(args) {
    const requestId = (0, uuid_1.v4)();
    const executionRequest = {
        requestId,
        tenantId: 'mcp-client',
        provider: args.provider,
        capability: 'browser.crawl',
        target: {
            url: args.url,
            options: {
                formats: args.formats,
            },
        },
        constraints: {
            maxPages: args.maxPages,
            depth: args.depth,
        },
    };
    const result = await router.execute(executionRequest);
    return result;
}
async function handleJobStatus(args) {
    const status = await router.getJob(args.jobId, args.provider);
    return status;
}
async function handleJobCancel(args) {
    const result = await router.cancel(args.jobId);
    return result;
}
// ============================================
// Health Endpoint
// ============================================
app.get('/health', async (req, res) => {
    try {
        const firecrawlHealth = await firecrawlProvider.health();
        res.json({
            status: firecrawlHealth.status,
            providers: {
                firecrawl: firecrawlHealth,
            },
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        res.status(503).json({
            status: 'unavailable',
            error: 'Provider check failed',
        });
    }
});
// ============================================
// Start Server
// ============================================
app.listen(PORT, () => {
    console.log(`Browser Gateway MCP Server listening on port ${PORT}`);
    console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
    console.log(`Health: http://localhost:${PORT}/health`);
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
exports.default = app;
