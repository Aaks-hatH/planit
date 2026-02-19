const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  eventId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Event', 
    required: true,
    index: true 
  },
  filename: { type: String, required: true, trim: true },
  originalName: { type: String, required: true, trim: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true }, // Size in bytes for display
  
  // Cloudinary storage - NO binary data stored in MongoDB
  cloudinaryUrl: { type: String, required: true }, // Full URL to file
  cloudinaryPublicId: { type: String, required: true }, // For deletion
  cloudinaryResourceType: { type: String, required: true }, // 'image', 'video', 'raw'
  
  uploadedBy: { type: String, required: true, trim: true },
  uploadedAt: { type: Date, default: Date.now, index: true },
  
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date },
  deletedBy: { type: String }
});

// Index for efficient queries
fileSchema.index({ eventId: 1, isDeleted: 1, uploadedAt: -1 });

// Cleanup method to delete from Cloudinary
fileSchema.methods.deleteFromCloudinary = async function() {
  const cloudinary = require('cloudinary').v2;
  try {
    await cloudinary.uploader.destroy(this.cloudinaryPublicId, {
      resource_type: this.cloudinaryResourceType
    });
    return true;
  } catch (error) {
    console.error('Failed to delete from Cloudinary:', error);
    return false;
  }
};

module.exports = mongoose.model('File', fileSchema);
