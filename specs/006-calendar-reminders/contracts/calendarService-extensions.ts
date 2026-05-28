/**
 * Contract: calendarService.ts Extensions for Calendar Reminders
 *
 * New functions to add to the existing calendarService.ts.
 * These extend the calendar service with event CRUD operations,
 * complementing the existing findCalendar/createCalendar functions.
 *
 * Both functions use the existing googleApiFetch + withRetry pattern.
 */

// --- Types ---

/** Minimal Google Calendar Event resource (insert response). */
export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: { date: string };
  end: { date: string };
}

// --- Functions ---

/**
 * Create a single all-day event on the specified calendar.
 *
 * The event spans a single day: start.date = dateYYYYMMDD,
 * end.date = day after dateYYYYMMDD (exclusive end per Google Calendar API).
 *
 * Reminder override: reminders.useDefault = false,
 * overrides = [{ method: 'popup', minutes: 0 }] (fires at midnight on event day).
 *
 * @param accessToken - OAuth2 access token with calendar scope
 * @param calendarId  - Google Calendar ID (from SetupResult.calendarId)
 * @param dateYYYYMMDD - Event date in YYYY-MM-DD format
 * @param title       - Event summary (e.g., "Maintenance — Mira Flat due 5 Jun 2026")
 * @param description - Event description (month + optional amount)
 * @returns The created event's ID (string)
 *
 * Uses: withRetry(googleApiFetch) → POST /calendar/v3/calendars/{calendarId}/events
 * Throws: GoogleApiRequestError on non-retryable failure
 */
export declare function createAllDayEvent(
  accessToken: string,
  calendarId: string,
  dateYYYYMMDD: string,
  title: string,
  description: string,
): Promise<string>;

/**
 * Delete a calendar event by ID.
 *
 * If the event is already gone (404 or 410), this succeeds silently.
 * Other errors are propagated (after retry via withRetry).
 *
 * @param accessToken - OAuth2 access token with calendar scope
 * @param calendarId  - Google Calendar ID
 * @param eventId     - Google Calendar event ID to delete
 *
 * Uses: withRetry(googleApiFetch) → DELETE /calendar/v3/calendars/{calendarId}/events/{eventId}
 * Returns: void (204 No Content on success)
 * Silently succeeds on: 404 (Not Found), 410 (Gone)
 * Throws: GoogleApiRequestError on other non-retryable failures
 */
export declare function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<void>;
