// server.js - ClickShield backend with SQLite persistence, rule audit, auth, and optional AI

// === CLICKSHIELD:SECTION:CONFIG ===

// === CLICKSHIELD:SECTION:CONFIG ===

// === CLICKSHIELD:SECTION:ANCHOR_INDEX ===
// Anchors in this file (keep updated):
// - CLICKSHIELD:SECTION:CONFIG
// - CLICKSHIELD:SECTION:ANCHOR_INDEX
// - CLICKSHIELD:SECTION:ERROR_BOUNDARY
// - CLICKSHIELD:SECTION:AUTH
// - CLICKSHIELD:SECTION:CACHE
// - CLICKSHIELD:SECTION:MIDDLEWARE
// - CLICKSHIELD:SECTION:HEALTH
// - CLICKSHIELD:SECTION:ENGINE_STATUS
// - CLICKSHIELD:SECTION:AUTH_ENDPOINTS
// - CLICKSHIELD:SECTION:AI_SETUP
// (more anchors may exist in the second half)

// === CLICKSHIELD:SECTION:CONFIG_CONTINUES ===


const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const {
  readNavigationFeedTruth: readNavigationFeedTruthFromModule,
} = require('./navigationFeedTruth');

// >>> ENV SETUP (keep this exactly as-is)
require('dotenv').config({ override: true });
console.log(
  '[ClickShield][AI] Loaded OPENAI_API_KEY prefix:',
  process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.slice(0, 10) : 'none'
);
// <<< ENV SETUP

const app = express();
const PORT = process.env.PORT || 4000;
const NAVIGATION_FEEDS_ROOT = path.join(__dirname, 'feeds', 'navigation');
const NAVIGATION_BUNDLES_ROOT = path.join(NAVIGATION_FEEDS_ROOT, 'bundles');
// === CLICKSHIELD:SECTION:AI_SETUP ===
// NOTE: Declare early so routes can safely reference it (prevents TDZ ReferenceError).
let openai = null;
// === /CLICKSHIELD:SECTION:AI_SETUP ===


// Trust proxy so secure cookies work correctly behind a proxy (Next.js / render / fly)
app.set('trust proxy', 1);

// === CLICKSHIELD:SECTION:ERROR_BOUNDARY ===

// =====================================================
// ============ RELIABILITY / OBSERVABILITY ============
// =====================================================

// ---- Structured JSON logger (single line logs) ----
function safeJsonStringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch {
    // last resort: avoid crashing logging
    return (
      '{"ts":"' +
      new Date().toISOString() +
      '","level":"error","event":"log_stringify_failed"}'
    );
  }
}

function logJson(level, event, fields = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level: level || 'info',
    event: event || 'log',
    service: 'clickshield-backend',
    ...fields,
  };

  const line = safeJsonStringify(payload);

  // Keep stderr for error/warn, stdout otherwise
  if (payload.level === 'error' || payload.level === 'warn') {
    console.error(line);
  } else {
    console.log(line);
  }
}

function redactApiKey(raw) {
  try {
    if (!raw) return null;
    const s = raw.toString();
    if (s.length <= 8) return '***';
    return s.slice(0, 4) + '...' + s.slice(-2);
  } catch {
    return null;
  }
}

function getReqId(req) {
  return req.reqId || null;
}

function deriveClientIp(req) {
  try {
    const xff = (req.headers['x-forwarded-for'] || '').toString();
    if (xff) {
      // could be a list, keep first hop
      return xff.split(',')[0].trim();
    }
    return (req.ip || '').toString() || null;
  } catch {
    return null;
  }
}

// Attach per-request context + request log on finish
function attachRequestContext(req, res, next) {
  req.reqId = crypto.randomUUID
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');

  req._reqStartAt = Date.now();

  res.setHeader('x-request-id', req.reqId);

  res.on('finish', () => {
    const ms = Date.now() - (req._reqStartAt || Date.now());

    const authOrgId = req.authUser?.orgId || null;
    const authUserId = req.authUser?.id || null;

    const apiKey =
      req.headers['x-clickshield-api-key'] || req.headers['x-api-key'] || null;

    logJson('info', 'request', {
      reqId: getReqId(req),
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      latencyMs: ms,
      ip: deriveClientIp(req),
      userAgent: (req.headers['user-agent'] || '').toString() || null,
      orgId: authOrgId,
      userId: authUserId,
      role: req.userRole || null,
      apiKey: redactApiKey(apiKey),
    });
  });

  next();
}

// ---- Rate limiting (per API key OR per org, fallback to IP) ----
// Fixed window counter (simple + reliable for v1)
const RATE_LIMIT_WINDOW_MS = Math.max(
  parseInt(process.env.CLICKSHIELD_RATE_LIMIT_WINDOW_MS || '60000', 10) || 60000,
  1000
);

// Default: 120 req/min per key/org
const RATE_LIMIT_MAX = Math.max(
  parseInt(process.env.CLICKSHIELD_RATE_LIMIT_MAX || '120', 10) || 120,
  1
);

// Optional: separate admin max
const RATE_LIMIT_ADMIN_MAX = Math.max(
  parseInt(process.env.CLICKSHIELD_RATE_LIMIT_ADMIN_MAX || '600', 10) || 600,
  1
);

const rateLimitBuckets = new Map();
// bucket shape: { windowStartMs, count }
function rateLimitKeyForRequest(req) {
  const apiKey =
    req.headers['x-clickshield-api-key'] || req.headers['x-api-key'] || null;

  // Prefer API key if present
  if (apiKey && typeof apiKey === 'string' && apiKey.trim()) {
    // hash key to avoid storing secrets in memory logs
    const h = crypto.createHash('sha256').update(apiKey.trim()).digest('hex');
    return `apiKey:${h}`;
  }

  // Then orgId if present (auth preferred)
  const orgId =
    req.authUser?.orgId ||
    (req.headers['x-org-id'] || req.headers['x-clickshield-org-id'] || '')
      .toString() ||
    (req.query && req.query.orgId ? req.query.orgId.toString() : '') ||
    '';

  if (orgId) return `org:${orgId}`;

  // Fallback: IP
  const ip = deriveClientIp(req) || 'unknown';
  return `ip:${ip}`;
}

function isAdminRoute(req) {
  try {
    const p = (req.originalUrl || req.url || '').toString();
    return p.startsWith('/admin') || p.startsWith('/export');
  } catch {
    return false;
  }
}

function rateLimitMiddleware(req, res, next) {
  try {
    const key = rateLimitKeyForRequest(req);
    const now = Date.now();

    const max = isAdminRoute(req) ? RATE_LIMIT_ADMIN_MAX : RATE_LIMIT_MAX;

    const bucket = rateLimitBuckets.get(key) || {
      windowStartMs: now,
      count: 0,
    };

    // rotate window
    if (now - bucket.windowStartMs >= RATE_LIMIT_WINDOW_MS) {
      bucket.windowStartMs = now;
      bucket.count = 0;
    }

    bucket.count += 1;
    rateLimitBuckets.set(key, bucket);

    const remaining = Math.max(max - bucket.count, 0);
    const resetMs = bucket.windowStartMs + RATE_LIMIT_WINDOW_MS;

    // Standard-ish headers (useful for dashboards)
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil(resetMs / 1000))); // epoch seconds

    if (bucket.count > max) {
      logJson('warn', 'rate_limit_block', {
        reqId: getReqId(req),
        key,
        max,
        windowMs: RATE_LIMIT_WINDOW_MS,
        path: req.originalUrl || req.url,
        method: req.method,
        orgId: req.authUser?.orgId || null,
        userId: req.authUser?.id || null,
        ip: deriveClientIp(req),
      });

      return res.status(429).json({
        ok: false,
        error: 'Rate limit exceeded',
        limit: max,
        windowMs: RATE_LIMIT_WINDOW_MS,
      });
    }

    next();
  } catch (err) {
    // Never block traffic if limiter fails
    logJson('error', 'rate_limit_error', {
      reqId: getReqId(req),
      message: err.message || String(err),
    });
    next();
  }
}

// ---- Health checks (/health basic, /health/deep DB+AI+queue) ----
async function checkDbHealth(dbAvailable, db) {
  try {
    if (!dbAvailable || !db) return { ok: false, mode: 'unavailable' };
    // lightweight
    const row = db.prepare('SELECT 1 as ok').get();
    return { ok: !!row && row.ok === 1, mode: 'sqlite' };
  } catch (err) {
    return {
      ok: false,
      mode: 'sqlite',
      error: err.message || String(err),
    };
  }
}

async function checkAiHealth(openaiClient) {
  try {
    if (!openaiClient) return { ok: false, mode: 'disabled' };

    // For v1: avoid external calls by default.
    // Optional deep AI call if CLICKSHIELD_HEALTH_AI_CALL=1 (costs a tiny request).
    const doCall =
      (process.env.CLICKSHIELD_HEALTH_AI_CALL || '').toString() === '1';
    if (!doCall) {
      return { ok: true, mode: 'configured_no_call' };
    }

    const response = await openaiClient.responses.create({
      model: 'gpt-4.1-mini',
      input: [{ role: 'user', content: 'ping' }],
      max_output_tokens: 5,
    });

    const model = response?.model || 'unknown';
    return { ok: true, mode: 'live', model };
  } catch (err) {
    const status = err.status || err.statusCode || null;
    return {
      ok: false,
      mode: 'live',
      status: status || null,
      error: err.message || String(err),
    };
  }
}

async function checkQueueHealth() {
  // No queue is wired in this file today. Provide a standard hook.
  // If you later add a real queue, expose:
  // global.clickshieldQueue = { name: 'bullmq', ping: async ()=>true }
  try {
    const q = global.clickshieldQueue || null;
    if (!q) return { ok: true, mode: 'none' };
    if (typeof q.ping !== 'function')
      return {
        ok: false,
        mode: q.name || 'unknown',
        error: 'missing ping()',
      };
    const ok = await q.ping();
    return { ok: !!ok, mode: q.name || 'custom' };
  } catch (err) {
    return { ok: false, mode: 'custom', error: err.message || String(err) };
  }
}

// === CLICKSHIELD:SECTION:AUTH ===

// =====================================================
// ================== RBAC / ADMIN KEY =================
// =====================================================

const ADMIN_API_KEY = process.env.CLICKSHIELD_ADMIN_API_KEY || null;
let hasLoggedAdminKeyWarning = false;

const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ORG_ADMIN: 'ORG_ADMIN',
  SEC_ANALYST: 'SEC_ANALYST',
  USER: 'USER',
};

function deriveRoleFromHeaders(req) {
  try {
    const raw = (req.headers['x-clickshield-role'] || req.headers['x-role'] || '')
      .toString()
      .toUpperCase();

    if (raw && ROLES[raw]) {
      return raw;
    }
  } catch {
    // fall through to default
  }

  // Default demo role: ORG_ADMIN (full org control)
  return ROLES.ORG_ADMIN;
}

// =====================================================
// =================== AUTH CONSTANTS ==================
// =====================================================

// JWT secret (for dev, we fall back to a random key so the app still works)
const AUTH_JWT_SECRET =
  process.env.CLICKSHIELD_AUTH_SECRET || crypto.randomBytes(32).toString('hex');

if (!process.env.CLICKSHIELD_AUTH_SECRET) {
  console.warn(
    '[ClickShield][Auth] CLICKSHIELD_AUTH_SECRET not set; using ephemeral key. Sessions will reset on restart.'
  );
}

const AUTH_COOKIE_NAME = 'cs_session';
const AUTH_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days
const AUTH_HASH_SECRET =
  process.env.CLICKSHIELD_AUTH_HASH_SECRET || 'clickshield-dev-hash';

// Cookie behavior (proxy-safe)
const AUTH_COOKIE_SAMESITE = (
  process.env.CLICKSHIELD_COOKIE_SAMESITE || 'lax'
).toLowerCase(); // lax | strict | none

function isHttpsRequest(req) {
  // Works correctly behind proxies when trust proxy = 1
  if (req.secure) return true;

  const xfProto = (req.headers['x-forwarded-proto'] || '')
    .toString()
    .toLowerCase();

  if (xfProto.includes('https')) return true;

  return false;
}

/**
 * Dev-only helper:
 * If you're on localhost (dashboard:3000 -> backend:4000), cookies often won't flow due to SameSite/Secure rules.
 * To preserve founder velocity + calm UI behavior, we allow a local dev fallback identity.
 * Production remains strict.
 */
function isLocalDevRequest(req) {
  try {
    if (process.env.NODE_ENV === 'production') return false;

    const origin = (req.headers.origin || '').toString().toLowerCase();
    const host = (req.headers.host || '').toString().toLowerCase();

    const localhostOrigin =
      origin.includes('http://localhost') ||
      origin.includes('http://127.0.0.1');

    const localhostHost =
      host.includes('localhost') || host.includes('127.0.0.1');

    return localhostOrigin || localhostHost;
  } catch {
    return false;
  }
}

// Basic SHA-256 password hashing with a shared salt.
// For v1 this is enough; swap to bcrypt/argon later if needed.
function hashPassword(plaintext) {
  if (!plaintext) return null;
  return crypto
    .createHash('sha256')
    .update(`${plaintext}:${AUTH_HASH_SECRET}`)
    .digest('hex');
}

function verifyPassword(plaintext, passwordHash) {
  if (!plaintext || !passwordHash) return false;
  const expected = hashPassword(plaintext);
  return expected === passwordHash;
}

