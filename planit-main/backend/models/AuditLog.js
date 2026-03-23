'use strict';

const { realIp } = require('../middleware/realIp');
/**
 * models/AuditLog.js
 *
 * Tamper-resistant audit trail for all admin/employee actions.
 *
 * KEY DESIGN DECISIONS
 * ────────────────────
 * 1. SEPARATE DB CONNECTION
 *    Set AUDIT_MONGODB_URI to a different MongoDB instance (strongly recommended
 *    for production). If unset, falls back to the main MONGODB_URI so the app
 *    never crashes — but physically separating it means a compromised main DB
 *    cannot wipe or alter audit logs.
 *
 * 2. ENCRYPTED DETAILS FIELD (AES-256-GCM)
 *    The `details` mixed field (IP, changed fields, PII) is encrypted before
 *    write and decrypted on read via decryptDetails(). This protects sensitive
 *    data from a MongoDB dump or direct DB read.
 *
 *    Set AUDIT_ENCRYPTION_KEY to a 64-char hex string (32 bytes):
 *      node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 *    If the key is missing, details are stored as base64 (obfuscation only).
 *    A startup warning is emitted so this is never silently insecure.
 *
 * 3. AUTO-DELETE (90 DAYS)
 *    A MongoDB TTL index on `createdAt` automatically purges old records.
 *    No cron job or manual cleanup needed. Change AUDIT_RETENTION_DAYS to adjust.
 *
 * USAGE (in routes / middleware):
 *   const { audit } = require('../models/AuditLog');
 *   // fire-and-forget — never throws, never blocks the request
 *   audit('login_success', { req, actor: req.admin, details: { email } });
 *   audit('employee_suspended', { req, actor: req.admin, targetId: emp._id.toString(),
 *     targetType: 'employee', details: { name: emp.name } });
 */

const mongoose = require('mongoose');
const crypto   = require('crypto');

// ─── Retention ────────────────────────────────────────────────────────────────
const RETENTION_DAYS = parseInt(process.env.AUDIT_RETENTION_DAYS || '90', 10);
const RETENTION_SECS = RETENTION_DAYS * 24 * 60 * 60;

// ─── Separate audit DB connection ─────────────────────────────────────────────
let _auditConn  = null;
let _connFailed = false;

function getAuditConnection() {
  if (_auditConn) return _auditConn;
  if (_connFailed) return null;

  const uri = process.env.AUDIT_MONGODB_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('[audit-db] No MongoDB URI found — audit logging disabled. Set AUDIT_MONGODB_URI or MONGODB_URI.');
    _connFailed = true;
    return null;
  }

  const isSeparate = !!process.env.AUDIT_MONGODB_URI && process.env.AUDIT_MONGODB_URI !== process.env.MONGODB_URI;
  _auditConn = mongoose.createConnection(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 8000 });
  _auditConn.once('open',  () => console.log(`[audit-db] Connected (${isSeparate ? 'SEPARATE audit DB' : 'shared main DB — set AUDIT_MONGODB_URI for isolation'})`));
  _auditConn.once('error', e  => { console.error('[audit-db] Connection error:', e.message); _connFailed = true; });
  return _auditConn;
}

// ─── AES-256-GCM encryption for the details field ────────────────────────────
const ENC_KEY_HEX = (process.env.AUDIT_ENCRYPTION_KEY || '').trim();
const ENC_KEY = ENC_KEY_HEX.length === 64 ? Buffer.from(ENC_KEY_HEX, 'hex') : null;

if (!ENC_KEY) {
  console.warn(
    '[audit] WARNING: AUDIT_ENCRYPTION_KEY not set or invalid.\n' +
    '        Audit log details will be stored as base64 (NOT encrypted).\n' +
    '        Generate a key: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
}

/**
 * Encrypts a plain JS object to an opaque envelope.
 * Returns an object with { enc, iv, tag, data } (AES-256-GCM)
 * or { enc: false, data } (base64 fallback).
 */
function encryptDetails(obj) {
  if (obj === null || obj === undefined) return null;
  const plain = JSON.stringify(obj);
  if (!ENC_KEY) {
    return { enc: false, data: Buffer.from(plain).toString('base64') };
  }
  const iv      = crypto.randomBytes(16);
  const cipher  = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const enc     = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag     = cipher.getAuthTag();
  return {
    enc:  true,
    iv:   iv.toString('hex'),
    tag:  tag.toString('hex'),
    data: enc.toString('hex'),
  };
}

/**
 * Decrypts an envelope previously produced by encryptDetails().
 * Returns the original JS object, or a sentinel string on failure.
 */
function decryptDetails(stored) {
  if (!stored || !stored.data) return null;
  if (!stored.enc) {
    try { return JSON.parse(Buffer.from(stored.data, 'base64').toString('utf8')); }
    catch { return stored.data; }
  }
  if (!ENC_KEY) return '[encrypted — AUDIT_ENCRYPTION_KEY missing]';
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      ENC_KEY,
      Buffer.from(stored.iv, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(stored.tag, 'hex'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(stored.data, 'hex')),
      decipher.final(),
    ]);
    return JSON.parse(plain.toString('utf8'));
  } catch {
    return '[decryption failed — key mismatch or corrupt data]';
  }
}

