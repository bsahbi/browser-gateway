/**
 * Browser Gateway Provider Contract
 * 
 * Defines the interface that all browser providers must implement.
 */

import { z } from 'zod';

// ============================================
// Provider Interface
// ============================================

export interface ProviderDescriptor {
  name: string;
  version: string;
  capabilities: ProviderCapability[];
  health: ProviderHealthStatus;
  limits: ProviderLimits;
  supportsAsync: boolean;
  supportsSessions: boolean;
}

export type ProviderCapability = 
  | 'browser.scrape'
  | 'browser.crawl'
  | 'browser.job.get'
  | 'browser.job.cancel'
  | 'browser.session.create'
  | 'browser.session.navigate'
  | 'browser.session.screenshot';

export type ProviderHealthStatus = 
  | 'healthy'
  | 'degraded'
  | 'unavailable'
  | 'maintenance';

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

// ============================================
// Execution Request/Result
// ============================================

export const ExecutionRequestSchema = z.object({
  requestId: z.string().uuid(),
  tenantId: z.string().uuid(),
  provider: z.enum(['firecrawl', 'http', 'playwright']).optional(),
  capability: z.enum([
    'browser.scrape',
    'browser.crawl',
    'browser.job.get',
    'browser.job.cancel',
  ]),
  target: z.object({
    url: z.string().url(),
    options: z.record(z.unknown()).optional(),
  }),
  constraints: z.object({
    timeoutSeconds: z.number().int().positive().max(300).optional(),
    maxDownloadBytes: z.number().int().positive().optional(),
    depth: z.number().int().nonnegative().optional(),
    maxPages: z.number().int().positive().optional(),
  }).optional(),
  idempotencyKey: z.string().optional(),
  deadline: z.string().datetime().optional(),
});

export type ExecutionRequest = z.infer<typeof ExecutionRequestSchema>;

export const ExecutionResultSchema = z.object({
  status: z.enum(['completed', 'processing', 'failed', 'cancelled']),
  provider: z.string(),
  jobId: z.string().optional(),
  result: z.unknown().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
  usage: z.object({
    pages: z.number().int().nonnegative(),
    bytesDownloaded: z.number().int().nonnegative(),
    bytesReturned: z.number().int().nonnegative(),
    durationMs: z.number().int().nonnegative(),
  }).optional(),
  timestamps: z.object({
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime().optional(),
  }),
  provenance: z.object({
    requestId: z.string().uuid(),
    tenantId: z.string().uuid(),
  }),
});

export type ExecutionResult = z.infer<typeof ExecutionResultSchema>;

// ============================================
// Job Status
// ============================================

export const JobStatusSchema = z.object({
  jobId: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']),
  provider: z.string(),
  progress: z.object({
    current: z.number().int().nonnegative(),
    total: z.number().int().positive().optional(),
  }).optional(),
  result: z.unknown().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});

export type JobStatus = z.infer<typeof JobStatusSchema>;

// ============================================
// Error Codes
// ============================================

export const ERROR_CODES = {
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
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

export interface GatewayError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================
// Provider Interface
// ============================================

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

// ============================================
// API Response Envelope
// ============================================

export const APIResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }).optional(),
  requestId: z.string().uuid(),
  timestamps: z.object({
    receivedAt: z.string().datetime(),
    processedAt: z.string().datetime(),
  }),
});

export type APIResponse = z.infer<typeof APIResponseSchema>;

export function successResponse<T>(
  data: T,
  requestId: string,
  receivedAt: Date,
  processedAt: Date = new Date()
): APIResponse {
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

export function errorResponse(
  error: GatewayError,
  requestId: string,
  receivedAt: Date,
  processedAt: Date = new Date()
): APIResponse {
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