function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;

  const parts = header.split(';');
  for (const part of parts) {
    const [rawName, ...rest] = part.split('=');
    if (!rawName) continue;
    const name = rawName.trim();
    if (!name) continue;
    const value = rest.join('=').trim();
    if (!value) continue;
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

function authFromRequest(req) {
  // Prefer Bearer token header for programmatic usage, fall back to cookie
  let token = null;

  const header = req.headers['authorization'];
  if (header && typeof header === 'string' && header.startsWith('Bearer ')) {
    token = header.slice(7).trim();
  }

  if (!token) {
    const cookies = parseCookies(req);
    if (cookies[AUTH_COOKIE_NAME]) {
      token = cookies[AUTH_COOKIE_NAME];
    }
  }

  if (!token) return null;

  try {
    const payload = jwt.verify(token, AUTH_JWT_SECRET);
    if (!payload || !payload.sub || !payload.orgId || !payload.role) {
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email || null,
      orgId: payload.orgId,
      role: payload.role,
    };
  } catch (err) {
    // Do not throw; just treat as unauthenticated
    console.warn(
      '[ClickShield][Auth] Failed to verify session token:',
      err.message || err
    );
    return null;
  }
}

function attachAuthSession(req, res, next) {
  const user = authFromRequest(req);
  if (user) {
    req.authUser = user;
  }
  next();
}

// Attach a simple role to every request.
// If an authenticated user exists, prefer that; otherwise use header-based demo.
function attachRequestRole(req, res, next) {
  if (req.authUser && req.authUser.role && ROLES[req.authUser.role]) {
    req.userRole = req.authUser.role;
    return next();
  }
  req.userRole = deriveRoleFromHeaders(req);
  next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const role = req.userRole || deriveRoleFromHeaders(req);

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        ok: false,
        error: 'Forbidden: insufficient role',
        role,
      });
    }

    next();
  };
}

function requireAdminApiKey(req, res, next) {
  // If no admin key is configured, do NOT block the request.
  // This keeps dev/demo environments working without extra setup.
  if (!ADMIN_API_KEY) {
    if (!hasLoggedAdminKeyWarning) {
      console.warn(
        '[ClickShield][Admin] CLICKSHIELD_ADMIN_API_KEY not set; /admin and /export routes are currently unprotected.'
      );
      hasLoggedAdminKeyWarning = true;
    }
    return next();
  }

  // Accept either x-clickshield-admin-key or x-api-key for convenience
  const headerKey =
    req.headers['x-clickshield-admin-key'] || req.headers['x-api-key'];

  if (!headerKey || headerKey !== ADMIN_API_KEY) {
    return res.status(401).json({
      ok: false,
      error: 'Unauthorized: missing or invalid admin API key',
    });
  }

  return next();
}

/**
 * Require auth, but keep founder velocity in dev:
 * If you're on localhost and have no cookie/token (common due to SameSite/Secure),
 * we attach a deterministic demo identity so the dashboard/admin suite can load.
 *
 * Production remains strict (401 when missing auth).
 */
function requireAuth(req, res, next) {
  if (req.authUser) return next();

  if (isLocalDevRequest(req)) {
    req.authUser = {
      id: 'user-1',
      email: 'security@acmecorp.com',
      orgId: 'demo-acme',
      role: ROLES.ORG_ADMIN,
    };
    req.userRole = ROLES.ORG_ADMIN;

    console.warn(
      '[ClickShield][Auth][DEV] No session detected; using local dev fallback identity:',
      req.authUser.email,
      'org=',
      req.authUser.orgId
    );

    return next();
  }

  return res.status(401).json({
    ok: false,
    error: 'Unauthorized: authentication required',
  });
}

// For GET endpoints that accept orgId as a query parameter, enforce tenant isolation.
function enforceOrgIdFromAuth(req, res, next) {
  if (req.method !== 'GET') return next();
  if (!req.authUser || !req.authUser.orgId) return next();

  const authOrgId = req.authUser.orgId;
  const currentQueryOrgId =
    (req.query.orgId && req.query.orgId.toString()) || null;

  if (!currentQueryOrgId) {
    req.query.orgId = authOrgId;
    return next();
  }

  if (
    currentQueryOrgId !== authOrgId &&
    req.authUser.role !== ROLES.SUPER_ADMIN
  ) {
    req.query.orgId = authOrgId;
  }

  return next();
}

// =====================================================
// ================== ORG CONTEXT (NEW) ================
// =====================================================

// Calm org derivation for writes (mobile/web/extension/API):
// - Prefer auth org if present
// - Else accept x-clickshield-org-id / x-org-id
// - Else accept body.orgId (dev only) as last resort
function deriveOrgIdForWrite(req) {
  const authOrgId = req.authUser?.orgId || null;
  if (authOrgId) return authOrgId;

  const headerOrg =
    (req.headers['x-clickshield-org-id'] || req.headers['x-org-id'] || '')
      .toString()
      .trim();

  const bodyOrg = (req.body?.orgId || req.body?.org_id || '').toString().trim();

  // Local dev normalization: keep everything in demo-acme unless explicitly testing multi-org
  if (isLocalDevRequest(req)) {
    const candidate = headerOrg || bodyOrg || '';
    if (!candidate) return 'demo-acme';
    if (candidate.toLowerCase() === 'personal') return 'demo-acme';
    return candidate;
  }

  // Production: require explicit org context when not authenticated
  if (headerOrg) return headerOrg;

  return null;
}


function requireOrgForWrite(req, res, next) {
  const orgId = deriveOrgIdForWrite(req);
  if (!orgId) {
    return res.status(400).json({
      ok: false,
      error:
        'Missing org context. Provide auth session OR x-clickshield-org-id header.',
    });
  }
  req.effectiveOrgId = orgId;
  next();
}

// === CLICKSHIELD:SECTION:SQLITE ===
// =====================================================
// ================== SQLITE PERSISTENCE ===============
// =====================================================


let Database = null;
let db = null;
let dbAvailable = false;

function ensureColumnExists(tableName, columnName, alterSql) {
  if (!dbAvailable || !db) return;
  try {
    const info = db.prepare(`PRAGMA table_info(${tableName})`).all();
    const exists = info.some((c) => c.name === columnName);
    if (!exists) {
      db.exec(alterSql);
      logJson('info', 'db_schema_migration', {
        table: tableName,
        column: columnName,
      });
    }
  } catch (err) {
    logJson('error', 'db_error', {
      message: `[DB] Failed to ensure column ${columnName} on ${tableName}`,
      error: err.message || String(err),
    });
  }
}

// === CLICKSHIELD:SECTION:AUDIT ===


// =====================================================
// ============== AUDIT LOGS (ADMIN ACTIONS) ===========
// =====================================================

const ADMIN_AUDIT_MAX = 500;
const adminAuditFallback = [];
const AUDIT_FALLBACK_PATH =
  process.env.CLICKSHIELD_AUDIT_FALLBACK_PATH ||
  path.join(__dirname, 'clickshield-audit.log');

function safePushAuditFallback(event) {
  try {
    adminAuditFallback.unshift(event);
    if (adminAuditFallback.length > ADMIN_AUDIT_MAX) {
      adminAuditFallback.length = ADMIN_AUDIT_MAX;
    }
  } catch {
    // swallow
  }
}

function safeAppendAuditToFile(event) {
  try {
    const line = JSON.stringify(event) + '\n';
    fs.appendFile(AUDIT_FALLBACK_PATH, line, () => {
      // ignore errors intentionally; this is best-effort only
    });
  } catch {
    // swallow
  }
}

function buildAuditEventBase(req, orgId) {
  const actor = req.authUser || null;
  return {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString('hex'),
    orgId: orgId || actor?.orgId || null,
    actorUserId: actor?.id || null,
    actorEmail: actor?.email || null,
    actorRole: actor?.role || req.userRole || null,
    ip: deriveClientIp(req),
    userAgent: (req.headers['user-agent'] || '').toString() || null,
    createdAt: new Date().toISOString(),
  };
}

function persistAuditLogToDb(event) {
  if (!dbAvailable || !db) return false;

  const stmt = db.prepare(
    `
    INSERT INTO audit_logs (
      id, orgId,
      actorUserId, actorEmail, actorRole,
      actionType,
      targetType, targetId,
      summary,
      beforeJson, afterJson,
      ip, userAgent,
      createdAt
    ) VALUES (
      @id, @orgId,
      @actorUserId, @actorEmail, @actorRole,
      @actionType,
      @targetType, @targetId,
      @summary,
      @beforeJson, @afterJson,
      @ip, @userAgent,
      @createdAt
    )
    `
  );

  try {
    stmt.run({
      id: event.id,
      orgId: event.orgId,
      actorUserId: event.actorUserId,
      actorEmail: event.actorEmail,
      actorRole: event.actorRole,
      actionType: event.actionType,
      targetType: event.targetType || null,
      targetId: event.targetId || null,
      summary: event.summary || null,
      beforeJson: event.beforeJson ? JSON.stringify(event.beforeJson) : null,
      afterJson: event.afterJson ? JSON.stringify(event.afterJson) : null,
      ip: event.ip || null,
      userAgent: event.userAgent || null,
      createdAt: event.createdAt,
    });
    return true;
  } catch (err) {
    logJson('error', 'db_error', {
      message: 'Failed to write audit log; will fallback',
      error: err.message || String(err),
    });
    return false;
  }
}

function writeAuditLog(req, event) {
  // Never throw; never block the caller.
  try {
    const ok = persistAuditLogToDb(event);
    if (!ok) {
      safePushAuditFallback(event);
      safeAppendAuditToFile(event);
    }
  } catch {
    safePushAuditFallback(event);
    safeAppendAuditToFile(event);
  }
}

// =====================================================
// ================== SQLITE INIT ======================
// =====================================================

try {
  Database = require('better-sqlite3');
  const dbPath =
    process.env.CLICKSHIELD_DB_PATH ||
    path.join(__dirname, 'clickshield.sqlite');

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Basic tables for orgs, users, scans, admin configs, integrations
  db.exec(
    `
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      plan TEXT,
      risk TEXT,
      status TEXT,
      seats INTEGER,
      primaryDomain TEXT,
      activeUsers INTEGER,
      adminCount INTEGER,
      analystCount INTEGER,
      userCount INTEGER,
      lastSeen TEXT,
      lastHighRiskEvent TEXT,
      createdAt TEXT NOT NULL
    );

    -- Users directory + auth identity
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      orgId TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      role TEXT NOT NULL,
      lastActiveAt TEXT,
      invitedAt TEXT,
      passwordHash TEXT,
      FOREIGN KEY (orgId) REFERENCES organizations(id)
    );

    CREATE TABLE IF NOT EXISTS admin_configs (
      orgId TEXT PRIMARY KEY,
      alertChannels TEXT,
      exportTargets TEXT,
      siemEnabled INTEGER,
      siemProvider TEXT,
      siemEndpoint TEXT,
      scheduleDailyDigest INTEGER,
      scheduleWeeklyReport INTEGER,
      FOREIGN KEY (orgId) REFERENCES organizations(id)
    );

    CREATE TABLE IF NOT EXISTS integrations (
      id TEXT PRIMARY KEY,
      orgId TEXT NOT NULL,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      target TEXT,
      lastEvent TEXT,
      FOREIGN KEY (orgId) REFERENCES organizations(id)
    );

    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      orgId TEXT,
      orgName TEXT,
      userId TEXT,
      userEmail TEXT,
      userType TEXT,
      url TEXT,
      riskLevel TEXT,
      riskScore INTEGER,
      threatType TEXT,
      detectedBy TEXT,
      detectedByType TEXT,
      ruleName TEXT,
      deviceId TEXT,
      source TEXT,
      engine TEXT,
      checkedAt TEXT,
      ruleReason TEXT,
      shortAdvice TEXT,
      aiNarrative TEXT,
      aiModel TEXT,
      -- incident workflow fields
      escalated INTEGER,
      lastEscalatedAt TEXT,
      escalationTargets TEXT,
      createdAt TEXT NOT NULL
    );

    -- Admin audit trail (compliance): who changed what, when?
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      orgId TEXT,
      actorUserId TEXT,
      actorEmail TEXT,
      actorRole TEXT,
      actionType TEXT NOT NULL,
      targetType TEXT,
      targetId TEXT,
      summary TEXT,
      beforeJson TEXT,
      afterJson TEXT,
      ip TEXT,
      userAgent TEXT,
      createdAt TEXT NOT NULL
    );
    `
  );

  dbAvailable = true;
  logJson('info', 'db_ready', { dbPath });

  // Ensure new columns exist even if DB was created by an older version
  ensureColumnExists(
    'users',
    'passwordHash',
    'ALTER TABLE users ADD COLUMN passwordHash TEXT'
  );
  ensureColumnExists(
    'scans',
    'detectedByType',
    'ALTER TABLE scans ADD COLUMN detectedByType TEXT'
  );
  ensureColumnExists(
    'scans',
    'ruleName',
    'ALTER TABLE scans ADD COLUMN ruleName TEXT'
  );
  ensureColumnExists(
    'scans',
    'escalated',
    'ALTER TABLE scans ADD COLUMN escalated INTEGER'
  );
  ensureColumnExists(
    'scans',
    'lastEscalatedAt',
    'ALTER TABLE scans ADD COLUMN lastEscalatedAt TEXT'
  );
  ensureColumnExists(
    'scans',
    'escalationTargets',
    'ALTER TABLE scans ADD COLUMN escalationTargets TEXT'
  );
  // Newer ordering resilience: ensure createdAt exists (already in schema, but safe in case of legacy)
  ensureColumnExists(
    'scans',
    'createdAt',
    'ALTER TABLE scans ADD COLUMN createdAt TEXT'
  );
} catch (err) {
  logJson('error', 'db_error', {
    message: 'SQLite unavailable; running in in-memory mode only',
    error: err.message || String(err),
  });
  dbAvailable = false;
}