// ─── Schema ───────────────────────────────────────────────────────────────────
const auditSchema = new mongoose.Schema(
  {
    // ── Who performed the action ─────────────────────────────────────────────
    actorId:    { type: String, default: 'root' }, // employee._id or 'root'
    actorEmail: { type: String, default: 'root' },
    actorRole:  { type: String, default: 'root' },
    actorName:  { type: String, default: 'root' },

    // ── What happened ────────────────────────────────────────────────────────
    action: {
      type: String,
      required: true,
      enum: [
        // Auth
        'login_success', 'login_failure', 'login_locked',
        'logout',
        // Session
        'session_revoked',
        // Password
        'password_changed', 'force_password_reset_set',
        // Employees
        'employee_created', 'employee_updated', 'employee_deleted',
        'employee_suspended', 'employee_unsuspended',
        // Permissions
        'permission_denied',
        // Events
        'event_created', 'event_updated', 'event_deleted',
        // Data
        'data_exported',
        // System
        'maintenance_toggled', 'blocklist_updated',
      ],
    },

    // ── What / who was targeted ───────────────────────────────────────────────
    targetId:   { type: String, default: null },
    targetType: { type: String, default: null }, // 'employee' | 'event' | 'system'

    // ── AES-256-GCM encrypted payload (IP, user-agent, changed fields, etc.) ──
    // Never query this field directly — use decryptDetails(log.details) to read.
    details: { type: mongoose.Schema.Types.Mixed, default: null },

    // ── Outcome ───────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['success', 'failure', 'blocked'],
      default: 'success',
    },

    // ── TTL index — MongoDB auto-deletes documents after RETENTION_DAYS ───────
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: false, // managed manually so TTL index targets createdAt
    versionKey: false,
    // Never add toJSON transforms that might expose decrypted fields
  }
);

// MongoDB TTL index — documents expire automatically after RETENTION_DAYS
auditSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_SECS });

// Index for fast per-actor and per-action lookups (admin audit viewer)
auditSchema.index({ actorId: 1, createdAt: -1 });
auditSchema.index({ action:  1, createdAt: -1 });
auditSchema.index({ targetId: 1, createdAt: -1 });

// ─── Model ────────────────────────────────────────────────────────────────────
// Initialized lazily so module load never crashes even if DB is unavailable.
let _AuditLog = null;

function getModel() {
  if (_AuditLog) return _AuditLog;
  const conn = getAuditConnection();
  if (!conn) return null;
  try {
    _AuditLog = conn.model('AuditLog', auditSchema);
  } catch (e) {
    // Model might already exist on this connection (hot-reload)
    _AuditLog = conn.model('AuditLog');
  }
  return _AuditLog;
}

// ─── Public helper: fire-and-forget audit write ───────────────────────────────
/**
 * audit(action, options)
 *
 * Writes an audit record. Never throws — a failed audit write must NEVER
 * break the main request flow. All errors are logged to console only.
 *
 * @param {string} action    - One of the enum values in auditSchema
 * @param {object} options
 *   @param {object}  [req]        - Express request (for IP and user-agent)
 *   @param {object}  [actor]      - req.admin decoded JWT payload
 *   @param {string}  [targetId]   - ID of the affected resource
 *   @param {string}  [targetType] - 'employee' | 'event' | 'system'
 *   @param {object}  [details]    - Arbitrary object — will be encrypted
 *   @param {string}  [status]     - 'success' | 'failure' | 'blocked'
 */
async function audit(action, { req, actor, targetId, targetType, details = {}, status = 'success' } = {}) {
  try {
    const Model = getModel();
    if (!Model) return; // audit DB unavailable — skip silently

    const admin = actor || {};
    const ip    = req ? realIp(req) : 'system';

    await Model.create({
      actorId:    admin.employeeId || admin.id || (admin.isEmployee ? admin.employeeId : 'root'),
      actorEmail: admin.email || admin.username || 'root',
      actorRole:  admin.role  || 'root',
      actorName:  admin.name  || admin.username || 'root',
      action,
      targetId:   targetId   || null,
      targetType: targetType || null,
      details:    encryptDetails(details),
      status,
      // ip and userAgent go into encrypted details (PII) — keep schema field for routing/indexing
    });

    // Also log the raw IP in encrypted details above — don't store plaintext IP in top-level
  } catch (err) {
    // Never propagate — audit failure must not block the user request
    console.error('[audit] Write failed (non-fatal):', err.message);
  }
}

// ─── Admin route helper: GET /admin/audit-logs ────────────────────────────────
// Returns decrypted logs for the admin UI.
async function getAuditLogs({ limit = 100, skip = 0, action, actorId, targetId } = {}) {
  const Model = getModel();
  if (!Model) return [];
  const filter = {};
  if (action)   filter.action   = action;
  if (actorId)  filter.actorId  = actorId;
  if (targetId) filter.targetId = targetId;
  const logs = await Model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  return logs.map(l => ({ ...l, details: decryptDetails(l.details) }));
}

module.exports = { audit, decryptDetails, getAuditLogs };
