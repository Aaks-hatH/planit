/**
 * Timezone Utilities - Using Luxon (PRODUCTION READY)
 * 
 * This implementation uses Luxon for reliable timezone conversions.
 * Luxon correctly interprets local times in specific timezones and handles DST automatically.
 */

import { DateTime } from 'luxon';

export function getUserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    return 'UTC';
  }
}

/**
 * Convert datetime-local input to UTC
 * 
 * @param {string} datetimeLocal - "2024-02-15T17:50" from datetime-local input
 * @param {string} selectedTimezone - IANA timezone (e.g., "America/New_York")
 * @returns {string} ISO 8601 UTC string (e.g., "2024-02-15T22:50:00.000Z")
 * 
 * Example:
 *   Input:  "2024-02-15T17:50" in "America/New_York" (EST = UTC-5)
 *   Output: "2024-02-15T22:50:00.000Z" (17:50 + 5 hours = 22:50 UTC)
 */
export function localDateTimeToUTC(datetimeLocal, selectedTimezone = getUserTimezone()) {
  if (!datetimeLocal) return '';
  
  try {
    // Parse the datetime string AS IF it's in the selected timezone
    // This is what Luxon excels at
    const dt = DateTime.fromISO(datetimeLocal, { zone: selectedTimezone });
    
    // Check if parsing was valid
    if (!dt.isValid) {
      console.error('Invalid datetime:', dt.invalidReason);
      return '';
    }
    
    // Convert to UTC and return as ISO string
    return dt.toUTC().toISO();
  } catch (error) {
    console.error('Timezone conversion error:', error);
    return '';
  }
}

/**
 * Convert UTC timestamp back to datetime-local string in a specific timezone
 * 
 * @param {string|Date} utcDate - UTC timestamp (ISO string or Date object)
 * @param {string} timezone - IANA timezone (e.g., "America/New_York")
 * @returns {string} datetime-local format "YYYY-MM-DDTHH:mm"
 * 
 * Example:
 *   Input:  "2024-02-15T22:50:00.000Z" in "America/New_York" (EST = UTC-5)
 *   Output: "2024-02-15T17:50" (22:50 UTC - 5 hours = 17:50 ET)
 */
export function utcToLocalDateTime(utcDate, timezone = getUserTimezone()) {
  if (!utcDate) return '';
  
  try {
    // Parse the UTC date and convert to the target timezone
    const dt = DateTime.fromISO(utcDate, { zone: 'UTC' }).setZone(timezone);
    
    if (!dt.isValid) {
      console.error('Invalid UTC date:', dt.invalidReason);
      return '';
    }
    
    // Return in datetime-local format (YYYY-MM-DDTHH:mm)
    return dt.toFormat("yyyy-MM-dd'T'HH:mm");
  } catch (error) {
    console.error('UTC to local conversion error:', error);
    return '';
  }
}

/**
 * Format UTC date for human-readable display in a specific timezone
 */
export function formatDateInTimezone(utcDate, timezone = getUserTimezone(), options = {}) {
  if (!utcDate) return '';
  
  try {
    const dt = DateTime.fromISO(utcDate, { zone: 'UTC' }).setZone(timezone);
    
    if (!dt.isValid) {
      console.error('Invalid date for formatting:', dt.invalidReason);
      return '';
    }
    
    // Default format: "Wednesday, February 15, 2024, 5:50 PM"
    const defaultFormat = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      ...options
    };
    
    return dt.toLocaleString(defaultFormat);
  } catch (error) {
    console.error('Date formatting error:', error);
    return '';
  }
}

/**
 * Get timezone abbreviation (e.g., "EST", "EDT", "PST")
 */
export function getTimezoneAbbr(timezone = getUserTimezone(), date = new Date()) {
  try {
    const dt = DateTime.fromJSDate(date).setZone(timezone);
    return dt.offsetNameShort || timezone;
  } catch (error) {
    return timezone;
  }
}

/**
 * Get list of common timezones for dropdowns
 */
export function getTimezoneOptions() {
  return [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Phoenix', label: 'Arizona (MT - No DST)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)' },
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' }
  ];
}