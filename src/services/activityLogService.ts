import { HEADER_DEFINITIONS } from '../config/schema';
import { readAllRows, appendRows } from './sheetsService';
import type { ActivityLogEntry, ActionType, ActivityEntityType, RowWithIndex } from '../types';

// --- Column index map derived from HEADER_DEFINITIONS ---

const TAB_NAME = 'ActivityLog';
const ACTIVITY_HEADERS = HEADER_DEFINITIONS.find(d => d.tabName === TAB_NAME)!.headers;
const COL = Object.fromEntries(ACTIVITY_HEADERS.map((h, i) => [h, i])) as Record<string, number>;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Format "2026-06-05" as "5 Jun" (no year — used for the fromDay in postpone summaries). */
export function formatShortDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

// --- Parse / Serialize ---

export function parseRow(row: RowWithIndex): ActivityLogEntry | null {
  const v = row.values;
  if (!v || v.length === 0) return null;
  const id = v[COL.id];
  if (!id) return null;

  return {
    _rowIndex: row.rowIndex,
    id,
    timestamp: v[COL.timestamp] ?? '',
    userEmail: v[COL.user_email] ?? '',
    action: (v[COL.action] ?? '') as ActionType,
    entityType: (v[COL.entity_type] ?? '') as ActivityEntityType,
    entityId: v[COL.entity_id] ?? '',
    summary: v[COL.summary] ?? '',
  };
}

export function serializeRow(entry: ActivityLogEntry): string[] {
  return [
    entry.id,
    entry.timestamp,
    entry.userEmail,
    entry.action,
    entry.entityType,
    entry.entityId,
    entry.summary,
  ];
}

// --- Read / Append ---

export async function fetchActivityLog(
  accessToken: string,
  spreadsheetId: string,
): Promise<ActivityLogEntry[]> {
  const rows = await readAllRows(accessToken, spreadsheetId, TAB_NAME);
  const entries: ActivityLogEntry[] = [];
  for (const row of rows) {
    const parsed = parseRow(row);
    if (parsed) {
      entries.push(parsed);
    }
  }
  // Sort by timestamp descending (newest first)
  entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return entries;
}

export async function appendActivityLog(
  accessToken: string,
  spreadsheetId: string,
  entry: Omit<ActivityLogEntry, '_rowIndex'>,
): Promise<void> {
  const row = serializeRow({ ...entry, _rowIndex: -1 });
  await appendRows(accessToken, spreadsheetId, TAB_NAME, [row]);
}

export async function appendActivityLogSafe(
  accessToken: string,
  spreadsheetId: string,
  entry: Omit<ActivityLogEntry, '_rowIndex'>,
): Promise<void> {
  try {
    await appendActivityLog(accessToken, spreadsheetId, entry);
  } catch (e) {
    console.warn('Activity log append failed:', e);
  }
}
