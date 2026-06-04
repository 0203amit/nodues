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
import { ensureRentCollectionsTab } from './rentCollectionsService';
import { ensurePaymentEventsTab } from './paymentEventsService';
import type { Tenancy, TenancyWithDisplay, TenancyFormData, RowWithIndex } from '../types';

// --- Column index map derived from HEADER_DEFINITIONS ---

const TAB_NAME = 'Tenancies';
const TAB_DEF = HEADER_DEFINITIONS.find((d) => d.tabName === TAB_NAME)!;
const COL = Object.fromEntries(TAB_DEF.headers.map((h, i) => [h, i])) as Record<string, number>;

// --- Parse / Serialize ---

export function parseRow(row: RowWithIndex): Tenancy | null {
  const v = row.values;
  if (!v || v.length === 0) return null;
  const id = v[COL.id];
  if (!id) return null;

  const depositStr = v[COL.security_deposit] ?? '';

  return {
    _rowIndex: row.rowIndex,
    id,
    propertyId: v[COL.property_id] ?? '',
    unitLabel: v[COL.unit_label] ?? '',
    name: v[COL.name] ?? '',
    phone: v[COL.phone] ?? '',
    email: v[COL.email] ?? '',
    rentAmount: Number(v[COL.rent_amount]) || 0,
    securityDeposit: depositStr === '' ? null : Number(depositStr),
    rentDueDay: Number(v[COL.rent_due_day]) || 1,
    leaseStartDate: v[COL.lease_start_date] ?? '',
    leaseEndDate: v[COL.lease_end_date] ?? '',
    isActive: v[COL.is_active] === 'true',
    notes: v[COL.notes] ?? '',
    createdAt: v[COL.created_at] ?? '',
    updatedAt: v[COL.updated_at] ?? '',
    deletedAt: v[COL.deleted_at] ?? '',
  };
}

export function serializeRow(tenancy: Tenancy): string[] {
  return [
    tenancy.id,
    tenancy.propertyId,
    tenancy.unitLabel,
    tenancy.name,
    tenancy.phone,
    tenancy.email,
    String(tenancy.rentAmount),
    tenancy.securityDeposit === null ? '' : String(tenancy.securityDeposit),
    String(tenancy.rentDueDay),
    tenancy.leaseStartDate,
    tenancy.leaseEndDate,
    String(tenancy.isActive),
    tenancy.notes,
    tenancy.createdAt,
    tenancy.updatedAt,
    tenancy.deletedAt,
  ];
}

// --- Ensure tab exists (lazy bootstrap) ---

export async function ensureTenanciesTab(
  accessToken: string,
  spreadsheetId: string,
): Promise<void> {
  try {
    const result = await readValues(
      accessToken,
      spreadsheetId,
      `'${TAB_NAME}'!A1:P1`,
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

export async function fetchTenancies(
  accessToken: string,
  spreadsheetId: string,
  propertyMap: Map<string, string>,
): Promise<TenancyWithDisplay[]> {
  const rows = await readAllRows(accessToken, spreadsheetId, TAB_NAME);
  const result: TenancyWithDisplay[] = [];
  for (const row of rows) {
    const parsed = parseRow(row);
    if (parsed && parsed.deletedAt === '') {
      result.push({
        ...parsed,
        propertyName: propertyMap.get(parsed.propertyId) ?? 'Unknown',
      });
    }
  }
  return result;
}

export async function addTenancy(
  accessToken: string,
  spreadsheetId: string,
  data: TenancyFormData,
): Promise<Tenancy> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const tenancy: Tenancy = {
    _rowIndex: -1,
    id,
    propertyId: data.propertyId,
    unitLabel: data.unitLabel,
    name: data.name,
    phone: data.phone,
    email: data.email,
    rentAmount: Number(data.rentAmount),
    securityDeposit: data.securityDeposit.trim() === '' ? null : Number(data.securityDeposit),
    rentDueDay: Number(data.rentDueDay) || 1,
    leaseStartDate: data.leaseStartDate,
    leaseEndDate: data.leaseEndDate,
    isActive: true,
    notes: data.notes,
    createdAt: now,
    updatedAt: now,
    deletedAt: '',
  };
  await appendRows(accessToken, spreadsheetId, TAB_NAME, [serializeRow(tenancy)]);
  return tenancy;
}

export async function updateTenancy(
  accessToken: string,
  spreadsheetId: string,
  existing: Tenancy,
  data: Partial<TenancyFormData>,
): Promise<Tenancy> {
  const updated: Tenancy = {
    ...existing,
    unitLabel: data.unitLabel ?? existing.unitLabel,
    name: data.name ?? existing.name,
    phone: data.phone ?? existing.phone,
    email: data.email ?? existing.email,
    rentAmount: data.rentAmount !== undefined ? Number(data.rentAmount) : existing.rentAmount,
    securityDeposit:
      data.securityDeposit !== undefined
        ? data.securityDeposit.trim() === ''
          ? null
          : Number(data.securityDeposit)
        : existing.securityDeposit,
    rentDueDay: data.rentDueDay !== undefined ? Number(data.rentDueDay) || 1 : existing.rentDueDay,
    leaseStartDate: data.leaseStartDate ?? existing.leaseStartDate,
    leaseEndDate: data.leaseEndDate ?? existing.leaseEndDate,
    notes: data.notes ?? existing.notes,
    updatedAt: new Date().toISOString(),
  };
  await updateRow(accessToken, spreadsheetId, TAB_NAME, existing._rowIndex, serializeRow(updated));
  return updated;
}

export async function toggleTenancyActive(
  accessToken: string,
  spreadsheetId: string,
  tenancy: Tenancy,
): Promise<Tenancy> {
  const newActive = !tenancy.isActive;
  const now = new Date().toISOString();
  const updated: Tenancy = {
    ...tenancy,
    isActive: newActive,
    updatedAt: now,
  };
  await updateRow(accessToken, spreadsheetId, TAB_NAME, tenancy._rowIndex, serializeRow(updated));
  return updated;
}

export async function softDeleteTenancy(
  accessToken: string,
  spreadsheetId: string,
  tenancy: Tenancy,
): Promise<void> {
  const isoNow = new Date().toISOString();
  await updateCell(accessToken, spreadsheetId, TAB_NAME, tenancy._rowIndex, COL.deleted_at, isoNow);
}

export async function undoDeleteTenancy(
  accessToken: string,
  spreadsheetId: string,
  tenancy: Tenancy,
): Promise<void> {
  await updateCell(accessToken, spreadsheetId, TAB_NAME, tenancy._rowIndex, COL.deleted_at, '');
}

// --- Orchestrator: ensure all 3 rental tabs exist ---

export async function ensureRentalTabs(
  accessToken: string,
  spreadsheetId: string,
): Promise<void> {
  await Promise.all([
    ensureTenanciesTab(accessToken, spreadsheetId),
    ensureRentCollectionsTab(accessToken, spreadsheetId),
    ensurePaymentEventsTab(accessToken, spreadsheetId),
  ]);
}
