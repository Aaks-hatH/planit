/**
 * Timezone Utilities
 * Handles all timezone conversions between local time and UTC storage
 */

/**
 * Get the user's current timezone
 * @returns {string} IANA timezone identifier (e.g., 'America/New_York')
 */
export function getUserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.warn('Could not detect timezone, defaulting to UTC');
    return 'UTC';
  }
}

/**
 * Convert a datetime-local input value to ISO string for storage
 * @param {string} localDatetimeString - Value from datetime-local input (e.g., '2024-12-25T14:30')
 * @param {string} timezone - Optional timezone, defaults to user's timezone
 * @returns {string} ISO string in UTC
 */
export function localDateTimeToUTC(localDatetimeString, timezone = getUserTimezone()) {
  if (!localDatetimeString) return '';
  
  try {
    // datetime-local gives us a string like "2024-12-25T14:30"
    // We need to interpret this as being in the specified timezone
    const date = new Date(localDatetimeString);
    
    // Get the timezone offset for the specified timezone
    const offsetMinutes = getTimezoneOffset(localDatetimeString, timezone);
    
    // Adjust the date by the offset to get the correct UTC time
    date.setMinutes(date.getMinutes() - offsetMinutes);
    
    return date.toISOString();
  } catch (error) {
    console.error('Error converting local datetime to UTC:', error);
    return new Date(localDatetimeString).toISOString();
  }
}

/**
 * Convert UTC date to local datetime-local input format
 * @param {string|Date} utcDate - UTC date string or Date object
 * @param {string} timezone - Optional timezone, defaults to user's timezone
 * @returns {string} Formatted string for datetime-local input (YYYY-MM-DDTHH:mm)
 */
export function utcToLocalDateTime(utcDate, timezone = getUserTimezone()) {
  if (!utcDate) return '';
  
  try {
    const date = new Date(utcDate);
    
    // Format for datetime-local input: "YYYY-MM-DDTHH:mm"
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(date);
    const values = {};
    parts.forEach(({ type, value }) => {
      values[type] = value;
    });
    
    return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
  } catch (error) {
    console.error('Error converting UTC to local datetime:', error);
    // Fallback to basic conversion
    const date = new Date(utcDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
}

/**
 * Format a UTC date for display in a specific timezone
 * @param {string|Date} utcDate - UTC date string or Date object
 * @param {string} timezone - Optional timezone, defaults to user's timezone
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
    console.error('Error formatting date:', error);
    return new Date(utcDate).toLocaleString();
  }
}

/**
 * Get timezone offset in minutes for a specific date and timezone
 * @param {string|Date} date - Date to check
 * @param {string} timezone - IANA timezone identifier
 * @returns {number} Offset in minutes
 */
function getTimezoneOffset(date, timezone) {
  try {
    const dateObj = new Date(date);
    
    // Get the UTC time
    const utcTime = dateObj.getTime();
    
    // Format the date in the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    });
    
    const parts = formatter.formatToParts(dateObj);
    const values = {};
    parts.forEach(({ type, value }) => {
      values[type] = value;
    });
    
    // Create a date object in the target timezone
    const localDate = new Date(
      `${values.month}/${values.day}/${values.year} ${values.hour}:${values.minute}:${values.second} UTC`
    );
    
    // Calculate the offset
    const offset = (utcTime - localDate.getTime()) / (1000 * 60);
    
    return offset;
  } catch (error) {
    console.error('Error calculating timezone offset:', error);
    return 0;
  }
}

/**
 * Get a list of common timezone options for dropdowns
 * @returns {Array<{value: string, label: string}>}
 */
export function getTimezoneOptions() {
  // Common US timezones with DST handling
  const timezones = [
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
  
  return timezones;
}

/**
 * Get timezone abbreviation (e.g., EST, PST, GMT)
 * @param {string} timezone - IANA timezone identifier
 * @param {Date} date - Optional date to check (for DST)
 * @returns {string} Timezone abbreviation
 */
export function getTimezoneAbbr(timezone = getUserTimezone(), date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    });
    
    const parts = formatter.formatToParts(date);
    const timeZonePart = parts.find(part => part.type === 'timeZoneName');
    
    return timeZonePart ? timeZonePart.value : timezone;
  } catch (error) {
    console.error('Error getting timezone abbreviation:', error);
    return timezone;
  }
}
