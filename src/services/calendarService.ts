import { googleApiFetch, withRetry } from './googleApi';

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
