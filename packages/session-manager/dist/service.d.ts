/**
 * Session Manager Service
 *
 * Manages stateful browser sessions:
 * - Session lifecycle (create, close, expire)
 * - Command execution
 * - History tracking
 * - Profile management
 */
import { BrowserSession, SessionStatus, SessionAction, NavigationState, SessionProfile, SessionCommand } from './schemas';
export declare function createSession(tenantId: string, provider: string, profileId?: string, ttlMinutes?: number): BrowserSession;
export declare function getSession(id: string): BrowserSession | undefined;
export declare function closeSession(id: string): BrowserSession | undefined;
export declare function extendSession(id: string, additionalMinutes: number): BrowserSession | undefined;
export declare function listSessions(tenantId: string, status?: SessionStatus): BrowserSession[];
export declare function recordAction(sessionId: string, action: Omit<SessionAction, 'id' | 'timestamp'>): SessionAction | null;
export declare function getActions(sessionId: string, limit?: number): SessionAction[];
export declare function recordNavigation(sessionId: string, state: Omit<NavigationState, 'timestamp'>): void;
export declare function getNavigationHistory(sessionId: string): NavigationState[];
export declare function createProfile(tenantId: string, name: string, config: Omit<SessionProfile, 'id' | 'name' | 'tenantId'>): SessionProfile;
export declare function getProfile(id: string): SessionProfile | undefined;
export declare function listProfiles(tenantId?: string): SessionProfile[];
export declare function updateProfile(id: string, updates: Partial<Omit<SessionProfile, 'id' | 'tenantId'>>): SessionProfile | undefined;
export declare function deleteProfile(id: string): boolean;
export declare function cleanupExpiredSessions(): BrowserSession[];
export declare function enqueueCommand(sessionId: string, command: SessionCommand): void;
export declare function dequeueCommand(sessionId: string): SessionCommand | undefined;
export declare function getQueueLength(sessionId: string): number;
