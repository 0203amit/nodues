/**
 * Contract: Shared Types for Properties & Bill Types
 *
 * These interfaces define the domain objects used across the service layer
 * and UI components. They are the TypeScript representation of Sheet rows.
 *
 * Location in source: src/types/properties.ts, src/types/billTypes.ts
 */

// --- Enums ---

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
  propertyId: string;           // Required on create, read-only on edit
  name: string;
  defaultAmount: string;        // String for form input; parsed to number on submit
  defaultDueDay: string;        // String for form input; parsed to number on submit
  frequency: Frequency;
  reminderOffsetsDays: string;  // Comma-separated string for form input
}

// --- Row with index (generic Sheet helper) ---

export interface RowWithIndex {
  /** 1-based Sheet row number. Header is row 1; data starts at row 2. */
  rowIndex: number;
  /** Raw cell values in column order. */
  values: string[];
}
