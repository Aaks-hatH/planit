'use strict';

/**
 * /api/blog  —  Blog post CRUD
 *
 * PUBLIC (no auth):
 *   GET  /api/blog          — list published posts (paginated)
 *   GET  /api/blog/:slug    — single post by slug
 *
 * ADMIN-ONLY (verifyAdmin + canEditContent permission):
 *   GET    /api/blog/admin/all      — list ALL posts incl. deleted, for CMS
 *   POST   /api/blog                — create post
 *   PATCH  /api/blog/:id            — update post (by MongoDB _id)
 *   DELETE /api/blog/:id            — soft-delete post (by MongoDB _id)
 *   DELETE /api/blog/:id/hard       — permanent delete (super_admin only)
 *
 * Security notes:
 *  - Writes are gated by verifyAdmin (JWT signed with secrets.jwt) +
 *    requirePermission('canEditContent').
 *  - Input is validated and sanitised via express-validator on every write.
 *  - The slug uniqueness constraint is enforced at both the DB index level
 *    (unique: true) and in the route handler (check before insert / on conflict).
 *  - Content is stored as raw markdown text — the frontend renders it safely
 *    via a controlled Prose renderer that never uses dangerouslySetInnerHTML
 *    on untrusted content without sanitisation.
 */

const express   = require('express');
const router    = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { verifyAdmin, requirePermission }        = require('../middleware/auth');
const BlogPost  = require('../models/BlogPost');

