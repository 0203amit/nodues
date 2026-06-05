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
  'PushSubscriptions',
  'Config',
] as const;

export const HEADER_DEFINITIONS: HeaderDefinition[] = [
  {
    tabName: 'Properties',
    headers: ['id', 'name', 'address', 'notes', 'active', 'created_at', 'deleted_at', 'is_rental'],
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
    tabName: 'PushSubscriptions',
    headers: [
      'id', 'user_email', 'endpoint', 'p256dh_key', 'auth_key',
      'delivery_hour', 'delivery_minute', 'timezone', 'enabled',
      'created_at', 'last_pushed_at', 'deleted_at',
    ],
  },
  {
    tabName: 'Tenancies',
    headers: [
      'id', 'property_id', 'unit_label', 'name', 'phone', 'email',
      'rent_amount', 'security_deposit', 'rent_due_day', 'lease_start_date',
      'lease_end_date', 'is_active', 'notes', 'created_at', 'updated_at',
      'deleted_at',
    ],
  },
  {
    tabName: 'RentCollections',
    headers: [
      'id', 'tenancy_id', 'month', 'expected_amount', 'due_date',
      'notes', 'composite_key', 'created_at', 'updated_at', 'deleted_at',
    ],
  },
  {
    tabName: 'PaymentEvents',
    headers: [
      'id', 'collection_id', 'amount', 'payment_date', 'payment_method',
      'notes', 'created_at', 'updated_at', 'deleted_at',
    ],
  },
  {
    tabName: 'Config',
    headers: ['key', 'value'],
  },
];

/** Returns 4 seed todo-category rows (FR-008). */
export function generateSeedTodoCategories(): string[][] {
  return [
    [uuidv4(), 'Insurance', '#6366F1', 'true', ''],   // Indigo
    [uuidv4(), 'Tax', '#EF4444', 'true', ''],          // Red
    [uuidv4(), 'Society', '#10B981', 'true', ''],      // Emerald
    [uuidv4(), 'Maintenance', '#F59E0B', 'true', ''],  // Amber
  ];
}

/** Returns 5 seed recurrence-pattern rows (DD-007). */
export function generateSeedRecurrencePatterns(): string[][] {
  return [
    [uuidv4(), 'One-time', '0', '', '', 'never', '', 'true'],
    [uuidv4(), 'Every month', '1', 'months', '', 'never', '', 'true'],
    [uuidv4(), 'Every 3 months', '3', 'months', '', 'never', '', 'true'],
    [uuidv4(), 'Every 6 months', '6', 'months', '', 'never', '', 'true'],
    [uuidv4(), 'Every year', '1', 'years', '', 'never', '', 'true'],
  ];
}
