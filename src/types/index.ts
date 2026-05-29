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

// --- Postpone ---

/** A row in the PostponeLog sheet. */
export interface PostponeLogEntry {
  _rowIndex: number;
  id: string;
  itemType: string;
  itemId: string;
  fromDate: string;
  toDate: string;
  reason: string;
  postponedBy: string;
  postponedAt: string;
}

/** Fields collected from the PostponeModal form. */
export interface PostponeFormData {
  newDueDate: string;
  reason: string;
}

// --- File Attachment Types ---

/** Metadata for a file stored in Google Drive. Retrieved via Drive API v3 files.get. */
export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  /** File size in bytes as a string (from Drive API). */
  size?: string;
  /** Drive-generated thumbnail URL. May be null with drive.file scope. */
  thumbnailLink?: string;
  /** URL to view the file in Google Drive. */
  webViewLink?: string;
}

/** UI representation of an attached file, combining Drive ID + metadata + loading state. */
export interface FileAttachment {
  fileId: string;
  /** null while loading or if metadata fetch failed. */
  metadata: DriveFileMetadata | null;
  isLoading: boolean;
  error: string | null;
  /** Object URL for image preview. null for PDFs or while loading. */
  thumbnailUrl: string | null;
}

/** Distinguishes bill documents from payment receipts. Maps to Sheet columns. */
export type AttachmentCategory = 'bill' | 'receipt';

/** Per-file status during a batch upload. */
export type UploadFileStatus = 'pending' | 'uploading' | 'done' | 'failed';

/** A file in the upload queue with its current status. */
export interface UploadingFile {
  file: File;
  status: UploadFileStatus;
  error: string | null;
  /** Drive file ID after successful upload. */
  driveFileId: string | null;
}
