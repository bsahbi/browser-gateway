/**
 * Browser Gateway Provider Contract
 *
 * Defines the interface that all browser providers must implement.
 */
import { z } from 'zod';
export interface ProviderDescriptor {
    name: string;
    version: string;
    capabilities: ProviderCapability[];
    health: ProviderHealthStatus;
    limits: ProviderLimits;
    supportsAsync: boolean;
    supportsSessions: boolean;
}
export type ProviderCapability = 'browser.scrape' | 'browser.crawl' | 'browser.job.get' | 'browser.job.cancel' | 'browser.session.create' | 'browser.session.navigate' | 'browser.session.screenshot';
export type ProviderHealthStatus = 'healthy' | 'degraded' | 'unavailable' | 'maintenance';
export interface ProviderLimits {
    maxConcurrentJobs: number;
    maxPagesPerCrawl: number;
    maxTimeoutSeconds: number;
    maxFileSizeBytes: number;
}
export interface ProviderHealth {
    status: ProviderHealthStatus;
    lastCheck: Date;
    latencyMs?: number;
    error?: string;
}
export declare const ExecutionRequestSchema: z.ZodObject<{
    requestId: z.ZodString;
    tenantId: z.ZodString;
    provider: z.ZodOptional<z.ZodEnum<["firecrawl", "http", "playwright"]>>;
    capability: z.ZodEnum<["browser.scrape", "browser.crawl", "browser.job.get", "browser.job.cancel"]>;
    target: z.ZodObject<{
        url: z.ZodString;
        options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        url: string;
        options?: Record<string, unknown> | undefined;
    }, {
        url: string;
        options?: Record<string, unknown> | undefined;
    }>;
    constraints: z.ZodOptional<z.ZodObject<{
        timeoutSeconds: z.ZodOptional<z.ZodNumber>;
        maxDownloadBytes: z.ZodOptional<z.ZodNumber>;
        depth: z.ZodOptional<z.ZodNumber>;
        maxPages: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        timeoutSeconds?: number | undefined;
        maxDownloadBytes?: number | undefined;
        depth?: number | undefined;
        maxPages?: number | undefined;
    }, {
        timeoutSeconds?: number | undefined;
        maxDownloadBytes?: number | undefined;
        depth?: number | undefined;
        maxPages?: number | undefined;
    }>>;
    idempotencyKey: z.ZodOptional<z.ZodString>;
    deadline: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    requestId: string;
    tenantId: string;
    capability: "browser.scrape" | "browser.crawl" | "browser.job.get" | "browser.job.cancel";
    target: {
        url: string;
        options?: Record<string, unknown> | undefined;
    };
    provider?: "firecrawl" | "http" | "playwright" | undefined;
    constraints?: {
        timeoutSeconds?: number | undefined;
        maxDownloadBytes?: number | undefined;
        depth?: number | undefined;
        maxPages?: number | undefined;
    } | undefined;
    idempotencyKey?: string | undefined;
    deadline?: string | undefined;
}, {
    requestId: string;
    tenantId: string;
    capability: "browser.scrape" | "browser.crawl" | "browser.job.get" | "browser.job.cancel";
    target: {
        url: string;
        options?: Record<string, unknown> | undefined;
    };
    provider?: "firecrawl" | "http" | "playwright" | undefined;
    constraints?: {
        timeoutSeconds?: number | undefined;
        maxDownloadBytes?: number | undefined;
        depth?: number | undefined;
        maxPages?: number | undefined;
    } | undefined;
    idempotencyKey?: string | undefined;
    deadline?: string | undefined;
}>;
export type ExecutionRequest = z.infer<typeof ExecutionRequestSchema>;
export declare const ExecutionResultSchema: z.ZodObject<{
    status: z.ZodEnum<["completed", "processing", "failed", "cancelled"]>;
    provider: z.ZodString;
    jobId: z.ZodOptional<z.ZodString>;
    result: z.ZodOptional<z.ZodUnknown>;
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
    }, {
        code: string;
        message: string;
    }>>;
    usage: z.ZodOptional<z.ZodObject<{
        pages: z.ZodNumber;
        bytesDownloaded: z.ZodNumber;
        bytesReturned: z.ZodNumber;
        durationMs: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        pages: number;
        bytesDownloaded: number;
        bytesReturned: number;
        durationMs: number;
    }, {
        pages: number;
        bytesDownloaded: number;
        bytesReturned: number;
        durationMs: number;
    }>>;
    timestamps: z.ZodObject<{
        startedAt: z.ZodString;
        completedAt: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        startedAt: string;
        completedAt?: string | undefined;
    }, {
        startedAt: string;
        completedAt?: string | undefined;
    }>;
    provenance: z.ZodObject<{
        requestId: z.ZodString;
        tenantId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        requestId: string;
        tenantId: string;
    }, {
        requestId: string;
        tenantId: string;
    }>;
}, "strip", z.ZodTypeAny, {
    provider: string;
    status: "completed" | "processing" | "failed" | "cancelled";
    timestamps: {
        startedAt: string;
        completedAt?: string | undefined;
    };
    provenance: {
        requestId: string;
        tenantId: string;
    };
    jobId?: string | undefined;
    result?: unknown;
    error?: {
        code: string;
        message: string;
    } | undefined;
    usage?: {
        pages: number;
        bytesDownloaded: number;
        bytesReturned: number;
        durationMs: number;
    } | undefined;
}, {
    provider: string;
    status: "completed" | "processing" | "failed" | "cancelled";
    timestamps: {
        startedAt: string;
        completedAt?: string | undefined;
    };
    provenance: {
        requestId: string;
        tenantId: string;
    };
    jobId?: string | undefined;
    result?: unknown;
    error?: {
        code: string;
        message: string;
    } | undefined;
    usage?: {
        pages: number;
        bytesDownloaded: number;
        bytesReturned: number;
        durationMs: number;
    } | undefined;
}>;
export type ExecutionResult = z.infer<typeof ExecutionResultSchema>;
export declare const JobStatusSchema: z.ZodObject<{
    jobId: z.ZodString;
    status: z.ZodEnum<["pending", "processing", "completed", "failed", "cancelled"]>;
    provider: z.ZodString;
    progress: z.ZodOptional<z.ZodObject<{
        current: z.ZodNumber;
        total: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        current: number;
        total?: number | undefined;
    }, {
        current: number;
        total?: number | undefined;
    }>>;
    result: z.ZodOptional<z.ZodUnknown>;
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
    }, {
        code: string;
        message: string;
    }>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    completedAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    provider: string;
    status: "completed" | "processing" | "failed" | "cancelled" | "pending";
    jobId: string;
    createdAt: string;
    updatedAt: string;
    result?: unknown;
    error?: {
        code: string;
        message: string;
    } | undefined;
    completedAt?: string | undefined;
    progress?: {
        current: number;
        total?: number | undefined;
    } | undefined;
}, {
    provider: string;
    status: "completed" | "processing" | "failed" | "cancelled" | "pending";
    jobId: string;
    createdAt: string;
    updatedAt: string;
    result?: unknown;
    error?: {
        code: string;
        message: string;
    } | undefined;
    completedAt?: string | undefined;
    progress?: {
        current: number;
        total?: number | undefined;
    } | undefined;
}>;
export type JobStatus = z.infer<typeof JobStatusSchema>;
export declare const ERROR_CODES: {
    readonly UNAUTHORIZED: "UNAUTHORIZED";
    readonly FORBIDDEN: "FORBIDDEN";
    readonly UNSUPPORTED_CAPABILITY: "UNSUPPORTED_CAPABILITY";
    readonly QUOTA_EXCEEDED: "QUOTA_EXCEEDED";
    readonly PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE";
    readonly TIMEOUT: "TIMEOUT";
    readonly NETWORK_POLICY_DENIED: "NETWORK_POLICY_DENIED";
    readonly INVALID_REQUEST: "INVALID_REQUEST";
    readonly JOB_NOT_FOUND: "JOB_NOT_FOUND";
    readonly CANCEL_UNSUPPORTED: "CANCEL_UNSUPPORTED";
    readonly IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT";
};
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
export interface GatewayError {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
}
export interface BrowserProvider {
    describe(): Promise<ProviderDescriptor>;
    health(): Promise<ProviderHealth>;
    execute(request: ExecutionRequest): Promise<ExecutionResult>;
    getJob?(jobId: string): Promise<JobStatus | null>;
    cancel?(jobId: string): Promise<CancelResult>;
}
export interface CancelResult {
    success: boolean;
    message?: string;
}
export declare const APIResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodOptional<z.ZodUnknown>;
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        details?: Record<string, unknown> | undefined;
    }, {
        code: string;
        message: string;
        details?: Record<string, unknown> | undefined;
    }>>;
    requestId: z.ZodString;
    timestamps: z.ZodObject<{
        receivedAt: z.ZodString;
        processedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        receivedAt: string;
        processedAt: string;
    }, {
        receivedAt: string;
        processedAt: string;
    }>;
}, "strip", z.ZodTypeAny, {
    requestId: string;
    timestamps: {
        receivedAt: string;
        processedAt: string;
    };
    success: boolean;
    error?: {
        code: string;
        message: string;
        details?: Record<string, unknown> | undefined;
    } | undefined;
    data?: unknown;
}, {
    requestId: string;
    timestamps: {
        receivedAt: string;
        processedAt: string;
    };
    success: boolean;
    error?: {
        code: string;
        message: string;
        details?: Record<string, unknown> | undefined;
    } | undefined;
    data?: unknown;
}>;
export type APIResponse = z.infer<typeof APIResponseSchema>;
export declare function successResponse<T>(data: T, requestId: string, receivedAt: Date, processedAt?: Date): APIResponse;
export declare function errorResponse(error: GatewayError, requestId: string, receivedAt: Date, processedAt?: Date): APIResponse;
