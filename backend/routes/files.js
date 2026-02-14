const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const File = require('../models/File');
const { verifyEventAccess } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');

const uploadDir = path.join(__dirname, '../uploads');
fs.mkdir(uploadDir, { recursive: true }).catch(console.error);

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const eventDir = path.join(uploadDir, req.params.eventId);
    await fs.mkdir(eventDir, { recursive: true });
    cb(null, eventDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/zip', 'application/x-zip-compressed'
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.FILE_UPLOAD_MAX_SIZE) || 10 * 1024 * 1024,
    files: 5
  }
});

// Upload files — frontend appends field name 'files'
router.post('/:eventId/upload',
  verifyEventAccess,
  uploadLimiter,
  upload.array('files', 5),
  async (req, res, next) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      // Get uploader from body, or fall back to JWT username
      const uploadedBy = req.body.uploadedBy || req.eventAccess?.username || 'unknown';

      const files = await Promise.all(
        req.files.map(async (file) => {
          const fileDoc = new File({
            eventId: req.params.eventId,
            uploadedBy,
            originalName: file.originalname,   // human-readable name
            filename: file.originalname,        // expose originalName as filename for frontend display
            path: file.path,
            mimetype: file.mimetype,
            size: file.size,
            url: `/uploads/${req.params.eventId}/${file.filename}`
          });
          await fileDoc.save();
          return {
            id: fileDoc._id,
            filename: file.originalname,        // always the original display name
            size: fileDoc.size,
            uploadedBy: fileDoc.uploadedBy,
            mimetype: fileDoc.mimetype,
            createdAt: fileDoc.createdAt
          };
        })
      );

      const io = req.app.get('io');
      if (io) io.to(`event_${req.params.eventId}`).emit('files_uploaded', { files });

      res.status(201).json({ message: 'Files uploaded successfully', files });
    } catch (error) {
      if (req.files) {
        await Promise.all(req.files.map(f => fs.unlink(f.path).catch(() => {})));
      }
      next(error);
    }
  }
);

// Get all files for an event
router.get('/:eventId', verifyEventAccess, async (req, res, next) => {
  try {
    const files = await File.find({ eventId: req.params.eventId, isDeleted: false })
      .sort({ createdAt: -1 })
      .lean();

    // Normalise: always return originalName as filename for the frontend
    const normalised = files.map(f => ({
      id: f._id,
      filename: f.originalName || f.filename,
      size: f.size,
      uploadedBy: f.uploadedBy,
      mimetype: f.mimetype,
      createdAt: f.createdAt
    }));

    res.json({ files: normalised });
  } catch (error) {
    next(error);
  }
});

// Download a file
router.get('/:eventId/download/:fileId', verifyEventAccess, async (req, res, next) => {
  try {
    const file = await File.findOne({ _id: req.params.fileId, eventId: req.params.eventId, isDeleted: false });
    if (!file) return res.status(404).json({ error: 'File not found' });

    await file.incrementDownloads();

    try { await fs.access(file.path); }
    catch { return res.status(404).json({ error: 'File not found on server' }); }

    res.download(file.path, file.originalName);
  } catch (error) {
    next(error);
  }
});

// Delete a file
router.delete('/:eventId/:fileId', verifyEventAccess, async (req, res, next) => {
  try {
    const file = await File.findOne({ _id: req.params.fileId, eventId: req.params.eventId });
    if (!file) return res.status(404).json({ error: 'File not found' });

    const username = req.body.username || req.eventAccess?.username;
    const event = req.event;
    const isOrganizer = event.participants.some(p => p.username === username && p.role === 'organizer');

    if (file.uploadedBy !== username && !isOrganizer) {
      return res.status(403).json({ error: 'You can only delete your own files' });
    }

    await file.softDelete();

    const io = req.app.get('io');
    if (io) io.to(`event_${req.params.eventId}`).emit('file_deleted', { fileId: file._id });

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
