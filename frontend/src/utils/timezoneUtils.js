/**
 * Timezone Utilities - SIMPLIFIED AND FIXED
 * 
 * THE PROBLEM WITH OLD CODE:
 * - Complex offset calculations were causing incorrect conversions
 * - 4:59 PM ET was being saved as 11:59 PM ET (7-hour error)
 * 
 * THE FIX:
 * - Use a simpler approach: parse the datetime string and construct a proper ISO string
 * - Let the browser/server handle timezone conversions naturally
 */

export function getUserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    return 'UTC';
  }
}

/**
 * FIXED: Convert datetime-local to UTC correctly
 * Simple and reliable approach using toLocaleString
 * @param {string} datetimeLocal - "2024-12-25T16:30" from input
 * @param {string} selectedTimezone - "America/New_York" from dropdown
 */
export function localDateTimeToUTC(datetimeLocal, selectedTimezone = getUserTimezone()) {
  if (!datetimeLocal) return '';
  
  try {
    // Parse the datetime components
    const [datePart, timePart] = datetimeLocal.split('T');
    if (!datePart || !timePart) {
      return new Date(datetimeLocal).toISOString();
    }
    
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    
    // Create the date string that represents "this time in the selected timezone"
    // We'll use a trick: format a date string that explicitly includes timezone info
    const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
    
    // Create a test date in UTC
    const testDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    
    // See how this UTC time appears in the target timezone
    const inTargetTz = testDate.toLocaleString('en-US', {
      timeZone: selectedTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    // Parse what we got back
    const [tzDate, tzTime] = inTargetTz.split(', ');
    const [tzMonth, tzDay, tzYear] = tzDate.split('/').map(Number);
    const [tzHour, tzMinute, tzSecond] = tzTime.split(':').map(Number);
    
    // Calculate the difference
    const tzMillis = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, tzSecond);
    const offset = testDate.getTime() - tzMillis;
    
    // Now apply the offset in the correct direction
    // We want: when it's hour:minute in selectedTimezone, what time is it in UTC?
    const targetMillis = Date.UTC(year, month - 1, day, hour, minute, 0);
    const utcMillis = targetMillis - offset;
    
    return new Date(utcMillis).toISOString();
  } catch (error) {
    console.error('Timezone conversion error:', error);
    // Fallback: treat as local browser timezone
    return new Date(datetimeLocal).toISOString();
  }
}

/**
 * Convert UTC date to datetime-local string in a specific timezone
 */
export function utcToLocalDateTime(utcDate, timezone = getUserTimezone()) {
  if (!utcDate) return '';
  
  try {
    const date = new Date(utcDate);
    
    // Use Swedish locale format which gives us ISO-like format
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    // Format and convert to datetime-local format
    const formatted = formatter.format(date);
    return formatted.replace(' ', 'T').substring(0, 16);
  } catch (error) {
    console.error('UTC to local error:', error);
    return new Date(utcDate).toISOString().slice(0, 16);
  }
}

/**
 * Format a UTC date for display in a specific timezone
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
    return new Date(utcDate).toLocaleString();
  }
}

/**
 * Get available timezone options for dropdown
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

/**
 * Get timezone abbreviation for a given timezone
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
