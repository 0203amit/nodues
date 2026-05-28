import { v4 as uuidv4 } from 'uuid';
import { HEADER_DEFINITIONS } from '../config/schema';
import { readAllRows, updateRow, updateCell, appendRows } from './sheetsService';
import type { Property, PropertyFormData, RowWithIndex } from '../types';

// --- Column index map derived from HEADER_DEFINITIONS ---

const TAB_NAME = 'Properties';
const PROPERTY_HEADERS = HEADER_DEFINITIONS.find((d) => d.tabName === TAB_NAME)!.headers;
const COL = Object.fromEntries(PROPERTY_HEADERS.map((h, i) => [h, i])) as Record<string, number>;

// --- Parse / Serialize ---

export function parseRow(row: RowWithIndex): Property | null {
  const v = row.values;
  if (!v || v.length < PROPERTY_HEADERS.length) return null;
  const id = v[COL.id];
  if (!id) return null;

  return {
    _rowIndex: row.rowIndex,
    id,
    name: v[COL.name] ?? '',
    address: v[COL.address] ?? '',
    notes: v[COL.notes] ?? '',
    active: v[COL.active] === 'true',
    createdAt: v[COL.created_at] ?? '',
    deletedAt: v[COL.deleted_at] ?? '',
  };
}

export function serializeRow(property: Property): string[] {
  return [
    property.id,
    property.name,
    property.address,
    property.notes,
    String(property.active),
    property.createdAt,
    property.deletedAt,
  ];
}

// --- CRUD ---

export async function fetchProperties(
  accessToken: string,
  spreadsheetId: string,
): Promise<Property[]> {
  const rows = await readAllRows(accessToken, spreadsheetId, TAB_NAME);
  const properties: Property[] = [];
  for (const row of rows) {
    const parsed = parseRow(row);
    if (parsed && parsed.deletedAt === '') {
      properties.push(parsed);
    }
  }
  return properties;
}

export async function addProperty(
  accessToken: string,
  spreadsheetId: string,
  data: PropertyFormData,
): Promise<Property> {
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const property: Property = {
    _rowIndex: -1,
    id,
    name: data.name,
    address: data.address,
    notes: data.notes,
    active: true,
    createdAt,
    deletedAt: '',
  };
  await appendRows(accessToken, spreadsheetId, TAB_NAME, [serializeRow(property)]);
  return property;
}

export async function updateProperty(
  accessToken: string,
  spreadsheetId: string,
  property: Property,
  data: PropertyFormData,
): Promise<Property> {
  const updated: Property = {
    ...property,
    name: data.name,
    address: data.address,
    notes: data.notes,
  };
  await updateRow(accessToken, spreadsheetId, TAB_NAME, property._rowIndex, serializeRow(updated));
  return updated;
}

export async function togglePropertyActive(
  accessToken: string,
  spreadsheetId: string,
  property: Property,
): Promise<Property> {
  const newActive = !property.active;
  await updateCell(accessToken, spreadsheetId, TAB_NAME, property._rowIndex, COL.active, String(newActive));
  return { ...property, active: newActive };
}

export async function softDeleteProperty(
  accessToken: string,
  spreadsheetId: string,
  property: Property,
): Promise<void> {
  const isoNow = new Date().toISOString();
  await updateCell(accessToken, spreadsheetId, TAB_NAME, property._rowIndex, COL.deleted_at, isoNow);
}

export async function undoDeleteProperty(
  accessToken: string,
  spreadsheetId: string,
  property: Property,
): Promise<void> {
  await updateCell(accessToken, spreadsheetId, TAB_NAME, property._rowIndex, COL.deleted_at, '');
}
