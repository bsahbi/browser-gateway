"use strict";
/**
 * Session Manager Service
 *
 * Manages stateful browser sessions:
 * - Session lifecycle (create, close, expire)
 * - Command execution
 * - History tracking
 * - Profile management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSession = createSession;
exports.getSession = getSession;
exports.closeSession = closeSession;
exports.extendSession = extendSession;
exports.listSessions = listSessions;
exports.recordAction = recordAction;
exports.getActions = getActions;
exports.recordNavigation = recordNavigation;
exports.getNavigationHistory = getNavigationHistory;
exports.createProfile = createProfile;
exports.getProfile = getProfile;
exports.listProfiles = listProfiles;
exports.updateProfile = updateProfile;
exports.deleteProfile = deleteProfile;
exports.cleanupExpiredSessions = cleanupExpiredSessions;
exports.enqueueCommand = enqueueCommand;
exports.dequeueCommand = dequeueCommand;
exports.getQueueLength = getQueueLength;
const uuid_1 = require("uuid");
const schemas_1 = require("./schemas");
// In-memory stores (replace with Redis in production)
const sessions = new Map();
const sessionActions = new Map();
const navigationHistory = new Map();
const profiles = new Map();
// Session configuration
const DEFAULT_SESSION_TTL_MINUTES = 30;
const MAX_ACTIONS_PER_SESSION = 100;
// ============================================
// Session Lifecycle
// ============================================
function createSession(tenantId, provider, profileId, ttlMinutes) {
    const id = (0, uuid_1.v4)();
    const now = new Date().toISOString();
    const expiresAt = (0, schemas_1.calculateExpiry)(ttlMinutes || DEFAULT_SESSION_TTL_MINUTES);
    const session = {
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
function getSession(id) {
    const session = sessions.get(id);
    // Check expiry
    if (session && new Date(session.expiresAt) < new Date()) {
        session.status = 'expired';
        session.updatedAt = new Date().toISOString();
        sessions.set(id, session);
    }
    return session;
}
function closeSession(id) {
    const session = sessions.get(id);
    if (!session) {
        return undefined;
    }
    session.status = 'idle';
    session.updatedAt = new Date().toISOString();
    sessions.set(id, session);
    return session;
}
function extendSession(id, additionalMinutes) {
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
function listSessions(tenantId, status) {
    let result = Array.from(sessions.values()).filter(s => s.tenantId === tenantId);
    if (status) {
        result = result.filter(s => s.status === status);
    }
    return result.sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
}
// ============================================
// Session Actions
// ============================================
function recordAction(sessionId, action) {
    const session = sessions.get(sessionId);
    if (!session || session.status !== 'active') {
        return null;
    }
    const actions = sessionActions.get(sessionId) || [];
    // Check action limit
    if (actions.length >= MAX_ACTIONS_PER_SESSION) {
        return null;
    }
    const sessionAction = {
        id: (0, uuid_1.v4)(),
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
function getActions(sessionId, limit) {
    const actions = sessionActions.get(sessionId) || [];
    return limit ? actions.slice(-limit) : actions;
}
// ============================================
// Navigation History
// ============================================
function recordNavigation(sessionId, state) {
    const history = navigationHistory.get(sessionId) || [];
    const navigationState = {
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
function getNavigationHistory(sessionId) {
    return navigationHistory.get(sessionId) || [];
}
// ============================================
// Session Profiles
// ============================================
function createProfile(tenantId, name, config) {
    const id = (0, uuid_1.v4)();
    const profile = {
        id,
        name,
        tenantId,
        ...config,
    };
    profiles.set(id, profile);
    return profile;
}
function getProfile(id) {
    return profiles.get(id);
}
function listProfiles(tenantId) {
    if (tenantId) {
        return Array.from(profiles.values()).filter(p => p.tenantId === tenantId);
    }
    return Array.from(profiles.values());
}
function updateProfile(id, updates) {
    const profile = profiles.get(id);
    if (!profile) {
        return undefined;
    }
    const updated = {
        ...profile,
        ...updates,
    };
    profiles.set(id, updated);
    return updated;
}
function deleteProfile(id) {
    return profiles.delete(id);
}
// ============================================
// Session Cleanup (Reaper)
// ============================================
function cleanupExpiredSessions() {
    const now = new Date();
    const expired = [];
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
const commandQueue = new Map();
function enqueueCommand(sessionId, command) {
    const queue = commandQueue.get(sessionId) || [];
    queue.push(command);
    commandQueue.set(sessionId, queue);
}
function dequeueCommand(sessionId) {
    const queue = commandQueue.get(sessionId);
    if (!queue || queue.length === 0) {
        return undefined;
    }
    return queue.shift();
}
function getQueueLength(sessionId) {
    return commandQueue.get(sessionId)?.length || 0;
}
