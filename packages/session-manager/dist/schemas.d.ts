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
export declare const SessionStatus: z.ZodEnum<["active", "idle", "expired", "error"]>;
export type SessionStatus = z.infer<typeof SessionStatus>;
export declare const BrowserSessionSchema: z.ZodObject<{
    id: z.ZodString;
    tenantId: z.ZodString;
    provider: z.ZodString;
    status: z.ZodEnum<["active", "idle", "expired", "error"]>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    expiresAt: z.ZodString;
    lastActivityAt: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "idle" | "expired" | "error";
    id: string;
    tenantId: string;
    provider: string;
    createdAt: string;
    updatedAt: string;
    expiresAt: string;
    lastActivityAt: string;
    metadata?: Record<string, unknown> | undefined;
}, {
    status: "active" | "idle" | "expired" | "error";
    id: string;
    tenantId: string;
    provider: string;
    createdAt: string;
    updatedAt: string;
    expiresAt: string;
    lastActivityAt: string;
    metadata?: Record<string, unknown> | undefined;
}>;
export type BrowserSession = z.infer<typeof BrowserSessionSchema>;
export declare const SessionActionType: z.ZodEnum<["navigate", "click", "type", "screenshot", "evaluate", "wait"]>;
export interface SessionAction {
    id: string;
    type: z.infer<typeof SessionActionType>;
    payload: Record<string, unknown>;
    result?: unknown;
    error?: string;
    timestamp: string;
}
export declare const NavigationStateSchema: z.ZodObject<{
    url: z.ZodString;
    title: z.ZodString;
    timestamp: z.ZodString;
    screenshot: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    url: string;
    title: string;
    timestamp: string;
    screenshot?: string | undefined;
}, {
    url: string;
    title: string;
    timestamp: string;
    screenshot?: string | undefined;
}>;
export type NavigationState = z.infer<typeof NavigationStateSchema>;
export declare const SessionProfileSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    tenantId: z.ZodOptional<z.ZodString>;
    userAgent: z.ZodOptional<z.ZodString>;
    viewport: z.ZodOptional<z.ZodObject<{
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        width: number;
        height: number;
    }, {
        width: number;
        height: number;
    }>>;
    timezone: z.ZodOptional<z.ZodString>;
    locale: z.ZodOptional<z.ZodString>;
    cookies: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        value: z.ZodString;
        domain: z.ZodOptional<z.ZodString>;
        path: z.ZodOptional<z.ZodString>;
        secure: z.ZodOptional<z.ZodBoolean>;
        httpOnly: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        value: string;
        name: string;
        path?: string | undefined;
        domain?: string | undefined;
        secure?: boolean | undefined;
        httpOnly?: boolean | undefined;
    }, {
        value: string;
        name: string;
        path?: string | undefined;
        domain?: string | undefined;
        secure?: boolean | undefined;
        httpOnly?: boolean | undefined;
    }>, "many">>;
    localStorage: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    sessionStorage: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    tenantId?: string | undefined;
    userAgent?: string | undefined;
    viewport?: {
        width: number;
        height: number;
    } | undefined;
    timezone?: string | undefined;
    locale?: string | undefined;
    cookies?: {
        value: string;
        name: string;
        path?: string | undefined;
        domain?: string | undefined;
        secure?: boolean | undefined;
        httpOnly?: boolean | undefined;
    }[] | undefined;
    localStorage?: Record<string, string> | undefined;
    sessionStorage?: Record<string, string> | undefined;
}, {
    id: string;
    name: string;
    tenantId?: string | undefined;
    userAgent?: string | undefined;
    viewport?: {
        width: number;
        height: number;
    } | undefined;
    timezone?: string | undefined;
    locale?: string | undefined;
    cookies?: {
        value: string;
        name: string;
        path?: string | undefined;
        domain?: string | undefined;
        secure?: boolean | undefined;
        httpOnly?: boolean | undefined;
    }[] | undefined;
    localStorage?: Record<string, string> | undefined;
    sessionStorage?: Record<string, string> | undefined;
}>;
export type SessionProfile = z.infer<typeof SessionProfileSchema>;
export declare const SessionCommandSchema: z.ZodUnion<[z.ZodObject<{
    action: z.ZodLiteral<"navigate">;
    url: z.ZodString;
    waitUntil: z.ZodOptional<z.ZodEnum<["load", "domcontentloaded", "networkidle"]>>;
    timeout: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    url: string;
    action: "navigate";
    waitUntil?: "load" | "domcontentloaded" | "networkidle" | undefined;
    timeout?: number | undefined;
}, {
    url: string;
    action: "navigate";
    waitUntil?: "load" | "domcontentloaded" | "networkidle" | undefined;
    timeout?: number | undefined;
}>, z.ZodObject<{
    action: z.ZodLiteral<"click">;
    selector: z.ZodString;
    timeout: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    action: "click";
    selector: string;
    timeout?: number | undefined;
}, {
    action: "click";
    selector: string;
    timeout?: number | undefined;
}>, z.ZodObject<{
    action: z.ZodLiteral<"type">;
    selector: z.ZodString;
    text: z.ZodString;
    delay: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    action: "type";
    selector: string;
    text: string;
    delay?: number | undefined;
}, {
    action: "type";
    selector: string;
    text: string;
    delay?: number | undefined;
}>, z.ZodObject<{
    action: z.ZodLiteral<"screenshot">;
    fullPage: z.ZodOptional<z.ZodBoolean>;
    type: z.ZodOptional<z.ZodEnum<["png", "jpeg"]>>;
    quality: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    action: "screenshot";
    type?: "png" | "jpeg" | undefined;
    fullPage?: boolean | undefined;
    quality?: number | undefined;
}, {
    action: "screenshot";
    type?: "png" | "jpeg" | undefined;
    fullPage?: boolean | undefined;
    quality?: number | undefined;
}>, z.ZodObject<{
    action: z.ZodLiteral<"evaluate">;
    script: z.ZodString;
}, "strip", z.ZodTypeAny, {
    action: "evaluate";
    script: string;
}, {
    action: "evaluate";
    script: string;
}>, z.ZodObject<{
    action: z.ZodLiteral<"wait">;
    time: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    action: "wait";
    time: number;
}, {
    action: "wait";
    time: number;
}>]>;
export type SessionCommand = z.infer<typeof SessionCommandSchema>;
export declare const SessionResultSchema: z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodOptional<z.ZodUnknown>;
    error: z.ZodOptional<z.ZodString>;
    screenshot: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    error?: string | undefined;
    screenshot?: string | undefined;
    data?: unknown;
}, {
    success: boolean;
    error?: string | undefined;
    screenshot?: string | undefined;
    data?: unknown;
}>;
export type SessionResult = z.infer<typeof SessionResultSchema>;
export declare function createId(): string;
export declare function calculateExpiry(durationMinutes: number): string;
