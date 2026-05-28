/**
 * Contract: Types for Bills Core Loop
 *
 * These interfaces define the domain objects for the Bills feature.
 * They will be added to the existing src/types/index.ts file
 * alongside Property, BillType, and other existing types.
 */

// --- Enums ---

/** Stored status values for a bill row in the Sheet. */
export type BillStatus = 'not_yet_generated' | 'pending' | 'paid' | 'skipped';

/** Computed display status (derived from stored status + date comparison). Not stored. */
export type BillDisplayStatus = 'paid' | 'overdue' | 'pending' | 'not_yet_generated' | 'skipped';

export const BILL_STATUS_OPTIONS: { value: BillStatus; label: string }[] = [
  { value: 'not_yet_generated', label: 'Not yet generated' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'skipped', label: 'Skipped' },
];

export const PAYMENT_METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: 'GPay', label: 'GPay' },
  { value: 'PhonePe', label: 'PhonePe' },
  { value: 'NEFT', label: 'NEFT' },
  { value: 'Net Banking', label: 'Net Banking' },
  { value: 'Cash', label: 'Cash' },
  { value: 'Other', label: 'Other' },
];

// --- Bill ---

export interface Bill {
  /** 1-based Sheet row index for targeting updates. Not a Sheet column. */
  _rowIndex: number;
  id: string;
  billTypeId: string;
  month: string;                // YYYY-MM
  amount: number | null;        // null when not_yet_generated
  dueDate: string;              // YYYY-MM-DD or '' when not_yet_generated
  originalDueDate: string;      // YYYY-MM-DD or '' — immutable after first set
  status: BillStatus;
  paidDate: string;             // YYYY-MM-DD or ''
  paymentMethod: string;        // From PAYMENT_METHOD_OPTIONS or ''
  transactionRef: string;       // UTR/reference or ''
  billFileIds: string;          // CSV of Drive file IDs (empty in Phase 4)
  receiptFileIds: string;       // CSV of Drive file IDs (empty in Phase 4)
  calendarEventIds: string;     // CSV of Calendar event IDs (empty in Phase 4)
  notes: string;
  createdAt: string;            // ISO 8601
  updatedAt: string;            // ISO 8601
  deletedAt: string;            // ISO 8601 or '' (soft-delete)
  compositeKey: string;         // property_id|bill_type_id|month
}

/** Bill enriched with resolved names and computed display status for UI rendering. */
export interface BillWithDisplay extends Bill {
  billTypeName: string;         // Resolved from bill_type_id → BillType.name
  propertyName: string;         // Resolved from BillType.property_id → Property.name
  propertyId: string;           // Resolved from BillType.property_id (for filtering)
  displayStatus: BillDisplayStatus; // Computed from status + due_date vs today
}

/** Fields for the Add/Edit Bill form. */
export interface BillFormData {
  billTypeId: string;           // Required on create, read-only on edit
  month: string;                // YYYY-MM, required
  amount: string;               // String for form input; parsed to number on submit
  dueDate: string;              // YYYY-MM-DD or '' for form input
  notes: string;
}

/** Fields for the Mark Paid form. */
export interface MarkPaidFormData {
  paidDate: string;             // YYYY-MM-DD, required (default: today)
  paymentMethod: string;        // Required, from PAYMENT_METHOD_OPTIONS
  transactionRef: string;       // Optional
}
