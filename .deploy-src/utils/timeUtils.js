/**
 * Time utilities for UTC normalization and slot rounding
 */

/**
 * Floor time to slot boundary in UTC
 * @param {Date|string} dateTime - Input datetime
 * @param {number} slotMinutes - Slot duration in minutes (default: 30)
 * @returns {Date} - UTC date floored to slot boundary
 */
function floorToSlotUTC(dateTime, slotMinutes = 30) {
  const date = new Date(dateTime);
  
  // Ensure valid date
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateTime}`);
  }
  
  // Convert to UTC milliseconds
  const utcMs = date.getTime();
  
  // Floor to slot boundary
  const slotMs = slotMinutes * 60 * 1000;
  const flooredMs = Math.floor(utcMs / slotMs) * slotMs;
  
  return new Date(flooredMs);
}

/**
 * Convert JST datetime string to UTC
 * @param {string} jstDateTime - JST datetime string (e.g., "2025-09-04T21:30:00+09:00")
 * @returns {Date} - UTC Date object
 */
function jstToUTC(jstDateTime) {
  const date = new Date(jstDateTime);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid JST datetime: ${jstDateTime}`);
  }
  return date;
}

/**
 * Format date to ISO string for database storage
 * @param {Date} date - Date object
 * @returns {string} - ISO string in UTC
 */
function toUTCISO(date) {
  return date.toISOString();
}

/**
 * Generate slot key for unique constraint
 * @param {string} storeId - Store ID
 * @param {Date} slotStartUTC - Slot start time in UTC
 * @param {string} seatId - Seat ID (optional)
 * @returns {string} - Unique slot key
 */
function generateSlotKey(storeId, slotStartUTC, seatId = '_default_') {
  const utcStr = slotStartUTC.toISOString();
  return `${storeId}:${utcStr}:${seatId}`;
}

module.exports = {
  floorToSlotUTC,
  jstToUTC,
  toUTCISO,
  generateSlotKey
};