function safeDbRun(statement, params) {
  if (!dbAvailable || !db) return false;
  try {
    statement.run(params);
    return true;
  } catch (err) {
    logJson('error', 'db_error', {
      message: 'Statement failed; disabling DB for this process',
      error: err.message || String(err),
    });
    dbAvailable = false;
    return false;
  }
}

function safeDbGet(statement, params) {
  if (!dbAvailable || !db) return null;
  try {
    return statement.get(params);
  } catch (err) {
    logJson('error', 'db_error', {
      message: 'Query failed; disabling DB for this process',
      error: err.message || String(err),
    });
    dbAvailable = false;
    return null;
  }
}

function safeDbAll(statement, params) {
  if (!dbAvailable || !db) return [];
  try {
    return statement.all(params);
  } catch (err) {
    logJson('error', 'db_error', {
      message: 'Query failed; disabling DB for this process',
      error: err.message || String(err),
    });
    dbAvailable = false;
    return [];
  }
}

// === /CLICKSHIELD:SECTION:SQLITE ===

// === /CLICKSHIELD:SECTION:AUDIT ===



// === CLICKSHIELD:SECTION:CACHE ===

// =====================================================
// ============ IN-MEMORY FALLBACK STRUCTURES =========
// =====================================================

const RECENT_SCANS_MAX = 200;
const recentScans = [];

// Last-known-good cache for dashboard reads (5-second self-heal when DB wobbles)
const RECENT_SCANS_LKG_MAX = 200;
const recentScansLkgByOrg = new Map(); // orgId -> { ts, items }
function setRecentScansLkg(orgId, items) {
  try {
    if (!orgId) return;
    recentScansLkgByOrg.set(orgId, {
      ts: Date.now(),
      items: Array.isArray(items) ? items.slice(0, RECENT_SCANS_LKG_MAX) : [],
    });
  } catch {
    // swallow
  }
}
function getRecentScansLkg(orgId) {
  try {
    if (!orgId) return null;
    const v = recentScansLkgByOrg.get(orgId);
    if (!v) return null;
    // keep it fresh-ish; 60s window is fine
    if (Date.now() - (v.ts || 0) > 60_000) return null;
    return v.items || null;
  } catch {
    return null;
  }
}

// In-memory sample orgs so the Admin Suite works without a DB.
// Used only for seeding or when DB is disabled.
const ADMIN_SAMPLE_ORGS = [
  {
    orgId: 'demo-acme',
    name: 'Acme Corp',
    plan: 'Enterprise',
    risk: 'medium',
    status: 'active',
    seats: 200,
    primaryDomain: 'acmecorp.com',
    activeUsers: 143,
    adminCount: 8,
    analystCount: 15,
    userCount: 120,
    lastSeen: new Date().toISOString(),
    lastHighRiskEvent: null,
  },
  {
    orgId: 'org-1',
    name: 'Acme Financial Group',
    plan: 'Enterprise',
    risk: 'high',
    status: 'active',
    seats: 184,
    primaryDomain: 'acme-fin.com',
    activeUsers: 121,
    adminCount: 6,
    analystCount: 10,
    userCount: 105,
    lastSeen: new Date().toISOString(),
    lastHighRiskEvent: null,
  },
];

const ADMIN_SAMPLE_INTEGRATIONS = [
  {
    id: 'int-slack-demo-acme',
    orgId: 'demo-acme',
    provider: 'Slack',
    status: 'connected',
    target: '#clickshield-alerts',
    lastEvent: 'Test phishing alert · 5m ago',
  },
  {
    id: 'int-teams-demo-acme',
    orgId: 'demo-acme',
    provider: 'Teams',
    status: 'connected',
    target: 'SecOps War Room',
    lastEvent: 'ClickShield test event · 10m ago',
  },
  {
    id: 'int-notion-demo-acme',
    orgId: 'demo-acme',
    provider: 'Notion',
    status: 'connected',
    target: 'Runbooks / ClickShield',
    lastEvent: 'Playbook linked for last incident',
  },
  {
    id: 'int-jira-demo-acme',
    orgId: 'demo-acme',
    provider: 'Jira',
    status: 'connected',
    target: 'SEC-BOARD',
    lastEvent: 'Incident SEC-231 opened from ClickShield',
  },
  {
    id: 'int-email-demo-acme',
    orgId: 'demo-acme',
    provider: 'Email',
    status: 'connected',
    target: 'soc-oncall@acmecorp.com',
    lastEvent: 'Daily digest delivered · 06:00 UTC',
  },
];

// Per-org alerts & exports config (seed source)
const ADMIN_SAMPLE_ALERTS_EXPORTS = [
  {
    orgId: 'demo-acme',
    alertChannels: ['Slack · #clickshield-alerts', 'Teams · SecOps War Room'],
    exportTargets: ['Notion · Runbooks / ClickShield', 'Jira · SEC-BOARD'],
    siem: {
      enabled: false,
      provider: null,
      endpoint: null,
    },
    schedule: {
      dailyDigest: true,
      weeklyReport: true,
    },
  },
];

// Per-org user directory (in-memory demo users for RBAC UI / auth seed)
const ADMIN_SAMPLE_ORG_USERS = {
  'demo-acme': [
    {
      id: 'user-1',
      email: 'security@acmecorp.com',
      name: 'Acme Security Admin',
      role: ROLES.ORG_ADMIN,
      lastActiveAt: new Date().toISOString(),
      invitedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      // Demo password: clickshield-demo
      passwordHash: hashPassword('clickshield-demo'),
    },
    {
      id: 'user-2',
      email: 'analyst1@acmecorp.com',
      name: 'Security Analyst One',
      role: ROLES.SEC_ANALYST,
      lastActiveAt: new Date().toISOString(),
      invitedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      passwordHash: hashPassword('clickshield-demo'),
    },
    {
      id: 'user-3',
      email: 'user1@acmecorp.com',
      name: 'Wallet User One',
      role: ROLES.USER,
      lastActiveAt: null,
      invitedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
      passwordHash: hashPassword('clickshield-demo'),
    },
  ],
  'org-1': [
    {
      id: 'org1-admin-1',
      email: 'admin@acme-fin.com',
      name: 'Acme Fin Admin',
      role: ROLES.ORG_ADMIN,
      lastActiveAt: new Date().toISOString(),
      invitedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      passwordHash: hashPassword('clickshield-demo'),
    },
    {
      id: 'org1-analyst-1',
      email: 'analyst@acme-fin.com',
      name: 'Acme Fin Analyst',
      role: ROLES.SEC_ANALYST,
      lastActiveAt: null,
      invitedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      passwordHash: hashPassword('clickshield-demo'),
    },
  ],
};

// =====================================================
// ============ DB SEEDING FROM IN-MEMORY DEMOS ========
// =====================================================

function seedDbIfEmpty() {
  if (!dbAvailable || !db) return;

  try {
    const countRow = db
      .prepare('SELECT COUNT(*) as count FROM organizations')
      .get();
    if (countRow && countRow.count > 0) {
      return; // already seeded
    }
  } catch (err) {
    logJson('error', 'db_error', {
      message: 'Failed to check seed status; disabling DB',
      error: err.message || String(err),
    });
    dbAvailable = false;
    return;
  }

  logJson('info', 'db_seed_start', { source: 'demo' });

  const insertOrg = db.prepare(
    `
    INSERT INTO organizations (
      id, name, plan, risk, status, seats,
      primaryDomain, activeUsers, adminCount, analystCount, userCount,
      lastSeen, lastHighRiskEvent, createdAt
    ) VALUES (
      @id, @name, @plan, @risk, @status, @seats,
      @primaryDomain, @activeUsers, @adminCount, @analystCount, @userCount,
      @lastSeen, @lastHighRiskEvent, @createdAt
    )
    `
  );

  const insertUser = db.prepare(
    `
    INSERT INTO users (
      id, orgId, email, name, role, lastActiveAt, invitedAt, passwordHash
    ) VALUES (
      @id, @orgId, @email, @name, @role, @lastActiveAt, @invitedAt, @passwordHash
    )
    `
  );

  const insertCfg = db.prepare(
    `
    INSERT INTO admin_configs (
      orgId, alertChannels, exportTargets,
      siemEnabled, siemProvider, siemEndpoint,
      scheduleDailyDigest, scheduleWeeklyReport
    ) VALUES (
      @orgId, @alertChannels, @exportTargets,
      @siemEnabled, @siemProvider, @siemEndpoint,
      @scheduleDailyDigest, @scheduleWeeklyReport
    )
    `
  );

  const insertIntegration = db.prepare(
    `
    INSERT INTO integrations (
      id, orgId, provider, status, target, lastEvent
    ) VALUES (
      @id, @orgId, @provider, @status, @target, @lastEvent
    )
    `
  );

  try {
    const now = new Date().toISOString();

    for (const org of ADMIN_SAMPLE_ORGS) {
      insertOrg.run({
        id: org.orgId,
        name: org.name,
        plan: org.plan,
        risk: org.risk,
        status: org.status,
        seats: org.seats,
        primaryDomain: org.primaryDomain,
        activeUsers: org.activeUsers,
        adminCount: org.adminCount,
        analystCount: org.analystCount,
        userCount: org.userCount,
        lastSeen: org.lastSeen,
        lastHighRiskEvent: org.lastHighRiskEvent,
        createdAt: now,
      });
    }

    for (const [orgId, users] of Object.entries(ADMIN_SAMPLE_ORG_USERS)) {
      for (const u of users) {
        insertUser.run({
          id: u.id,
          orgId,
          email: u.email,
          name: u.name,
          role: u.role,
          lastActiveAt: u.lastActiveAt,
          invitedAt: u.invitedAt,
          passwordHash: u.passwordHash || null,
        });
      }
    }

    for (const cfg of ADMIN_SAMPLE_ALERTS_EXPORTS) {
      insertCfg.run({
        orgId: cfg.orgId,
        alertChannels: JSON.stringify(cfg.alertChannels || []),
        exportTargets: JSON.stringify(cfg.exportTargets || []),
        siemEnabled: cfg.siem?.enabled ? 1 : 0,
        siemProvider: cfg.siem?.provider || null,
        siemEndpoint: cfg.siem?.endpoint || null,
        scheduleDailyDigest: cfg.schedule?.dailyDigest ? 1 : 0,
        scheduleWeeklyReport: cfg.schedule?.weeklyReport ? 1 : 0,
      });
    }

    for (const int of ADMIN_SAMPLE_INTEGRATIONS) {
      insertIntegration.run({
        id: int.id,
        orgId: int.orgId,
        provider: int.provider,
        status: int.status,
        target: int.target || null,
        lastEvent: int.lastEvent || null,
      });
    }

    logJson('info', 'db_seed_done', { ok: true });
  } catch (err) {
    logJson('error', 'db_error', {
      message: 'Seeding failed; disabling DB for this process',
      error: err.message || String(err),
    });
    dbAvailable = false;
  }
}

seedDbIfEmpty();

