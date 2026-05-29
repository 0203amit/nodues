import { v4 as uuidv4 } from 'uuid';
import { HEADER_DEFINITIONS } from '../config/schema';
import { readAllRows, updateRow, updateCell, appendRows } from './sheetsService';
import { createAllDayEvent, deleteEvent } from './calendarService';
import type {
  Bill,
  BillDisplayStatus,
  BillFormData,
  BillStatus,
  BillWithDisplay,
  MarkPaidFormData,
  RowWithIndex,
} from '../types';

// --- Column index map derived from HEADER_DEFINITIONS ---

const TAB_NAME = 'Bills';
const BILL_HEADERS = HEADER_DEFINITIONS.find((d) => d.tabName === TAB_NAME)!.headers;
const COL = Object.fromEntries(BILL_HEADERS.map((h, i) => [h, i])) as Record<string, number>;

// --- Pure Helpers ---

/** Compute display status from stored status + due date vs today (IST-aware). */
export function computeDisplayStatus(
  status: BillStatus,
  dueDate: string,
  today?: string,
): BillDisplayStatus {
  if (status === 'paid') return 'paid';
  if (status === 'skipped') return 'skipped';
  if (status === 'not_yet_generated') return 'not_yet_generated';
  // status === 'pending'
  const todayStr =
    today ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (dueDate && dueDate < todayStr) return 'overdue';
  return 'pending';
}

