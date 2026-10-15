'use strict';

/*
 * services/githubService.js
 *
 * Talks to the GitHub REST API for Admin -> Team -> GitHub.
 *   - the connection (repo + token) lives in GithubConfig; the token is AES-256-GCM encrypted at rest
 *   - GITHUB_TOKEN / GITHUB_REPO env vars work as a fallback when nothing is saved in the admin page
 *   - listPulls() is the live feed: one shared 15s cache + ETag revalidation (a 304 costs no rate limit),
 *     so any number of open admin tabs polling still means roughly 4 GitHub requests a minute.
 *
 * The host is fixed to api.github.com and the repo is validated, so the browser can never steer a request elsewhere.
 */

const crypto = require('crypto');
const axios  = require('axios');
const GithubConfig = require('../models/GithubConfig');
const { secrets }  = require('../keys');

const API = 'https://api.github.com';
const REPO_RE = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const USER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const TTL_MS  = 15 * 1000;

// ── token encryption (same scheme as the TOTP secrets) ───────────────────────
const key = () => crypto.createHash('sha256').update(String(secrets.db)).digest();
function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const c  = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return `v2:${iv.toString('hex')}:${c.getAuthTag().toString('hex')}:${enc.toString('hex')}`;
}
function decrypt(stored) {
  const [v, iv, tag, enc] = String(stored || '').split(':');
  if (v !== 'v2') throw new Error('Unreadable token');
  const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'hex'));
  d.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([d.update(Buffer.from(enc, 'hex')), d.final()]).toString('utf8');
}

// ── errors the UI can show as-is ─────────────────────────────────────────────
function explain(err) {
  const s = err?.response?.status;
  const h = err?.response?.headers || {};
  const e = new Error('GitHub could not be reached. Try again in a moment.');
  e.status = 502;
  if (s === 401) { e.message = 'GitHub rejected the token. It may be wrong, expired or revoked.'; e.status = 400; }
  else if (s === 403 && h['x-ratelimit-remaining'] === '0') {
    const mins = Math.max(1, Math.ceil((Number(h['x-ratelimit-reset']) * 1000 - Date.now()) / 60000));
    e.message = `GitHub rate limit reached. It resets in about ${mins} min.`; e.status = 429;
  }
  else if (s === 403) { e.message = 'The token is not allowed to read this repository.'; e.status = 400; }
  else if (s === 404) { e.message = 'Repository not found, or the token has no access to it. Check the name and the token\'s repository access.'; e.status = 400; }
  else if (err?.code === 'ECONNABORTED') e.message = 'GitHub took too long to answer.';
  return e;
}

const gh = (token) => axios.create({
  baseURL: API, timeout: 10000,
  headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'PlanIt-Admin' },
  validateStatus: (s) => (s >= 200 && s < 300) || s === 304,
});

// ── connection ───────────────────────────────────────────────────────────────
async function getConnection() {
  const doc = await GithubConfig.findOne({ key: 'main' }).select('+tokenEnc').lean();
  if (doc?.repo && doc?.tokenEnc) {
    try { return { repo: doc.repo, token: decrypt(doc.tokenEnc), source: 'admin', doc }; }
    catch { /* fall through to env */ }
  }
  if (process.env.GITHUB_TOKEN && REPO_RE.test(process.env.GITHUB_REPO || '')) {
    return { repo: process.env.GITHUB_REPO, token: process.env.GITHUB_TOKEN, source: 'env', doc };
  }
  return null;
}

async function status() {
  const c = await getConnection();
  if (!c) return { connected: false };
  const d = c.doc || {};
  return {
    connected: true, source: c.source, repo: c.repo,
    tokenHint: c.source === 'admin' ? d.tokenHint : undefined,
    tokenOwner: d.tokenOwner, connectedBy: d.connectedBy, connectedAt: d.connectedAt,
    lastOkAt: d.lastOkAt, lastError: d.lastError || null,
  };
}

