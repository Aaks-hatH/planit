const mongoose = require('mongoose');

const uptimeReportSchema = new mongoose.Schema({
  description: { type: String, required: true },
  email: { type: String, default: '' },
  affectedService: { type: String, default: 'General' },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'dismissed'],
    default: 'pending'
  },
  incidentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UptimeReport', uptimeReportSchema);