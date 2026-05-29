import { HEADER_DEFINITIONS } from '../config/schema';
import { readAllRows } from './sheetsService';
import type { RecurrencePattern, RowWithIndex } from '../types';

// --- Column index map derived from HEADER_DEFINITIONS ---

const TAB_NAME = 'RecurrencePatterns';
const PATTERN_HEADERS = HEADER_DEFINITIONS.find((d) => d.tabName === TAB_NAME)!.headers;
const COL = Object.fromEntries(PATTERN_HEADERS.map((h, i) => [h, i])) as Record<string, number>;

// --- Parse ---

export function parseRow(row: RowWithIndex): RecurrencePattern | null {
  const v = row.values;
  if (!v || v.length === 0) return null;
  const id = v[COL.id];
  if (!id) return null;

  const intervalValue = parseInt(v[COL.interval_value] ?? '0', 10);
  const anchorDayStr = v[COL.anchor_day] ?? '';

  return {
    _rowIndex: row.rowIndex,
    id,
    name: v[COL.name] ?? '',
    intervalValue: isNaN(intervalValue) ? 0 : intervalValue,
    intervalUnit: v[COL.interval_unit] ?? '',
    anchorDay: anchorDayStr === '' ? null : parseInt(anchorDayStr, 10),
    endCondition: v[COL.end_condition] ?? 'never',
    endValue: v[COL.end_value] ?? '',
    active: v[COL.active] !== 'false',
  };
}

// --- Fetch ---

export async function fetchRecurrencePatterns(
  accessToken: string,
  spreadsheetId: string,
): Promise<RecurrencePattern[]> {
  const rows = await readAllRows(accessToken, spreadsheetId, TAB_NAME);
  const patterns: RecurrencePattern[] = [];
  for (const row of rows) {
    const parsed = parseRow(row);
    if (parsed && parsed.active) {
      patterns.push(parsed);
    }
  }
  return patterns;
}

// --- Next Due Date ---

/**
 * Compute the next due date given a current due date and recurrence interval.
 * Pure function — no side effects.
 *
 * Verification examples (DD-002):
 *   Every 1 month,  2026-01-31              → 2026-02-28 (Feb has 28 days)
 *   Every 1 month,  2026-03-31              → 2026-04-30 (Apr has 30 days)
 *   Every 3 months, 2026-05-15              → 2026-08-15
 *   Every 1 year,   2024-02-29              → 2025-02-28 (non-leap year)
 *   Every 6 months, 2026-01-31, anchor_day=31 → 2026-07-31
 */
export function computeNextDueDate(
  currentDueDate: string,
  intervalValue: number,
  intervalUnit: string,
  anchorDay: number | null,
): string {
  if (!currentDueDate || intervalValue <= 0) return '';

  const [year, month, day] = currentDueDate.split('-').map(Number);

  switch (intervalUnit) {
    case 'days': {
      const d = new Date(year, month - 1, day + intervalValue);
      return formatYMD(d);
    }
    case 'weeks': {
      const d = new Date(year, month - 1, day + intervalValue * 7);
      return formatYMD(d);
    }
    case 'months': {
      const targetMonth = month - 1 + intervalValue; // 0-indexed
      const targetYear = year + Math.floor(targetMonth / 12);
      const targetMon = (targetMonth % 12) + 1; // back to 1-indexed
      const targetDay = anchorDay ?? day;
      const lastDay = new Date(targetYear, targetMon, 0).getDate();
      const clampedDay = Math.min(targetDay, lastDay);
      return `${targetYear}-${String(targetMon).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
    }
    case 'years': {
      const targetYear = year + intervalValue;
      const targetDay = anchorDay ?? day;
      const lastDay = new Date(targetYear, month, 0).getDate();
      const clampedDay = Math.min(targetDay, lastDay);
      return `${targetYear}-${String(month).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
    }
    default:
      return '';
  }
}

// --- Helpers ---

function formatYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
