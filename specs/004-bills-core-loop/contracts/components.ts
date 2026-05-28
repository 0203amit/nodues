/**
 * Contract: Component Props & UI Interfaces for Bills Core Loop
 *
 * Defines the prop interfaces for the main UI components in this feature.
 * These are design-time contracts — the actual component implementations
 * may include additional internal state.
 */

import type {
  Bill,
  BillFormData,
  BillWithDisplay,
  BillDisplayStatus,
  MarkPaidFormData,
} from './types';
import type { BillTypeWithProperty, Property } from '../../../src/types';

// ============================================================
// Bill Status Badge (src/components/bills/BillStatusBadge.tsx)
// ============================================================

/** Props for the bill-specific status badge (paid/overdue/pending/etc.) */
export interface BillStatusBadgeProps {
  /** The computed display status (not the stored status). */
  displayStatus: BillDisplayStatus;
}

// ============================================================
// Bill Row (src/components/bills/BillRow.tsx)
// ============================================================

/** Props for a single bill row in the list. Based on MASTER.md section 11. */
export interface BillRowProps {
  bill: BillWithDisplay;
  /** Called when the user taps the "Mark Paid" action. */
  onMarkPaid: (bill: BillWithDisplay) => void;
  /** Called when the user taps the "Edit" action. */
  onEdit: (bill: BillWithDisplay) => void;
  /** Called when the user taps the "Delete" action. */
  onDelete: (bill: BillWithDisplay) => void;
  /** True when a write is in progress for this specific bill. */
  isLoading: boolean;
}

// ============================================================
// Bill Form Modal (src/components/bills/BillFormModal.tsx)
// ============================================================

/** Props for the Add/Edit Bill form modal. */
export interface BillFormModalProps {
  /** Null for Add mode, populated for Edit mode. */
  bill: BillWithDisplay | null;
  /** Active, non-deleted bill types for the dropdown (with property names). */
  availableBillTypes: BillTypeWithProperty[];
  /** True while the save API call is in progress. */
  isSaving: boolean;
  /** Called when the form is submitted. */
  onSubmit: (data: BillFormData) => void;
  /** Called when the modal should close. */
  onClose: () => void;
}

// ============================================================
// Mark Paid Modal (src/components/bills/MarkPaidModal.tsx)
// ============================================================

/** Props for the Mark Paid form modal. */
export interface MarkPaidModalProps {
  /** The bill being marked as paid. */
  bill: BillWithDisplay;
  /** True while the save API call is in progress. */
  isSaving: boolean;
  /** Called when the form is submitted. */
  onSubmit: (data: MarkPaidFormData) => void;
  /** Called when the modal should close. */
  onClose: () => void;
}

// ============================================================
// Duplicate Warning Modal (src/components/bills/DuplicateWarningModal.tsx)
// ============================================================

/** Props for the duplicate bill detection warning modal. */
export interface DuplicateWarningModalProps {
  /** The existing bill that conflicts with the new entry. */
  existingBill: BillWithDisplay;
  /** Called when the user chooses to open/scroll-to the existing bill. */
  onOpenExisting: () => void;
  /** Called when the user chooses to force-save anyway. */
  onAddAnyway: () => void;
  /** Called when the user cancels (returns to the form). */
  onCancel: () => void;
}

// ============================================================
// Filter Bar (src/components/bills/BillsFilterBar.tsx)
// ============================================================

/** Props for the bills filter bar. */
export interface BillsFilterBarProps {
  /** All properties that have at least one bill (for the filter dropdown). */
  properties: { id: string; name: string }[];
  /** All distinct months that have at least one bill (for the filter dropdown). */
  months: string[];
  /** Currently selected property ID, or '' for all. */
  selectedPropertyId: string;
  /** Currently selected month (YYYY-MM), or '' for all. */
  selectedMonth: string;
  /** Called when the property filter changes. */
  onPropertyChange: (propertyId: string) => void;
  /** Called when the month filter changes. */
  onMonthChange: (month: string) => void;
}