// =====================================================
// =========== ORG-SCOPED VIEW / HELPERS ===============
// =====================================================
function getOrgScopedScans(req) {
  const orgId = (req.query.orgId || '').toString();

  // Prefer DB for dashboard accuracy + cross-process stability
  if (dbAvailable && db) {
    const params = {};
    let where = '';
    if (orgId) {
      where = 'WHERE orgId = @orgId';
      params.orgId = orgId;
    }

    const rows = safeDbAll(
      db.prepare(
        `
        SELECT
          id, orgId, orgName, userId, userEmail, userType,
          url, riskLevel, riskScore, threatType, detectedBy,
          detectedByType, ruleName,
          deviceId, source, engine, checkedAt,
          ruleReason, shortAdvice, aiNarrative, aiModel,
          escalated, lastEscalatedAt, escalationTargets,
          createdAt
        FROM scans
        ${where}
        ORDER BY COALESCE(checkedAt, createdAt) DESC
        LIMIT 500
        `
      ),
      params
    );

    return (rows || []).map((r) => ({
      id: r.id,
      orgId: r.orgId,
      orgName: r.orgName,
      userId: r.userId,
      userEmail: r.userEmail,
      userType: r.userType,
      url: r.url,
      riskLevel: r.riskLevel,
      riskScore: r.riskScore,
      threatType: r.threatType,
      detectedBy: r.detectedBy,
      detectedByType: r.detectedByType,
      ruleName: r.ruleName,
      deviceId: r.deviceId,
      source: r.source,
      engine: r.engine,
      checkedAt: r.checkedAt,
      ruleReason: r.ruleReason,
      shortAdvice: r.shortAdvice,
      aiNarrative: r.aiNarrative,
      aiModel: r.aiModel,
      escalated: !!r.escalated,
      lastEscalatedAt: r.lastEscalatedAt,
      escalationTargets: r.escalationTargets
        ? (() => {
            try {
              const parsed = JSON.parse(r.escalationTargets);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          })()
        : [],
      createdAt: r.createdAt || null,
    }));
  }

  // DB down -> fallback to memory
  if (!orgId) return recentScans;
  return recentScans.filter((s) => (s.orgId || '') === orgId);
}


function findOrgOverview(orgId) {
  if (dbAvailable && db) {
    const row = safeDbGet(
      db.prepare('SELECT * FROM organizations WHERE id = @orgId LIMIT 1'),
      { orgId }
    );
    if (row) {
      return {
        orgId: row.id,
        name: row.name,
        plan: row.plan || 'Enterprise',
        risk: row.risk || 'medium',
        status: row.status || 'active',
        seats: row.seats || 0,
        primaryDomain: row.primaryDomain || null,
        activeUsers: row.activeUsers || 0,
        adminCount: row.adminCount || 0,
        analystCount: row.analystCount || 0,
        userCount: row.userCount || 0,
        lastSeen: row.lastSeen || null,
        lastHighRiskEvent: row.lastHighRiskEvent || null,
      };
    }
  }

  return ADMIN_SAMPLE_ORGS.find((org) => org.orgId === orgId) || null;
}

function findOrgIntegrations(orgId) {
  if (dbAvailable && db) {
    const rows = safeDbAll(
      db.prepare(
        'SELECT id, orgId, provider, status, target, lastEvent FROM integrations WHERE orgId = @orgId'
      ),
      { orgId }
    );
    return rows || [];
  }

  // Fallback: in-memory demo integrations
  return ADMIN_SAMPLE_INTEGRATIONS.filter((int) => int.orgId === orgId);
}

function findOrgAlertsExports(orgId) {
  if (dbAvailable && db) {
    const row = safeDbGet(
      db.prepare('SELECT * FROM admin_configs WHERE orgId = @orgId LIMIT 1'),
      { orgId }
    );
    if (row) {
      return {
        orgId: row.orgId,
        alertChannels: row.alertChannels ? JSON.parse(row.alertChannels) : [],
        exportTargets: row.exportTargets ? JSON.parse(row.exportTargets) : [],
        siem: {
          enabled: !!row.siemEnabled,
          provider: row.siemProvider || null,
          endpoint: row.siemEndpoint || null,
        },
        schedule: {
          dailyDigest: !!row.scheduleDailyDigest,
          weeklyReport: !!row.scheduleWeeklyReport,
        },
      };
    }
  }

  return ADMIN_SAMPLE_ALERTS_EXPORTS.find((cfg) => cfg.orgId === orgId) || null;
}

function findOrgUsers(orgId) {
  if (dbAvailable && db) {
    const rows = safeDbAll(
      db.prepare(
        'SELECT id, orgId, email, name, role, lastActiveAt, invitedAt FROM users WHERE orgId = @orgId'
      ),
      { orgId }
    );
    if (rows && rows.length > 0) {
      return rows.map((r) => ({
        id: r.id,
        email: r.email,
        name: r.name,
        role: r.role,
        lastActiveAt: r.lastActiveAt,
        invitedAt: r.invitedAt,
      }));
    }
  }

  return ADMIN_SAMPLE_ORG_USERS[orgId] || [];
}

function findUserByEmail(email) {
  if (!dbAvailable || !db) return null;
  return safeDbGet(
    db.prepare(
      'SELECT id, orgId, email, name, role, passwordHash FROM users WHERE lower(email) = lower(@email) LIMIT 1'
    ),
    { email }
  );
}

function findUserById(id) {
  if (!dbAvailable || !db) return null;
  return safeDbGet(
    db.prepare('SELECT id, orgId, email, name, role FROM users WHERE id = @id LIMIT 1'),
    { id }
  );
}

function normalizeProviderFromParam(providerParam) {
  if (!providerParam) return null;
  const p = providerParam.toLowerCase();
  if (p === 'slack') return 'Slack';
  if (p === 'teams') return 'Teams';
  if (p === 'notion') return 'Notion';
  if (p === 'jira') return 'Jira';
  if (p === 'email') return 'Email';
  return null;
}

function sendJsonFile(res, filePath, cacheControl) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (cacheControl) {
    res.setHeader('Cache-Control', cacheControl);
  }
  res.sendFile(filePath);
}

function navigationBundleFilePath(bundleVersion) {
  const decodedVersion = decodeURIComponent((bundleVersion || '').toString());
  const resolvedPath = path.resolve(
    NAVIGATION_BUNDLES_ROOT,
    decodedVersion,
    'bundle.json'
  );

  if (!resolvedPath.startsWith(`${NAVIGATION_BUNDLES_ROOT}${path.sep}`)) {
    return null;
  }

  return resolvedPath;
}

// =====================================================
// ===================== MIDDLEWARE ====================
// =====================================================

// === CLICKSHIELD:SECTION:MIDDLEWARE ===

app.use(
  cors({
    origin: true, // reflect request origin
    credentials: true, // allow cookies / auth headers
  })
);

// ✅ Tauri/WebView fix: always satisfy CORS preflight fast (before auth/rate-limit/org checks)
app.options('*', cors({ origin: true, credentials: true }));
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

app.use(
  express.json({
    limit: '1mb', // guardrail; URLs/docs are small
  })
);

// Request context + request logging (JSON)
app.use(attachRequestContext);

// Auth + role attachments
app.use(attachAuthSession);
app.use(attachRequestRole);
app.use(enforceOrgIdFromAuth);

// Rate limiting (per API key / org / IP)
app.use(rateLimitMiddleware);

// =====================================================
// ============== SHIELD MODE (NORMAL / PARANOID) ======
// =====================================================

// Shield mode: 'normal' (extension corner badge hidden) or 'paranoid' (badge shown).
// Stored in-memory; desktop agent re-pushes on every boot.
let shieldMode = 'normal';

// GET /shield-mode — read current shield mode (no auth, local-only)
app.get('/shield-mode', (req, res) => {
  res.json({ ok: true, shieldMode });
});

// PUT /shield-mode — set shield mode (no auth, local-only desktop agent)
app.put('/shield-mode', (req, res) => {
  const mode = (req.body?.shieldMode || '').toString().trim().toLowerCase();
  if (mode !== 'normal' && mode !== 'paranoid') {
    return res.status(400).json({
      ok: false,
      error: 'shieldMode must be "normal" or "paranoid"',
    });
  }
  shieldMode = mode;
  logJson('info', 'shield_mode_changed', { shieldMode: mode });
  res.json({ ok: true, shieldMode });
});

// =====================================================
// ================ HEALTH / CURRENT USER ==============
// =====================================================

// === CLICKSHIELD:SECTION:HEALTH ===

// Basic health: cheap, no external calls
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'clickshield-backend',
    dbAvailable,
    checkedAt: new Date().toISOString(),
  });
});

app.get('/intel/feeds/navigation/manifest.json', (req, res) => {
  const manifestPath = path.join(NAVIGATION_FEEDS_ROOT, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return res.status(404).json({
      ok: false,
      error: 'Navigation feed manifest not found',
    });
  }

  return sendJsonFile(res, manifestPath, 'no-store');
});

app.get('/intel/feeds/navigation/bundles/:bundleVersion/bundle.json', (req, res) => {
  const bundlePath = navigationBundleFilePath(req.params.bundleVersion);
  if (!bundlePath || !fs.existsSync(bundlePath)) {
    return res.status(404).json({
      ok: false,
      error: 'Navigation feed bundle not found',
    });
  }

  return sendJsonFile(res, bundlePath, 'public, max-age=31536000, immutable');
});

app.get('/intel/feeds/navigation/status.json', (req, res) => {
  const truth = readNavigationFeedTruthFromModule({
    feedsRoot: NAVIGATION_FEEDS_ROOT,
    now: Date.now(),
  });
  return res.status(truth.httpStatus).json(truth.payload);
});

// Deep health: DB + AI + queue
app.get('/health/deep', async (req, res) => {
  const dbCheck = await checkDbHealth(dbAvailable, db);
  const aiCheck = await checkAiHealth(openai);
  const queueCheck = await checkQueueHealth();

  const ok = !!dbCheck.ok && !!aiCheck.ok && !!queueCheck.ok;

  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    service: 'clickshield-backend',
    checks: {
      db: dbCheck,
      ai: aiCheck,
      queue: queueCheck,
    },
    checkedAt: new Date().toISOString(),
  });
});

// =====================================================
// ============== ENGINE / MONITORING STATUS ===========
// =====================================================

// === CLICKSHIELD:SECTION:ENGINE_STATUS ===

// Used by dashboard status badge ("ACTIVE" vs "MONITORING")
app.get('/engine/status', (req, res) => {
  const ruleEngineAvailable = true; // rules are always local
  const aiEngineAvailable = !!openai; // OpenAI client initialized?
  const dbOk = !!dbAvailable;

  const engineState = ruleEngineAvailable ? 'ACTIVE' : 'DEGRADED';

  res.json({
    ok: true,
    engine: {
      state: engineState, // ACTIVE | DEGRADED
      ruleEngine: ruleEngineAvailable ? 'AVAILABLE' : 'UNAVAILABLE',
      aiEngine: aiEngineAvailable ? 'AVAILABLE' : 'UNAVAILABLE',
      database: dbOk ? 'AVAILABLE' : 'UNAVAILABLE',
    },
    mode: aiEngineAvailable ? 'RULE_PLUS_AI' : 'RULE_ONLY',
    checkedAt: new Date().toISOString(),
  });
});

// -------- Authentication endpoints --------

// === CLICKSHIELD:SECTION:AUTH_ENDPOINTS ===

// POST /auth/login
// Body: { email, password }
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        message: 'email and password are required',
      });
    }

    if (!dbAvailable || !db) {
      return res.status(503).json({
        ok: false,
        message:
          'Authentication is temporarily unavailable (no database). Check backend configuration.',
      });
    }

    const userRow = findUserByEmail(email.toString().trim().toLowerCase());

    if (!userRow || !userRow.passwordHash) {
      return res.status(401).json({
        ok: false,
        message: 'Invalid email or password',
      });
    }

    const valid = verifyPassword(password, userRow.passwordHash);
    if (!valid) {
      return res.status(401).json({
        ok: false,
        message: 'Invalid email or password',
      });
    }

    const orgOverview = findOrgOverview(userRow.orgId) || {
      orgId: userRow.orgId,
      name: userRow.orgId,
    };

    const claims = {
      sub: userRow.id,
      email: userRow.email,
      orgId: userRow.orgId,
      role: userRow.role,
    };

    const token = jwt.sign(claims, AUTH_JWT_SECRET, {
      expiresIn: AUTH_COOKIE_MAX_AGE_SECONDS,
    });

    const secureCookie =
      process.env.NODE_ENV === 'production' ? isHttpsRequest(req) : false;

    const sameSite =
      AUTH_COOKIE_SAMESITE === 'none'
        ? 'none'
        : AUTH_COOKIE_SAMESITE === 'strict'
        ? 'strict'
        : 'lax';

    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: sameSite === 'none' ? true : secureCookie,
      sameSite,
      maxAge: AUTH_COOKIE_MAX_AGE_SECONDS * 1000,
    });

    return res.json({
      ok: true,
      token,
      user: {
        id: userRow.id,
        email: userRow.email,
        name: userRow.name || userRow.email,
      },
      org: {
        id: orgOverview.orgId,
        name: orgOverview.name,
      },
      role: userRow.role,
    });
  } catch (err) {
    logJson('error', 'auth_error', {
      reqId: getReqId(req),
      path: '/auth/login',
      message: err.message || String(err),
    });

    return res.status(500).json({
      ok: false,
      message: 'Internal server error',
    });
  }
});

// POST /auth/logout - clear session cookie
app.post('/auth/logout', (req, res) => {
  const secureCookie =
    process.env.NODE_ENV === 'production' ? isHttpsRequest(req) : false;

  const sameSite =
    AUTH_COOKIE_SAMESITE === 'none'
      ? 'none'
      : AUTH_COOKIE_SAMESITE === 'strict'
      ? 'strict'
      : 'lax';

  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: sameSite === 'none' ? true : secureCookie,
    sameSite,
  });

  return res.json({
    ok: true,
  });
});

// GET /me - current user from auth token (or local dev fallback)
app.get('/me', requireAuth, (req, res) => {
  const authUser = req.authUser;

  if (!authUser) {
    return res.status(401).json({
      ok: false,
      error: 'Unauthorized',
    });
  }

  let userRow = null;
  let orgOverview = null;

  if (dbAvailable && db) {
    userRow = findUserById(authUser.id);
    orgOverview = findOrgOverview(authUser.orgId);
  } else {
    orgOverview = findOrgOverview(authUser.orgId);
  }

  res.json({
    ok: true,
    user: {
      id: authUser.id,
      email: authUser.email || userRow?.email || 'unknown@clickshield.local',
      name: userRow?.name || authUser.email || 'ClickShield User',
    },
    org: {
      id: orgOverview?.orgId || authUser.orgId,
      name: orgOverview?.name || authUser.orgId || 'ClickShield Org',
    },
    role: authUser.role || ROLES.ORG_ADMIN,
  });
});


// =====================================================
// ===================== OpenAI / AI Setup =============
// =====================================================

// === CLICKSHIELD:SECTION:AI_SETUP ===



// (declared earlier near CONFIG to avoid TDZ issues)


