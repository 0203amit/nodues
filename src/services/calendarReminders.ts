import { createAllDayEvent, deleteEvent } from './calendarService';

// --- Types ---

export interface ReminderResult {
  eventIds: string[];
  allSucceeded: boolean;
}

// --- CSV Helpers ---

/** Parse a comma-separated event ID string into an array. Handles empty/whitespace/double commas. */
export function parseEventIds(csv: string): string[] {
  if (!csv || !csv.trim()) return [];
  return csv.split(',').map(s => s.trim()).filter(Boolean);
}

/** Join an array of event IDs into a comma-separated string. Filters out empty values. */
export function serializeEventIds(ids: string[]): string {
  return ids.filter(Boolean).join(',');
}

// --- Date Helpers ---

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Compute a reminder date by subtracting offsetDays from a due date. Safe month/year rollover. */
export function computeReminderDate(dueDateStr: string, offsetDays: number): string {
  const [year, month, day] = dueDateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day - offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Compute the next day for a given YYYY-MM-DD date string. */
export function nextDay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Format "2026-06-05" as "5 Jun 2026" (unpadded day, abbreviated month). */
export function formatDueDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

// --- Calendar Orchestration ---

/**
 * Create reminder events on the NoDues Reminders calendar.
 * Sequential loop over offsets; partial failures are captured (allSucceeded=false).
 *
 * Accepts pre-built title and description strings — call sites are responsible
 * for constructing the appropriate format (bill-specific, todo-specific, etc.).
 */
export async function createReminders(
  accessToken: string,
  calendarId: string,
  dueDate: string,
  reminderOffsetsDays: number[],
  title: string,
  description: string,
): Promise<ReminderResult> {
  if (reminderOffsetsDays.length === 0) {
    return { eventIds: [], allSucceeded: true };
  }

  const eventIds: string[] = [];
  let allSucceeded = true;

  for (const offset of reminderOffsetsDays) {
    const reminderDate = computeReminderDate(dueDate, offset);
    try {
      const eventId = await createAllDayEvent(accessToken, calendarId, reminderDate, title, description);
      eventIds.push(eventId);
    } catch {
      allSucceeded = false;
    }
  }

  return { eventIds, allSucceeded };
}

/** Delete a list of calendar events (best-effort). Never throws. */
export async function cleanupReminders(
  accessToken: string,
  calendarId: string,
  eventIds: string[],
): Promise<void> {
  for (const eventId of eventIds) {
    try {
      await deleteEvent(accessToken, calendarId, eventId);
    } catch {
      // best-effort — swallow all errors
    }
  }
}
