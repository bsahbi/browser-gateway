/**
 * Workplane Browser Gateway - Firecrawl SDK Integration
 * P0: Standalone Deployment Client Library
 * 
 * This library provides integration with the Firecrawl P0 deployment.
 * Designed for use by development agents to interact with the browser gateway.
 * 
 * Usage:
 *   npm install firecrawl
 *   node agent-integration.js
 */

const { FirecrawlApp } = require('firecrawl');

// ============================================
// CONFIGURATION
// ============================================

const API_URL = process.env.FIRECRAWL_API_URL || 'http://localhost:3002';
// Self-hosted Firecrawl does not need an API key when USE_DB_AUTHENTICATION=false.
// Set FIRECRAWL_API_KEY only when the deployment has an application-level
// authentication implementation. This direct SDK example is for loopback or
// private ingress; use the MCP endpoint for the Traefik BasicAuth deployment.
const API_KEY = process.env.FIRECRAWL_API_KEY;

// Initialize Firecrawl client with P0 configuration
const firecrawl = new FirecrawlApp({
    ...(API_KEY ? { apiKey: API_KEY } : {}),
    apiUrl: API_URL,
});

// ============================================
// API HELPERS
// ============================================

/**
 * Scrape a single URL
 * @param url The URL to scrape
 * @param options Optional scrape options
 * @returns Promise resolving to scrape response
 */
async function scrapeUrl(url, options = {}) {
    try {
        const response = await firecrawl.scrapeUrl(url, options);
        return response;
    } catch (error) {
        console.error('Scrape error:', error);
        throw error;
    }
}

/**
 * Crawl multiple URLs starting from a base URL
 * @param url The starting URL
 * @param options Crawl options
 * @returns Promise resolving to crawl job response
 */
async function crawlUrl(url, options = {}) {
    try {
        const response = await firecrawl.crawlUrl(url, options);
        return response;
    } catch (error) {
        console.error('Crawl error:', error);
        throw error;
    }
}

/**
 * Crawl with job status polling
 * @param jobId The crawl job ID
 * @param pollIntervalMs Interval between status checks
 * @param timeoutMs Maximum time to wait
 * @returns Promise resolving to completed crawl data
 */
async function pollCrawlStatus(jobId, pollIntervalMs = 2000, timeoutMs = 60000) {
    const startTime = Date.now();
    
    while (true) {
        const elapsed = Date.now() - startTime;
        
        if (elapsed > timeoutMs) {
            throw new Error(`Crawl job ${jobId} did not complete within ${timeoutMs}ms`);
        }
        
        const status = await firecrawl.checkCrawlStatus(jobId);
        
        if (status.success && status.data) {
            return status.data;
        }
        
        if (status.status === 'completed') {
            return status;
        }
        
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
}

// ============================================
// EXAMPLE USAGE
// ============================================

async function example() {
    console.log('=== Firecrawl P0 SDK Example ===\n');
    
    // Example 1: Simple scrape
    console.log('1. Scraping example.com...');
    const scrapeResult = await scrapeUrl('https://example.com', {
        formats: ['markdown'],
        waitFor: 2000,
    });
    
    if (scrapeResult.success) {
        console.log('Title:', scrapeResult.data?.metadata?.title);
        console.log('Content (first 200 chars):', scrapeResult.data?.markdown?.substring(0, 200));
    } else {
        console.log('Error:', scrapeResult.error);
    }
    
    console.log('\n');
    
    // Example 2: Structured extraction
    console.log('2. Extracting structured data...');
    const extractResult = await scrapeUrl('https://example.com', {
        formats: ['extract'],
        extractOptions: {
            schema: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                },
                required: ['title'],
            },
        },
    });
    
    if (extractResult.success) {
        console.log('Extracted data:', JSON.stringify(extractResult.data, null, 2));
    }
    
    console.log('\n');
    
    // Example 3: Crawl with job polling
    console.log('3. Starting crawl job...');
    const crawlResult = await crawlUrl('https://example.com', {
        limit: 5,
        scrapeOptions: {
            formats: ['markdown'],
        },
    });
    
    if (crawlResult.success && crawlResult.jobId) {
        console.log('Crawl job ID:', crawlResult.jobId);
        console.log('Polling for completion...');
        
        try {
            const completedData = await pollCrawlStatus(crawlResult.jobId);
            console.log('Crawl completed with', completedData?.length || 0, 'pages');
        } catch (error) {
            console.log('Polling error:', error);
        }
    } else {
        console.log('Crawl error:', crawlResult.error);
    }
}

// ============================================
// RUN EXAMPLE (if executed directly)
// ============================================

if (require.main === module) {
    example().catch(console.error);
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    scrapeUrl,
    crawlUrl,
    pollCrawlStatus,
    firecrawl,
};