if (process.env.OPENAI_API_KEY) {
  try {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    logJson('info', 'ai_ready', {
      mode: 'RULE_PLUS_AI',
      keyPrefix: process.env.OPENAI_API_KEY.slice(0, 8),
    });
  } catch (err) {
    logJson('error', 'ai_error', {
      message: 'Failed to initialize OpenAI client',
      error: err.message || String(err),
    });
    openai = null;
  }
} else {
  logJson('info', 'ai_ready', { mode: 'RULE_ONLY' });
}

// === CLICKSHIELD:SECTION:SCAN_PIPELINE ===

// =====================================================
// =================== AI ANALYSIS =====================
// =====================================================

async function runAiAnalysis({ url, ruleResult, effectiveUserType, source }) {
  if (!openai) {
    return null;
  }

  try {
    const prompt = `
You are the AI engine for ClickShield, a Web3 and consumer security platform.

You receive:
- A URL that was just scanned
- The output of a deterministic rule engine (risk level, threat type, score, reason)
- Basic context: is this a consumer or business user, and the source (extension, mobile, dashboard, api).

Your job:
1. Briefly validate or lightly refine the rule engine's assessment.
2. Write a concise, business-friendly narrative (2-3 sentences) explaining the risk in clear language.
3. If the URL looks extremely benign, you can slightly reinforce SAFE, but do not override to SAFE if rules said DANGEROUS.
4. Focus heavily on wallet drainers, seed phrase theft, phishing, and common Web3 scam patterns.
5. Avoid long walls of text. No bullet points. No markdown. No headings.

Return ONLY a short paragraph (2–3 sentences) suitable for showing in a security dashboard or browser overlay.
`;

    const inputDescription = {
      url,
      ruleResult,
      userType: effectiveUserType,
      source,
    };

    const response = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: prompt,
        },
        {
          role: 'user',
          content: JSON.stringify(inputDescription),
        },
      ],
    });

    const output = response.output?.[0]?.content?.[0];
    const text = output && output.text ? output.text.trim() : null;

    if (!text) {
      return null;
    }

    return {
      aiNarrative: text,
      aiModel: response.model || 'gpt-4.1-mini',
    };
  } catch (err) {
    const status = err.status || err.statusCode || null;

    logJson('error', 'ai_error', {
      reqId: null,
      status: status || null,
      message: err.message || String(err),
    });

    if (status === 401) {
      logJson('error', 'ai_error', {
        message: 'Disabling AI for this process (401). Running in RULE_ONLY mode.',
      });
      openai = null;
    }

    return null;
  }
}

// =====================================================
// =============== SOURCE DERIVATION ===================
// =====================================================

function deriveSourceFromBody(body = {}) {
  try {
    const rawSource = (body.source || body.userType || body.user_type || '')
      .toString()
      .toLowerCase();

    if (rawSource === 'browser-extension' || rawSource === 'extension') {
      return 'extension';
    }
    if (rawSource === 'consumer' || rawSource === 'mobile') {
      return 'mobile';
    }
    if (rawSource === 'business' || rawSource === 'dashboard' || rawSource === 'admin') {
      return 'dashboard';
    }

    return 'api';
  } catch {
    return 'api';
  }
}

// =====================================================
// ================== TRUSTED DOMAINS ==================
// =====================================================

const TRUSTED_DOMAINS = [
  'lowes.com',
  'www.lowes.com',
  'openai.com',
  'platform.openai.com',
  'www.openai.com',
];

function isTrustedDomain(rawUrl) {
  if (!rawUrl) return false;
  try {
    const normalized =
      rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
        ? rawUrl
        : `https://${rawUrl}`;
    const u = new URL(normalized);
    const host = (u.hostname || '').toLowerCase();
    return TRUSTED_DOMAINS.includes(host);
  } catch {
    return false;
  }
}

// =====================================================
// ============== SIMPLE RULE ENGINE ===================
// =====================================================

function runRuleEngine(rawUrl) {
  const url = (rawUrl || '').toString();
  const lower = url.toLowerCase();

  let riskLevel = 'SAFE';
  let threatType = 'GENERIC';
  let score = 10;
  let reason = 'No obvious threat patterns detected.';
  let detectedBy = 'Rule: baseline-no-match';
  let detectedByType = 'HEURISTIC';
  let ruleName = 'baseline-no-match';

  if (isTrustedDomain(url)) {
    riskLevel = 'SAFE';
    threatType = 'TRUSTED_SITE';
    score = 5;
    reason = 'Domain is on ClickShield trusted allowlist.';
    detectedBy = 'Rule: trusted-allowlist';
    detectedByType = 'HEURISTIC';
    ruleName = 'trusted-allowlist';

    logJson('info', 'rule_hit', {
      ruleName,
      detectedBy,
      detectedByType,
      riskLevel,
      threatType,
      score,
      url,
    });

    return {
      ruleRiskLevel: riskLevel,
      ruleThreatCategory: threatType,
      ruleScore: score,
      ruleReason: reason,
      detectedBy,
      detectedByType,
      ruleName,
    };
  }

  const dangerousKeywords = [
    'seed-phrase',
    'seedphrase',
    'private-key',
    'privatekey',
    'drainer',
    'walletdrainer',
    'verify-seed',
    'recovery-phrase',
  ];

  const suspiciousKeywords = [
    'airdrop',
    'claim',
    'mint',
    'bonus',
    'giveaway',
    'login',
    'signin',
    'sign-in',
    'metamask',
    'phantom',
    'keplr',
    'ledger',
    'trezor',
  ];

  let matchedDangerous = [];
  let matchedSuspicious = [];

  for (const k of dangerousKeywords) {
    if (lower.includes(k)) matchedDangerous.push(k);
  }
  for (const k of suspiciousKeywords) {
    if (lower.includes(k)) matchedSuspicious.push(k);
  }

  const looksLikeWalletConnect =
    lower.includes('walletconnect') ||
    lower.includes('wc?uri=') ||
    lower.includes('wc=');

  const looksLikeLoginPhish =
    lower.includes('login') &&
    (lower.includes('metamask') ||
      lower.includes('phantom') ||
      lower.includes('binance') ||
      lower.includes('coinbase'));

  if (matchedDangerous.length > 0 || looksLikeWalletConnect) {
    riskLevel = 'DANGEROUS';
    threatType = 'PHISHING_DRAINER';
    score = 90;
    reason =
      'URL matches high-risk crypto scam patterns (wallet drainer / seed phrase).';
    detectedBy =
      matchedDangerous.length > 0
        ? `Rule: wallet-drainer-keyword: ${matchedDangerous[0]}`
        : 'Rule: walletconnect-pattern';
    detectedByType = 'RULE_ONLY';
    ruleName =
      matchedDangerous.length > 0
        ? 'wallet-drainer-pattern'
        : 'walletconnect-pattern';
  } else if (matchedSuspicious.length > 0 || looksLikeLoginPhish) {
    riskLevel = 'SUSPICIOUS';
    threatType = 'PHISHING_LURE';
    score = 65;
    reason =
      'URL contains common crypto airdrop / login lure patterns. Treat with caution.';
    detectedBy =
      matchedSuspicious.length > 0
        ? `Rule: suspicious-keyword: ${matchedSuspicious[0]}`
        : 'Rule: login-phish-pattern';
    detectedByType = 'RULE_ONLY';
    ruleName =
      matchedSuspicious.length > 0
        ? 'suspicious-lure-pattern'
        : 'login-phish-pattern';
  }

  if (url.length < 15 && riskLevel === 'SAFE') {
    score = 15;
    reason =
      'Short URL with no known scam patterns detected. Appears low-risk but always verify the source.';
    detectedBy = 'Rule: short-url-heuristic';
    detectedByType = 'HEURISTIC';
    ruleName = 'short-url-heuristic';
  }

  if (ruleName !== 'baseline-no-match') {
    logJson('info', 'rule_hit', {
      ruleName,
      detectedBy,
      detectedByType,
      riskLevel,
      threatType,
      score,
      url,
      matchedDangerous,
      matchedSuspicious,
      looksLikeWalletConnect,
      looksLikeLoginPhish,
    });
  }

  return {
    ruleRiskLevel: riskLevel,
    ruleThreatCategory: threatType,
    ruleScore: score,
    ruleReason: reason,
    detectedBy,
    detectedByType,
    ruleName,
  };
}

// =====================================================
// ================ DB HELPERS: SCANS ==================
// =====================================================

function persistScanToDb(scan) {
  if (!dbAvailable || !db) return;

  const stmt = db.prepare(
    `
    INSERT INTO scans (
      id, orgId, orgName, userId, userEmail, userType,
      url, riskLevel, riskScore, threatType, detectedBy,
      detectedByType, ruleName,
      deviceId, source, engine, checkedAt, ruleReason,
      shortAdvice, aiNarrative, aiModel,
      escalated, lastEscalatedAt, escalationTargets,
      createdAt
    ) VALUES (
      @id, @orgId, @orgName, @userId, @userEmail, @userType,
      @url, @riskLevel, @riskScore, @threatType, @detectedBy,
      @detectedByType, @ruleName,
      @deviceId, @source, @engine, @checkedAt, @ruleReason,
      @shortAdvice, @aiNarrative, @aiModel,
      @escalated, @lastEscalatedAt, @escalationTargets,
      @createdAt
    )
    `
  );

  safeDbRun(stmt, {
    id: scan.id,
    orgId: scan.orgId || null,
    orgName: scan.orgName || null,
    userId: scan.userId || null,
    userEmail: scan.userEmail || null,
    userType: scan.userType || null,
    url: scan.url || null,
    riskLevel: scan.riskLevel || null,
    riskScore: typeof scan.riskScore === 'number' ? scan.riskScore : null,
    threatType: scan.threatType || null,
    detectedBy: scan.detectedBy || null,
    detectedByType: scan.detectedByType || null,
    ruleName: scan.ruleName || null,
    deviceId: scan.deviceId || null,
    source: scan.source || null,
    engine: scan.engine || null,
    checkedAt: scan.checkedAt || null,
    ruleReason: scan.ruleReason || null,
    shortAdvice: scan.shortAdvice || null,
    aiNarrative: scan.aiNarrative || null,
    aiModel: scan.aiModel || null,
    escalated: scan.escalated ? 1 : 0,
    lastEscalatedAt: scan.lastEscalatedAt || null,
    escalationTargets: scan.escalationTargets
      ? JSON.stringify(scan.escalationTargets)
      : null,
    createdAt: scan.createdAt || new Date().toISOString(),
  });
}

function pushRecentScanMemory(scan) {
  try {
    recentScans.unshift(scan);
    if (recentScans.length > RECENT_SCANS_MAX) {
      recentScans.length = RECENT_SCANS_MAX;
    }
  } catch {
    // swallow
  }
}

// =====================================================
// ===================== MIDDLEWARE: ADMIN =============
// =====================================================

app.use(
  '/admin',
  requireAuth,
  requireAdminApiKey,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.SEC_ANALYST)
);
app.use(
  '/export',
  requireAuth,
  requireAdminApiKey,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.SEC_ANALYST)
);

// =====================================================
// ============== SCAN ROUTES (NEW / FIX) ==============
// =====================================================

