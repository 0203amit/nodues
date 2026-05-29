/**
 * Contract: activityLogService.ts
 *
 * Mirrors postponeLogService.ts. Provides parse/serialize, fetch (read), and
 * append (write) for the ActivityLog sheet tab. Also exposes appendActivityLogSafe
 * which wraps append in a silent try/catch for best-effort call sites.
 */

import type { ActivityLogEntry, ActionType, ActivityEntityType, RowWithIndex } from '../../src/types';

// --- Column index map derived from HEADER_DEFINITIONS ---
// const TAB_NAME = 'ActivityLog';
// const ACTIVITY_HEADERS = HEADER_DEFINITIONS.find(d => d.tabName === TAB_NAME)!.headers;
// const COL = Object.fromEntries(ACTIVITY_HEADERS.map((h, i) => [h, i])) as Record<string, number>;

// --- Date helper for postpone summaries ---

/**
 * Format "2026-06-05" as "5 Jun" (no year).
 * Used for the fromDay side of postpone summaries.
 */
export declare function formatShortDate(dateStr: string): string;

// --- Parse / Serialize ---

/**
 * Parse a raw Sheet row into an ActivityLogEntry.
 * Returns null if the row is empty or has no id value (defensive null guard).
 *
 * Maps snake_case sheet columns to camelCase TS fields:
 *   user_email → userEmail
 *   entity_type → entityType
 *   entity_id → entityId
 */
export declare function parseRow(row: RowWithIndex): ActivityLogEntry | null;

/**
 * Serialize an ActivityLogEntry into a string[] matching HEADER_DEFINITIONS column order:
 * [id, timestamp, user_email, action, entity_type, entity_id, summary]
 */
export declare function serializeRow(entry: ActivityLogEntry): string[];

// --- Read ---

/**
 * Fetch all activity log entries, parse (skip nulls), sort by timestamp descending.
 * Returns newest-first.
 */
export declare function fetchActivityLog(
  accessToken: string,
  spreadsheetId: string,
): Promise<ActivityLogEntry[]>;

// --- Write ---

/**
 * Append a single activity log entry to the ActivityLog sheet tab.
 * Throws on failure (network error, API error, etc.).
 *
 * The entry's _rowIndex is ignored (set to -1 internally).
 */
export declare function appendActivityLog(
  accessToken: string,
  spreadsheetId: string,
  entry: Omit<ActivityLogEntry, '_rowIndex'>,
): Promise<void>;

/**
 * Best-effort wrapper around appendActivityLog.
 * Catches all errors and logs via console.warn.
 * NEVER throws. NEVER shows a toast.
 *
 * This is the function called by all CRUD handlers across the 5 entity pages.
 */
export declare function appendActivityLogSafe(
  accessToken: string,
  spreadsheetId: string,
  entry: Omit<ActivityLogEntry, '_rowIndex'>,
): Promise<void>;
