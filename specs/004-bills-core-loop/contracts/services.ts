/**
 * Contract: Service Layer Interfaces for Bills Core Loop
 *
 * Defines the functions for src/services/billsService.ts.
 * All functions accept accessToken and spreadsheetId as their first two
 * parameters, consistent with existing service patterns.
 */

import type {
  Bill,
  BillFormData,
  BillWithDisplay,
  MarkPaidFormData,
} from './types';

// ============================================================
// Bills Service (src/services/billsService.ts)
// ============================================================

/**
 * Fetch all non-deleted bills from the Bills tab, enriched with
 * resolved bill type name, property name, property ID, and computed
 * display status.
 *
 * Implementation notes:
 * - Reads Bills, BillTypes, and Properties tabs in parallel.
 * - Parses bill rows, skips nulls, filters out deleted_at !== ''.
 * - Resolves bill_type_id → BillType.name and BillType.property_id → Property.name.
 * - Computes displayStatus from stored status + due_date vs today.
 * - Sorts result: overdue first (asc by due_date), pending (asc by due_date),
 *   not_yet_generated (asc by month), paid (desc by paid_date), skipped.
 */
export type FetchBills = (
  accessToken: string,
  spreadsheetId: string,
) => Promise<BillWithDisplay[]>;

/**
 * Check for a duplicate bill by composite_key.
 * Returns the matching BillWithDisplay if found, null otherwise.
 *
 * @param compositeKey - The composite_key to check (property_id|bill_type_id|month)
 * @param excludeBillId - Optional bill ID to exclude (for edit mode, so the
 *   bill being edited doesn't match itself)
 * @param bills - The current list of bills (already fetched) to check against.
 *   This avoids a redundant Sheet read — the page already has the bills loaded.
 */
export type CheckDuplicate = (
  compositeKey: string,
  bills: BillWithDisplay[],
  excludeBillId?: string,
) => BillWithDisplay | null;

/**
 * Add a new bill. Generates UUID, computes composite_key, sets timestamps.
 * Appends a row to the Bills tab.
 *
 * @param data - Form data from the Add Bill modal
 * @param propertyId - The property_id resolved from the selected bill type
 *   (needed for composite_key computation)
 *
 * Status logic:
 * - If amount is provided AND dueDate is provided → status = 'pending'
 * - Otherwise → status = 'not_yet_generated'
 *
 * original_due_date = dueDate (set equal on creation).
 * bill_file_ids, receipt_file_ids, calendar_event_ids = '' (Phase 5/6).
 */
export type AddBill = (
  accessToken: string,
  spreadsheetId: string,
  data: BillFormData,
  propertyId: string,
) => Promise<Bill>;

/**
 * Update a bill's editable fields.
 * Uses full-row-safety: preserves id, bill_type_id, original_due_date,
 * created_at, bill_file_ids, receipt_file_ids, calendar_event_ids from
 * the existing row.
 *
 * Updates: month, amount, due_date, notes, updated_at, composite_key.
 *
 * Status auto-flip:
 * - If status was 'not_yet_generated' and edit provides amount + due_date,
 *   status flips to 'pending'.
 * - If original_due_date was empty and due_date is now provided,
 *   original_due_date is set.
 *
 * @param bill - The existing bill entity (with _rowIndex)
 * @param data - The edited form data
 * @param propertyId - The property_id (from the bill type, for composite_key)
 */
export type UpdateBill = (
  accessToken: string,
  spreadsheetId: string,
  bill: Bill,
  data: BillFormData,
  propertyId: string,
) => Promise<Bill>;

/**
 * Mark a bill as paid.
 * Sets status='paid', paid_date, payment_method, transaction_ref, updated_at.
 * Uses full-row write to preserve all other fields.
 *
 * @param bill - The existing bill entity
 * @param data - The mark-paid form data
 */
export type MarkBillPaid = (
  accessToken: string,
  spreadsheetId: string,
  bill: Bill,
  data: MarkPaidFormData,
) => Promise<Bill>;

/**
 * Soft-delete a bill by setting deleted_at to current ISO timestamp.
 * Writes only the deleted_at column at the bill's row index.
 */
export type SoftDeleteBill = (
  accessToken: string,
  spreadsheetId: string,
  bill: Bill,
) => Promise<void>;

/**
 * Undo a soft-delete by clearing the deleted_at column.
 */
export type UndoDeleteBill = (
  accessToken: string,
  spreadsheetId: string,
  bill: Bill,
) => Promise<void>;
