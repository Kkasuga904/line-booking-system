/**
 * Events API - Separated booking and constraint events
 */

const express = require('express');
const router = express.Router();

/**
 * Get events by type (booking or constraint)
 */
router.get('/', async (req, res) => {
  const supabase = req.supabase;
  const { type, store_id, start, end } = req.query;

  if (!store_id) {
    return res.status(400).json({
      error: 'missing_store_id',
      message: 'store_id is required'
    });
  }

  try {
    if (type === 'booking') {
      // Fetch bookings
      let query = supabase
        .from('reservations')
        .select('*')
        .eq('store_id', store_id)
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
        console.error('Fetch bookings error:', error);
        return res.status(500).json({
          error: 'fetch_failed',
          message: 'Failed to fetch bookings'
        });
      }

      // Format bookings for FullCalendar
      const bookingEvents = (reservations || []).map(reservation => {
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
      });

      console.log(`[EVENTS] Returning ${bookingEvents.length} booking events`);
      return res.json(bookingEvents);

    } else if (type === 'constraint') {
      // Fetch capacity constraints
      let query = supabase
        .from('capacity_controls')
        .select('*')
        .eq('store_id', store_id)
        .order('start_time', { ascending: true });

      if (start) {
        query = query.gte('end_time', start);
      }
      if (end) {
        query = query.lte('start_time', end);
      }

      const { data: constraints, error } = await query;

      if (error) {
        console.error('Fetch constraints error:', error);
        return res.status(500).json({
          error: 'fetch_failed',
          message: 'Failed to fetch constraints'
        });
      }

      // Format constraints for FullCalendar background events
      const constraintEvents = (constraints || []).map(constraint => {
        // Ensure proper UTC times with explicit end
        const startTime = new Date(constraint.start_time);
        const endTime = new Date(constraint.end_time);
        
        // Generate unique ID based on time slot
        const slotKey = `${startTime.toISOString()}_${constraint.seat_id || 'all'}`;
        
        return {
          id: `cs_${slotKey}`,
          start: startTime.toISOString(),
          end: endTime.toISOString(),
          allDay: false,
          display: 'background',
          classNames: ['fc-constraint'],
          backgroundColor: 'rgba(255, 0, 0, 0.2)',
          borderColor: 'rgba(255, 0, 0, 0.5)',
          extendedProps: {
            type: 'constraint',
            constraintId: constraint.id,
            storeId: constraint.store_id,
            maxGroups: constraint.max_groups,
            maxPeople: constraint.max_people,
            maxPerGroup: constraint.max_per_group,
            seatId: constraint.seat_id
          }
        };
      });

      console.log(`[EVENTS] Returning ${constraintEvents.length} constraint events`);
      return res.json(constraintEvents);

    } else if (type === 'all') {
      // Fetch both types (NOT RECOMMENDED - use separate sources)
      const [bookingsRes, constraintsRes] = await Promise.all([
        supabase
          .from('reservations')
          .select('*')
          .eq('store_id', store_id)
          .neq('status', 'cancelled'),
        supabase
          .from('capacity_controls')
          .select('*')
          .eq('store_id', store_id)
      ]);

      if (bookingsRes.error || constraintsRes.error) {
        return res.status(500).json({
          error: 'fetch_failed',
          message: 'Failed to fetch events'
        });
      }

      // Format and combine (but keep IDs distinct!)
      const bookingEvents = (bookingsRes.data || []).map(r => ({
        id: `bk_${r.id}`,
        title: `${r.user_name} (${r.people}名)`,
        start: r.slot_start_at_utc || `${r.date}T${r.time}:00.000Z`,
        end: r.slot_end_at_utc || new Date(new Date(r.slot_start_at_utc || `${r.date}T${r.time}:00.000Z`).getTime() + 30 * 60 * 1000).toISOString(),
        allDay: false,
        classNames: ['fc-booking'],
        extendedProps: { type: 'booking', storeId: r.store_id }
      }));

      const constraintEvents = (constraintsRes.data || []).map(c => ({
        id: `cs_${c.start_time}_${c.seat_id || 'all'}`,
        start: c.start_time,
        end: c.end_time,
        allDay: false,
        display: 'background',
        classNames: ['fc-constraint'],
        extendedProps: { type: 'constraint', storeId: c.store_id }
      }));

      // Return as separate arrays to avoid mixing
      return res.json({
        bookings: bookingEvents,
        constraints: constraintEvents
      });

    } else {
      return res.status(400).json({
        error: 'invalid_type',
        message: 'type must be booking, constraint, or all'
      });
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'An unexpected error occurred'
    });
  }
});

/**
 * Create or update capacity constraint
 */
router.post('/constraints', async (req, res) => {
  const supabase = req.supabase;
  const {
    store_id,
    start_time,
    end_time,
    max_groups,
    max_people,
    max_per_group,
    seat_id = null
  } = req.body;

  if (!store_id || !start_time || !end_time) {
    return res.status(400).json({
      error: 'missing_fields',
      message: 'store_id, start_time, and end_time are required'
    });
  }

  try {
    // Ensure times are properly formatted
    const startUTC = new Date(start_time).toISOString();
    const endUTC = new Date(end_time).toISOString();

    const constraintData = {
      store_id,
      start_time: startUTC,
      end_time: endUTC,
      max_groups,
      max_people,
      max_per_group,
      seat_id,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('capacity_controls')
      .insert([constraintData])
      .select();

    if (error) {
      console.error('Insert constraint error:', error);
      return res.status(500).json({
        error: 'insert_failed',
        message: 'Failed to create constraint'
      });
    }

    const constraint = data[0];
    
    // Return formatted constraint event
    const constraintEvent = {
      id: `cs_${startUTC}_${seat_id || 'all'}`,
      start: startUTC,
      end: endUTC,
      allDay: false,
      display: 'background',
      classNames: ['fc-constraint'],
      backgroundColor: 'rgba(255, 0, 0, 0.2)',
      extendedProps: {
        type: 'constraint',
        constraintId: constraint.id,
        storeId: constraint.store_id,
        maxGroups: constraint.max_groups,
        maxPeople: constraint.max_people,
        maxPerGroup: constraint.max_per_group,
        seatId: constraint.seat_id
      }
    };

    return res.status(201).json({
      success: true,
      constraint: constraintEvent
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