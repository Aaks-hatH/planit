/**
 * Timezone Utilities - REAL FIX
 * 
 * THE PROBLEM:
 * - User enters "4:30 PM" in datetime-local input
 * - Selects "Eastern Time (ET)" timezone
 * - Browser's new Date("2024-12-25T16:30") interprets this in BROWSER timezone
 * - This causes wrong UTC conversion
 * 
 * THE FIX:
 * - Treat datetime-local string as timezone-naive
 * - Manually construct UTC time based on SELECTED timezone
 */

export function getUserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    return 'UTC';
  }
}

/**
 * FIXED: Convert datetime-local to UTC properly
 * @param {string} datetimeLocal - "2024-12-25T16:30" from input
 * @param {string} selectedTimezone - "America/New_York" from dropdown
 */
export function localDateTimeToUTC(datetimeLocal, selectedTimezone = getUserTimezone()) {
  if (!datetimeLocal) return '';
  
  try {
    // Parse the datetime string (it has NO timezone info)
    const [datePart, timePart] = datetimeLocal.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = (timePart || '00:00').split(':').map(Number);
    
    // Create a string that says "this time IN the selected timezone"
    // We'll use a hack: create the date string and let Intl interpret it
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
    
    // Create a fake date to get timezone offset
    // We create a date in UTC, then see how it displays in target timezone
    const utcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
    const fakeDate = new Date(utcMs);
    
    // Format this UTC time as if it were in the target timezone
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
    
    const formatted = formatter.format(fakeDate);
    const [m, d, y] = formatted.split(', ')[0].split('/');
    const [h, min] = formatted.split(', ')[1].split(':');
    
    // Now we know: when UTC is utcMs, it displays as formatted in target TZ
    // We want: when it's hour:minute in target TZ, what is UTC?
    
    // Calculate the offset
    const displayedMs = Date.UTC(Number(y), Number(m) - 1, Number(d), Number(h), Number(min), 0);
    const offsetMs = utcMs - displayedMs;
    
    // Apply inverse offset to get correct UTC
    const correctUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0) - offsetMs;
    
    return new Date(correctUtcMs).toISOString();
  } catch (error) {
    console.error('Timezone conversion error:', error);
    // Fallback
    return new Date(datetimeLocal).toISOString();
  }
}

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
    
    // sv-SE format gives us YYYY-MM-DD HH:mm:ss
    const formatted = formatter.format(date);
    return formatted.replace(' ', 'T').substring(0, 16);
  } catch (error) {
    console.error('UTC to local error:', error);
    return new Date(utcDate).toISOString().slice(0, 16);
  }
}

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