// POST /scan-url
// Body: { url, deviceId?, userType?, userEmail?, source?, orgId? }
// Auth cookie preferred; for API clients, send x-clickshield-org-id.
app.post('/scan-url', requireOrgForWrite, async (req, res) => {
  try {
    const url = (req.body?.url || '').toString().trim();
    if (!url) {
      return res.status(400).json({ ok: false, error: 'url is required' });
    }

    const orgId = req.effectiveOrgId;
    const org = findOrgOverview(orgId);
    const source = deriveSourceFromBody(req.body || {});
    const checkedAt = new Date().toISOString();

    const ruleResult = runRuleEngine(url);

    const effectiveUserType =
      (req.body?.userType || req.body?.user_type || '').toString() ||
      (req.authUser ? 'business' : 'consumer');

    const ai = await runAiAnalysis({
      url,
      ruleResult,
      effectiveUserType,
      source,
    });

    const scan = {
      id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
      orgId,
      orgName: org?.name || orgId,
      userId: req.authUser?.id || null,
      userEmail: req.authUser?.email || (req.body?.userEmail || null),
      userType: effectiveUserType || null,
      url,
      riskLevel: ruleResult.ruleRiskLevel,
      riskScore: ruleResult.ruleScore,
      threatType: ruleResult.ruleThreatCategory,
      detectedBy: ruleResult.detectedBy,
      detectedByType: ruleResult.detectedByType,
      ruleName: ruleResult.ruleName,
      deviceId: (req.body?.deviceId || req.body?.device_id || null),
      source,
      engine: openai ? 'RULE_PLUS_AI' : 'RULE_ONLY',
      checkedAt,
      ruleReason: ruleResult.ruleReason,
      shortAdvice:
        ruleResult.ruleRiskLevel === 'DANGEROUS'
          ? 'Do not connect your wallet or enter seed phrases. Verify the domain and contact your security team.'
          : ruleResult.ruleRiskLevel === 'SUSPICIOUS'
          ? 'Proceed cautiously. Verify the domain and avoid signing unexpected transactions.'
          : 'No obvious scam patterns detected. Still verify the source before connecting a wallet.',
      aiNarrative: ai?.aiNarrative || null,
      aiModel: ai?.aiModel || null,
      escalated: false,
      lastEscalatedAt: null,
      escalationTargets: [],
      createdAt: checkedAt,
    };

    // Persist (DB-first, memory always)
    persistScanToDb(scan);
    pushRecentScanMemory(scan);

    logJson('info', 'scan_recorded', {
      reqId: getReqId(req),
      orgId,
      source,
      riskLevel: scan.riskLevel,
      threatType: scan.threatType,
      url,
      scanId: scan.id,
    });

    return res.json({ ok: true, scan, shieldMode });
  } catch (err) {
    logJson('error', 'scan_error', {
      reqId: getReqId(req),
      message: err.message || String(err),
    });
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// POST /scan-url/rescan
// Body: { scanId } OR { url }  (scanId preferred)
// Writes a NEW scan row (auditability) instead of overwriting.
app.post('/scan-url/rescan', requireAuth, requireOrgForWrite, async (req, res) => {
  try {
    const orgId = req.effectiveOrgId;
    const scanId = (req.body?.scanId || req.body?.id || '').toString().trim();
    const directUrl = (req.body?.url || '').toString().trim();

    let url = directUrl || null;

    if (!url && scanId && dbAvailable && db) {
      const row = safeDbGet(
        db.prepare(
          `SELECT id, orgId, url FROM scans WHERE id = @id AND orgId = @orgId LIMIT 1`
        ),
        { id: scanId, orgId }
      );
      url = row?.url || null;
    }

    if (!url && scanId) {
      // memory fallback lookup
      const mem = recentScans.find((s) => s.id === scanId && (s.orgId || '') === orgId);
      url = mem?.url || null;
    }

    if (!url) {
      return res.status(404).json({ ok: false, error: 'Original scan not found (org-scoped)' });
    }

    const org = findOrgOverview(orgId);
    const source = 'dashboard';
    const checkedAt = new Date().toISOString();

    const ruleResult = runRuleEngine(url);

    const ai = await runAiAnalysis({
      url,
      ruleResult,
      effectiveUserType: 'business',
      source,
    });

    const newScan = {
      id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
      orgId,
      orgName: org?.name || orgId,
      userId: req.authUser?.id || null,
      userEmail: req.authUser?.email || null,
      userType: 'business',
      url,
      riskLevel: ruleResult.ruleRiskLevel,
      riskScore: ruleResult.ruleScore,
      threatType: ruleResult.ruleThreatCategory,
      detectedBy: ruleResult.detectedBy,
      detectedByType: ruleResult.detectedByType,
      ruleName: ruleResult.ruleName,
      deviceId: null,
      source,
      engine: openai ? 'RULE_PLUS_AI' : 'RULE_ONLY',
      checkedAt,
      ruleReason: ruleResult.ruleReason,
      shortAdvice:
        ruleResult.ruleRiskLevel === 'DANGEROUS'
          ? 'Do not connect your wallet or enter seed phrases. Verify the domain and contact your security team.'
          : ruleResult.ruleRiskLevel === 'SUSPICIOUS'
          ? 'Proceed cautiously. Verify the domain and avoid signing unexpected transactions.'
          : 'No obvious scam patterns detected. Still verify the source before connecting a wallet.',
      aiNarrative: ai?.aiNarrative || null,
      aiModel: ai?.aiModel || null,
      escalated: false,
      lastEscalatedAt: null,
      escalationTargets: [],
      createdAt: checkedAt,
    };

    persistScanToDb(newScan);
    pushRecentScanMemory(newScan);

    // Lightweight audit log
    try {
      writeAuditLog(req, {
        ...buildAuditEventBase(req, orgId),
        actionType: 'SCAN_RESCAN',
        targetType: 'SCAN',
        targetId: scanId || url,
        summary: `${req.authUser?.email || 'Admin'} rescanned ${url}`,
        beforeJson: scanId ? { scanId } : null,
        afterJson: { newScanId: newScan.id, riskLevel: newScan.riskLevel, threatType: newScan.threatType },
      });
    } catch {
      // swallow
    }

    return res.json({ ok: true, scan: newScan, shieldMode });
  } catch (err) {
    logJson('error', 'scan_rescan_error', {
      reqId: getReqId(req),
      message: err.message || String(err),
    });
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// =====================================================
// =============== ADMIN AUDIT: QUERY ENDPOINT =========
// =====================================================

function safeParseJson(maybeJson) {
  if (!maybeJson || typeof maybeJson !== 'string') return null;
  try {
    return JSON.parse(maybeJson);
  } catch {
    return null;
  }
}

function humanTime(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toISOString();
  } catch {
    return iso;
  }
}

// =====================================================
// ================= ADMIN ROUTE GUARDS ================
// =====================================================

function ensureAdminOrgAccess(req, res, next) {
  const pathOrgId = (req.params.orgId || '').toString();
  if (!req.authUser || !pathOrgId) return next();
  if (req.authUser.role === ROLES.SUPER_ADMIN) return next();
  if (req.authUser.orgId !== pathOrgId) {
    return res.status(403).json({
      ok: false,
      error: 'Forbidden: cross-org admin access is not allowed for this account.',
    });
  }
  next();
}

// =====================================================
// ========= ALERTS / EXPORTS / SIEM HELPERS ===========
// =====================================================

// Small HTTP helper: best-effort JSON POST with timeout.
async function safePostJson(url, body, timeoutMs = 2000) {
  if (!url) return false;
  if (typeof fetch === 'undefined') {
    console.warn(
      '[ClickShield][HTTP] fetch is not available in this runtime; skipping POST to',
      url
    );
    return false;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    clearTimeout(timer);

    if (!res.ok) {
      logJson('error', 'webhook_error', {
        url,
        status: res.status,
      });
      return false;
    }

    return true;
  } catch (err) {
    logJson('error', 'webhook_error', {
      url,
      message: err.message || String(err),
    });
    return false;
  }
}

function normalizeAlertChannels(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === 'string') {
        return {
          type: 'label',
          display: entry,
          webhookUrl: null,
        };
      }
      if (typeof entry === 'object') {
        const type = (entry.type || '').toString().toLowerCase() || 'label';
        const display =
          entry.display || entry.label || entry.name || entry.target || '';
        const webhookUrl = entry.webhookUrl || entry.url || null;
        return {
          type,
          display,
          webhookUrl,
        };
      }
      return null;
    })
    .filter(Boolean);
}

function normalizeExportTargets(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === 'string') {
        return {
          type: 'label',
          display: entry,
          url: null,
          email: null,
        };
      }
      if (typeof entry === 'object') {
        const type = (entry.type || '').toString().toLowerCase() || 'label';
        const display =
          entry.display || entry.label || entry.name || entry.target || '';
        const url = entry.url || entry.webhookUrl || null;
        const email = entry.email || null;
        return {
          type,
          display,
          url,
          email,
        };
      }
      return null;
    })
    .filter(Boolean);
}

// =====================================================
// =========== ELITE ENTERPRISE ADMIN ROUTES ===========
// =====================================================

// GET /admin/orgs/:orgId/activity
app.get('/admin/orgs/:orgId/activity', ensureAdminOrgAccess, (req, res) => {
  const { orgId } = req.params;

  const limit = Math.min(
    Math.max(parseInt(req.query.limit || '50', 10) || 50, 1),
    200
  );
  const cursor = (req.query.cursor || '').toString().trim();

  if (dbAvailable && db) {
    const params = { orgId, limit };
    let cursorClause = '';
    if (cursor) {
      cursorClause = 'AND createdAt < @cursor';
      params.cursor = cursor;
    }

    const rows = safeDbAll(
      db.prepare(
        `
        SELECT
          id, orgId,
          actorUserId, actorEmail, actorRole,
          actionType,
          targetType, targetId,
          summary,
          beforeJson, afterJson,
          ip, userAgent,
          createdAt
        FROM audit_logs
        WHERE orgId = @orgId
        ${cursorClause}
        ORDER BY createdAt DESC
        LIMIT @limit
        `
      ),
      params
    );

    const items = (rows || []).map((r) => ({
      id: r.id,
      orgId: r.orgId,
      actorUserId: r.actorUserId,
      actorEmail: r.actorEmail,
      actorRole: r.actorRole,
      actionType: r.actionType,
      targetType: r.targetType,
      targetId: r.targetId,
      summary: r.summary,
      before: safeParseJson(r.beforeJson),
      after: safeParseJson(r.afterJson),
      ip: r.ip,
      userAgent: r.userAgent,
      createdAt: r.createdAt,
    }));

    const nextCursor =
      items.length > 0 ? items[items.length - 1].createdAt : null;

    return res.json({
      ok: true,
      orgId,
      items,
      limit,
      cursor: cursor || null,
      nextCursor,
      source: 'db',
    });
  }

  const filtered = adminAuditFallback
    .filter((e) => (e.orgId || '') === orgId)
    .filter((e) => (!cursor ? true : (e.createdAt || '') < cursor))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, limit);

  const nextCursor =
    filtered.length > 0 ? filtered[filtered.length - 1].createdAt : null;

  return res.json({
    ok: true,
    orgId,
    items: filtered,
    limit,
    cursor: cursor || null,
    nextCursor,
    source: 'memory_fallback',
  });
});

// GET /admin/orgs/:orgId/audit-logs
app.get('/admin/orgs/:orgId/audit-logs', ensureAdminOrgAccess, (req, res) => {
  const { orgId } = req.params;

  const limit = Math.min(
    Math.max(parseInt(req.query.limit || '25', 10) || 25, 1),
    200
  );

  const cursor = (req.query.cursor || '').toString().trim();

  if (dbAvailable && db) {
    const params = { orgId, limit };
    let cursorClause = '';
    if (cursor) {
      cursorClause = 'AND createdAt < @cursor';
      params.cursor = cursor;
    }

    const rows = safeDbAll(
      db.prepare(
        `
        SELECT
          id, orgId,
          actorUserId, actorEmail, actorRole,
          actionType,
          targetType, targetId,
          summary,
          beforeJson, afterJson,
          ip, userAgent,
          createdAt
        FROM audit_logs
        WHERE orgId = @orgId
        ${cursorClause}
        ORDER BY createdAt DESC
        LIMIT @limit
        `
      ),
      params
    );

    const items = (rows || []).map((r) => ({
      id: r.id,
      orgId: r.orgId,
      actorUserId: r.actorUserId,
      actorEmail: r.actorEmail,
      actorRole: r.actorRole,
      actionType: r.actionType,
      targetType: r.targetType,
      targetId: r.targetId,
      summary: r.summary,
      before: safeParseJson(r.beforeJson),
      after: safeParseJson(r.afterJson),
      ip: r.ip,
      userAgent: r.userAgent,
      createdAt: r.createdAt,
    }));

    const nextCursor =
      items.length > 0 ? items[items.length - 1].createdAt : null;

    return res.json({
      items,
      nextCursor,
      fallback: false,
    });
  }

  const filtered = adminAuditFallback
    .filter((e) => (e.orgId || '') === orgId)
    .filter((e) => (!cursor ? true : (e.createdAt || '') < cursor))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, limit);

  const nextCursor =
    filtered.length > 0 ? filtered[filtered.length - 1].createdAt : null;

  return res.json({
    items: filtered,
    nextCursor,
    fallback: true,
  });
});

// GET /admin/orgs/:orgId/overview
app.get('/admin/orgs/:orgId/overview', ensureAdminOrgAccess, (req, res) => {
  const { orgId } = req.params;
  const overview = findOrgOverview(orgId);

  if (!overview) {
    return res.status(404).json({
      overview: {
        orgId,
        name: 'Unknown organization',
        plan: 'Free',
        risk: 'low',
        status: 'active',
        seats: 0,
        primaryDomain: null,
        activeUsers: 0,
        lastSeen: null,
        lastHighRiskEvent: null,
      },
    });
  }

  res.json({ overview });
});

// GET /admin/orgs/:orgId/custom-rules
app.get('/admin/orgs/:orgId/custom-rules', ensureAdminOrgAccess, (req, res) => {
  const { orgId } = req.params;
  return res.json({
    orgId,
    rules: [],
    source: 'default',
  });
});

// GET /admin/orgs/:orgId/integrations
app.get('/admin/orgs/:orgId/integrations', ensureAdminOrgAccess, (req, res) => {
  const { orgId } = req.params;
  const integrations = findOrgIntegrations(orgId);

  res.json({
    orgId,
    integrations,
  });
});

function upsertIntegration({ orgId, provider, status, target, lastEvent }) {
  const id = `int-${provider.toLowerCase()}-${orgId}`;

  if (dbAvailable && db) {
    const existing = safeDbGet(
      db.prepare('SELECT id FROM integrations WHERE id = @id LIMIT 1'),
      { id }
    );

    if (existing) {
      const stmt = db.prepare(
        `
        UPDATE integrations
        SET status = @status,
            target = @target,
            lastEvent = @lastEvent
        WHERE id = @id AND orgId = @orgId
        `
      );
      safeDbRun(stmt, {
        id,
        orgId,
        status,
        target: target || null,
        lastEvent: lastEvent || null,
      });
    } else {
      const stmt = db.prepare(
        `
        INSERT INTO integrations (id, orgId, provider, status, target, lastEvent)
        VALUES (@id, @orgId, @provider, @status, @target, @lastEvent)
        `
      );
      safeDbRun(stmt, {
        id,
        orgId,
        provider,
        status,
        target: target || null,
        lastEvent: lastEvent || null,
      });
    }
    return {
      id,
      orgId,
      provider,
      status,
      target: target || null,
      lastEvent: lastEvent || null,
    };
  }

  const idx = ADMIN_SAMPLE_INTEGRATIONS.findIndex((x) => x.id === id);
  const row = {
    id,
    orgId,
    provider,
    status,
    target: target || null,
    lastEvent: lastEvent || null,
  };
  if (idx >= 0) ADMIN_SAMPLE_INTEGRATIONS[idx] = row;
  else ADMIN_SAMPLE_INTEGRATIONS.push(row);

  return row;
}

