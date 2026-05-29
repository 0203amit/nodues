import { googleApiFetch, GoogleApiRequestError, withRetry } from './googleApi';

// --- Types ---

export interface GoogleCalendar {
  id: string;
  summary: string;
  timeZone?: string;
}

interface CalendarListResponse {
  items?: Array<GoogleCalendar & { deleted?: boolean }>;
  nextPageToken?: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: { date: string };
  end: { date: string };
}

// --- Constants ---

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

// --- Functions ---

/**
 * Find a calendar by summary name. Returns null if not found.
 *
 * If a user already has a calendar with the given name (whether created by
 * this app previously or manually), the first match is reused. This is
 * acceptable for a personal/household app.
 */
export async function findCalendar(
  accessToken: string,
  summary: string,
): Promise<GoogleCalendar | null> {
  let pageToken: string | undefined;

  do {
    const url = pageToken
      ? `${CALENDAR_API}/users/me/calendarList?pageToken=${encodeURIComponent(pageToken)}`
      : `${CALENDAR_API}/users/me/calendarList`;

    const result = await withRetry(() =>
      googleApiFetch<CalendarListResponse>(accessToken, url),
    );

    const match = result.items?.find(
      (cal) => cal.summary === summary && !cal.deleted,
    );
    if (match) {
      return { id: match.id, summary: match.summary, timeZone: match.timeZone };
    }

    pageToken = result.nextPageToken;
  } while (pageToken);

  return null;
}

/** Create a secondary calendar. Returns the created calendar. */
export async function createCalendar(
  accessToken: string,
  summary: string,
  timeZone: string,
): Promise<GoogleCalendar> {
  return withRetry(() =>
    googleApiFetch<GoogleCalendar>(accessToken, `${CALENDAR_API}/calendars`, {
      method: 'POST',
      body: { summary, timeZone },
    }),
  );
}

/**
 * Create a single all-day event on the specified calendar.
 * end.date is exclusive — set to the day after start.date for a single-day event.
 * Returns the created event's ID.
 */
export async function createAllDayEvent(
  accessToken: string,
  calendarId: string,
  dateYYYYMMDD: string,
  title: string,
  description: string,
): Promise<string> {
  // Compute next day inline (no cross-service import)
  const [y, m, d] = dateYYYYMMDD.split('-').map(Number);
  const nd = new Date(y, m - 1, d + 1);
  const nextDayStr = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}-${String(nd.getDate()).padStart(2, '0')}`;

  const url = `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`;
  const event = await withRetry(() =>
    googleApiFetch<GoogleCalendarEvent>(accessToken, url, {
      method: 'POST',
      body: {
        summary: title,
        description,
        start: { date: dateYYYYMMDD },
        end: { date: nextDayStr },
        reminders: {
          useDefault: false,
          overrides: [{ method: 'popup', minutes: 0 }],
        },
      },
    }),
  );
  return event.id;
}

/**
 * Delete a calendar event by ID.
 * 404/410 → return silently (event already gone). Other errors are re-thrown.
 */
export async function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  const url = `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
  try {
    await withRetry(() =>
      googleApiFetch(accessToken, url, { method: 'DELETE' }),
    );
  } catch (error) {
    if (
      error instanceof GoogleApiRequestError &&
      (error.status === 404 || error.status === 410)
    ) {
      return; // already gone
    }
    throw error;
  }
}
