const mongoose = require('mongoose');

// Single-document store for the GitHub connection made in Admin -> Team -> GitHub.
// The access token is stored encrypted (AES-256-GCM, see services/githubService.js) and is never sent to the browser.
const githubConfigSchema = new mongoose.Schema({
  key:         { type: String, default: 'main', unique: true },
  repo:        { type: String, trim: true },        // "owner/name"
  tokenEnc:    { type: String, select: false },
  tokenHint:   { type: String },                    // last 4 characters, for display only
  tokenOwner:  { type: String },                    // GitHub login the token belongs to
  connectedBy: { type: String },
  connectedAt: { type: Date },
  lastOkAt:    { type: Date },
  lastError:   { type: String },
}, { timestamps: true });

module.exports = mongoose.model('GithubConfig', githubConfigSchema);