// POST /admin/orgs/:orgId/integrations/:provider/connect
app.post(
  '/admin/orgs/:orgId/integrations/:provider/connect',
  ensureAdminOrgAccess,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN),
  (req, res) => {
    const { orgId, provider: providerParam } = req.params;
    const provider = normalizeProviderFromParam(providerParam);

    if (!provider) {
      return res.status(400).json({ ok: false, error: 'Invalid provider' });
    }

    const target =
      (req.body &&
        (req.body.target || req.body.channel || req.body.destination)) ||
      null;

    const integration = upsertIntegration({
      orgId,
      provider,
      status: 'connected',
      target: target ? target.toString() : null,
      lastEvent: `Connected · ${humanTime(new Date().toISOString())}`,
    });

    const actorLabel = req.authUser?.email || 'Admin';
    const summary = `${actorLabel} connected ${provider}${
      integration.target ? ` (${integration.target})` : ''
    }`;

    writeAuditLog(req, {
      ...buildAuditEventBase(req, orgId),
      actionType: 'INTEGRATION_CONNECT',
      targetType: 'INTEGRATION',
      targetId: integration.id,
      summary,
      beforeJson: null,
      afterJson: integration,
    });

    return res.json({ ok: true, orgId, integration });
  }
);

// POST /admin/orgs/:orgId/integrations/:provider/disconnect
app.post(
  '/admin/orgs/:orgId/integrations/:provider/disconnect',
  ensureAdminOrgAccess,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN),
  (req, res) => {
    const { orgId, provider: providerParam } = req.params;
    const provider = normalizeProviderFromParam(providerParam);

    if (!provider) {
      return res.status(400).json({ ok: false, error: 'Invalid provider' });
    }

    const current =
      findOrgIntegrations(orgId).find((i) => i.provider === provider) || null;

    const integration = upsertIntegration({
      orgId,
      provider,
      status: 'disconnected',
      target: current?.target || null,
      lastEvent: `Disconnected · ${humanTime(new Date().toISOString())}`,
    });

    const actorLabel = req.authUser?.email || 'Admin';
    const summary = `${actorLabel} disconnected ${provider}`;

    writeAuditLog(req, {
      ...buildAuditEventBase(req, orgId),
      actionType: 'INTEGRATION_DISCONNECT',
      targetType: 'INTEGRATION',
      targetId: integration.id,
      summary,
      beforeJson: current,
      afterJson: integration,
    });

    return res.json({ ok: true, orgId, integration });
  }
);

// POST /admin/orgs/:orgId/integrations/:provider/test-event
app.post(
  '/admin/orgs/:orgId/integrations/:provider/test-event',
  ensureAdminOrgAccess,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.SEC_ANALYST),
  async (req, res) => {
    const { orgId, provider: providerParam } = req.params;
    const provider = normalizeProviderFromParam(providerParam);

    if (!provider) {
      return res.status(400).json({ ok: false, error: 'Invalid provider' });
    }

    const current =
      findOrgIntegrations(orgId).find((i) => i.provider === provider) || null;

    const nowIso = new Date().toISOString();
    const actorEmail = req.authUser?.email || 'unknown@clickshield.local';

    const updated = upsertIntegration({
      orgId,
      provider,
      status: current?.status || 'connected',
      target: current?.target || null,
      lastEvent: `Test event sent by ${actorEmail} · ${humanTime(nowIso)}`,
    });

    try {
      const cfg = findOrgAlertsExports(orgId);
      const channels = normalizeAlertChannels(cfg?.alertChannels || []);
      const webhookTargets = channels.filter(
        (ch) =>
          (ch.type === 'slack' || ch.type === 'teams') &&
          ch.webhookUrl &&
          typeof ch.webhookUrl === 'string'
      );

      if (webhookTargets.length > 0) {
        const payload = {
          text: `[ClickShield] Test event (${provider}) sent by ${actorEmail} · ${humanTime(nowIso)}`,
        };
        await Promise.all(
          webhookTargets.map((ch) => safePostJson(ch.webhookUrl, payload, 2000))
        );
      }
    } catch (err) {
      console.warn(
        '[ClickShield][Admin][TestEvent] Webhook test send failed:',
        err.message || err
      );
    }

    const summary = `${actorEmail} sent a ${provider} test event at ${humanTime(
      nowIso
    )}`;

    writeAuditLog(req, {
      ...buildAuditEventBase(req, orgId),
      actionType: 'INTEGRATION_TEST_EVENT',
      targetType: 'INTEGRATION',
      targetId: updated.id,
      summary,
      beforeJson: current,
      afterJson: updated,
    });

    return res.json({ ok: true, orgId, integration: updated });
  }
);

// GET /admin/orgs/:orgId/alerts-exports
app.get('/admin/orgs/:orgId/alerts-exports', ensureAdminOrgAccess, (req, res) => {
  const { orgId } = req.params;
  const cfg = findOrgAlertsExports(orgId);

  if (!cfg) {
    return res.json({
      orgId,
      alertChannels: [],
      exportTargets: [],
      siem: { enabled: false, provider: null, endpoint: null },
      schedule: { dailyDigest: false, weeklyReport: true },
    });
  }

  res.json(cfg);
});

// PATCH /admin/orgs/:orgId/alerts-exports
app.patch('/admin/orgs/:orgId/alerts-exports', ensureAdminOrgAccess, (req, res) => {
  const { orgId } = req.params;
  const body = req.body || {};

  const beforeCfg = findOrgAlertsExports(orgId);

  const alertChannels = Array.isArray(body.alertChannels) ? body.alertChannels : [];
  const exportTargets = Array.isArray(body.exportTargets) ? body.exportTargets : [];
  const siem = body.siem || {};
  const schedule = body.schedule || {};

  const normalizedCfg = {
    orgId,
    alertChannels,
    exportTargets,
    siem: {
      enabled: !!siem.enabled,
      provider: siem.provider || null,
      endpoint: siem.endpoint || null,
    },
    schedule: {
      dailyDigest: !!schedule.dailyDigest,
      weeklyReport: !!schedule.weeklyReport,
    },
  };

  if (dbAvailable && db) {
    const existing = safeDbGet(
      db.prepare('SELECT orgId FROM admin_configs WHERE orgId = @orgId LIMIT 1'),
      { orgId }
    );

    if (existing) {
      const updateStmt = db.prepare(
        `
          UPDATE admin_configs
          SET alertChannels = @alertChannels,
              exportTargets = @exportTargets,
              siemEnabled = @siemEnabled,
              siemProvider = @siemProvider,
              siemEndpoint = @siemEndpoint,
              scheduleDailyDigest = @scheduleDailyDigest,
              scheduleWeeklyReport = @scheduleWeeklyReport
          WHERE orgId = @orgId
          `
      );
      safeDbRun(updateStmt, {
        orgId,
        alertChannels: JSON.stringify(alertChannels),
        exportTargets: JSON.stringify(exportTargets),
        siemEnabled: normalizedCfg.siem.enabled ? 1 : 0,
        siemProvider: normalizedCfg.siem.provider,
        siemEndpoint: normalizedCfg.siem.endpoint,
        scheduleDailyDigest: normalizedCfg.schedule.dailyDigest ? 1 : 0,
        scheduleWeeklyReport: normalizedCfg.schedule.weeklyReport ? 1 : 0,
      });
    } else {
      const insertStmt = db.prepare(
        `
          INSERT INTO admin_configs (
            orgId, alertChannels, exportTargets,
            siemEnabled, siemProvider, siemEndpoint,
            scheduleDailyDigest, scheduleWeeklyReport
          ) VALUES (
            @orgId, @alertChannels, @exportTargets,
            @siemEnabled, @siemProvider, @siemEndpoint,
            @scheduleDailyDigest, @scheduleWeeklyReport
          )
          `
      );
      safeDbRun(insertStmt, {
        orgId,
        alertChannels: JSON.stringify(alertChannels),
        exportTargets: JSON.stringify(exportTargets),
        siemEnabled: normalizedCfg.siem.enabled ? 1 : 0,
        siemProvider: normalizedCfg.siem.provider,
        siemEndpoint: normalizedCfg.siem.endpoint,
        scheduleDailyDigest: normalizedCfg.schedule.dailyDigest ? 1 : 0,
        scheduleWeeklyReport: normalizedCfg.schedule.weeklyReport ? 1 : 0,
      });
    }
  } else {
    const idx = ADMIN_SAMPLE_ALERTS_EXPORTS.findIndex((c) => c.orgId === orgId);
    if (idx >= 0) ADMIN_SAMPLE_ALERTS_EXPORTS[idx] = normalizedCfg;
    else ADMIN_SAMPLE_ALERTS_EXPORTS.push(normalizedCfg);
  }

  try {
    const actorEmail = req.authUser?.email || 'unknown@clickshield.local';
    const siemBefore = !!beforeCfg?.siem?.enabled;
    const siemAfter = !!normalizedCfg.siem.enabled;

    let summary = `${actorEmail} updated alerts/exports settings`;
    if (siemBefore !== siemAfter) {
      summary = `${actorEmail} ${siemAfter ? 'enabled' : 'disabled'} SIEM streaming`;
    }

    writeAuditLog(req, {
      ...buildAuditEventBase(req, orgId),
      actionType: 'ALERTS_EXPORTS_UPDATE',
      targetType: 'ORG_CONFIG',
      targetId: orgId,
      summary,
      beforeJson: beforeCfg,
      afterJson: normalizedCfg,
    });
  } catch {
    // swallow
  }

  return res.json(normalizedCfg);
});

// GET /admin/orgs/:orgId/users
app.get('/admin/orgs/:orgId/users', ensureAdminOrgAccess, (req, res) => {
  const { orgId } = req.params;
  const users = findOrgUsers(orgId);

  return res.json({
    orgId,
    users,
  });
});

// PATCH /admin/orgs/:orgId/users/:userId/role
app.patch(
  '/admin/orgs/:orgId/users/:userId/role',
  ensureAdminOrgAccess,
  requireRole(ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN),
  (req, res) => {
    const { orgId, userId } = req.params;
    const { role } = req.body || {};

    if (!role || typeof role !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'role is required as a string',
      });
    }

    const normalizedRole = role.toString().toUpperCase();
    const allowedTargetRoles = [ROLES.ORG_ADMIN, ROLES.SEC_ANALYST, ROLES.USER];

    if (!allowedTargetRoles.includes(normalizedRole)) {
      return res.status(400).json({
        ok: false,
        error:
          'Invalid role. Only ORG_ADMIN, SEC_ANALYST, or USER can be set from this endpoint.',
      });
    }

    const users = findOrgUsers(orgId);
    const user = users.find((u) => u.id === userId);

    if (!user) {
      return res.status(404).json({
        ok: false,
        error: `User ${userId} not found for org ${orgId}.`,
      });
    }

    if (user.role === ROLES.SUPER_ADMIN) {
      return res.status(403).json({
        ok: false,
        error: 'Cannot modify SUPER_ADMIN role from this endpoint.',
      });
    }

    const before = { ...user };
    const beforeRole = user.role;

    user.role = normalizedRole;

    if (dbAvailable && db) {
      const updateStmt = db.prepare(
        'UPDATE users SET role = @role WHERE id = @userId AND orgId = @orgId'
      );
      safeDbRun(updateStmt, { role: normalizedRole, userId, orgId });
    }

    try {
      const actorEmail = req.authUser?.email || 'unknown@clickshield.local';
      const summary = `${actorEmail} changed ${user.email}'s role from ${beforeRole} → ${normalizedRole}`;

      writeAuditLog(req, {
        ...buildAuditEventBase(req, orgId),
        actionType: 'USER_ROLE_CHANGE',
        targetType: 'USER',
        targetId: userId,
        summary,
        beforeJson: before,
        afterJson: { ...user },
      });
    } catch {
      // swallow
    }

    return res.json({
      ok: true,
      orgId,
      user,
    });
  }
);

// =====================================================
// ============ DASHBOARD DATA ENDPOINTS ===============
// =====================================================

app.get('/metrics', requireAuth, (req, res) => {
  const list = getOrgScopedScans(req);

  const totalScans = list.length;
  let dangerousCount = 0;
  let suspiciousCount = 0;
  let safeCount = 0;
  let lastScanAt = null;

  for (const s of list) {
    const risk = (s.riskLevel || '').toString().toUpperCase();
    if (risk === 'DANGEROUS') dangerousCount++;
    else if (risk === 'SUSPICIOUS') suspiciousCount++;
    else if (risk === 'SAFE') safeCount++;

    if (!lastScanAt || (s.checkedAt || '') > lastScanAt) {
      lastScanAt = s.checkedAt || null;
    }
  }

  res.json({
    totalScans,
    dangerousCount,
    suspiciousCount,
    safeCount,
    lastScanAt,
  });
});

