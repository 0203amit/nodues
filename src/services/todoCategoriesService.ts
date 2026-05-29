import { v4 as uuidv4 } from 'uuid';
import { HEADER_DEFINITIONS } from '../config/schema';
import { readAllRows, updateRow, updateCell, appendRows } from './sheetsService';
import type { TodoCategory, TodoCategoryFormData, RowWithIndex } from '../types';

// --- Column index map derived from HEADER_DEFINITIONS ---

const TAB_NAME = 'TodoCategories';
const CATEGORY_HEADERS = HEADER_DEFINITIONS.find((d) => d.tabName === TAB_NAME)!.headers;
const COL = Object.fromEntries(CATEGORY_HEADERS.map((h, i) => [h, i])) as Record<string, number>;

// --- Parse / Serialize ---

export function parseRow(row: RowWithIndex): TodoCategory | null {
  const v = row.values;
  if (!v || v.length === 0) return null;
  const id = v[COL.id];
  if (!id) return null;

  return {
    _rowIndex: row.rowIndex,
    id,
    name: v[COL.name] ?? '',
    color: v[COL.color] ?? '',
    active: v[COL.active] === 'true',
    deletedAt: v[COL.deleted_at] ?? '',
  };
}

export function serializeRow(cat: TodoCategory): string[] {
  return [
    cat.id,
    cat.name,
    cat.color,
    String(cat.active),
    cat.deletedAt,
  ];
}

// --- Fetch ---

/** Fetch non-deleted categories (including inactive). */
export async function fetchCategories(
  accessToken: string,
  spreadsheetId: string,
): Promise<TodoCategory[]> {
  const rows = await readAllRows(accessToken, spreadsheetId, TAB_NAME);
  const categories: TodoCategory[] = [];
  for (const row of rows) {
    const parsed = parseRow(row);
    if (parsed && parsed.deletedAt === '') {
      categories.push(parsed);
    }
  }
  return categories;
}

/** Fetch all categories including deleted (for resolving names on to-dos that reference deleted categories). */
export async function fetchAllCategories(
  accessToken: string,
  spreadsheetId: string,
): Promise<TodoCategory[]> {
  const rows = await readAllRows(accessToken, spreadsheetId, TAB_NAME);
  const categories: TodoCategory[] = [];
  for (const row of rows) {
    const parsed = parseRow(row);
    if (parsed) {
      categories.push(parsed);
    }
  }
  return categories;
}

// --- CRUD ---

export async function addCategory(
  accessToken: string,
  spreadsheetId: string,
  data: TodoCategoryFormData,
): Promise<TodoCategory> {
  const id = uuidv4();
  const cat: TodoCategory = {
    _rowIndex: -1,
    id,
    name: data.name,
    color: data.color,
    active: true,
    deletedAt: '',
  };
  await appendRows(accessToken, spreadsheetId, TAB_NAME, [serializeRow(cat)]);
  return cat;
}

export async function updateCategory(
  accessToken: string,
  spreadsheetId: string,
  cat: TodoCategory,
  data: TodoCategoryFormData,
): Promise<TodoCategory> {
  const updated: TodoCategory = {
    ...cat,
    name: data.name,
    color: data.color,
  };
  await updateRow(accessToken, spreadsheetId, TAB_NAME, cat._rowIndex, serializeRow(updated));
  return updated;
}

export async function toggleCategoryActive(
  accessToken: string,
  spreadsheetId: string,
  cat: TodoCategory,
): Promise<TodoCategory> {
  const newActive = !cat.active;
  await updateCell(accessToken, spreadsheetId, TAB_NAME, cat._rowIndex, COL.active, String(newActive));
  return { ...cat, active: newActive };
}

export async function softDeleteCategory(
  accessToken: string,
  spreadsheetId: string,
  cat: TodoCategory,
): Promise<void> {
  const isoNow = new Date().toISOString();
  await updateCell(accessToken, spreadsheetId, TAB_NAME, cat._rowIndex, COL.deleted_at, isoNow);
}

export async function undoDeleteCategory(
  accessToken: string,
  spreadsheetId: string,
  cat: TodoCategory,
): Promise<void> {
  await updateCell(accessToken, spreadsheetId, TAB_NAME, cat._rowIndex, COL.deleted_at, '');
}
