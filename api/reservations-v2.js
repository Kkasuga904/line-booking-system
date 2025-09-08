/**
 * Reservation API v2 with UTC normalization and Idempotency support
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { floorToSlotUTC, toUTCISO, generateSlotKey } = require('../utils/timeUtils');

// Feature flag
const FEATURE_IDEMPOTENCY = process.env.FEATURE_IDEMPOTENCY !== 'false';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

/**
 * Create reservation with idempotency and UTC slot normalization
 */
router.post('/reservations', async (req, res) => {
  const supabase = req.supabase;
  const {
    storeId,
    startAt,  // Can be JST ISO string like "2025-09-04T21:30:00+09:00"
    name,
    phone,
    people = 1,
    seatId = null,
    message = ''
  } = req.body;

  // Get or generate idempotency key
  const idempotencyKey = FEATURE_IDEMPOTENCY 
    ? (req.headers['idempotency-key'] || uuidv4())
    : null;

  try {
    // Validate required fields
    if (!storeId || !startAt || !name || !phone) {
      return res.status(400).json({
        error: 'missing_fields',
        message: 'Required fields: storeId, startAt, name, phone'
      });
    }

    // UTC normalization and slot rounding
    const slotStartUTC = floorToSlotUTC(startAt, 30); // 30-minute slots
    const slotEndUTC = new Date(slotStartUTC.getTime() + 30 * 60 * 1000);
    const slotKey = generateSlotKey(storeId, slotStartUTC, seatId);

    // Logging (info level)
    if (LOG_LEVEL === 'debug' || LOG_LEVEL === 'info') {
      console.log('[RESERVATION CREATE]', {
        storeId,
        receivedStartAt: startAt,
        utcNormalized: toUTCISO(new Date(startAt)),
        slotStartUTC: toUTCISO(slotStartUTC),
        slotEndUTC: toUTCISO(slotEndUTC),
        idempotencyKey,
        computedKey: slotKey
      });
    }

    // Check capacity constraints first
    const { data: constraints, error: constraintError } = await supabase
      .from('capacity_controls')
      .select('*')
      .eq('store_id', storeId)
      .lte('start_time', toUTCISO(slotStartUTC))
      .gte('end_time', toUTCISO(slotStartUTC));

    if (constraintError) {
      console.error('Constraint check error:', constraintError);
      return res.status(500).json({
        error: 'constraint_check_failed',
        message: 'Failed to check capacity constraints'
      });
    }

    // Check if slot is restricted
    if (constraints && constraints.length > 0) {
      const constraint = constraints[0];
      
      // Count existing reservations in this slot
      const { count, error: countError } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .eq('slot_start_at_utc', toUTCISO(slotStartUTC))
        .neq('status', 'cancelled');

      if (countError) {
        console.error('Count error:', countError);
      }

      const currentCount = count || 0;
      
      // Check capacity limits
      if (constraint.max_groups && currentCount >= constraint.max_groups) {
        return res.status(409).json({
          error: 'slot_taken',
          message: `This time slot is full (${currentCount}/${constraint.max_groups} groups)`,
          details: {
            slotStartUTC: toUTCISO(slotStartUTC),
            maxGroups: constraint.max_groups,
            currentCount
          }
        });
      }

      if (constraint.max_people) {
        const { data: existingReservations } = await supabase
          .from('reservations')
          .select('people')
          .eq('store_id', storeId)
          .eq('slot_start_at_utc', toUTCISO(slotStartUTC))
          .neq('status', 'cancelled');

        const totalPeople = (existingReservations || [])
          .reduce((sum, r) => sum + (r.people || 1), 0) + people;

        if (totalPeople > constraint.max_people) {
          return res.status(409).json({
            error: 'capacity_exceeded',
            message: `This time slot would exceed capacity (${totalPeople}/${constraint.max_people} people)`,
            details: {
              slotStartUTC: toUTCISO(slotStartUTC),
              maxPeople: constraint.max_people,
              wouldBe: totalPeople
            }
          });
        }
      }
    }

    // Build reservation data
    const reservationData = {
      id: uuidv4(),
      store_id: storeId,
      slot_start_at_utc: toUTCISO(slotStartUTC),
      slot_end_at_utc: toUTCISO(slotEndUTC),
      user_name: name,
      user_phone: phone,
      people,
      seat_id: seatId,
      message,
      status: 'confirmed',
      created_at: new Date().toISOString()
    };

    if (idempotencyKey) {
      reservationData.idempotency_key = idempotencyKey;
    }

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
        if (error.message?.includes('uniq_idem_key') || 
            error.message?.includes('idempotency_key')) {
          // Idempotency key duplicate - return existing reservation
          if (idempotencyKey) {
            const { data: existing } = await supabase
              .from('reservations')
              .select('*')
              .eq('idempotency_key', idempotencyKey)
              .single();

            if (existing) {
              return res.status(200).json({
                success: true,
                message: 'Reservation already exists (idempotent)',
                reservation: formatReservationForCalendar(existing),
                duplicate: true
              });
            }
          }

          return res.status(409).json({
            error: 'duplicate_request',
            message: 'Duplicate request detected. Please wait before retrying.',
            idempotencyKey
          });
        }
        
        if (error.message?.includes('uniq_reservation_slot') ||
            error.message?.includes('slot_start_at_utc')) {
          // Slot is taken
          return res.status(409).json({
            error: 'slot_taken',
            message: 'This time slot is already booked',
            details: {
              slotStartUTC: toUTCISO(slotStartUTC),
              storeId,
              seatId
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

    // Log success (debug only)
    if (LOG_LEVEL === 'debug') {
      console.log('[RESERVATION CREATED]', {
        id: reservation.id,
        slotStartUTC: reservation.slot_start_at_utc,
        slotEndUTC: reservation.slot_end_at_utc
      });
    }

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
 * Get reservations for calendar display
 */
router.get('/reservations', async (req, res) => {
  const supabase = req.supabase;
  const { storeId, start, end } = req.query;

  if (!storeId) {
    return res.status(400).json({
      error: 'missing_store_id',
      message: 'storeId is required'
    });
  }

  try {
    // Fetch reservations in date range
    let query = supabase
      .from('reservations')
      .select('*')
      .eq('store_id', storeId)
      .neq('status', 'cancelled')
      .order('slot_start_at_utc', { ascending: true });

    if (start) {
      query = query.gte('slot_start_at_utc', start);
    }
    if (end) {
      query = query.lte('slot_start_at_utc', end);
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

/**
 * Get capacity constraints for calendar display
 */
router.get('/constraints', async (req, res) => {
  const supabase = req.supabase;
  const { storeId, start, end } = req.query;

  if (!storeId) {
    return res.status(400).json({
      error: 'missing_store_id',
      message: 'storeId is required'
    });
  }

  try {
    let query = supabase
      .from('capacity_controls')
      .select('*')
      .eq('store_id', storeId)
      .order('start_time', { ascending: true });

    if (start) {
      query = query.gte('end_time', start);
    }
    if (end) {
      query = query.lte('start_time', end);
    }

    const { data: constraints, error } = await query;

    if (error) {
      console.error('Fetch error:', error);
      return res.status(500).json({
        error: 'fetch_failed',
        message: 'Failed to fetch constraints'
      });
    }

    // Format for FullCalendar background events
    const events = constraints.map(formatConstraintForCalendar);

    return res.json({
      success: true,
      constraints: events
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
  return {
    id: `booking-${reservation.id}`,
    title: `${reservation.user_name} (${reservation.people}名)`,
    start: reservation.slot_start_at_utc, // UTC ISO string
    end: reservation.slot_end_at_utc,     // UTC ISO string
    allDay: false,
    classNames: ['fc-booking'],
    extendedProps: {
      type: 'booking',
      reservationId: reservation.id,
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
 * Format constraint for FullCalendar background
 */
function formatConstraintForCalendar(constraint) {
  return {
    id: `constraint-${constraint.id}`,
    start: constraint.start_time, // UTC ISO string
    end: constraint.end_time,     // UTC ISO string
    allDay: false,
    display: 'background',
    classNames: ['fc-constraint'],
    backgroundColor: '#ffcccc',
    extendedProps: {
      type: 'constraint',
      constraintId: constraint.id,
      maxGroups: constraint.max_groups,
      maxPeople: constraint.max_people,
      maxPerGroup: constraint.max_per_group
    }
  };
}

module.exports = router;