// ─── Validation middleware ────────────────────────────────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// ─── Shared write-field validators ───────────────────────────────────────────
const writeValidators = [
  body('title')
    .optional()
    .trim()
    .notEmpty().withMessage('title cannot be blank')
    .isLength({ max: 300 }).withMessage('title max 300 chars'),

  body('slug')
    .optional()
    .trim()
    .toLowerCase()
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .withMessage('slug must be URL-safe (lowercase letters, digits, hyphens)'),

  body('excerpt')
    .optional()
    .trim()
    .isLength({ max: 600 }).withMessage('excerpt max 600 chars'),

  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('category max 100 chars'),

  body('author')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('author max 100 chars'),

  body('publishDate')
    .optional()
    .trim()
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('publishDate must be YYYY-MM-DD'),

  body('readTime')
    .optional()
    .isInt({ min: 1, max: 120 }).withMessage('readTime must be 1–120 minutes'),

  body('featured')
    .optional()
    .isBoolean().withMessage('featured must be boolean'),

  body('heroColor')
    .optional()
    .trim()
    .matches(/^#[0-9a-fA-F]{6}$/).withMessage('heroColor must be #rrggbb'),

  body('tags')
    .optional()
    .isArray().withMessage('tags must be an array'),

  body('tags.*')
    .optional()
    .trim()
    .isLength({ max: 60 }).withMessage('each tag max 60 chars'),
];

// ─── Helper: strip internal fields from public response ──────────────────────
function toPublic(post) {
  const obj = post.toObject ? post.toObject() : { ...post };
  delete obj.deleted;
  delete obj.__v;
  return obj;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/blog
 * Lists published (non-deleted) posts, most-recent first.
 *
 * Query params:
 *   page     (default 1)
 *   limit    (default 20, max 50)
 *   category (optional filter)
 *   q        (optional full-text search across title + excerpt + tags)
 *   featured (optional "true" to return only featured posts)
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
    query('featured').optional().isBoolean().toBoolean(),
    validate,
  ],
  async (req, res, next) => {
    try {
      const page     = req.query.page    || 1;
      const limit    = Math.min(req.query.limit || 20, 50);
      const skip     = (page - 1) * limit;
      const category = req.query.category;
      const featured = req.query.featured;
      const q        = (req.query.q || '').trim();

      const filter = { deleted: false };
      if (category) filter.category = category;
      if (featured === true) filter.featured = true;

      // Text search: case-insensitive regex across title, excerpt, tags
      // A full $text index would be faster at scale; regex is fine for a blog
      // with hundreds of posts and acceptable MongoDB query plans.
      if (q) {
        const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [
          { title:   re },
          { excerpt: re },
          { tags:    re },
        ];
      }

      const [posts, total] = await Promise.all([
        BlogPost
          .find(filter)
          .sort({ featured: -1, publishDate: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        BlogPost.countDocuments(filter),
      ]);

      res.json({
        posts: posts.map(p => { const { deleted, __v, ...rest } = p; return rest; }),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (err) { next(err); }
  }
);

/**
 * GET /api/blog/admin/all
 * CMS-only listing: returns ALL posts including soft-deleted ones.
 * Requires admin auth.
 */
router.get(
  '/admin/all',
  verifyAdmin,
  requirePermission('canEditContent'),
  async (req, res, next) => {
    try {
      const posts = await BlogPost
        .find({})
        .sort({ createdAt: -1 })
        .lean();
      res.json({ posts });
    } catch (err) { next(err); }
  }
);

/**
 * GET /api/blog/:slug
 * Returns a single published post by URL slug.
 * Slugs are matched case-insensitively for robustness.
 */
router.get(
  '/:slug',
  [
    param('slug').trim().notEmpty().withMessage('slug is required'),
    validate,
  ],
  async (req, res, next) => {
    try {
      const post = await BlogPost.findOne({
        slug:    req.params.slug.toLowerCase(),
        deleted: false,
      }).lean();

      if (!post) return res.status(404).json({ error: 'Post not found' });

      const { deleted, __v, ...rest } = post;
      res.json({ post: rest });
    } catch (err) { next(err); }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN WRITE ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/blog
 * Create a new blog post.
 * slug is auto-derived from title if not provided.
 * Returns 409 on slug collision so the frontend can prompt for a different slug.
 */
router.post(
  '/',
  verifyAdmin,
  requirePermission('canEditContent'),
  [
    body('title').trim().notEmpty().withMessage('title is required').isLength({ max: 300 }),
    ...writeValidators,
    validate,
  ],
  async (req, res, next) => {
    try {
      const {
        title, excerpt = '', content = '', category = 'Event Planning',
        tags = [], author = 'PlanIt Team', publishDate, readTime = 5,
        featured = false, heroColor = '#6366f1',
      } = req.body;

      // Derive slug from title if not provided; lower-case + sanitise
      let slug = (req.body.slug || BlogPost.slugFromTitle(title)).toLowerCase();

      // Check for existing slug (non-deleted or deleted — slugs must be globally unique)
      const existing = await BlogPost.findOne({ slug });
      if (existing) {
        // Append a timestamp suffix to auto-resolve the collision rather than failing
        slug = `${slug}-${Date.now()}`;
      }

      const post = await BlogPost.create({
        slug,
        title,
        excerpt,
        content,
        category,
        tags: Array.isArray(tags) ? tags.map(t => String(t).trim()).filter(Boolean) : [],
        author,
        publishDate: publishDate || new Date().toISOString().slice(0, 10),
        readTime: Number(readTime) || 5,
        featured: Boolean(featured),
        heroColor,
      });

      res.status(201).json({ post: toPublic(post) });
    } catch (err) { next(err); }
  }
);

/**
 * PATCH /api/blog/:id
 * Update any fields of a post. Only supplied fields are changed.
 * Returns 404 if post doesn't exist (including soft-deleted).
 */
router.patch(
  '/:id',
  verifyAdmin,
  requirePermission('canEditContent'),
  [
    param('id').isMongoId().withMessage('invalid post id'),
    ...writeValidators,
    validate,
  ],
  async (req, res, next) => {
    try {
      const post = await BlogPost.findById(req.params.id);
      if (!post || post.deleted) return res.status(404).json({ error: 'Post not found' });

      const allowed = [
        'title', 'slug', 'excerpt', 'content', 'category',
        'tags', 'author', 'publishDate', 'readTime', 'featured', 'heroColor',
      ];

      for (const field of allowed) {
        if (req.body[field] !== undefined) {
          if (field === 'slug') {
            const newSlug = String(req.body.slug).toLowerCase();
            // Only check uniqueness if slug actually changed
            if (newSlug !== post.slug) {
              const conflict = await BlogPost.findOne({ slug: newSlug, _id: { $ne: post._id } });
              if (conflict) return res.status(409).json({ error: 'Slug already in use by another post' });
              post.slug = newSlug;
            }
          } else if (field === 'tags') {
            post.tags = Array.isArray(req.body.tags)
              ? req.body.tags.map(t => String(t).trim()).filter(Boolean)
              : [];
          } else if (field === 'readTime') {
            post.readTime = Number(req.body.readTime) || 5;
          } else if (field === 'featured') {
            post.featured = Boolean(req.body.featured);
          } else {
            post[field] = req.body[field];
          }
        }
      }

      await post.save();
      res.json({ post: toPublic(post) });
    } catch (err) { next(err); }
  }
);

/**
 * DELETE /api/blog/:id
 * Soft-deletes a post (sets deleted: true). The post is hidden from all
 * public endpoints but remains in the database.
 */
router.delete(
  '/:id',
  verifyAdmin,
  requirePermission('canEditContent'),
  [
    param('id').isMongoId().withMessage('invalid post id'),
    validate,
  ],
  async (req, res, next) => {
    try {
      const post = await BlogPost.findById(req.params.id);
      if (!post || post.deleted) return res.status(404).json({ error: 'Post not found' });

      post.deleted = true;
      await post.save();

      res.json({ ok: true, message: 'Post deleted (soft)' });
    } catch (err) { next(err); }
  }
);

/**
 * DELETE /api/blog/:id/hard
 * Permanently removes a post from the database.
 * Restricted to super_admin only for safety.
 */
router.delete(
  '/:id/hard',
  verifyAdmin,
  requirePermission('canEditContent'),
  [
    param('id').isMongoId().withMessage('invalid post id'),
    validate,
  ],
  async (req, res, next) => {
    try {
      // Only super_admin may hard-delete
      if (req.admin?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Hard delete requires super_admin role' });
      }

      const result = await BlogPost.findByIdAndDelete(req.params.id);
      if (!result) return res.status(404).json({ error: 'Post not found' });

      res.json({ ok: true, message: 'Post permanently deleted' });
    } catch (err) { next(err); }
  }
);

module.exports = router;
