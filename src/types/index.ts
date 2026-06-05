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
  isRental: boolean;
}

/** Fields editable via the Property form. */
export interface PropertyFormData {
  name: string;
  address: string;
  notes: string;
  isRental: boolean;
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

// --- To-Do Types ---

/** Stored status values for a to-do row in the Sheet. */
export type TodoStatus = 'pending' | 'done';

/** Computed display status (derived from stored status + date comparison). Not stored. */
export type TodoDisplayStatus = 'pending' | 'overdue' | 'done';

export interface Todo {
  /** 1-based Sheet row index for targeting updates. Not a Sheet column. */
  _rowIndex: number;
  id: string;
  title: string;
  description: string;
  categoryId: string;
  dueDate: string;
  originalDueDate: string;
  status: TodoStatus;
  doneDate: string;
  recurrencePatternId: string;
  parentTodoId: string;
  reminderOffsetsDays: string;
  attachmentFileIds: string;
  calendarEventIds: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
}

/** Todo enriched with resolved display fields from TodoCategories and RecurrencePatterns. */
export interface TodoWithDisplay extends Todo {
  categoryName: string;
  categoryColor: string;
  recurrenceName: string;
  displayStatus: TodoDisplayStatus;
}

export interface TodoCategory {
  /** 1-based Sheet row index for targeting updates. Not a Sheet column. */
  _rowIndex: number;
  id: string;
  name: string;
  color: string;
  active: boolean;
  deletedAt: string;
}

/** Fields editable via the TodoCategory form. */
export interface TodoCategoryFormData {
  name: string;
  color: string;
}

export interface RecurrencePattern {
  /** 1-based Sheet row index for targeting updates. Not a Sheet column. */
  _rowIndex: number;
  id: string;
  name: string;
  intervalValue: number;
  intervalUnit: string;
  anchorDay: number | null;
  endCondition: string;
  endValue: string;
  active: boolean;
}

/** Fields for the Add/Edit To-Do form. */
export interface TodoFormData {
  title: string;
  description: string;
  categoryId: string;
  dueDate: string;
  recurrencePatternId: string;
  reminderOffsetsDays: string;
  notes: string;
}

/** Fields for the Mark Done form. */
export interface MarkDoneFormData {
  notes: string;
}

/** Preset color palette for to-do categories. */
export const CATEGORY_COLOR_PALETTE = [
  { name: 'Slate', hex: '#64748B' },
  { name: 'Red', hex: '#EF4444' },
  { name: 'Amber', hex: '#F59E0B' },
  { name: 'Emerald', hex: '#10B981' },
  { name: 'Cyan', hex: '#06B6D4' },
  { name: 'Indigo', hex: '#6366F1' },
  { name: 'Purple', hex: '#A855F7' },
  { name: 'Pink', hex: '#EC4899' },
] as const;

// --- Activity Log Types ---

export type ActionType =
  | 'bill_added' | 'bill_updated' | 'bill_paid' | 'bill_postponed'
  | 'bill_deleted' | 'bill_restored'
  | 'todo_added' | 'todo_updated' | 'todo_done' | 'todo_recurrence_created'
  | 'todo_postponed' | 'todo_deleted' | 'todo_restored'
  | 'property_added' | 'property_updated' | 'property_deleted' | 'property_restored'
  | 'billtype_added' | 'billtype_updated' | 'billtype_deleted' | 'billtype_restored'
  | 'category_added' | 'category_updated' | 'category_deleted' | 'category_restored'
  | 'push_enabled' | 'push_disabled'
  // Phase 16: Rentals
  | 'tenancy_added' | 'tenancy_updated' | 'tenancy_toggled'
  | 'tenancy_deleted' | 'tenancy_restored'
  | 'rent_auto_generated'
  | 'payment_received' | 'payment_deleted';

export type ActivityEntityType =
  | 'bill' | 'todo' | 'property' | 'billtype' | 'category' | 'push_subscription'
  // Phase 16: Rentals
  | 'tenancy' | 'rent_collection' | 'payment_event';

export interface ActivityLogEntry {
  _rowIndex: number;
  id: string;
  timestamp: string;
  userEmail: string;
  action: ActionType;
  entityType: ActivityEntityType;
  entityId: string;
  summary: string;
}

// --- Dashboard Types ---

export interface PropertyMoneySummary {
  propertyId: string;
  propertyName: string;
  outstanding: number;
  paid: number;
}

export interface MoneyThisMonth {
  outstanding: number;
  paid: number;
  byProperty: PropertyMoneySummary[];
}

export type AttentionItem =
  | {
      kind: 'bill';
      id: string;
      billTypeName: string;
      propertyName: string;
      propertyId: string;
      month: string;
      dueDate: string;
      displayStatus: BillDisplayStatus;
      amount: number | null;
    }
  | {
      kind: 'todo';
      id: string;
      title: string;
      categoryId: string;
      categoryName: string;
      categoryColor: string;
      dueDate: string;
      displayStatus: TodoDisplayStatus;
    }
  | {
      kind: 'rent';
      id: string;
      tenancyName: string;
      unitLabel: string;
      propertyId: string;
      propertyName: string;
      month: string;
      dueDate: string;
      expectedAmount: number;
      totalReceived: number;
      displayStatus: RentDisplayStatus;
    };

// --- Push Subscription Types ---

export interface PushSubscription {
  _rowIndex: number;
  id: string;
  userEmail: string;
  endpoint: string;
  p256dhKey: string;
  authKey: string;
  deliveryHour: number;
  deliveryMinute: number;
  timezone: string;
  enabled: boolean;
  createdAt: string;
  lastPushedAt: string;
  deletedAt: string;
}

// --- Rental Types ---

export interface Tenancy {
  _rowIndex: number;
  id: string;
  propertyId: string;
  unitLabel: string;
  name: string;
  phone: string;
  email: string;
  rentAmount: number;
  securityDeposit: number | null;
  rentDueDay: number;
  leaseStartDate: string;
  leaseEndDate: string;
  isActive: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
}

export interface TenancyWithDisplay extends Tenancy {
  propertyName: string;
}

export interface TenancyFormData {
  propertyId: string;
  unitLabel: string;
  name: string;
  phone: string;
  email: string;
  rentAmount: string;
  securityDeposit: string;
  rentDueDay: string;
  leaseStartDate: string;
  leaseEndDate: string;
  notes: string;
}

export type RentDisplayStatus = 'received' | 'partial' | 'pending' | 'overdue';

export interface RentCollection {
  _rowIndex: number;
  id: string;
  tenancyId: string;
  month: string;
  expectedAmount: number;
  dueDate: string;
  notes: string;
  compositeKey: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
}

export interface RentCollectionWithDisplay extends RentCollection {
  tenancyName: string;
  unitLabel: string;
  propertyId: string;
  propertyName: string;
  totalReceived: number;
  remainingBalance: number;
  displayStatus: RentDisplayStatus;
}

export interface PaymentEvent {
  _rowIndex: number;
  id: string;
  collectionId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
}

export interface PaymentEventFormData {
  amount: string;
  paymentDate: string;
  paymentMethod: string;
  notes: string;
}
