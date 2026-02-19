const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { verifyEventAccess: verifyEventToken } = require('../middleware/auth');
const File = require('../models/File');
const Event = require('../models/Event');

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
    // Allowed file types for security
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
    // Determine resource type
    let resourceType = 'raw'; // default for documents
    if (mimetype.startsWith('image/')) {
      resourceType = 'image';
    } else if (mimetype.startsWith('video/')) {
      resourceType = 'video';
    }

    // Create upload stream
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'planit-events', // Organize files in folder
        resource_type: resourceType,
        public_id: `${Date.now()}-${filename.replace(/\.[^/.]+$/, '')}`, // Remove extension, Cloudinary adds it
        secure: true,
        // Add transformation for images (optimize)
        ...(resourceType === 'image' && {
          transformation: [
            { quality: 'auto', fetch_format: 'auto' }
          ]
        })
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    // Pipe buffer to upload stream
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
    try {
      const { eventId } = req.params;

      // Verify event exists
      const event = await Event.findById(eventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Verify user is participant
      const isParticipant = event.participants.some(
        p => p.username === req.username
      );
      if (!isParticipant) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Upload to Cloudinary from buffer
      const cloudinaryResult = await uploadToCloudinary(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      // Create file record in MongoDB (only metadata + URL)
      const file = new File({
        eventId,
        filename: req.file.originalname,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        cloudinaryUrl: cloudinaryResult.secure_url,
        cloudinaryPublicId: cloudinaryResult.public_id,
        cloudinaryResourceType: cloudinaryResult.resource_type,
        uploadedBy: req.username
      });

      await file.save();

      // Emit socket event for real-time update
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
      // Clean up Cloudinary upload if database save fails
      if (req.file && error.cloudinaryPublicId) {
        try {
          await cloudinary.uploader.destroy(error.cloudinaryPublicId);
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

    const files = await File.find({
      eventId,
      isDeleted: false
    })
      .sort({ uploadedAt: -1 })
      .select('-cloudinaryPublicId') // Don't expose internal IDs
      .lean();

    // Map to safe response format
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

    const file = await File.findOne({
      _id: fileId,
      eventId,
      isDeleted: false
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Return the Cloudinary URL for download
    // The client can use this URL directly
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

    const file = await File.findOne({
      _id: fileId,
      eventId,
      isDeleted: false
    });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Verify user is the uploader or organizer
    const event = await Event.findById(eventId);
    const isOrganizer = event.participants.some(
      p => p.username === req.username && p.role === 'organizer'
    );
    const isUploader = file.uploadedBy === req.username;

    if (!isOrganizer && !isUploader) {
      return res.status(403).json({ error: 'Not authorized to delete this file' });
    }

    // Delete from Cloudinary
    await file.deleteFromCloudinary();

    // Soft delete in database
    file.isDeleted = true;
    file.deletedAt = new Date();
    file.deletedBy = req.username;
    await file.save();

    // Emit socket event
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
