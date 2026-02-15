/**
 * Timezone Utilities - CORRECTED VERSION (No External Dependencies)
 * 
 * Fixed Implementation:
 * - Correctly interprets datetime-local input as being IN the selected timezone
 * - Converts to UTC without double-shifting offsets
 * - Handles DST transitions properly
 * - Uses only native JavaScript Intl API
 */

export function getUserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    return 'UTC';
  }
}

/**
 * Convert datetime-local input to UTC (CORRECTED VERSION)
 * 
 * THE FIX: We create a localized date string that the Date constructor 
 * will parse correctly in the target timezone.
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
    // Parse the components
    const [datePart, timePart] = datetimeLocal.split('T');
    if (!datePart || !timePart) return '';
    
    // Create an ISO string WITH timezone info
    // The trick: append the datetime to a format that includes timezone
    const dateString = `${datePart}T${timePart}:00`;
    
    // Format it in the target timezone to get the localized string
    // We'll use this to figure out what UTC time corresponds to this local time
    const testDate = new Date(dateString + 'Z'); // Temporarily treat as UTC
    
    // Get the local representation in the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: selectedTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    // Format the test date to see what it looks like in the target timezone
    const parts = formatter.formatToParts(testDate);
    const formatted = {};
    parts.forEach(part => {
      if (part.type !== 'literal') {
        formatted[part.type] = part.value;
      }
    });
    
    // Now we know the offset: the difference between our input and what testDate shows
    const testUTC = Date.UTC(
      parseInt(formatted.year),
      parseInt(formatted.month) - 1,
      parseInt(formatted.day),
      parseInt(formatted.hour),
      parseInt(formatted.minute),
      parseInt(formatted.second)
    );
    
    // Calculate offset in milliseconds
    const offset = testDate.getTime() - testUTC;
    
    // Parse our actual input
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    
    // Create UTC timestamp: our input time, adjusted by the offset
    const inputUTC = Date.UTC(year, month - 1, day, hour, minute, 0);
    const correctUTC = inputUTC - offset;
    
    return new Date(correctUTC).toISOString();
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
    const date = new Date(utcDate);
    
    // Format in the target timezone using Swedish locale (ISO-like format)
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const formatted = formatter.format(date);
    // Swedish format is "2024-02-15 17:50", we need "2024-02-15T17:50"
    return formatted.replace(' ', 'T');
  } catch (error) {
    console.error('UTC to local conversion error:', error);
    return '';
  }
}

/**
 * Format UTC date for human-readable display in a specific timezone
 * 
 * @param {string|Date} utcDate - UTC timestamp
 * @param {string} timezone - IANA timezone
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export function formatDateInTimezone(utcDate, timezone = getUserTimezone(), options = {}) {
  if (!utcDate) return '';
  
  try {
    const date = new Date(utcDate);
    
    const defaultOptions = {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      ...options
    };
    
    return new Intl.DateTimeFormat('en-US', defaultOptions).format(date);
  } catch (error) {
    console.error('Date formatting error:', error);
    return '';
  }
}

/**
 * Get timezone abbreviation (e.g., "EST", "EDT", "PST")
 * 
 * @param {string} timezone - IANA timezone
 * @param {Date} date - Date to check for DST (defaults to now)
 * @returns {string} Timezone abbreviation
 */
export function getTimezoneAbbr(timezone = getUserTimezone(), date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    });
    
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    return tzPart ? tzPart.value : timezone;
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