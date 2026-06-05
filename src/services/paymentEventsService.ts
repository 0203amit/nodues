import { v4 as uuidv4 } from 'uuid';
import { HEADER_DEFINITIONS } from '../config/schema';
import {
  readValues,
  readAllRows,
  updateCell,
  appendRows,
  writeHeaders,
  addSheet,
} from './sheetsService';
import { GoogleApiRequestError } from './googleApi';
import type { PaymentEvent, RowWithIndex } from '../types';

// --- Column index map derived from HEADER_DEFINITIONS ---

const TAB_NAME = 'PaymentEvents';
const TAB_DEF = HEADER_DEFINITIONS.find((d) => d.tabName === TAB_NAME)!;
const COL = Object.fromEntries(TAB_DEF.headers.map((h, i) => [h, i])) as Record<string, number>;

// --- Parse / Serialize ---

export function parseRow(row: RowWithIndex): PaymentEvent | null {
  const v = row.values;
  if (!v || v.length === 0) return null;
  const id = v[COL.id];
  if (!id) return null;

  return {
    _rowIndex: row.rowIndex,
    id,
    collectionId: v[COL.collection_id] ?? '',
    amount: Number(v[COL.amount]) || 0,
    paymentDate: v[COL.payment_date] ?? '',
    paymentMethod: v[COL.payment_method] ?? '',
    notes: v[COL.notes] ?? '',
    createdAt: v[COL.created_at] ?? '',
    updatedAt: v[COL.updated_at] ?? '',
    deletedAt: v[COL.deleted_at] ?? '',
    receiptFileId: v[COL.receipt_file_id] ?? '',
  };
}

export function serializeRow(event: PaymentEvent): string[] {
  return [
    event.id,
    event.collectionId,
    String(event.amount),
    event.paymentDate,
    event.paymentMethod,
    event.notes,
    event.createdAt,
    event.updatedAt,
    event.deletedAt,
    event.receiptFileId,
  ];
}

// --- Ensure tab exists (lazy bootstrap) ---

export async function ensurePaymentEventsTab(
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

// --- CRUD ---

export async function fetchPaymentEvents(
  accessToken: string,
  spreadsheetId: string,
): Promise<PaymentEvent[]> {
  const rows = await readAllRows(accessToken, spreadsheetId, TAB_NAME);
  const result: PaymentEvent[] = [];
  for (const row of rows) {
    const parsed = parseRow(row);
    if (parsed) {
      result.push(parsed);
    }
  }
  return result;
}

export async function addPaymentEvent(
  accessToken: string,
  spreadsheetId: string,
  data: {
    collectionId: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    notes: string;
  },
): Promise<PaymentEvent> {
  const id = uuidv4();
  const now = new Date().toISOString();

  const event: PaymentEvent = {
    _rowIndex: -1,
    id,
    collectionId: data.collectionId,
    amount: data.amount,
    paymentDate: data.paymentDate,
    paymentMethod: data.paymentMethod,
    notes: data.notes,
    createdAt: now,
    updatedAt: now,
    deletedAt: '',
    receiptFileId: '',
  };

  await appendRows(accessToken, spreadsheetId, TAB_NAME, [serializeRow(event)]);
  return event;
}

export async function softDeletePaymentEvent(
  accessToken: string,
  spreadsheetId: string,
  event: PaymentEvent,
): Promise<void> {
  const isoNow = new Date().toISOString();
  await updateCell(accessToken, spreadsheetId, TAB_NAME, event._rowIndex, COL.deleted_at, isoNow);
}

export async function undoDeletePaymentEvent(
  accessToken: string,
  spreadsheetId: string,
  event: PaymentEvent,
): Promise<void> {
  await updateCell(accessToken, spreadsheetId, TAB_NAME, event._rowIndex, COL.deleted_at, '');
}

// --- Receipt File ID ---

/** Set the receipt_file_id cell for a payment event. */
export async function setReceiptFileIdForPaymentEvent(
  accessToken: string,
  spreadsheetId: string,
  event: PaymentEvent,
  newFileId: string,
): Promise<void> {
  await updateCell(accessToken, spreadsheetId, TAB_NAME, event._rowIndex, COL.receipt_file_id, newFileId);
}

/** Clear the receipt_file_id cell for a payment event. */
export async function clearReceiptFileIdForPaymentEvent(
  accessToken: string,
  spreadsheetId: string,
  event: PaymentEvent,
): Promise<void> {
  await updateCell(accessToken, spreadsheetId, TAB_NAME, event._rowIndex, COL.receipt_file_id, '');
}
