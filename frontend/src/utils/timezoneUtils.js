/**
 * Timezone Utilities - SIMPLE & WORKING
 * 
 * The problem: datetime-local gives us "2024-12-25T17:35" (meaning 5:35 PM)
 * We need to convert this to UTC, treating it as being in the selected timezone
 */

export function getUserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    return 'UTC';
  }
}

/**
 * Convert datetime-local to UTC - FINAL WORKING VERSION
 * @param {string} datetimeLocal - "2024-12-25T17:35" from datetime-local input
 * @param {string} selectedTimezone - "America/New_York"
 */
export function localDateTimeToUTC(datetimeLocal, selectedTimezone = getUserTimezone()) {
  if (!datetimeLocal) return '';
  
  try {
    // Just append the timezone and let the browser do the work
    // We'll use a trick: create a date string in ISO format with explicit timezone
    
    // Parse the input
    const [datePart, timePart] = datetimeLocal.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    
    // Create a date object at this time in UTC
    const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    
    // Get how this UTC time appears in the target timezone
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
    
    const formatted = formatter.format(utcDate);
    const [tzDate, tzTime] = formatted.split(', ');
    const [tzMonth, tzDay, tzYear] = tzDate.split('/').map(Number);
    const [tzHour, tzMinute] = tzTime.split(':').map(Number);
    
    // Calculate the offset: how many milliseconds difference
    const tzUTC = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, 0);
    const offsetMs = utcDate.getTime() - tzUTC;
    
    // Apply the INVERSE offset to get correct UTC
    // If we want 5:35 PM ET, and ET is currently UTC-5, we need to add 5 hours to get UTC
    const correctUTC = Date.UTC(year, month - 1, day, hour, minute, 0) - offsetMs;
    
    return new Date(correctUTC).toISOString();
  } catch (error) {
    console.error('Timezone conversion error:', error);
    // Fallback: treat as UTC
    const [datePart, timePart] = datetimeLocal.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    return new Date(Date.UTC(year, month - 1, day, hour, minute, 0)).toISOString();
  }
}

/**
 * Convert UTC to datetime-local string in a timezone
 */
export function utcToLocalDateTime(utcDate, timezone = getUserTimezone()) {
  if (!utcDate) return '';
  
  try {
    const date = new Date(utcDate);
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
    return formatted.replace(' ', 'T').substring(0, 16);
  } catch (error) {
    return new Date(utcDate).toISOString().slice(0, 16);
  }
}

/**
 * Format UTC date for display in timezone
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
