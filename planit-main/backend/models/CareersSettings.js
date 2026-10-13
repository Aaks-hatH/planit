'use strict';

/*
 * CareersSettings - singleton. Lets an admin pause / close the whole careers
 * program with one switch (listings stay visible, Apply buttons are disabled).
 */

const mongoose = require('mongoose');

const careersSettingsSchema = new mongoose.Schema({
  key:                   { type: String, default: 'main', unique: true },
  acceptingApplications: { type: Boolean, default: true },
  pausedMessage:         { type: String, trim: true, maxlength: 300, default: "We're not taking applications right now. Check back soon." },
  updatedBy:             { type: String, default: '' },
}, { timestamps: true });

careersSettingsSchema.statics.get = async function () {
  let doc = await this.findOne({ key: 'main' });
  if (!doc) doc = await this.create({ key: 'main' });
  return doc;
};

module.exports = mongoose.models.CareersSettings || mongoose.model('CareersSettings', careersSettingsSchema);
