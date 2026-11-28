/**
 * Session Manager Service
 * 
 * Manages stateful browser sessions:
 * - Session lifecycle (create, close, expire)
 * - Command execution
 * - History tracking
 * - Profile management
 */

import { v4 as uuidv4 } from 'uuid';
import {
  BrowserSession,
  SessionStatus,
  SessionAction,
  NavigationState,
  SessionProfile,
  SessionCommand,
  SessionResult,
  createId,
  calculateExpiry,
} from './schemas';

// In-memory stores (replace with Redis in production)
const sessions = new Map<string, BrowserSession>();
const sessionActions = new Map<string, SessionAction[]>();
const navigationHistory = new Map<string, NavigationState[]>();
const profiles = new Map<string, SessionProfile>();

// Session configuration
const DEFAULT_SESSION_TTL_MINUTES = 30;
const MAX_ACTIONS_PER_SESSION = 100;

// ============================================
// Session Lifecycle
// ============================================

export function createSession(
  tenantId: string,
  provider: string,
  profileId?: string,
  ttlMinutes?: number
): BrowserSession {
  const id = uuidv4();
  const now = new Date().toISOString();
  const expiresAt = calculateExpiry(ttlMinutes || DEFAULT_SESSION_TTL_MINUTES);

  const session: BrowserSession = {
    id,
    tenantId,
    provider,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    expiresAt,
    lastActivityAt: now,
    metadata: profileId ? { profileId } : undefined,
  };

  sessions.set(id, session);
  sessionActions.set(id, []);
  navigationHistory.set(id, []);

  return session;
}

export function getSession(id: string): BrowserSession | undefined {
  const session = sessions.get(id);
  
  // Check expiry
  if (session && new Date(session.expiresAt) < new Date()) {
    session.status = 'expired';
    session.updatedAt = new Date().toISOString();
    sessions.set(id, session);
  }

  return session;
}

export function closeSession(id: string): BrowserSession | undefined {
  const session = sessions.get(id);
  if (!session) {
    return undefined;
  }

  session.status = 'idle';
  session.updatedAt = new Date().toISOString();
  sessions.set(id, session);

  return session;
}

export function extendSession(id: string, additionalMinutes: number): BrowserSession | undefined {
  const session = sessions.get(id);
  if (!session) {
    return undefined;
  }

  const currentExpiry = new Date(session.expiresAt);
  const newExpiry = new Date(currentExpiry.getTime() + additionalMinutes * 60 * 1000);
  
  session.expiresAt = newExpiry.toISOString();
  session.updatedAt = new Date().toISOString();
  sessions.set(id, session);

  return session;
}

export function listSessions(tenantId: string, status?: SessionStatus): BrowserSession[] {
  let result = Array.from(sessions.values()).filter(s => s.tenantId === tenantId);
  
  if (status) {
    result = result.filter(s => s.status === status);
  }

  return result.sort((a, b) => 
    new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
  );
}

// ============================================
// Session Actions
// ============================================

export function recordAction(
  sessionId: string,
  action: Omit<SessionAction, 'id' | 'timestamp'>
): SessionAction | null {
  const session = sessions.get(sessionId);
  if (!session || session.status !== 'active') {
    return null;
  }

  const actions = sessionActions.get(sessionId) || [];
  
  // Check action limit
  if (actions.length >= MAX_ACTIONS_PER_SESSION) {
    return null;
  }

  const sessionAction: SessionAction = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    ...action,
  };

  actions.push(sessionAction);
  sessionActions.set(sessionId, actions);

  // Update last activity
  session.lastActivityAt = sessionAction.timestamp;
  session.updatedAt = sessionAction.timestamp;
  sessions.set(sessionId, session);

  return sessionAction;
}

export function getActions(sessionId: string, limit?: number): SessionAction[] {
  const actions = sessionActions.get(sessionId) || [];
  return limit ? actions.slice(-limit) : actions;
}

// ============================================
// Navigation History
// ============================================

export function recordNavigation(
  sessionId: string,
  state: Omit<NavigationState, 'timestamp'>
): void {
  const history = navigationHistory.get(sessionId) || [];
  
  const navigationState: NavigationState = {
    ...state,
    timestamp: new Date().toISOString(),
  };

  history.push(navigationState);
  
  // Keep last 50 navigations
  if (history.length > 50) {
    history.shift();
  }

  navigationHistory.set(sessionId, history);
}

export function getNavigationHistory(sessionId: string): NavigationState[] {
  return navigationHistory.get(sessionId) || [];
}

// ============================================
// Session Profiles
// ============================================

export function createProfile(
  tenantId: string,
  name: string,
  config: Omit<SessionProfile, 'id' | 'name' | 'tenantId'>
): SessionProfile {
  const id = uuidv4();
  const profile: SessionProfile = {
    id,
    name,
    tenantId,
    ...config,
  };

  profiles.set(id, profile);
  return profile;
}

export function getProfile(id: string): SessionProfile | undefined {
  return profiles.get(id);
}

export function listProfiles(tenantId?: string): SessionProfile[] {
  if (tenantId) {
    return Array.from(profiles.values()).filter(p => p.tenantId === tenantId);
  }
  return Array.from(profiles.values());
}

export function updateProfile(
  id: string,
  updates: Partial<Omit<SessionProfile, 'id' | 'tenantId'>>
): SessionProfile | undefined {
  const profile = profiles.get(id);
  if (!profile) {
    return undefined;
  }

  const updated: SessionProfile = {
    ...profile,
    ...updates,
  };

  profiles.set(id, updated);
  return updated;
}

export function deleteProfile(id: string): boolean {
  return profiles.delete(id);
}

// ============================================
// Session Cleanup (Reaper)
// ============================================

export function cleanupExpiredSessions(): BrowserSession[] {
  const now = new Date();
  const expired: BrowserSession[] = [];

  for (const [id, session] of sessions.entries()) {
    if (new Date(session.expiresAt) < now) {
      session.status = 'expired';
      session.updatedAt = now.toISOString();
      sessions.set(id, session);
      expired.push(session);
    }
  }

  return expired;
}

// Run cleanup every 5 minutes
setInterval(() => {
  const expired = cleanupExpiredSessions();
  if (expired.length > 0) {
    console.log(`Cleaned up ${expired.length} expired sessions`);
  }
}, 5 * 60 * 1000);

// ============================================
// Command Queue (for async execution)
// ============================================

const commandQueue = new Map<string, SessionCommand[]>();

export function enqueueCommand(sessionId: string, command: SessionCommand): void {
  const queue = commandQueue.get(sessionId) || [];
  queue.push(command);
  commandQueue.set(sessionId, queue);
}

export function dequeueCommand(sessionId: string): SessionCommand | undefined {
  const queue = commandQueue.get(sessionId);
  if (!queue || queue.length === 0) {
    return undefined;
  }
  return queue.shift();
}

export function getQueueLength(sessionId: string): number {
  return commandQueue.get(sessionId)?.length || 0;
}