app.get('/weekly-report', requireAuth, (req, res) => {
  const now = new Date();
  const weekEnd = now.toISOString();
  const weekStartDate = new Date(now);
  weekStartDate.setDate(now.getDate() - 7);
  const weekStart = weekStartDate.toISOString();

  const baseList = getOrgScopedScans(req);

  const inRange = baseList.filter((s) => {
    if (!s.checkedAt) return false;
    return s.checkedAt >= weekStart && s.checkedAt <= weekEnd;
  });

  const totalScans = inRange.length;
  let dangerousCount = 0;
  let suspiciousCount = 0;
  let safeCount = 0;
  const typeCounts = {};

  for (const s of inRange) {
    const risk = (s.riskLevel || '').toString().toUpperCase();
    if (risk === 'DANGEROUS') dangerousCount++;
    else if (risk === 'SUSPICIOUS') suspiciousCount++;
    else if (risk === 'SAFE') safeCount++;

    const t = (s.threatType || 'UNKNOWN').toString();
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }

  const topThreatTypes = Object.entries(typeCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  res.json({
    weekStart,
    weekEnd,
    totalScans,
    dangerousCount,
    suspiciousCount,
    safeCount,
    topThreatTypes,
  });
});

app.get('/dashboard-ai-digest', requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const weekEnd = now.toISOString();
    const weekStartDate = new Date(now);
    weekStartDate.setDate(now.getDate() - 7);
    const weekStart = weekStartDate.toISOString();

    const baseList = getOrgScopedScans(req);

    const inRange = baseList.filter((s) => {
      if (!s.checkedAt) return false;
      return s.checkedAt >= weekStart && s.checkedAt <= weekEnd;
    });

    const totalScans = inRange.length;
    let dangerousCount = 0;
    let suspiciousCount = 0;
    let safeCount = 0;
    const typeCounts = {};

    for (const s of inRange) {
      const risk = (s.riskLevel || '').toString().toUpperCase();
      if (risk === 'DANGEROUS') dangerousCount++;
      else if (risk === 'SUSPICIOUS') suspiciousCount++;
      else if (risk === 'SAFE') safeCount++;

      const t = (s.threatType || 'UNKNOWN').toString();
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }

    const topThreatTypes = Object.entries(typeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    if (!openai) {
      const plainDigest =
        totalScans === 0
          ? 'No scans were recorded for this period. ClickShield will summarize threats once activity begins.'
          : `In the last 7 days, ClickShield processed ${totalScans} links: ${dangerousCount} dangerous, ${suspiciousCount} suspicious, and ${safeCount} safe. Top threat types were ${
              topThreatTypes.map((t) => `${t.type} (${t.count})`).join(', ') ||
              'not yet observed'
            }.`;

      return res.json({
        weekStart,
        weekEnd,
        totalScans,
        dangerousCount,
        suspiciousCount,
        safeCount,
        topThreatTypes,
        aiDigest: { digest: plainDigest, model: 'RULE_ONLY' },
      });
    }

    const summaryForModel = {
      weekStart,
      weekEnd,
      totalScans,
      dangerousCount,
      suspiciousCount,
      safeCount,
      topThreatTypes,
      sampleScans: inRange.slice(0, 20).map((s) => ({
        url: s.url,
        riskLevel: s.riskLevel,
        riskScore: s.riskScore,
        threatType: s.threatType,
        source: s.source,
        userType: s.userType,
        checkedAt: s.checkedAt,
      })),
    };

    const prompt = `
You are the AI analyst for ClickShield, a Web3 and consumer security platform.

Write a short, executive-friendly summary (2–4 sentences) of what happened this week.
Do NOT use bullet points, lists, markdown, or headings.
Return only the paragraph of text.
`;

    let digestText = null;
    let modelUsed = 'gpt-4.1-mini';

    try {
      const response = await openai.responses.create({
        model: 'gpt-4.1-mini',
        input: [
          { role: 'system', content: prompt },
          { role: 'user', content: JSON.stringify(summaryForModel) },
        ],
      });

      const output = response.output?.[0]?.content?.[0];
      const text = output && output.text ? output.text.trim() : null;
      if (text) {
        digestText = text;
        modelUsed = response.model || 'gpt-4.1-mini';
      }
    } catch (err) {
      logJson('error', 'ai_error', {
        message: 'Failed to generate dashboard digest',
        error: err.message || String(err),
      });
    }

    if (!digestText) {
      digestText =
        totalScans === 0
          ? 'No scans were recorded for this period. ClickShield will summarize threats once activity begins.'
          : `In the last 7 days, ClickShield processed ${totalScans} links: ${dangerousCount} dangerous, ${suspiciousCount} suspicious, and ${safeCount} safe. Top threat types were ${
              topThreatTypes.map((t) => `${t.type} (${t.count})`).join(', ') ||
              'not yet observed'
            }.`;
      modelUsed = 'RULE_ONLY_FALLBACK';
    }

    res.json({
      weekStart,
      weekEnd,
      totalScans,
      dangerousCount,
      suspiciousCount,
      safeCount,
      topThreatTypes,
      aiDigest: { digest: digestText, model: modelUsed },
    });
  } catch (err) {
    logJson('error', 'ai_error', {
      message: 'Error in /dashboard-ai-digest',
      error: err.message || String(err),
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =====================================================
// =========== RECENT SCANS (PAGINATION + SEARCH) ======
// =====================================================

app.get('/recent-scans', requireAuth, (req, res) => {

    // Force tenant isolation: dashboard reads default to the authenticated org
    let orgId = (req.query.orgId || '').toString() || null;

    if (req.authUser?.orgId && req.authUser.role !== ROLES.SUPER_ADMIN) {
      orgId = req.authUser.orgId;
    }
  


  const limit = Math.min(
    Math.max(parseInt(req.query.limit || '50', 10) || 50, 1),
    200
  );
  const offset = Math.max(parseInt(req.query.offset || '0', 10) || 0, 0);
  const search = (req.query.search || '').toString().trim();
  const risk = (req.query.risk || '').toString().trim().toUpperCase();
  const source = (req.query.source || '').toString().trim().toLowerCase();

  if (dbAvailable && db) {
    let whereParts = [];
    const params = { limit, offset };

    if (orgId) {
      whereParts.push('orgId = @orgId');
      params.orgId = orgId;
    }

    if (search) {
      whereParts.push(
        '(url LIKE @search OR userEmail LIKE @search OR threatType LIKE @search)'
      );
      params.search = `%${search}%`;
    }

    if (risk) {
      whereParts.push('upper(riskLevel) = @risk');
      params.risk = risk;
    }

    if (source) {
      whereParts.push('lower(source) = @source');
      params.source = source;
    }

    const whereClause = whereParts.length
      ? 'WHERE ' + whereParts.join(' AND ')
      : '';

    const totalRow = safeDbGet(
      db.prepare(`SELECT COUNT(*) as total FROM scans ${whereClause}`),
      params
    );
    const total = totalRow?.total || 0;

    const rows = safeDbAll(
      db.prepare(
        `
        SELECT
          id, orgId, orgName, userId, userEmail, userType,
          url, riskLevel, riskScore, threatType, detectedBy,
          detectedByType, ruleName,
          deviceId, source, engine, checkedAt,
          ruleReason, shortAdvice, aiNarrative, aiModel,
          escalated, lastEscalatedAt, escalationTargets,
          createdAt
        FROM scans
        ${whereClause}
        ORDER BY COALESCE(checkedAt, createdAt) DESC
        LIMIT @limit OFFSET @offset
        `
      ),
      params
    );

    const items = (rows || []).map((r) => ({
      id: r.id,
      orgId: r.orgId,
      orgName: r.orgName,
      userId: r.userId,
      userEmail: r.userEmail,
      userType: r.userType,
      url: r.url,
      riskLevel: r.riskLevel,
      riskScore: r.riskScore,
      threatType: r.threatType,
      detectedBy: r.detectedBy,
      detectedByType: r.detectedByType,
      ruleName: r.ruleName,
      deviceId: r.deviceId,
      source: r.source,
      engine: r.engine,
      checkedAt: r.checkedAt,
      ruleReason: r.ruleReason,
      shortAdvice: r.shortAdvice,
      aiNarrative: r.aiNarrative,
      aiModel: r.aiModel,
      escalated: !!r.escalated,
      lastEscalatedAt: r.lastEscalatedAt,
      escalationTargets: r.escalationTargets
        ? (() => {
            try {
              const parsed = JSON.parse(r.escalationTargets);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          })()
        : [],
      createdAt: r.createdAt || null,
    }));

    // store last-known-good for calm dashboard recovery
    if (orgId) setRecentScansLkg(orgId, items);

    return res.json({ items, total, limit, offset });
  }

  // DB down -> use LKG cache for org, else memory list
  if (orgId) {
    const lkg = getRecentScansLkg(orgId);
    if (lkg) {
      return res.json({
        items: lkg.slice(offset, offset + limit),
        total: lkg.length,
        limit,
        offset,
        fallback: true,
        source: 'lkg_cache',
      });
    }
  }

  const baseList = orgId
    ? recentScans.filter((s) => (s.orgId || null) === orgId)
    : recentScans.slice();

  let filtered = baseList;

  if (search) {
    const term = search.toLowerCase();
    filtered = filtered.filter((s) => {
      const u = (s.url || '').toString().toLowerCase();
      const ue = (s.userEmail || '').toString().toLowerCase();
      const tt = (s.threatType || '').toString().toLowerCase();
      return u.includes(term) || ue.includes(term) || tt.includes(term);
    });
  }

  if (risk) {
    filtered = filtered.filter(
      (s) => (s.riskLevel || '').toString().toUpperCase() === risk
    );
  }

  if (source) {
    filtered = filtered.filter(
      (s) => (s.source || '').toString().toLowerCase() === source
    );
  }

  filtered.sort((a, b) =>
    (b.checkedAt || b.createdAt || '').localeCompare(a.checkedAt || a.createdAt || '')
  );

  const total = filtered.length;
  const sliced = filtered.slice(offset, offset + limit);

  return res.json({
    items: sliced,
    total,
    limit,
    offset,
    fallback: true,
    source: 'memory',
  });
});

// === CLICKSHIELD:SECTION:EXPORTS ===

// =====================================================
// ================ EXPORT ENDPOINTS ===================
// =====================================================

function getOrgScansForExport(orgId) {
  if (dbAvailable && db) {
    const params = {};
    let where = '';
    if (orgId) {
      where = 'WHERE orgId = @orgId';
      params.orgId = orgId;
    }

    const rows = safeDbAll(
      db.prepare(
        `
        SELECT
          id, orgId, orgName, userId, userEmail, userType,
          url, riskLevel, riskScore, threatType, detectedBy,
          detectedByType, ruleName,
          deviceId, source, engine, checkedAt, ruleReason,
          shortAdvice, aiNarrative, aiModel, createdAt
        FROM scans
        ${where}
        ORDER BY COALESCE(checkedAt, createdAt) DESC
        `
      ),
      params
    );

    return rows || [];
  }

  if (!orgId) return recentScans.slice();
  return recentScans.filter((s) => (s.orgId || null) === orgId);
}

app.get('/export/recent-scans.json', (req, res) => {
  const orgId = (req.query.orgId || '').toString() || null;
  const scans = getOrgScansForExport(orgId);

  const payload = {
    orgId: orgId || null,
    exportedAt: new Date().toISOString(),
    totalScans: scans.length,
    scans,
  };

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json(payload);
});

app.get('/export/recent-scans.csv', (req, res) => {
  const orgId = (req.query.orgId || '').toString() || null;
  const scans = getOrgScansForExport(orgId);

  const header = [
    'id',
    'orgId',
    'orgName',
    'userId',
    'userEmail',
    'userType',
    'url',
    'riskLevel',
    'riskScore',
    'threatType',
    'detectedBy',
    'detectedByType',
    'ruleName',
    'deviceId',
    'source',
    'engine',
    'checkedAt',
    'ruleReason',
    'shortAdvice',
    'aiNarrative',
    'aiModel',
    'escalated',
    'lastEscalatedAt',
    'escalationTargets',
    'createdAt',
  ];

  function csvEscape(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  const lines = [];
  lines.push(header.join(','));

  for (const s of scans) {
    const row = [
      s.id,
      s.orgId,
      s.orgName,
      s.userId,
      s.userEmail,
      s.userType,
      s.url,
      s.riskLevel,
      s.riskScore,
      s.threatType,
      s.detectedBy,
      s.detectedByType,
      s.ruleName,
      s.deviceId,
      s.source,
      s.engine,
      s.checkedAt,
      s.ruleReason,
      s.shortAdvice,
      s.aiNarrative,
      s.aiModel,
      s.escalated ? 1 : 0,
      s.lastEscalatedAt || '',
      s.escalationTargets ? JSON.stringify(s.escalationTargets) : '',
      s.createdAt,
    ].map(csvEscape);

    lines.push(row.join(','));
  }

  const csv = lines.join('\n');
  const filename = orgId
    ? `clickshield-recent-scans-${orgId}.csv`
    : 'clickshield-recent-scans.csv';

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

// =====================================================
// ================== SERVER START =====================
// =====================================================

if (require.main === module) {
  app.listen(PORT, () => {
    logJson('info', 'startup', {
      port: PORT,
      dbAvailable,
    });

    console.log(
      `[ClickShield] Backend running on http://localhost:${PORT} (DB: ${
        dbAvailable ? 'enabled' : 'disabled'
      })`
    );
  });
}

module.exports = {
  app,
  readNavigationFeedTruth: readNavigationFeedTruthFromModule,
};
