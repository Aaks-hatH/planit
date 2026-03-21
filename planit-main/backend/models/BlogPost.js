'use strict';

const mongoose = require('mongoose');

// ─── Schema ───────────────────────────────────────────────────────────────────
//
// Blog posts are created/edited/deleted exclusively through the admin panel
// (verifyAdmin middleware). Public reads hit /api/blog endpoints with no auth.
//
// slugs must be unique — the frontend routes on /blog/:slug.
// If a slug is not supplied on create, the route handler derives one from the
// title before calling save().
//
const blogPostSchema = new mongoose.Schema(
  {
    slug: {
      type:     String,
      required: true,
      unique:   true,
      trim:     true,
      // Enforce URL-safe slugs — only lowercase letters, digits, hyphens
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be URL-safe (lowercase letters, digits, hyphens)'],
      maxlength: 200,
    },

    title: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 300,
    },

    excerpt: {
      type:      String,
      default:   '',
      trim:      true,
      maxlength: 600,
    },

    content: {
      type:    String,
      default: '',
      // No maxlength — long-form posts can be arbitrarily large.
      // The API layer enforces a 2 MB request body limit which is sufficient.
    },

    category: {
      type:    String,
      default: 'Event Planning',
      trim:    true,
      maxlength: 100,
    },

    tags: {
      type:    [String],
      default: [],
    },

    author: {
      type:    String,
      default: 'PlanIt Team',
      trim:    true,
      maxlength: 100,
    },

    // ISO date string displayed on the post (e.g. "2026-03-10").
    // Stored separately from createdAt so the editor can back-date posts.
    publishDate: {
      type:    String,
      default: () => new Date().toISOString().slice(0, 10),
      trim:    true,
    },

    readTime: {
      type:    Number,
      default: 5,
      min:     1,
      max:     120,
    },

    featured: {
      type:    Boolean,
      default: false,
    },

    // Accent hex color for the post card / hero (#rrggbb)
    heroColor: {
      type:    String,
      default: '#6366f1',
      trim:    true,
      match:   [/^#[0-9a-fA-F]{6}$/, 'heroColor must be a 6-digit hex color (#rrggbb)'],
    },

    // Soft-delete flag — deleted posts are filtered out of public queries
    // but remain in the DB for potential recovery.
    deleted: {
      type:    Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // adds createdAt + updatedAt
    collection:  'blog_posts',
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
blogPostSchema.index({ slug:     1 });           // unique, used for /blog/:slug
blogPostSchema.index({ deleted:  1, featured: -1, publishDate: -1 }); // list queries
blogPostSchema.index({ category: 1, deleted: 1 });

// ─── Helper: derive a URL-safe slug from a title ──────────────────────────────
blogPostSchema.statics.slugFromTitle = function (title) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9\s-]/g, '')   // keep only alphanum, spaces, hyphens
    .trim()
    .replace(/\s+/g, '-')            // spaces → hyphens
    .replace(/-+/g, '-')             // collapse runs of hyphens
    .slice(0, 200);
};

module.exports = mongoose.model('BlogPost', blogPostSchema);
