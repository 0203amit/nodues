// --- Frequency ---

export type Frequency = 'monthly' | 'quarterly' | 'annual' | 'one-time';

export const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
  { value: 'one-time', label: 'One-time' },
];

// --- Property ---

export interface Property {
  /** 1-based Sheet row index for targeting updates. Not a Sheet column. */
  _rowIndex: number;
  id: string;
  name: string;
  address: string;
  notes: string;
  active: boolean;
  createdAt: string;
  deletedAt: string;
}

/** Fields editable via the Property form. */
export interface PropertyFormData {
  name: string;
  address: string;
  notes: string;
}

// --- BillType ---

export interface BillType {
  /** 1-based Sheet row index for targeting updates. Not a Sheet column. */
  _rowIndex: number;
  id: string;
  propertyId: string;
  name: string;
  defaultAmount: number | null;
  defaultDueDay: number | null;
  frequency: Frequency;
  reminderOffsetsDays: number[];
  active: boolean;
  createdAt: string;
  deletedAt: string;
}

/** BillType enriched with resolved property information for display. */
export interface BillTypeWithProperty extends BillType {
  propertyName: string;
  propertyDeleted: boolean;
  propertyActive: boolean;
}

/** Fields editable via the BillType form. */
export interface BillTypeFormData {
  propertyId: string;
  name: string;
  defaultAmount: string;
  defaultDueDay: string;
  frequency: Frequency;
  reminderOffsetsDays: string;
}

// --- Row with index (generic Sheet helper) ---

export interface RowWithIndex {
  /** 1-based Sheet row number. Header is row 1; data starts at row 2. */
  rowIndex: number;
  /** Raw cell values in column order. */
  values: string[];
}

// --- Bill ---

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

export interface Bill {
  /** 1-based Sheet row index for targeting updates. Not a Sheet column. */
  _rowIndex: number;
  id: string;
  billTypeId: string;
  month: string;
  amount: number | null;
  dueDate: string;
  originalDueDate: string;
  status: BillStatus;
  paidDate: string;
  paymentMethod: string;
  transactionRef: string;
  billFileIds: string;
  receiptFileIds: string;
  calendarEventIds: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
  compositeKey: string;
}

/** Bill enriched with resolved names and computed display status for UI rendering. */
export interface BillWithDisplay extends Bill {
  billTypeName: string;
  propertyName: string;
  propertyId: string;
  displayStatus: BillDisplayStatus;
}

/** Fields for the Add/Edit Bill form. */
export interface BillFormData {
  billTypeId: string;
  month: string;
  amount: string;
  dueDate: string;
  notes: string;
}

/** Fields for the Mark Paid form. */
export interface MarkPaidFormData {
  paidDate: string;
  paymentMethod: string;
  transactionRef: string;
}
