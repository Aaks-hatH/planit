const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { verifyEventAccess: verifyEventToken } = require('../middleware/auth');
const File = require('../models/File');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Use memory storage - files held in memory until we write to a temp path
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

// Upload buffer to Cloudinary via a temporary file on disk.
//
// Previous attempts used upload_stream (stream flushing issues with SDK v1)
// and base64 data URIs (SDK v1 runs local format validation before sending,
// failing with "Invalid image file" even for valid files when resource_type
// is set explicitly).
//
// The only fully reliable method with Cloudinary SDK v1 is to write the buffer
// to a temp file and pass the file path to upload(). This bypasses all client-
// side validation and stream concerns — Cloudinary reads the file directly from
// disk and detects the format itself.
//
// resource_type: 'auto' lets Cloudinary's servers detect image/video/raw —
// removing our manual mimetype check which was the source of the "Invalid image
// file" rejection.
const uploadToCloudinary = async (buffer, filename) => {
  // Sanitize filename for use as a Cloudinary public_id.
  const safeName = (
    filename
      .replace(/\.[^/.]+$/, '')        // strip extension
      .replace(/\s+/g, '_')            // spaces → underscores
      .replace(/[^a-zA-Z0-9_-]/g, '')  // remove unsafe chars
  ) || 'upload';

  // Write the buffer to a uniquely named temp file
  const tmpPath = path.join(os.tmpdir(), `planit-${Date.now()}-${safeName}`);
  fs.writeFileSync(tmpPath, buffer);

  try {
    const result = await cloudinary.uploader.upload(tmpPath, {
      folder: 'planit-events',
      resource_type: 'auto', // Let Cloudinary detect type — avoids client-side validation errors
      public_id: `${Date.now()}-${safeName}`,
      secure: true,
    });
    return result;
  } finally {
    // Always clean up the temp file whether upload succeeded or failed
    try { fs.unlinkSync(tmpPath); } catch (_) {}
  }
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
    // Fail fast if Cloudinary is not configured
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.error('[PlanIt] Upload failed: Cloudinary environment variables are not set.');
      return res.status(503).json({
        error: 'Storage not configured',
        message: 'File storage is not available. Please contact the administrator.'
      });
    }

    // Track Cloudinary public_id for rollback if DB save fails
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

      if (!req.file.buffer || req.file.buffer.length === 0) {
        return res.status(400).json({ error: 'Empty file', message: 'The uploaded file is empty.' });
      }

      const cloudinaryResult = await uploadToCloudinary(
        req.file.buffer,
        req.file.originalname
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
      console.error('[PlanIt] File upload error:', error?.message || error);

      // Roll back Cloudinary upload if DB save failed
      if (uploadedPublicId) {
        try {
          await cloudinary.uploader.destroy(uploadedPublicId, {
            resource_type: uploadedResourceType || 'raw'
          });
        } catch (cleanupError) {
          console.error('[PlanIt] Failed to cleanup Cloudinary upload:', cleanupError);
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
