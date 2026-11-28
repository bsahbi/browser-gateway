"use strict";
/**
 * Session Manager Schemas
 *
 * Core entities for stateful browser sessions:
 * - Sessions
 * - Browser Contexts
 * - Navigation History
 * - Session Profiles
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionResultSchema = exports.SessionCommandSchema = exports.SessionProfileSchema = exports.NavigationStateSchema = exports.SessionActionType = exports.BrowserSessionSchema = exports.SessionStatus = void 0;
exports.createId = createId;
exports.calculateExpiry = calculateExpiry;
const zod_1 = require("zod");
// ============================================
// Session Status
// ============================================
exports.SessionStatus = zod_1.z.enum(['active', 'idle', 'expired', 'error']);
// ============================================
// Browser Session
// ============================================
exports.BrowserSessionSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    tenantId: zod_1.z.string().uuid(),
    provider: zod_1.z.string(),
    status: exports.SessionStatus,
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
    expiresAt: zod_1.z.string().datetime(),
    lastActivityAt: zod_1.z.string().datetime(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
});
// ============================================
// Session Action
// ============================================
exports.SessionActionType = zod_1.z.enum([
    'navigate',
    'click',
    'type',
    'screenshot',
    'evaluate',
    'wait',
]);
// ============================================
// Navigation State
// ============================================
exports.NavigationStateSchema = zod_1.z.object({
    url: zod_1.z.string().url(),
    title: zod_1.z.string(),
    timestamp: zod_1.z.string().datetime(),
    screenshot: zod_1.z.string().optional(),
});
// ============================================
// Session Profile
// ============================================
exports.SessionProfileSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(1).max(255),
    tenantId: zod_1.z.string().uuid().optional(),
    userAgent: zod_1.z.string().optional(),
    viewport: zod_1.z.object({
        width: zod_1.z.number().int().positive(),
        height: zod_1.z.number().int().positive(),
    }).optional(),
    timezone: zod_1.z.string().optional(),
    locale: zod_1.z.string().optional(),
    cookies: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        value: zod_1.z.string(),
        domain: zod_1.z.string().optional(),
        path: zod_1.z.string().optional(),
        secure: zod_1.z.boolean().optional(),
        httpOnly: zod_1.z.boolean().optional(),
    })).optional(),
    localStorage: zod_1.z.record(zod_1.z.string()).optional(),
    sessionStorage: zod_1.z.record(zod_1.z.string()).optional(),
});
// ============================================
// Session Command
// ============================================
exports.SessionCommandSchema = zod_1.z.union([
    zod_1.z.object({
        action: zod_1.z.literal('navigate'),
        url: zod_1.z.string().url(),
        waitUntil: zod_1.z.enum(['load', 'domcontentloaded', 'networkidle']).optional(),
        timeout: zod_1.z.number().int().positive().optional(),
    }),
    zod_1.z.object({
        action: zod_1.z.literal('click'),
        selector: zod_1.z.string(),
        timeout: zod_1.z.number().int().positive().optional(),
    }),
    zod_1.z.object({
        action: zod_1.z.literal('type'),
        selector: zod_1.z.string(),
        text: zod_1.z.string(),
        delay: zod_1.z.number().int().nonnegative().optional(),
    }),
    zod_1.z.object({
        action: zod_1.z.literal('screenshot'),
        fullPage: zod_1.z.boolean().optional(),
        type: zod_1.z.enum(['png', 'jpeg']).optional(),
        quality: zod_1.z.number().int().min(0).max(100).optional(),
    }),
    zod_1.z.object({
        action: zod_1.z.literal('evaluate'),
        script: zod_1.z.string(),
    }),
    zod_1.z.object({
        action: zod_1.z.literal('wait'),
        time: zod_1.z.number().int().positive(),
    }),
]);
// ============================================
// Session Result
// ============================================
exports.SessionResultSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    data: zod_1.z.unknown().optional(),
    error: zod_1.z.string().optional(),
    screenshot: zod_1.z.string().optional(), // Base64 encoded
});
// ============================================
// Helper Functions
// ============================================
function createId() {
    return crypto.randomUUID();
}
function calculateExpiry(durationMinutes) {
    const expiry = new Date(Date.now() + durationMinutes * 60 * 1000);
    return expiry.toISOString();
}
