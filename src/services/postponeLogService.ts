import { HEADER_DEFINITIONS } from '../config/schema';
import { readAllRows, appendRows } from './sheetsService';
import type { PostponeLogEntry, RowWithIndex } from '../types';

// --- Column index map derived from HEADER_DEFINITIONS ---

const TAB_NAME = 'PostponeLog';
const POSTPONE_HEADERS = HEADER_DEFINITIONS.find((d) => d.tabName === TAB_NAME)!.headers;
const COL = Object.fromEntries(POSTPONE_HEADERS.map((h, i) => [h, i])) as Record<string, number>;

// --- Parse / Serialize ---

export function parseRow(row: RowWithIndex): PostponeLogEntry | null {
  const v = row.values;
  if (!v || v.length === 0) return null;
  const id = v[COL.id];
  if (!id) return null;

  return {
    _rowIndex: row.rowIndex,
    id,
    itemType: v[COL.item_type] ?? '',
    itemId: v[COL.item_id] ?? '',
    fromDate: v[COL.from_date] ?? '',
    toDate: v[COL.to_date] ?? '',
    reason: v[COL.reason] ?? '',
    postponedBy: v[COL.postponed_by] ?? '',
    postponedAt: v[COL.postponed_at] ?? '',
  };
}

export function serializeRow(entry: PostponeLogEntry): string[] {
  return [
    entry.id,
    entry.itemType,
    entry.itemId,
    entry.fromDate,
    entry.toDate,
    entry.reason,
    entry.postponedBy,
    entry.postponedAt,
  ];
}

// --- Read / Append ---

export async function fetchPostponeLog(
  accessToken: string,
  spreadsheetId: string,
): Promise<PostponeLogEntry[]> {
  const rows = await readAllRows(accessToken, spreadsheetId, TAB_NAME);
  const entries: PostponeLogEntry[] = [];
  for (const row of rows) {
    const parsed = parseRow(row);
    if (parsed) {
      entries.push(parsed);
    }
  }
  // Sort by postponedAt descending (most recent first)
  entries.sort((a, b) => b.postponedAt.localeCompare(a.postponedAt));
  return entries;
}

export async function appendPostponeLog(
  accessToken: string,
  spreadsheetId: string,
  entry: Omit<PostponeLogEntry, '_rowIndex'>,
): Promise<void> {
  const row = serializeRow({ ...entry, _rowIndex: -1 });
  await appendRows(accessToken, spreadsheetId, TAB_NAME, [row]);
}
