import { v4 as uuidv4 } from 'uuid';

export interface HeaderDefinition {
  tabName: string;
  headers: string[];
}

export const TAB_NAMES = [
  'Properties',
  'BillTypes',
  'Bills',
  'TodoCategories',
  'RecurrencePatterns',
  'Todos',
  'PostponeLog',
  'ActivityLog',
  'Config',
] as const;

export const HEADER_DEFINITIONS: HeaderDefinition[] = [
  {
    tabName: 'Properties',
    headers: ['id', 'name', 'address', 'notes', 'active', 'created_at', 'deleted_at'],
  },
  {
    tabName: 'BillTypes',
    headers: [
      'id', 'property_id', 'name', 'default_amount', 'default_due_day',
      'frequency', 'reminder_offsets_days', 'active', 'created_at', 'deleted_at',
    ],
  },
  {
    tabName: 'Bills',
    headers: [
      'id', 'bill_type_id', 'month', 'amount', 'due_date', 'original_due_date',
      'status', 'paid_date', 'payment_method', 'transaction_ref', 'bill_file_ids',
      'receipt_file_ids', 'calendar_event_ids', 'notes', 'created_at', 'updated_at',
      'deleted_at', 'composite_key',
    ],
  },
  {
    tabName: 'TodoCategories',
    headers: ['id', 'name', 'color', 'active', 'deleted_at'],
  },
  {
    tabName: 'RecurrencePatterns',
    headers: [
      'id', 'name', 'interval_value', 'interval_unit', 'anchor_day',
      'end_condition', 'end_value', 'active',
    ],
  },
  {
    tabName: 'Todos',
    headers: [
      'id', 'title', 'description', 'category_id', 'due_date', 'original_due_date',
      'status', 'done_date', 'recurrence_pattern_id', 'parent_todo_id',
      'reminder_offsets_days', 'attachment_file_ids', 'calendar_event_ids', 'notes',
      'created_at', 'updated_at', 'deleted_at',
    ],
  },
  {
    tabName: 'PostponeLog',
    headers: [
      'id', 'item_type', 'item_id', 'from_date', 'to_date',
      'reason', 'postponed_by', 'postponed_at',
    ],
  },
  {
    tabName: 'ActivityLog',
    headers: ['id', 'timestamp', 'user_email', 'action', 'entity_type', 'entity_id', 'summary'],
  },
  {
    tabName: 'Config',
    headers: ['key', 'value'],
  },
];

/** Returns 3 seed property rows: Mira Shop, Mira Flat, Chawl. */
export function generateSeedProperties(): string[][] {
  const now = new Date().toISOString();
  return [
    [uuidv4(), 'Mira Shop', '', '', 'true', now, ''],
    [uuidv4(), 'Mira Flat', '', '', 'true', now, ''],
    [uuidv4(), 'Chawl', '', '', 'true', now, ''],
  ];
}

/** Returns 5 seed bill-type rows linked to property UUIDs (FR-007). */
export function generateSeedBillTypes(propertyIds: Record<string, string>): string[][] {
  const now = new Date().toISOString();
  return [
    [uuidv4(), propertyIds['Mira Shop'], 'Maintenance', '', '5', 'monthly', '3,1', 'true', now, ''],
    [uuidv4(), propertyIds['Mira Shop'], 'Property Tax', '', '1', 'annual', '30,7,1', 'true', now, ''],
    [uuidv4(), propertyIds['Mira Flat'], 'Maintenance', '', '5', 'monthly', '3,1', 'true', now, ''],
    [uuidv4(), propertyIds['Mira Flat'], 'Property Tax', '', '1', 'annual', '30,7,1', 'true', now, ''],
    [uuidv4(), propertyIds['Chawl'], 'Electricity', '', '15', 'monthly', '5,1', 'true', now, ''],
  ];
}

/** Returns 4 seed todo-category rows (FR-008). */
export function generateSeedTodoCategories(): string[][] {
  return [
    [uuidv4(), 'Insurance', '', 'true', ''],
    [uuidv4(), 'Tax', '', 'true', ''],
    [uuidv4(), 'Society', '', 'true', ''],
    [uuidv4(), 'Maintenance', '', 'true', ''],
  ];
}
