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

// Upload buffer to Cloudinary using a base64 data URI.
//
// The previous implementation used upload_stream, piping the multer Buffer
// into a Cloudinary writable stream via uploadStream.end(buffer). With SDK v1
// this approach can deliver corrupt or incomplete data to Cloudinary, causing
// the "Invalid image file" error even for perfectly valid files — because the
// internal stream may not be fully flushed before Cloudinary processes the bytes.
//
// The correct approach when you already have the file in memory is to encode
// it as a base64 data URI and use the standard upload() method, which is
// fully Promise-based and has no stream flushing edge cases.
const uploadToCloudinary = (buffer, filename, mimetype) => {
  // Sanitize filename for use as a Cloudinary public_id.
  // Cloudinary rejects public_ids with spaces or special characters.
  // Fall back to 'upload' if the entire name sanitizes to empty.
  const safeName = (
    filename
      .replace(/\.[^/.]+$/, '')        // strip extension
      .replace(/\s+/g, '_')            // spaces → underscores
      .replace(/[^a-zA-Z0-9_-]/g, '')  // remove anything else unsafe
  ) || 'upload';

  // Determine Cloudinary resource type from mimetype
  let resourceType = 'raw'; // default for documents, zips, etc.
  if (mimetype.startsWith('image/')) resourceType = 'image';
  else if (mimetype.startsWith('video/')) resourceType = 'video';

  // Encode buffer as a base64 data URI — Cloudinary's upload() accepts this
  // directly and handles decoding on their end with no stream concerns.
  const dataURI = `data:${mimetype};base64,${buffer.toString('base64')}`;

  // cloudinary.uploader.upload() returns a Promise natively in SDK v1+
  return cloudinary.uploader.upload(dataURI, {
    folder: 'planit-events',
    resource_type: resourceType,
    public_id: `${Date.now()}-${safeName}`,
    secure: true,
    // No transformation block — quality/format optimisation belongs on the
    // delivery URL, not the upload call (upload-time transformation params
    // are different and were previously causing Cloudinary API errors).
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
    // Guard: fail fast with a clear message if Cloudinary is not configured,
    // rather than letting the SDK throw an opaque error.
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.error('[PlanIt] Upload failed: Cloudinary environment variables are not set.');
      return res.status(503).json({
        error: 'Storage not configured',
        message: 'File storage is not available. Please contact the administrator.'
      });
    }

    // Track the Cloudinary public_id so we can delete the orphaned file if
    // the subsequent MongoDB save fails.
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
      console.error('[PlanIt] File upload error:', error?.message || error);

      // Roll back the Cloudinary upload if the MongoDB save failed
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
