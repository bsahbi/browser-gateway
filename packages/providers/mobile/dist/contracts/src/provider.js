"use strict";
/**
 * Browser Gateway Provider Contract
 *
 * Defines the interface that all browser providers must implement.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIResponseSchema = exports.ERROR_CODES = exports.JobStatusSchema = exports.ExecutionResultSchema = exports.ExecutionRequestSchema = void 0;
exports.successResponse = successResponse;
exports.errorResponse = errorResponse;
const zod_1 = require("zod");
// ============================================
// Execution Request/Result
// ============================================
exports.ExecutionRequestSchema = zod_1.z.object({
    requestId: zod_1.z.string().uuid(),
    tenantId: zod_1.z.string().uuid(),
    provider: zod_1.z.enum(['firecrawl', 'http', 'playwright']).optional(),
    capability: zod_1.z.enum([
        'browser.scrape',
        'browser.crawl',
        'browser.job.get',
        'browser.job.cancel',
    ]),
    target: zod_1.z.object({
        url: zod_1.z.string().url(),
        options: zod_1.z.record(zod_1.z.unknown()).optional(),
    }),
    constraints: zod_1.z.object({
        timeoutSeconds: zod_1.z.number().int().positive().max(300).optional(),
        maxDownloadBytes: zod_1.z.number().int().positive().optional(),
        depth: zod_1.z.number().int().nonnegative().optional(),
        maxPages: zod_1.z.number().int().positive().optional(),
    }).optional(),
    idempotencyKey: zod_1.z.string().optional(),
    deadline: zod_1.z.string().datetime().optional(),
});
exports.ExecutionResultSchema = zod_1.z.object({
    status: zod_1.z.enum(['completed', 'processing', 'failed', 'cancelled']),
    provider: zod_1.z.string(),
    jobId: zod_1.z.string().optional(),
    result: zod_1.z.unknown().optional(),
    error: zod_1.z.object({
        code: zod_1.z.string(),
        message: zod_1.z.string(),
    }).optional(),
    usage: zod_1.z.object({
        pages: zod_1.z.number().int().nonnegative(),
        bytesDownloaded: zod_1.z.number().int().nonnegative(),
        bytesReturned: zod_1.z.number().int().nonnegative(),
        durationMs: zod_1.z.number().int().nonnegative(),
    }).optional(),
    timestamps: zod_1.z.object({
        startedAt: zod_1.z.string().datetime(),
        completedAt: zod_1.z.string().datetime().optional(),
    }),
    provenance: zod_1.z.object({
        requestId: zod_1.z.string().uuid(),
        tenantId: zod_1.z.string().uuid(),
    }),
});
// ============================================
// Job Status
// ============================================
exports.JobStatusSchema = zod_1.z.object({
    jobId: zod_1.z.string(),
    status: zod_1.z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']),
    provider: zod_1.z.string(),
    progress: zod_1.z.object({
        current: zod_1.z.number().int().nonnegative(),
        total: zod_1.z.number().int().positive().optional(),
    }).optional(),
    result: zod_1.z.unknown().optional(),
    error: zod_1.z.object({
        code: zod_1.z.string(),
        message: zod_1.z.string(),
    }).optional(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
    completedAt: zod_1.z.string().datetime().optional(),
});
// ============================================
// Error Codes
// ============================================
exports.ERROR_CODES = {
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    UNSUPPORTED_CAPABILITY: 'UNSUPPORTED_CAPABILITY',
    QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
    PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
    TIMEOUT: 'TIMEOUT',
    NETWORK_POLICY_DENIED: 'NETWORK_POLICY_DENIED',
    INVALID_REQUEST: 'INVALID_REQUEST',
    JOB_NOT_FOUND: 'JOB_NOT_FOUND',
    CANCEL_UNSUPPORTED: 'CANCEL_UNSUPPORTED',
    IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
};
// ============================================
// API Response Envelope
// ============================================
exports.APIResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    data: zod_1.z.unknown().optional(),
    error: zod_1.z.object({
        code: zod_1.z.string(),
        message: zod_1.z.string(),
        details: zod_1.z.record(zod_1.z.unknown()).optional(),
    }).optional(),
    requestId: zod_1.z.string().uuid(),
    timestamps: zod_1.z.object({
        receivedAt: zod_1.z.string().datetime(),
        processedAt: zod_1.z.string().datetime(),
    }),
});
function successResponse(data, requestId, receivedAt, processedAt = new Date()) {
    return {
        success: true,
        data,
        requestId,
        timestamps: {
            receivedAt: receivedAt.toISOString(),
            processedAt: processedAt.toISOString(),
        },
    };
}
function errorResponse(error, requestId, receivedAt, processedAt = new Date()) {
    return {
        success: false,
        error: {
            code: error.code,
            message: error.message,
            details: error.details,
        },
        requestId,
        timestamps: {
            receivedAt: receivedAt.toISOString(),
            processedAt: processedAt.toISOString(),
        },
    };
}