// Checks the token against the repo, then saves it. Throws a user-readable error otherwise.
async function connect({ repo, token, by }) {
  repo = String(repo || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/$/, '');
  token = String(token || '').trim();
  if (!REPO_RE.test(repo)) { const e = new Error('Repository must look like owner/name, for example acme/planit.'); e.status = 400; throw e; }
  if (token.length < 20 || /\s/.test(token)) { const e = new Error('That does not look like a GitHub token.'); e.status = 400; throw e; }
  let owner = '';
  try {
    const api = gh(token);
    const [me] = await Promise.all([api.get('/user'), api.get(`/repos/${repo}`), api.get(`/repos/${repo}/pulls`, { params: { per_page: 1 } })]);
    owner = me.data?.login || '';
  } catch (err) { throw explain(err); }
  await GithubConfig.findOneAndUpdate({ key: 'main' }, {
    $set: { repo, tokenEnc: encrypt(token), tokenHint: token.slice(-4), tokenOwner: owner, connectedBy: by || '', connectedAt: new Date(), lastOkAt: new Date(), lastError: '' },
  }, { upsert: true, setDefaultsOnInsert: true });
  cache.clear();
  return status();
}

async function disconnect() { await GithubConfig.deleteOne({ key: 'main' }); cache.clear(); }

// ── looking up a username (used when linking a person) ───────────────────────
async function lookupUser(username) {
  username = String(username || '').trim().replace(/^@/, '');
  if (!USER_RE.test(username)) { const e = new Error('That is not a valid GitHub username.'); e.status = 400; throw e; }
  const c = await getConnection();
  try {
    const r = await (c ? gh(c.token) : axios.create({ baseURL: API, timeout: 10000, headers: { 'User-Agent': 'PlanIt-Admin' }, validateStatus: (s) => s < 500 }))
      .get(`/users/${username}`);
    if (r.status === 404) { const e = new Error(`No GitHub user called "${username}".`); e.status = 404; throw e; }
    if (r.status >= 400) throw Object.assign(new Error('GitHub could not verify that username right now.'), { status: 502 });
    return { login: r.data.login, id: r.data.id, avatar: r.data.avatar_url };
  } catch (err) { throw err.status ? err : explain(err); }
}

// ── live PR feed ─────────────────────────────────────────────────────────────
const cache = new Map();   // repo -> { at, etag, prs }
const inflight = new Map();

const shape = (p, repo) => ({
  number: p.number, title: p.title, url: p.html_url, repo,
  state: p.merged_at ? 'merged' : p.state === 'closed' ? 'closed' : p.draft ? 'draft' : 'open',
  author: { login: p.user?.login || '', id: p.user?.id || null, avatar: p.user?.avatar_url || '' },
  branch: p.head?.ref || '', base: p.base?.ref || '',
  createdAt: p.created_at, updatedAt: p.updated_at, mergedAt: p.merged_at || null, closedAt: p.closed_at || null,
});

async function listPulls() {
  const c = await getConnection();
  if (!c) { const e = new Error('GitHub is not connected yet.'); e.status = 409; e.notConnected = true; throw e; }
  const hit = cache.get(c.repo);
  if (hit && Date.now() - hit.at < TTL_MS) return { repo: c.repo, prs: hit.prs, fetchedAt: hit.at };
  if (inflight.has(c.repo)) return inflight.get(c.repo);

  const run = (async () => {
    try {
      const r = await gh(c.token).get(`/repos/${c.repo}/pulls`, {
        params: { state: 'all', sort: 'updated', direction: 'desc', per_page: 100 },
        headers: hit?.etag ? { 'If-None-Match': hit.etag } : {},
      });
      const entry = r.status === 304 && hit
        ? { ...hit, at: Date.now() }
        : { at: Date.now(), etag: r.headers.etag, prs: (r.data || []).map((p) => shape(p, c.repo)) };
      cache.set(c.repo, entry);
      GithubConfig.updateOne({ key: 'main' }, { $set: { lastOkAt: new Date(), lastError: '' } }).catch(() => {});
      return { repo: c.repo, prs: entry.prs, fetchedAt: entry.at };
    } catch (err) {
      const e = explain(err);
      GithubConfig.updateOne({ key: 'main' }, { $set: { lastError: e.message } }).catch(() => {});
      if (hit) return { repo: c.repo, prs: hit.prs, fetchedAt: hit.at, stale: true, warning: e.message };   // keep showing the last good data
      throw e;
    } finally { inflight.delete(c.repo); }
  })();
  inflight.set(c.repo, run);
  return run;
}

module.exports = { REPO_RE, USER_RE, status, connect, disconnect, lookupUser, listPulls };
