const mongoose = require('mongoose');

// A task one person assigns to another from Admin -> Team -> Tasks.
const employeeTaskSchema = new mongoose.Schema({
  title:        { type: String, required: true, trim: true, maxlength: 200 },
  description:  { type: String, trim: true, maxlength: 4000, default: '' },
  assigneeId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  assigneeName: { type: String, trim: true, maxlength: 100 },       // snapshot so the list still reads if the person is removed
  createdById:  { type: String, index: true },                       // employee _id, or 'root' for the env-login super admin
  createdByName:{ type: String, trim: true, maxlength: 100 },
  status:       { type: String, enum: ['todo', 'in_progress', 'review', 'done'], default: 'todo', index: true },
  priority:     { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  dueDate:      { type: Date },
  prNumber:     { type: Number },                                    // optional link to a pull request in the connected repo
  completedAt:  { type: Date },
}, { timestamps: true });

employeeTaskSchema.index({ status: 1, dueDate: 1 });

module.exports = mongoose.model('EmployeeTask', employeeTaskSchema);
