import { v4 as uuidv4 } from 'uuid';
import { HEADER_DEFINITIONS } from '../config/schema';
import { readAllRows, updateRow, updateCell, appendRows } from './sheetsService';
import { parseRow as parsePropertyRow } from './propertiesService';
import type {
  BillType,
  BillTypeFormData,
  BillTypeWithProperty,
  Frequency,
  RowWithIndex,
} from '../types';

// --- Column index map derived from HEADER_DEFINITIONS ---

const TAB_NAME = 'BillTypes';
const BILL_TYPE_HEADERS = HEADER_DEFINITIONS.find((d) => d.tabName === TAB_NAME)!.headers;
const COL = Object.fromEntries(BILL_TYPE_HEADERS.map((h, i) => [h, i])) as Record<string, number>;

// --- Parse / Serialize ---

export function parseRow(row: RowWithIndex): BillType | null {
  const v = row.values;
  if (!v || v.length < BILL_TYPE_HEADERS.length) return null;
  const id = v[COL.id];
  if (!id) return null;

  const amountStr = v[COL.default_amount] ?? '';
  const dueDayStr = v[COL.default_due_day] ?? '';
  const offsetsStr = v[COL.reminder_offsets_days] ?? '';

  return {
    _rowIndex: row.rowIndex,
    id,
    propertyId: v[COL.property_id] ?? '',
    name: v[COL.name] ?? '',
    defaultAmount: amountStr === '' ? null : Number(amountStr),
    defaultDueDay: dueDayStr === '' ? null : Number(dueDayStr),
    frequency: (v[COL.frequency] ?? 'monthly') as Frequency,
    reminderOffsetsDays:
      offsetsStr === '' ? [] : offsetsStr.split(',').map((s) => parseInt(s.trim(), 10)),
    active: v[COL.active] === 'true',
    createdAt: v[COL.created_at] ?? '',
    deletedAt: v[COL.deleted_at] ?? '',
  };
}

export function serializeRow(billType: BillType): string[] {
  return [
    billType.id,
    billType.propertyId,
    billType.name,
    billType.defaultAmount === null ? '' : String(billType.defaultAmount),
    billType.defaultDueDay === null ? '' : String(billType.defaultDueDay),
    billType.frequency,
    billType.reminderOffsetsDays.join(','),
    String(billType.active),
    billType.createdAt,
    billType.deletedAt,
  ];
}

// --- CRUD ---

export async function fetchBillTypes(
  accessToken: string,
  spreadsheetId: string,
): Promise<BillTypeWithProperty[]> {
  const [billTypeRows, propertyRows] = await Promise.all([
    readAllRows(accessToken, spreadsheetId, TAB_NAME),
    readAllRows(accessToken, spreadsheetId, 'Properties'),
  ]);

  // Build property lookup
  const propertyMap = new Map<string, { name: string; active: boolean; deletedAt: string }>();
  for (const row of propertyRows) {
    const prop = parsePropertyRow(row);
    if (prop) {
      propertyMap.set(prop.id, { name: prop.name, active: prop.active, deletedAt: prop.deletedAt });
    }
  }

  const result: BillTypeWithProperty[] = [];
  for (const row of billTypeRows) {
    const parsed = parseRow(row);
    if (!parsed || parsed.deletedAt !== '') continue;

    const propInfo = propertyMap.get(parsed.propertyId);
    result.push({
      ...parsed,
      propertyName: propInfo?.name ?? 'Unknown',
      propertyDeleted: propInfo ? propInfo.deletedAt !== '' : false,
      propertyActive: propInfo?.active ?? false,
    });
  }
  return result;
}

export async function addBillType(
  accessToken: string,
  spreadsheetId: string,
  data: BillTypeFormData,
): Promise<BillType> {
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const billType: BillType = {
    _rowIndex: -1,
    id,
    propertyId: data.propertyId,
    name: data.name,
    defaultAmount: data.defaultAmount.trim() === '' ? null : Number(data.defaultAmount),
    defaultDueDay: data.defaultDueDay.trim() === '' ? null : Number(data.defaultDueDay),
    frequency: data.frequency,
    reminderOffsetsDays:
      data.reminderOffsetsDays.trim() === ''
        ? []
        : data.reminderOffsetsDays.split(',').map((s) => parseInt(s.trim(), 10)),
    active: true,
    createdAt,
    deletedAt: '',
  };
  await appendRows(accessToken, spreadsheetId, TAB_NAME, [serializeRow(billType)]);
  return billType;
}

export async function updateBillType(
  accessToken: string,
  spreadsheetId: string,
  billType: BillType,
  data: BillTypeFormData,
): Promise<BillType> {
  const updated: BillType = {
    ...billType,
    // property_id is immutable — always from existing entity, never from form data
    name: data.name,
    defaultAmount: data.defaultAmount.trim() === '' ? null : Number(data.defaultAmount),
    defaultDueDay: data.defaultDueDay.trim() === '' ? null : Number(data.defaultDueDay),
    frequency: data.frequency,
    reminderOffsetsDays:
      data.reminderOffsetsDays.trim() === ''
        ? []
        : data.reminderOffsetsDays.split(',').map((s) => parseInt(s.trim(), 10)),
  };
  await updateRow(accessToken, spreadsheetId, TAB_NAME, billType._rowIndex, serializeRow(updated));
  return updated;
}

export async function toggleBillTypeActive(
  accessToken: string,
  spreadsheetId: string,
  billType: BillType,
): Promise<BillType> {
  const newActive = !billType.active;
  await updateCell(accessToken, spreadsheetId, TAB_NAME, billType._rowIndex, COL.active, String(newActive));
  return { ...billType, active: newActive };
}

export async function softDeleteBillType(
  accessToken: string,
  spreadsheetId: string,
  billType: BillType,
): Promise<void> {
  const isoNow = new Date().toISOString();
  await updateCell(accessToken, spreadsheetId, TAB_NAME, billType._rowIndex, COL.deleted_at, isoNow);
}

export async function undoDeleteBillType(
  accessToken: string,
  spreadsheetId: string,
  billType: BillType,
): Promise<void> {
  await updateCell(accessToken, spreadsheetId, TAB_NAME, billType._rowIndex, COL.deleted_at, '');
}
