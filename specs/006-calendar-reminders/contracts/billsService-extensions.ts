/**
 * Contract: billsService.ts Extensions for Calendar Reminders
 *
 * New functions to add to the existing billsService.ts.
 * Grouped into: event-ID helpers, pure date helpers, full-row-safety
 * setter, and calendar orchestration functions.
 */

import type { Bill } from '../../src/types';

// =====================================================================
// 1. Event ID Helpers (aliases for parseFileIds / serializeFileIds)
// =====================================================================

/**
 * Parse a comma-separated event ID string into an array.
 * Handles empty strings, whitespace, and double commas.
 * Alias for parseFileIds — identical CSV format.
 */
export declare const parseEventIds: (csv: string) => string[];

/**
 * Join an array of event IDs into a comma-separated string.
 * Filters out empty values.
 * Alias for serializeFileIds — identical CSV format.
 */
export declare const serializeEventIds: (ids: string[]) => string;

// =====================================================================
// 2. Pure Date Helpers
// =====================================================================

/**
 * Compute a reminder date by subtracting offsetDays from a due date.
 * Uses JavaScript Date constructor for safe month/year rollover.
 *
 * @param dueDateStr  - Due date in YYYY-MM-DD format
 * @param offsetDays  - Number of days before due date (e.g., 7, 3, 1)
 * @returns Reminder date in YYYY-MM-DD format
 *
 * Examples:
 *   computeReminderDate("2026-06-15", 7)  → "2026-06-08"
 *   computeReminderDate("2026-06-05", 7)  → "2026-05-29"  (month rollover)
 *   computeReminderDate("2026-01-03", 7)  → "2025-12-27"  (year rollover)
 *   computeReminderDate("2026-06-15", 0)  → "2026-06-15"  (same-day reminder)
 */
export declare function computeReminderDate(dueDateStr: string, offsetDays: number): string;

/**
 * Compute the next day for a given date string.
 * Used to set end.date for all-day events (Google Calendar exclusive end).
 *
 * @param dateStr - Date in YYYY-MM-DD format
 * @returns Next day in YYYY-MM-DD format
 *
 * Examples:
 *   nextDay("2026-06-08") → "2026-06-09"
 *   nextDay("2026-06-30") → "2026-07-01"
 *   nextDay("2026-12-31") → "2027-01-01"
 */
export declare function nextDay(dateStr: string): string;

/**
 * Format a YYYY-MM-DD date string as "D MMM YYYY" for event titles.
 * Day is unpadded (no leading zero).
 *
 * @param dateStr - Date in YYYY-MM-DD format
 * @returns Formatted date string (e.g., "5 Jun 2026")
 *
 * Examples:
 *   formatDueDate("2026-06-05") → "5 Jun 2026"
 *   formatDueDate("2026-12-25") → "25 Dec 2026"
 */
export declare function formatDueDate(dateStr: string): string;

// =====================================================================
// 3. Full-Row-Safety Setter for calendar_event_ids
// =====================================================================

/**
 * Replace a bill's calendar_event_ids with a new set of IDs.
 * Uses full-row-safety: spread existing bill, overwrite calendarEventIds,
 * bump updatedAt, write full row via updateRow.
 *
 * Pass an empty array to clear all event IDs.
 *
 * @param accessToken   - OAuth2 access token
 * @param spreadsheetId - Google Sheets spreadsheet ID
 * @param bill          - Existing bill (must have valid _rowIndex)
 * @param eventIds      - New event IDs (empty array to clear)
 * @returns Updated Bill object with new calendarEventIds and updatedAt
 *
 * Pattern: mirrors addFileIdToBill / removeFileIdFromBill
 */
export declare function setCalendarEventIds(
  accessToken: string,
  spreadsheetId: string,
  bill: Bill,
  eventIds: string[],
): Promise<Bill>;

// =====================================================================
// 4. Calendar Orchestration
// =====================================================================

/** Result of a createReminders call. */
export interface ReminderResult {
  /** IDs of successfully created calendar events. May be partial on failure. */
  eventIds: string[];
  /** true if all events were created successfully; false on any failure. */
  allSucceeded: boolean;
}

/**
 * Create reminder events for a bill on the NoDues Reminders calendar.
 *
 * For each offset in reminderOffsetsDays, computes the reminder date
 * (dueDate - offset days), then creates an all-day event via
 * calendarService.createAllDayEvent.
 *
 * Events are created sequentially. On partial failure, already-created
 * event IDs are preserved in the result. The function never throws —
 * all errors are caught and reflected in allSucceeded.
 *
 * If reminderOffsetsDays is empty, returns { eventIds: [], allSucceeded: true }.
 *
 * Event title format: "{billTypeName} — {propertyName} due {D MMM YYYY}"
 * Event description: "Month: {MMM YYYY}" + optional "\nAmount: {formatted INR}"
 *
 * @param accessToken         - OAuth2 access token
 * @param calendarId          - NoDues Reminders calendar ID
 * @param dueDate             - Bill due date (YYYY-MM-DD)
 * @param reminderOffsetsDays - Array of day offsets (e.g., [7, 3, 1])
 * @param billTypeName        - Bill type display name (e.g., "Maintenance")
 * @param propertyName        - Property display name (e.g., "Mira Flat")
 * @param amount              - Bill amount (null if unknown)
 * @param month               - Bill month (YYYY-MM, for description)
 * @returns ReminderResult with created event IDs and success flag
 */
export declare function createReminders(
  accessToken: string,
  calendarId: string,
  dueDate: string,
  reminderOffsetsDays: number[],
  billTypeName: string,
  propertyName: string,
  amount: number | null,
  month: string,
): Promise<ReminderResult>;

/**
 * Delete a list of calendar events (best-effort cleanup).
 *
 * Iterates through eventIds and calls calendarService.deleteEvent for each.
 * 404/410 responses are silently tolerated (event already gone).
 * Other errors are caught and logged but never thrown — cleanup is
 * best-effort and must not block the calling operation.
 *
 * @param accessToken - OAuth2 access token
 * @param calendarId  - NoDues Reminders calendar ID
 * @param eventIds    - Array of Google Calendar event IDs to delete
 */
export declare function cleanupReminders(
  accessToken: string,
  calendarId: string,
  eventIds: string[],
): Promise<void>;
