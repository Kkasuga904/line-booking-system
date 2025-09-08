/**
 * FullCalendar v3 - Complete separation of bookings and constraints
 */

let calendar = null;
const DEBUG_MODE = localStorage.getItem('debug') === 'true';

/**
 * Initialize FullCalendar with separated event sources
 */
function initCalendarV3(elementId, storeId) {
  const calendarEl = document.getElementById(elementId);
  
  if (!calendarEl) {
    console.error('Calendar element not found:', elementId);
    return;
  }

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'ja',
    timeZone: 'local',  // Use local timezone (JST in Japan)
    height: 'auto',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    
    // IMPORTANT: Completely separated event sources
    eventSources: [
      {
        // Bookings source - regular events
        id: 'bookings',
        url: '/api/events',
        method: 'GET',
        extraParams: {
          type: 'booking',
          store_id: storeId
        },
        color: '#4CAF50',  // Green for bookings
        textColor: '#ffffff',
        failure: function(error) {
          console.error('[Calendar] Failed to load bookings:', error);
        },
        success: function(events) {
          if (DEBUG_MODE) {
            console.log('[Calendar] Loaded bookings:', events.length);
            events.forEach(e => {
              console.log(`  Booking ${e.id}: ${e.start} - ${e.end}`);
            });
          }
          return events;
        }
      },
      {
        // Constraints source - background events
        id: 'constraints', 
        url: '/api/events',
        method: 'GET',
        extraParams: {
          type: 'constraint',
          store_id: storeId
        },
        display: 'background',  // Always render as background
        color: 'rgba(255, 0, 0, 0.2)',  // Red background for constraints
        failure: function(error) {
          console.error('[Calendar] Failed to load constraints:', error);
        },
        success: function(events) {
          if (DEBUG_MODE) {
            console.log('[Calendar] Loaded constraints:', events.length);
            events.forEach(e => {
              console.log(`  Constraint ${e.id}: ${e.start} - ${e.end}`);
            });
          }
          // Ensure all constraints have proper background display
          return events.map(e => ({
            ...e,
            display: 'background',
            allDay: false
          }));
        }
      }
    ],
    
    // Event click handler (only for bookings)
    eventClick: function(info) {
      const event = info.event;
      const props = event.extendedProps;
      
      // Only handle booking clicks
      if (props.type === 'booking') {
        showReservationDetails(props);
      }
    },
    
    // Date/time selection for new reservations
    dateClick: function(info) {
      openReservationModal(info.dateStr, storeId);
    },
    
    select: function(info) {
      openReservationModal(info.startStr, storeId, info.endStr);
    },
    
    selectable: true,
    selectMirror: true,
    
    // Event rendering customization
    eventDidMount: function(info) {
      const event = info.event;
      const props = event.extendedProps;
      
      if (props.type === 'constraint') {
        // Ensure constraints are non-interactive
        info.el.style.pointerEvents = 'none';
        info.el.style.opacity = '0.3';
      }
    }
  });
  
  calendar.render();
  return calendar;
}

/**
 * Create reservation with proper handling
 */
async function createReservationV3(formData, storeId) {
  // Generate unique idempotency key
  const idempotencyKey = generateUUID();
  
  // Ensure store_id is included
  const requestData = {
    ...formData,
    store_id: storeId
  };
  
  if (DEBUG_MODE) {
    console.log('[Reservation] Creating with data:', requestData);
    console.log('[Reservation] Idempotency-Key:', idempotencyKey);
  }
  
  try {
    const response = await fetch('/api/admin?action=create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey  // REQUIRED
      },
      body: JSON.stringify(requestData)
    });
    
    const result = await response.json();
    
    if (DEBUG_MODE) {
      console.log('[Reservation] Response status:', response.status);
      console.log('[Reservation] Response data:', result);
    }
    
    if (response.ok && result.success) {
      // Success - add event immediately
      if (calendar && result.reservation) {
        // Add the booking event immediately
        calendar.addEvent(result.reservation);
        
        // Refetch only constraints to ensure consistency
        refetchConstraints();
        
        if (DEBUG_MODE) {
          console.log('[Reservation] Added event:', result.reservation);
          console.log('[Reservation] Event UTC times:', {
            start: result.reservation.start,
            end: result.reservation.end
          });
        }
      }
      
      return { 
        success: true, 
        data: result,
        event: result.reservation
      };
      
    } else if (response.status === 409) {
      // Handle 409 conflicts
      if (result.error === 'duplicate_request') {
        return {
          success: false,
          error: 'duplicate_request',
          message: '重複したリクエストです。少しお待ちください。'
        };
      } else if (result.error === 'slot_taken') {
        return {
          success: false,
          error: 'slot_taken',
          message: 'この時間帯は既に予約されています。'
        };
      }
    }
    
    // Other errors
    return {
      success: false,
      error: result.error || 'unknown',
      message: result.message || '予約の作成に失敗しました。'
    };
    
  } catch (error) {
    console.error('[Reservation] Network error:', error);
    return {
      success: false,
      error: 'network',
      message: 'ネットワークエラーが発生しました。'
    };
  }
}

/**
 * Refetch only constraint events
 */
function refetchConstraints() {
  if (!calendar) return;
  
  // Get the constraints event source
  const sources = calendar.getEventSources();
  const constraintSource = sources.find(s => s.id === 'constraints');
  
  if (constraintSource) {
    constraintSource.refetch();
    if (DEBUG_MODE) {
      console.log('[Calendar] Refetched constraints');
    }
  }
}

/**
 * Refetch only booking events
 */
function refetchBookings() {
  if (!calendar) return;
  
  const sources = calendar.getEventSources();
  const bookingSource = sources.find(s => s.id === 'bookings');
  
  if (bookingSource) {
    bookingSource.refetch();
    if (DEBUG_MODE) {
      console.log('[Calendar] Refetched bookings');
    }
  }
}

/**
 * Refetch all events (both sources)
 */
function refetchAllEvents() {
  if (!calendar) return;
  
  calendar.refetchEvents();
  if (DEBUG_MODE) {
    console.log('[Calendar] Refetched all events');
  }
}

/**
 * Generate UUID v4
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get events by type (utility)
 */
function getEventsByType(type) {
  if (!calendar) return [];
  
  const allEvents = calendar.getEvents();
  return allEvents.filter(event => {
    return event.extendedProps && event.extendedProps.type === type;
  });
}

/**
 * Remove all events of a specific type (utility)
 */
function removeEventsByType(type) {
  if (!calendar) return;
  
  const events = getEventsByType(type);
  events.forEach(event => event.remove());
  
  if (DEBUG_MODE) {
    console.log(`[Calendar] Removed ${events.length} ${type} events`);
  }
}

/**
 * Open reservation modal (placeholder)
 */
function openReservationModal(startDate, storeId, endDate) {
  console.log('Open reservation modal:', { startDate, endDate, storeId });
  // Implement based on your UI
}

/**
 * Show reservation details (placeholder)
 */
function showReservationDetails(reservation) {
  console.log('Show reservation details:', reservation);
  // Implement based on your UI
}

// Export for global use
window.CalendarV3 = {
  init: initCalendarV3,
  createReservation: createReservationV3,
  refetchConstraints,
  refetchBookings,
  refetchAllEvents,
  getEventsByType,
  removeEventsByType,
  getCalendarInstance: () => calendar
};