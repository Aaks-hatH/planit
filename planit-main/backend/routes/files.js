const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { verifyEventAccess: verifyEventToken } = require('../middleware/auth');
const File = require('../models/File');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Use memory storage - files go directly to Cloudinary, not disk
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'application/zip',
      'application/x-zip-compressed',
      'application/x-zip',
      'multipart/x-zip',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Only images, PDFs, and common documents are supported.'));
    }
  }
});

// Helper function to upload to Cloudinary from buffer
const uploadToCloudinary = (buffer, filename, mimetype) => {
  return new Promise((resolve, reject) => {
    let resourceType = 'raw';
    if (mimetype.startsWith('image/')) resourceType = 'image';
    else if (mimetype.startsWith('video/')) resourceType = 'video';

    // Sanitize filename: strip extension, spaces → underscores, remove unsafe chars.
    // Cloudinary rejects public_ids containing spaces, causing a 500 on any
    // upload whose filename has a space or special character.
    const safeName = filename
      .replace(/\.[^/.]+$/, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '');

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'planit-events',
        resource_type: resourceType,
        public_id: `${Date.now()}-${safeName}`,
        secure: true,
        // NOTE: fetch_format is a delivery/URL parameter, NOT an upload parameter.
        // Passing it here caused Cloudinary to reject every image upload with an
        // error. Removed — quality: 'auto' still applies compression on upload.
        ...(resourceType === 'image' && {
          transformation: [{ quality: 'auto' }]
        })
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );

    // FIX: Attach an 'error' event handler directly on the stream.
    //
    // When a network-level failure occurs (TCP refused, timeout, DNS failure)
    // the Cloudinary SDK emits an 'error' event on the stream object BEFORE the
    // callback above fires. In Node.js, an unhandled 'error' event on any
    // EventEmitter throws an uncaughtException — bypassing every try/catch.
    // Without this line, a single failed upload crashes the entire server process,
    // killing all active connections and triggering the process.exit(1) in server.js.
    //
    // Routing it through reject() means the error surfaces as a normal rejected
    // Promise, is caught by the try/catch in the route handler, and passed to
    // next(error) — returning a clean 500 to the client with no crash.
    uploadStream.on('error', reject);

    uploadStream.end(buffer);
  });
};

// Upload file
router.post('/:eventId/upload',
  verifyEventToken,
  (req, res, next) => {
    upload.single('files')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large', message: 'Maximum file size is 10MB.' });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ error: 'Unexpected field', message: 'File must be uploaded under the "files" field.' });
        }
        return res.status(400).json({ error: 'Upload error', message: err.message });
      }
      next();
    });
  },
  async (req, res, next) => {
    // Track what was uploaded to Cloudinary so we can roll it back if the DB
    // save subsequently fails. The original code checked error.cloudinaryPublicId
    // which is never set on an Error object — orphaned files were never cleaned up.
    let uploadedPublicId = null;
    let uploadedResourceType = null;

    try {
      const { eventId } = req.params;

      const event = req.event;
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const username = req.eventAccess?.username || req.eventAccess?.sub;
      if (!username) {
        return res.status(403).json({ error: 'Not authorized — could not identify user' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const cloudinaryResult = await uploadToCloudinary(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      uploadedPublicId = cloudinaryResult.public_id;
      uploadedResourceType = cloudinaryResult.resource_type;

      const file = new File({
        eventId,
        filename: req.file.originalname,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        cloudinaryUrl: cloudinaryResult.secure_url,
        cloudinaryPublicId: cloudinaryResult.public_id,
        cloudinaryResourceType: cloudinaryResult.resource_type,
        uploadedBy: username
      });

      await file.save();

      const io = req.app.get('io');
      if (io) {
        io.to(`event-${eventId}`).emit('file_uploaded', {
          file: {
            _id: file._id,
            filename: file.filename,
            size: file.size,
            mimetype: file.mimetype,
            url: file.cloudinaryUrl,
            uploadedBy: file.uploadedBy,
            uploadedAt: file.uploadedAt
          }
        });
      }

      res.json({
        message: 'File uploaded successfully',
        file: {
          _id: file._id,
          filename: file.filename,
          size: file.size,
          mimetype: file.mimetype,
          url: file.cloudinaryUrl,
          uploadedBy: file.uploadedBy,
          uploadedAt: file.uploadedAt
        }
      });
    } catch (error) {
      // Roll back the Cloudinary upload if the DB save failed
      if (uploadedPublicId) {
        try {
          await cloudinary.uploader.destroy(uploadedPublicId, {
            resource_type: uploadedResourceType || 'raw'
          });
        } catch (cleanupError) {
          console.error('Failed to cleanup Cloudinary upload:', cleanupError);
        }
      }
      next(error);
    }
  }
);

// Get all files for event
router.get('/:eventId', verifyEventToken, async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const files = await File.find({ eventId, isDeleted: false })
      .sort({ uploadedAt: -1 })
      .select('-cloudinaryPublicId')
      .lean();

    const safeFiles = files.map(f => ({
      _id: f._id,
      filename: f.filename,
      size: f.size,
      mimetype: f.mimetype,
      url: f.cloudinaryUrl,
      uploadedBy: f.uploadedBy,
      uploadedAt: f.uploadedAt
    }));

    res.json({ files: safeFiles });
  } catch (error) {
    next(error);
  }
});

// Download/Get file URL (returns Cloudinary URL)
router.get('/:eventId/download/:fileId', verifyEventToken, async (req, res, next) => {
  try {
    const { eventId, fileId } = req.params;

    const file = await File.findOne({ _id: fileId, eventId, isDeleted: false });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({
      url: file.cloudinaryUrl,
      filename: file.filename,
      mimetype: file.mimetype
    });
  } catch (error) {
    next(error);
  }
});

// Delete file
router.delete('/:eventId/:fileId', verifyEventToken, async (req, res, next) => {
  try {
    const { eventId, fileId } = req.params;

    const file = await File.findOne({ _id: fileId, eventId, isDeleted: false });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const event = req.event;
    const username = req.eventAccess?.username || req.eventAccess?.sub;
    const isOrganizer = event.participants.some(
      p => p.username === username && p.role === 'organizer'
    );
    const isUploader = file.uploadedBy === username;

    if (!isOrganizer && !isUploader && req.eventAccess?.isAdminAccess !== true) {
      return res.status(403).json({ error: 'Not authorized to delete this file' });
    }

    await file.deleteFromCloudinary();

    file.isDeleted = true;
    file.deletedAt = new Date();
    file.deletedBy = username;
    await file.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`event-${eventId}`).emit('file_deleted', { fileId });
    }

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
