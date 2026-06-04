import { v4 as uuidv4 } from 'uuid';
import { HEADER_DEFINITIONS } from '../config/schema';
import {
  readValues,
  readAllRows,
  updateRow,
  updateCell,
  appendRows,
  writeHeaders,
  addSheet,
} from './sheetsService';
import { GoogleApiRequestError } from './googleApi';
import { computeDueDate } from './billsService';
import type { RentCollection, RentDisplayStatus, RowWithIndex } from '../types';

// Re-export for convenience in Chunk 2/3
export { computeDueDate };
export { formatCurrency, formatMonth } from './billsService';

// --- Column index map derived from HEADER_DEFINITIONS ---

const TAB_NAME = 'RentCollections';
const TAB_DEF = HEADER_DEFINITIONS.find((d) => d.tabName === TAB_NAME)!;
const COL = Object.fromEntries(TAB_DEF.headers.map((h, i) => [h, i])) as Record<string, number>;

// --- Parse / Serialize ---

export function parseRow(row: RowWithIndex): RentCollection | null {
  const v = row.values;
  if (!v || v.length === 0) return null;
  const id = v[COL.id];
  if (!id) return null;

  return {
    _rowIndex: row.rowIndex,
    id,
    tenancyId: v[COL.tenancy_id] ?? '',
    month: v[COL.month] ?? '',
    expectedAmount: Number(v[COL.expected_amount]) || 0,
    dueDate: v[COL.due_date] ?? '',
    notes: v[COL.notes] ?? '',
    compositeKey: v[COL.composite_key] ?? '',
    createdAt: v[COL.created_at] ?? '',
    updatedAt: v[COL.updated_at] ?? '',
    deletedAt: v[COL.deleted_at] ?? '',
  };
}

export function serializeRow(collection: RentCollection): string[] {
  return [
    collection.id,
    collection.tenancyId,
    collection.month,
    String(collection.expectedAmount),
    collection.dueDate,
    collection.notes,
    collection.compositeKey,
    collection.createdAt,
    collection.updatedAt,
    collection.deletedAt,
  ];
}

// --- Ensure tab exists (lazy bootstrap) ---

export async function ensureRentCollectionsTab(
  accessToken: string,
  spreadsheetId: string,
): Promise<void> {
  try {
    const result = await readValues(
      accessToken,
      spreadsheetId,
      `'${TAB_NAME}'!A1:J1`,
    );
    if (!result?.values || result.values.length === 0) {
      await writeHeaders(accessToken, spreadsheetId, [TAB_DEF]);
    }
  } catch (error) {
    if (error instanceof GoogleApiRequestError && error.status === 400) {
      await addSheet(accessToken, spreadsheetId, TAB_NAME);
      await writeHeaders(accessToken, spreadsheetId, [TAB_DEF]);
    } else {
      throw error;
    }
  }
}

// --- Pure Helpers ---

/** Build composite key: tenancyId|YYYY-MM */
export function computeCompositeKey(tenancyId: string, month: string): string {
  return `${tenancyId}|${month}`;
}

/** Find a non-deleted duplicate by composite key. */
export function checkDuplicate(
  compositeKey: string,
  collections: RentCollection[],
  excludeId?: string,
): RentCollection | null {
  for (const coll of collections) {
    if (coll.compositeKey !== compositeKey) continue;
    if (excludeId && coll.id === excludeId) continue;
    if (coll.deletedAt !== '') continue;
    return coll;
  }
  return null;
}

/** Compute display status from payment sums + month-end threshold. */
export function computeRentStatus(
  expectedAmount: number,
  totalReceived: number,
  month: string,
  today?: string,
): RentDisplayStatus {
  const todayStr =
    today ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const [year, mon] = month.split('-').map(Number);
  const lastDayOfMonth = new Date(year, mon, 0).getDate();
  const monthEnd = `${year}-${String(mon).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
  const monthEnded = todayStr > monthEnd;

  if (totalReceived >= expectedAmount) return 'received';
  if (monthEnded) return 'overdue';
  if (totalReceived > 0) return 'partial';
  return 'pending';
}

// --- CRUD ---

export async function fetchRentCollections(
  accessToken: string,
  spreadsheetId: string,
): Promise<RentCollection[]> {
  const rows = await readAllRows(accessToken, spreadsheetId, TAB_NAME);
  const result: RentCollection[] = [];
  for (const row of rows) {
    const parsed = parseRow(row);
    if (parsed) {
      result.push(parsed);
    }
  }
  return result;
}

export async function addRentCollection(
  accessToken: string,
  spreadsheetId: string,
  data: {
    tenancyId: string;
    month: string;
    expectedAmount: number;
    rentDueDay: number;
    notes?: string;
  },
): Promise<RentCollection> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const dueDate = computeDueDate(data.month, data.rentDueDay);
  const compositeKey = computeCompositeKey(data.tenancyId, data.month);

  const collection: RentCollection = {
    _rowIndex: -1,
    id,
    tenancyId: data.tenancyId,
    month: data.month,
    expectedAmount: data.expectedAmount,
    dueDate,
    notes: data.notes ?? '',
    compositeKey,
    createdAt: now,
    updatedAt: now,
    deletedAt: '',
  };

  await appendRows(accessToken, spreadsheetId, TAB_NAME, [serializeRow(collection)]);
  return collection;
}

export async function updateRentCollection(
  accessToken: string,
  spreadsheetId: string,
  existing: RentCollection,
  data: Partial<{ expectedAmount: number; dueDate: string; notes: string }>,
): Promise<RentCollection> {
  const updated: RentCollection = {
    ...existing,
    expectedAmount: data.expectedAmount ?? existing.expectedAmount,
    dueDate: data.dueDate ?? existing.dueDate,
    notes: data.notes ?? existing.notes,
    updatedAt: new Date().toISOString(),
  };
  await updateRow(accessToken, spreadsheetId, TAB_NAME, existing._rowIndex, serializeRow(updated));
  return updated;
}

export async function softDeleteRentCollection(
  accessToken: string,
  spreadsheetId: string,
  collection: RentCollection,
): Promise<void> {
  const isoNow = new Date().toISOString();
  await updateCell(accessToken, spreadsheetId, TAB_NAME, collection._rowIndex, COL.deleted_at, isoNow);
}

export async function undoDeleteRentCollection(
  accessToken: string,
  spreadsheetId: string,
  collection: RentCollection,
): Promise<void> {
  await updateCell(accessToken, spreadsheetId, TAB_NAME, collection._rowIndex, COL.deleted_at, '');
}
