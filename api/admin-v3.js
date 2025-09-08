/**
 * Admin API v3 - Complete rewrite without global guards
 * Uses Idempotency-Key and DB constraints for duplicate prevention
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// UTC normalization utilities
function floorToSlotUTC(dateTime, slotMinutes = 30) {
  const date = new Date(dateTime);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateTime}`);
  }
  const utcMs = date.getTime();
  const slotMs = slotMinutes * 60 * 1000;
  const flooredMs = Math.floor(utcMs / slotMs) * slotMs;
  return new Date(flooredMs);
}

function toUTCISO(date) {
  return date.toISOString();
}

/**
 * Create reservation with Idempotency-Key and DB constraints
 */
router.post('/', async (req, res) => {
  const supabase = req.supabase;
  const action = req.query.action;
  
  if (action !== 'create') {
    return res.status(400).json({ error: 'invalid_action' });
  }

  const {
    store_id,
    date,      // Can be date only or ISO datetime
    time,      // Optional if datetime provided
    startAt,   // Alternative to date+time
    user_name,
    user_phone,
    people = 1,
    seat_id = null,
    seat_code = null,
    message = '',
    status = 'confirmed'
  } = req.body;

  // Require and validate Idempotency-Key
  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) {
    return res.status(400).json({
      error: 'missing_idempotency_key',
      message: 'Idempotency-Key header is required'
    });
  }

  try {
    // Determine start time
    let startDateTime;
    if (startAt) {
      startDateTime = new Date(startAt);
    } else if (date && time) {
      // Combine date and time (assume JST if no timezone)
      const dateStr = date.includes('T') ? date : `${date}T${time}:00+09:00`;
      startDateTime = new Date(dateStr);
    } else {
      return res.status(400).json({
        error: 'missing_datetime',
        message: 'Either startAt or date+time is required'
      });
    }

    // UTC normalization and slot rounding
    const slotStartUTC = floorToSlotUTC(startDateTime, 30);
    const slotEndUTC = new Date(slotStartUTC.getTime() + 30 * 60 * 1000);
    
    // Logging
    console.log('[RESERVATION CREATE v3]', {
      storeId: store_id,
      receivedStartAt: startDateTime.toISOString(),
      utcNormalized: toUTCISO(startDateTime),
      slotStartUTC: toUTCISO(slotStartUTC),
      slotEndUTC: toUTCISO(slotEndUTC),
      idempotencyKey
    });

    // Build reservation data
    const reservationId = uuidv4();
    const reservationData = {
      id: reservationId,
      store_id,
      slot_start_at_utc: toUTCISO(slotStartUTC),
      slot_end_at_utc: toUTCISO(slotEndUTC),
      // Keep legacy columns for compatibility
      date: slotStartUTC.toISOString().split('T')[0],
      time: slotStartUTC.toTimeString().substring(0, 5),
      user_name,
      user_phone,
      people,
      seat_id: seat_id || seat_code || null,
      seat_code: seat_code || seat_id || null,
      message,
      status,
      idempotency_key: idempotencyKey,
      created_at: new Date().toISOString()
    };

    // Insert with conflict handling
    const { data, error } = await supabase
      .from('reservations')
      .insert([reservationData])
      .select();

    if (error) {
      console.error('Insert error:', error);
      
      // Handle unique constraint violations
      if (error.code === '23505') {
        // Check which constraint was violated
        if (error.message?.includes('idempotency_key') || 
            error.message?.includes('uniq_idem_key')) {
          // Idempotency key duplicate - fetch and return existing
          const { data: existing } = await supabase
            .from('reservations')
            .select('*')
            .eq('idempotency_key', idempotencyKey)
            .single();

          if (existing) {
            return res.status(200).json({
              success: true,
              message: 'Reservation already exists (idempotent)',
              reservation: formatReservationForCalendar(existing)
            });
          }

          return res.status(409).json({
            error: 'duplicate_request',
            message: 'Duplicate request detected. Please wait before retrying.'
          });
        }
        
        if (error.message?.includes('uniq_reservation_slot') ||
            error.message?.includes('unique_reservation_slot') ||
            error.message?.includes('slot_start_at_utc')) {
          // Slot is taken
          return res.status(409).json({
            error: 'slot_taken',
            message: 'This time slot is already booked',
            details: {
              slotStartUTC: toUTCISO(slotStartUTC),
              storeId: store_id,
              seatId: seat_id
            }
          });
        }

        // Other unique constraint violation  
        return res.status(409).json({
          error: 'constraint_violation',
          message: 'Reservation conflicts with existing booking'
        });
      }

      // Other database errors
      return res.status(500).json({
        error: 'database_error',
        message: 'Failed to create reservation'
      });
    }

    // Success - format for FullCalendar
    const reservation = data[0];
    const calendarEvent = formatReservationForCalendar(reservation);

    console.log('[RESERVATION CREATED]', {
      id: reservation.id,
      slotStartUTC: reservation.slot_start_at_utc,
      calendarEvent
    });

    return res.status(201).json({
      success: true,
      message: 'Reservation created successfully',
      reservation: calendarEvent
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'An unexpected error occurred'
    });
  }
});

/**
 * Format reservation for FullCalendar
 */
function formatReservationForCalendar(reservation) {
  // Use UTC slot times if available, fallback to date+time
  const startUTC = reservation.slot_start_at_utc || 
    `${reservation.date}T${reservation.time}:00.000Z`;
  const endUTC = reservation.slot_end_at_utc || 
    new Date(new Date(startUTC).getTime() + 30 * 60 * 1000).toISOString();

  return {
    id: `bk_${reservation.id}`,
    title: `${reservation.user_name} (${reservation.people}名)`,
    start: startUTC,
    end: endUTC,
    allDay: false,
    classNames: ['fc-booking'],
    backgroundColor: '#4CAF50',
    borderColor: '#45a049',
    extendedProps: {
      type: 'booking',
      reservationId: reservation.id,
      storeId: reservation.store_id,
      userName: reservation.user_name,
      userPhone: reservation.user_phone,
      people: reservation.people,
      seatId: reservation.seat_id,
      message: reservation.message,
      status: reservation.status
    }
  };
}

/**
 * Get reservations
 */
router.get('/', async (req, res) => {
  const supabase = req.supabase;
  const action = req.query.action;
  
  if (action !== 'list') {
    return res.status(400).json({ error: 'invalid_action' });
  }

  const { store_id, start_date, end_date } = req.query;

  try {
    let query = supabase
      .from('reservations')
      .select('*')
      .eq('store_id', store_id || 'default-store')
      .neq('status', 'cancelled')
      .order('slot_start_at_utc', { ascending: true });

    if (start_date) {
      query = query.gte('date', start_date);
    }
    if (end_date) {
      query = query.lte('date', end_date);
    }

    const { data: reservations, error } = await query;

    if (error) {
      console.error('Fetch error:', error);
      return res.status(500).json({
        error: 'fetch_failed',
        message: 'Failed to fetch reservations'
      });
    }

    // Format for FullCalendar
    const events = reservations.map(formatReservationForCalendar);

    return res.json({
      success: true,
      reservations: events
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'An unexpected error occurred'
    });
  }
});

module.exports = router;