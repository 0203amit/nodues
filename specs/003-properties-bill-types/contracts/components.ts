/**
 * Contract: Component Props & UI Interfaces
 *
 * Defines the prop interfaces for the main UI components in this feature.
 * These are design-time contracts — the actual component implementations
 * may include additional internal state.
 */

import type {
  Property,
  PropertyFormData,
  BillType,
  BillTypeFormData,
  BillTypeWithProperty,
  Frequency,
} from './types';

// ============================================================
// Toast / Notification System (src/contexts/ToastContext.tsx)
// ============================================================

export type ToastVariant = 'success' | 'error';

export interface Toast {
  id: string;
  variant: ToastVariant;
  message: string;
}

export interface UndoSnackbar {
  id: string;
  message: string;
  /** Called when user taps Undo. */
  onUndo: () => void;
  /** Duration in ms before auto-dismiss. Default: 10000. */
  durationMs: number;
}

export interface ToastContextValue {
  /** Show a success or error toast. Auto-dismisses after 4 seconds. */
  showToast: (message: string, variant: ToastVariant) => void;
  /** Show an undo snackbar with a countdown. */
  showUndo: (message: string, onUndo: () => void, durationMs?: number) => void;
  /** Programmatically dismiss a toast or snackbar by ID. */
  dismiss: (id: string) => void;
}

// ============================================================
// Property Components
// ============================================================

/** Props for the Properties list page (src/pages/PropertiesPage.tsx) */
// No external props — page fetches its own data via useAuth + useBootstrap.

/** Props for a single property card in the list. */
export interface PropertyCardProps {
  property: Property;
  onEdit: (property: Property) => void;
  onToggleActive: (property: Property) => void;
  onDelete: (property: Property) => void;
  /** True when a toggle/delete write is in progress for this item. */
  isLoading: boolean;
}

/** Props for the Add/Edit property form modal. */
export interface PropertyFormModalProps {
  /** Null for Add mode, populated for Edit mode. */
  property: Property | null;
  /** True while the save API call is in progress. */
  isSaving: boolean;
  onSubmit: (data: PropertyFormData) => void;
  onClose: () => void;
}

// ============================================================
// Bill Type Components
// ============================================================

/** Props for a single bill type card in the list. */
export interface BillTypeCardProps {
  billType: BillTypeWithProperty;
  onEdit: (billType: BillTypeWithProperty) => void;
  onToggleActive: (billType: BillTypeWithProperty) => void;
  onDelete: (billType: BillTypeWithProperty) => void;
  /** True when a toggle/delete write is in progress for this item. */
  isLoading: boolean;
}

/** Props for the Add/Edit bill type form modal. */
export interface BillTypeFormModalProps {
  /** Null for Add mode, populated for Edit mode. */
  billType: BillType | null;
  /** Active, non-deleted properties for the property dropdown. */
  availableProperties: Property[];
  /** True while the save API call is in progress. */
  isSaving: boolean;
  onSubmit: (data: BillTypeFormData) => void;
  onClose: () => void;
}

// ============================================================
// Settings Hub
// ============================================================

export interface SettingsLinkCard {
  label: string;
  description: string;
  to: string;            // React Router path
  icon: string;          // Lucide icon name (e.g., 'Building2', 'Receipt')
  disabled?: boolean;    // For "Coming soon" items
}

// ============================================================
// Confirmation Dialog
// ============================================================

export interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant: 'primary' | 'destructive';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
