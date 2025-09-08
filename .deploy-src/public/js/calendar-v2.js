/**
 * FullCalendar v2 Implementation with separated event sources
 */

let calendar = null;
const API_BASE = '/api/v2';
const DEBUG_MODE = localStorage.getItem('debug') === 'true';

/**
 * Initialize FullCalendar with separated event sources
 */
function initCalendarV2(elementId, storeId) {
  const calendarEl = document.getElementById(elementId);
  
  if (!calendarEl) {
    console.error('Calendar element not found:', elementId);
    return;
  }

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'ja',
    timeZone: 'Asia/Tokyo',  // Always use Asia/Tokyo for display
    height: 'auto',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    
    // Separated event sources
    eventSources: [
      {
        // Booking events source
        id: 'bookings',
        url: `${API_BASE}/reservations`,
        method: 'GET',
        extraParams: function() {
          return {
            storeId: storeId
          };
        },
        success: function(response) {
          if (DEBUG_MODE) {
            console.log('[Calendar] Loaded bookings:', response.reservations?.length || 0);
          }
          return response.reservations || [];
        },
        failure: function() {
          console.error('[Calendar] Failed to load bookings');
        }
      },
      {
        // Constraint events source (background)
        id: 'constraints',
        url: `${API_BASE}/constraints`,
        method: 'GET',
        extraParams: function() {
          return {
            storeId: storeId
          };
        },
        success: function(response) {
          if (DEBUG_MODE) {
            console.log('[Calendar] Loaded constraints:', response.constraints?.length || 0);
          }
          return response.constraints || [];
        },
        failure: function() {
          console.error('[Calendar] Failed to load constraints');
        }
      }
    ],
    
    // Event click handler
    eventClick: function(info) {
      const event = info.event;
      const props = event.extendedProps;
      
      if (props.type === 'booking') {
        showReservationDetails(props);
      }
      // Constraints are background events, no click handler
    },
    
    // Date click handler for new reservations
    dateClick: function(info) {
      openReservationModal(info.dateStr, storeId);
    },
    
    // Select handler for time slots
    select: function(info) {
      openReservationModal(info.startStr, storeId, info.endStr);
    },
    
    selectable: true,
    selectMirror: true,
    
    // Custom event rendering
    eventDidMount: function(info) {
      const event = info.event;
      const props = event.extendedProps;
      
      if (props.type === 'constraint') {
        // Style constraint backgrounds
        info.el.style.opacity = '0.3';
        info.el.style.pointerEvents = 'none';
      }
    }
  });
  
  calendar.render();
  return calendar;
}

/**
 * Create reservation with proper UTC handling
 */
async function createReservation(formData) {
  const idempotencyKey = generateIdempotencyKey();
  
  try {
    const response = await fetch(`${API_BASE}/reservations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(formData)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      // Success - add event immediately and refetch
      if (calendar && result.reservation) {
        // Add the new event immediately for instant feedback
        calendar.addEvent(result.reservation);
        
        // Refetch to ensure consistency
        await refetchCalendarEvents();
      }
      
      if (DEBUG_MODE) {
        console.log('[Reservation] Created:', {
          id: result.reservation?.id,
          start: result.reservation?.start,
          end: result.reservation?.end
        });
      }
      
      return { success: true, data: result };
    } else {
      // Handle different error types
      if (response.status === 409) {
        if (result.error === 'duplicate_request') {
          return {
            success: false,
            error: 'duplicate',
            message: '重複したリクエストです。少しお待ちください。'
          };
        } else if (result.error === 'slot_taken') {
          return {
            success: false,
            error: 'slot_taken',
            message: 'この時間帯は既に予約されています。'
          };
        } else if (result.error === 'capacity_exceeded') {
          return {
            success: false,
            error: 'capacity',
            message: result.message || '予約上限に達しています。'
          };
        }
      }
      
      return {
        success: false,
        error: result.error || 'unknown',
        message: result.message || '予約の作成に失敗しました。'
      };
    }
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
 * Refetch calendar events (both sources)
 */
async function refetchCalendarEvents() {
  if (!calendar) return;
  
  try {
    // Refetch all event sources
    await calendar.refetchEvents();
    
    if (DEBUG_MODE) {
      console.log('[Calendar] Events refetched');
    }
  } catch (error) {
    console.error('[Calendar] Refetch failed:', error);
  }
}

/**
 * Generate UUID v4 for idempotency key
 */
function generateIdempotencyKey() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Open reservation modal (placeholder - implement based on UI)
 */
function openReservationModal(startDate, storeId, endDate) {
  console.log('Open reservation modal:', { startDate, endDate, storeId });
  // Implement based on your modal UI
}

/**
 * Show reservation details (placeholder - implement based on UI)
 */
function showReservationDetails(reservation) {
  console.log('Show reservation details:', reservation);
  // Implement based on your modal UI
}

/**
 * Utility: Get calendar events by type
 */
function getEventsByType(type) {
  if (!calendar) return [];
  
  const allEvents = calendar.getEvents();
  return allEvents.filter(event => event.extendedProps.type === type);
}

/**
 * Utility: Remove all events of a specific type
 */
function removeEventsByType(type) {
  if (!calendar) return;
  
  const events = getEventsByType(type);
  events.forEach(event => event.remove());
}

/**
 * Utility: Update constraint visibility
 */
function setConstraintVisibility(visible) {
  if (!calendar) return;
  
  const constraints = getEventsByType('constraint');
  constraints.forEach(event => {
    event.setProp('display', visible ? 'background' : 'none');
  });
}

// Export for use in other modules
window.CalendarV2 = {
  init: initCalendarV2,
  createReservation,
  refetchEvents: refetchCalendarEvents,
  getEventsByType,
  removeEventsByType,
  setConstraintVisibility,
  getCalendarInstance: () => calendar
};