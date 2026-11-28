/**
 * Session Manager Schemas
 * 
 * Core entities for stateful browser sessions:
 * - Sessions
 * - Browser Contexts
 * - Navigation History
 * - Session Profiles
 */

import { z } from 'zod';

// ============================================
// Session Status
// ============================================

export const SessionStatus = z.enum(['active', 'idle', 'expired', 'error']);
export type SessionStatus = z.infer<typeof SessionStatus>;

// ============================================
// Browser Session
// ============================================

export const BrowserSessionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  provider: z.string(),
  status: SessionStatus,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  lastActivityAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
});

export type BrowserSession = z.infer<typeof BrowserSessionSchema>;

// ============================================
// Session Action
// ============================================

export const SessionActionType = z.enum([
  'navigate',
  'click',
  'type',
  'screenshot',
  'evaluate',
  'wait',
]);

export interface SessionAction {
  id: string;
  type: z.infer<typeof SessionActionType>;
  payload: Record<string, unknown>;
  result?: unknown;
  error?: string;
  timestamp: string;
}

// ============================================
// Navigation State
// ============================================

export const NavigationStateSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  timestamp: z.string().datetime(),
  screenshot: z.string().optional(),
});

export type NavigationState = z.infer<typeof NavigationStateSchema>;

// ============================================
// Session Profile
// ============================================

export const SessionProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  tenantId: z.string().uuid().optional(),
  userAgent: z.string().optional(),
  viewport: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }).optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
  cookies: z.array(z.object({
    name: z.string(),
    value: z.string(),
    domain: z.string().optional(),
    path: z.string().optional(),
    secure: z.boolean().optional(),
    httpOnly: z.boolean().optional(),
  })).optional(),
  localStorage: z.record(z.string()).optional(),
  sessionStorage: z.record(z.string()).optional(),
});

export type SessionProfile = z.infer<typeof SessionProfileSchema>;

// ============================================
// Session Command
// ============================================

export const SessionCommandSchema = z.union([
  z.object({
    action: z.literal('navigate'),
    url: z.string().url(),
    waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional(),
    timeout: z.number().int().positive().optional(),
  }),
  z.object({
    action: z.literal('click'),
    selector: z.string(),
    timeout: z.number().int().positive().optional(),
  }),
  z.object({
    action: z.literal('type'),
    selector: z.string(),
    text: z.string(),
    delay: z.number().int().nonnegative().optional(),
  }),
  z.object({
    action: z.literal('screenshot'),
    fullPage: z.boolean().optional(),
    type: z.enum(['png', 'jpeg']).optional(),
    quality: z.number().int().min(0).max(100).optional(),
  }),
  z.object({
    action: z.literal('evaluate'),
    script: z.string(),
  }),
  z.object({
    action: z.literal('wait'),
    time: z.number().int().positive(),
  }),
]);

export type SessionCommand = z.infer<typeof SessionCommandSchema>;

// ============================================
// Session Result
// ============================================

export const SessionResultSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  screenshot: z.string().optional(), // Base64 encoded
});

export type SessionResult = z.infer<typeof SessionResultSchema>;

// ============================================
// Helper Functions
// ============================================

export function createId(): string {
  return crypto.randomUUID();
}

export function calculateExpiry(durationMinutes: number): string {
  const expiry = new Date(Date.now() + durationMinutes * 60 * 1000);
  return expiry.toISOString();
}