/** Compute due date from YYYY-MM month + default due day with last-day clamping. */
export function computeDueDate(month: string, defaultDueDay: number | null): string {
  if (!month || defaultDueDay === null) return '';
  const [year, mon] = month.split('-').map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  const clampedDay = Math.min(defaultDueDay, lastDay);
  return `${year}-${String(mon).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

/** Compute composite key: propertyId|billTypeId|month. */
export function computeCompositeKey(
  propertyId: string,
  billTypeId: string,
  month: string,
): string {
  return propertyId + '|' + billTypeId + '|' + month;
}

/** Sort bills by display status priority, then secondary sort within each status. */
export function sortBills(bills: BillWithDisplay[]): BillWithDisplay[] {
  const STATUS_PRIORITY: Record<BillDisplayStatus, number> = {
    overdue: 0,
    pending: 1,
    not_yet_generated: 2,
    paid: 3,
    skipped: 4,
  };

  return [...bills].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.displayStatus];
    const pb = STATUS_PRIORITY[b.displayStatus];
    if (pa !== pb) return pa - pb;

    switch (a.displayStatus) {
      case 'overdue':
        return (a.dueDate || '').localeCompare(b.dueDate || '');
      case 'pending':
        return (a.dueDate || '').localeCompare(b.dueDate || '');
      case 'not_yet_generated':
        return (a.month || '').localeCompare(b.month || '');
      case 'paid':
        return (b.paidDate || '').localeCompare(a.paidDate || '');
      case 'skipped':
        return (b.month || '').localeCompare(a.month || '');
      default:
        return 0;
    }
  });
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Format "2026-06" as "Jun 2026". */
export function formatMonth(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  return `${MONTHS[mon - 1]} ${year}`;
}

/** Format amount as INR currency string. */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Parse a comma-separated file ID string into an array. Handles empty/whitespace/double commas. */
export function parseFileIds(csv: string): string[] {
  if (!csv || !csv.trim()) return [];
  return csv.split(',').map(s => s.trim()).filter(Boolean);
}

/** Join an array of file IDs into a comma-separated string. Filters out empty values. */
export function serializeFileIds(ids: string[]): string {
  return ids.filter(Boolean).join(',');
}

// --- Calendar Helpers ---

/** Parse a comma-separated event ID string into an array. Alias for parseFileIds. */
export const parseEventIds = parseFileIds;

/** Join an array of event IDs into a comma-separated string. Alias for serializeFileIds. */
export const serializeEventIds = serializeFileIds;

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

// --- Parse / Serialize ---

const VALID_STATUSES: string[] = ['pending', 'paid', 'not_yet_generated', 'skipped'];

export function parseRow(row: RowWithIndex): Bill | null {
  const v = row.values;
  if (!v || v.length === 0) return null;
  const id = v[COL.id];
  if (!id) return null;

  const amountStr = v[COL.amount] ?? '';
  const rawStatus = v[COL.status] ?? 'pending';
  const status: BillStatus = VALID_STATUSES.includes(rawStatus)
    ? (rawStatus as BillStatus)
    : 'pending';

  return {
    _rowIndex: row.rowIndex,
    id,
    billTypeId: v[COL.bill_type_id] ?? '',
    month: v[COL.month] ?? '',
    amount: amountStr === '' ? null : Number(amountStr),
    dueDate: v[COL.due_date] ?? '',
    originalDueDate: v[COL.original_due_date] ?? '',
    status,
    paidDate: v[COL.paid_date] ?? '',
    paymentMethod: v[COL.payment_method] ?? '',
    transactionRef: v[COL.transaction_ref] ?? '',
    billFileIds: v[COL.bill_file_ids] ?? '',
    receiptFileIds: v[COL.receipt_file_ids] ?? '',
    calendarEventIds: v[COL.calendar_event_ids] ?? '',
    notes: v[COL.notes] ?? '',
    createdAt: v[COL.created_at] ?? '',
    updatedAt: v[COL.updated_at] ?? '',
    deletedAt: v[COL.deleted_at] ?? '',
    compositeKey: v[COL.composite_key] ?? '',
  };
}

export function serializeRow(bill: Bill): string[] {
  return [
    bill.id,
    bill.billTypeId,
    bill.month,
    bill.amount === null ? '' : String(bill.amount),
    bill.dueDate,
    bill.originalDueDate,
    bill.status,
    bill.paidDate,
    bill.paymentMethod,
    bill.transactionRef,
    bill.billFileIds,
    bill.receiptFileIds,
    bill.calendarEventIds,
    bill.notes,
    bill.createdAt,
    bill.updatedAt,
    bill.deletedAt,
    bill.compositeKey,
  ];
}

// --- Duplicate Check ---

/** Check for a duplicate bill by composite_key among non-deleted bills. */
export function checkDuplicate(
  compositeKey: string,
  bills: BillWithDisplay[],
  excludeBillId?: string,
): BillWithDisplay | null {
  for (const bill of bills) {
    if (bill.compositeKey !== compositeKey) continue;
    if (excludeBillId && bill.id === excludeBillId) continue;
    if (bill.deletedAt !== '') continue;
    return bill;
  }
  return null;
}

// --- CRUD ---

/** Fetch all non-deleted bills, enriched with resolved names and display status. */
export async function fetchBills(
  accessToken: string,
  spreadsheetId: string,
  billTypeMap: Map<string, { name: string; propertyId: string; propertyName: string }>,
): Promise<BillWithDisplay[]> {
  const rows = await readAllRows(accessToken, spreadsheetId, TAB_NAME);
  const result: BillWithDisplay[] = [];

  for (const row of rows) {
    const parsed = parseRow(row);
    if (!parsed || parsed.deletedAt !== '') continue;

    const btInfo = billTypeMap.get(parsed.billTypeId);
    result.push({
      ...parsed,
      billTypeName: btInfo?.name ?? 'Unknown',
      propertyName: btInfo?.propertyName ?? 'Unknown',
      propertyId: btInfo?.propertyId ?? '',
      displayStatus: computeDisplayStatus(parsed.status, parsed.dueDate),
    });
  }

  return sortBills(result);
}

/** Add a new bill. Generates UUID, computes status and composite key, appends row. */
export async function addBill(
  accessToken: string,
  spreadsheetId: string,
  data: BillFormData,
  propertyId: string,
): Promise<Bill> {
  const id = uuidv4();
  const parsedAmount = data.amount.trim() === '' ? null : Number(data.amount);
  const status: BillStatus = data.dueDate !== '' ? 'pending' : 'not_yet_generated';
  const now = new Date().toISOString();
  const compositeKey = computeCompositeKey(propertyId, data.billTypeId, data.month);

  const bill: Bill = {
    _rowIndex: -1,
    id,
    billTypeId: data.billTypeId,
    month: data.month,
    amount: parsedAmount,
    dueDate: data.dueDate,
    originalDueDate: data.dueDate,
    status,
    paidDate: '',
    paymentMethod: '',
    transactionRef: '',
    billFileIds: '',
    receiptFileIds: '',
    calendarEventIds: '',
    notes: data.notes,
    createdAt: now,
    updatedAt: now,
    deletedAt: '',
    compositeKey,
  };

  await appendRows(accessToken, spreadsheetId, TAB_NAME, [serializeRow(bill)]);
  return bill;
}

/** Update a bill's editable fields with full-row-safety. */
export async function updateBill(
  accessToken: string,
  spreadsheetId: string,
  existingBill: Bill,
  data: BillFormData,
  propertyId: string,
): Promise<Bill> {
  const parsedAmount = data.amount.trim() === '' ? null : Number(data.amount);
  const newCompositeKey = computeCompositeKey(propertyId, data.billTypeId, data.month);

  // Auto-flip status based on dueDate (sole driver of pending vs not_yet_generated)
  let newStatus = existingBill.status;
  if (existingBill.status === 'not_yet_generated' && data.dueDate !== '') {
    newStatus = 'pending';
  } else if (existingBill.status === 'pending' && data.dueDate === '') {
    newStatus = 'not_yet_generated';
  }

  // Auto-set originalDueDate if previously empty and dueDate now provided
  const newOriginalDueDate =
    existingBill.originalDueDate === '' && data.dueDate !== ''
      ? data.dueDate
      : existingBill.originalDueDate;

  const updatedBill: Bill = {
    ...existingBill,
    month: data.month,
    amount: parsedAmount,
    dueDate: data.dueDate,
    notes: data.notes,
    status: newStatus,
    originalDueDate: newOriginalDueDate,
    compositeKey: newCompositeKey,
    updatedAt: new Date().toISOString(),
  };

  await updateRow(
    accessToken,
    spreadsheetId,
    TAB_NAME,
    existingBill._rowIndex,
    serializeRow(updatedBill),
  );
  return updatedBill;
}

/** Mark a bill as paid with full-row-safety. */
export async function markBillPaid(
  accessToken: string,
  spreadsheetId: string,
  existingBill: Bill,
  data: MarkPaidFormData,
): Promise<Bill> {
  const paidBill: Bill = {
    ...existingBill,
    status: 'paid',
    paidDate: data.paidDate,
    paymentMethod: data.paymentMethod,
    transactionRef: data.transactionRef,
    updatedAt: new Date().toISOString(),
  };

  await updateRow(
    accessToken,
    spreadsheetId,
    TAB_NAME,
    existingBill._rowIndex,
    serializeRow(paidBill),
  );
  return paidBill;
}

/** Soft-delete a bill by setting deleted_at to current ISO timestamp. */
export async function softDeleteBill(
  accessToken: string,
  spreadsheetId: string,
  bill: Bill,
): Promise<void> {
  const isoNow = new Date().toISOString();
  await updateCell(accessToken, spreadsheetId, TAB_NAME, bill._rowIndex, COL.deleted_at, isoNow);
}

/** Undo a soft-delete by clearing deleted_at. */
export async function undoDeleteBill(
  accessToken: string,
  spreadsheetId: string,
  bill: Bill,
): Promise<void> {
  await updateCell(accessToken, spreadsheetId, TAB_NAME, bill._rowIndex, COL.deleted_at, '');
}

/** Append a Drive file ID to a bill's file column with full-row-safety. */
export async function addFileIdToBill(
  accessToken: string,
  spreadsheetId: string,
  bill: Bill,
  fileId: string,
  column: 'bill_file_ids' | 'receipt_file_ids',
): Promise<Bill> {
  const fieldKey = column === 'bill_file_ids' ? 'billFileIds' : 'receiptFileIds';
  const existingIds = parseFileIds(bill[fieldKey]);
  existingIds.push(fileId);

  const updatedBill: Bill = {
    ...bill,
    [fieldKey]: serializeFileIds(existingIds),
    updatedAt: new Date().toISOString(),
  };

  await updateRow(accessToken, spreadsheetId, TAB_NAME, bill._rowIndex, serializeRow(updatedBill));
  return updatedBill;
}

/** Remove a Drive file ID from a bill's file column with full-row-safety. */
export async function removeFileIdFromBill(
  accessToken: string,
  spreadsheetId: string,
  bill: Bill,
  fileId: string,
  column: 'bill_file_ids' | 'receipt_file_ids',
): Promise<Bill> {
  const fieldKey = column === 'bill_file_ids' ? 'billFileIds' : 'receiptFileIds';
  const existingIds = parseFileIds(bill[fieldKey]);
  const filtered = existingIds.filter(id => id !== fileId);

  const updatedBill: Bill = {
    ...bill,
    [fieldKey]: serializeFileIds(filtered),
    updatedAt: new Date().toISOString(),
  };

  await updateRow(accessToken, spreadsheetId, TAB_NAME, bill._rowIndex, serializeRow(updatedBill));
  return updatedBill;
}

// --- Calendar Event ID Setter ---

/** Replace a bill's calendarEventIds with full-row-safety. Pass [] to clear. */
export async function setCalendarEventIds(
  accessToken: string,
  spreadsheetId: string,
  bill: Bill,
  eventIds: string[],
): Promise<Bill> {
  const updatedBill: Bill = {
    ...bill,
    calendarEventIds: serializeEventIds(eventIds),
    updatedAt: new Date().toISOString(),
  };
  await updateRow(accessToken, spreadsheetId, TAB_NAME, bill._rowIndex, serializeRow(updatedBill));
  return updatedBill;
}

// --- Calendar Orchestration ---

export interface ReminderResult {
  eventIds: string[];
  allSucceeded: boolean;
}

/**
 * Create reminder events for a bill on the NoDues Reminders calendar.
 * Sequential loop over offsets; partial failures are captured (allSucceeded=false).
 */
export async function createReminders(
  accessToken: string,
  calendarId: string,
  dueDate: string,
  reminderOffsetsDays: number[],
  billTypeName: string,
  propertyName: string,
  amount: number | null,
  month: string,
): Promise<ReminderResult> {
  if (reminderOffsetsDays.length === 0) {
    return { eventIds: [], allSucceeded: true };
  }

  const title = `${billTypeName} \u2014 ${propertyName} due ${formatDueDate(dueDate)}`;
  const description =
    `Month: ${formatMonth(month)}` +
    (amount !== null ? `\nAmount: ${formatCurrency(amount)}` : '');

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
