/**
 * Contract: Service Layer Interfaces
 *
 * Defines the functions that will be added to sheetsService.ts (generic)
 * and to domain services (propertiesService.ts, billTypesService.ts).
 *
 * All functions accept accessToken and spreadsheetId as their first two
 * parameters, consistent with the existing Phase 2 service pattern.
 */

import type {
  Property,
  PropertyFormData,
  BillType,
  BillTypeFormData,
  BillTypeWithProperty,
  RowWithIndex,
} from './types';

// ============================================================
// Generic Sheet Helpers (added to src/services/sheetsService.ts)
// ============================================================

/**
 * Read all data rows from a tab (skips header row 1).
 * Returns each row paired with its 1-based Sheet row index.
 *
 * @param accessToken - OAuth2 token
 * @param spreadsheetId - Google Sheets document ID
 * @param tabName - Tab name (e.g., 'Properties')
 * @returns Array of {rowIndex, values} — may be empty if tab has no data rows
 */
export type ReadAllRows = (
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
) => Promise<RowWithIndex[]>;

/**
 * Overwrite a single row in a tab at the given row index.
 *
 * @param accessToken - OAuth2 token
 * @param spreadsheetId - Google Sheets document ID
 * @param tabName - Tab name
 * @param rowIndex - 1-based Sheet row number to overwrite
 * @param values - Full row of cell values in column order
 */
export type UpdateRow = (
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
  rowIndex: number,
  values: string[],
) => Promise<void>;

/**
 * Update a single cell in a tab.
 *
 * @param accessToken - OAuth2 token
 * @param spreadsheetId - Google Sheets document ID
 * @param tabName - Tab name
 * @param rowIndex - 1-based Sheet row number
 * @param columnIndex - 0-based column index
 * @param value - New cell value
 */
export type UpdateCell = (
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
  rowIndex: number,
  columnIndex: number,
  value: string,
) => Promise<void>;

// ============================================================
// Properties Service (src/services/propertiesService.ts)
// ============================================================

/**
 * Fetch all non-deleted properties from the Properties tab.
 */
export type FetchProperties = (
  accessToken: string,
  spreadsheetId: string,
) => Promise<Property[]>;

/**
 * Add a new property. Generates UUID and timestamps.
 * Appends a row to the Properties tab.
 */
export type AddProperty = (
  accessToken: string,
  spreadsheetId: string,
  data: PropertyFormData,
) => Promise<Property>;

/**
 * Update an existing property's editable fields (name, address, notes).
 * Targets the row at property._rowIndex.
 */
export type UpdateProperty = (
  accessToken: string,
  spreadsheetId: string,
  property: Property,
  data: PropertyFormData,
) => Promise<Property>;

/**
 * Toggle a property's active field.
 * Writes only the `active` column at the property's row index.
 */
export type TogglePropertyActive = (
  accessToken: string,
  spreadsheetId: string,
  property: Property,
) => Promise<Property>;

/**
 * Soft-delete a property by setting deleted_at to current ISO timestamp.
 * Writes only the `deleted_at` column.
 */
export type SoftDeleteProperty = (
  accessToken: string,
  spreadsheetId: string,
  property: Property,
) => Promise<void>;

/**
 * Undo a soft-delete by clearing the deleted_at column.
 */
export type UndoDeleteProperty = (
  accessToken: string,
  spreadsheetId: string,
  property: Property,
) => Promise<void>;

// ============================================================
// Bill Types Service (src/services/billTypesService.ts)
// ============================================================

/**
 * Fetch all non-deleted bill types, enriched with property name info.
 * Requires fetching properties to resolve property_id → name.
 */
export type FetchBillTypes = (
  accessToken: string,
  spreadsheetId: string,
) => Promise<BillTypeWithProperty[]>;

/**
 * Add a new bill type. Generates UUID and timestamps.
 * Appends a row to the BillTypes tab.
 */
export type AddBillType = (
  accessToken: string,
  spreadsheetId: string,
  data: BillTypeFormData,
) => Promise<BillType>;

/**
 * Update an existing bill type's editable fields.
 * property_id is NOT updated (immutable after creation).
 */
export type UpdateBillType = (
  accessToken: string,
  spreadsheetId: string,
  billType: BillType,
  data: BillTypeFormData,
) => Promise<BillType>;

/**
 * Toggle a bill type's active field.
 */
export type ToggleBillTypeActive = (
  accessToken: string,
  spreadsheetId: string,
  billType: BillType,
) => Promise<BillType>;

/**
 * Soft-delete a bill type.
 */
export type SoftDeleteBillType = (
  accessToken: string,
  spreadsheetId: string,
  billType: BillType,
) => Promise<void>;

/**
 * Undo a soft-delete on a bill type.
 */
export type UndoDeleteBillType = (
  accessToken: string,
  spreadsheetId: string,
  billType: BillType,
) => Promise<void>;
