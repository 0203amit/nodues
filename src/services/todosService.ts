import { v4 as uuidv4 } from 'uuid';
import { HEADER_DEFINITIONS } from '../config/schema';
import { readAllRows, updateRow, updateCell, appendRows } from './sheetsService';
import { appendPostponeLog } from './postponeLogService';
import { computeNextDueDate } from './recurrencePatternsService';
import { serializeEventIds } from './calendarReminders';
import type {
  MarkDoneFormData,
  RecurrencePattern,
  RowWithIndex,
  Todo,
  TodoDisplayStatus,
  TodoFormData,
  TodoStatus,
  TodoWithDisplay,
} from '../types';

// --- Column index map derived from HEADER_DEFINITIONS ---

const TAB_NAME = 'Todos';
const TODO_HEADERS = HEADER_DEFINITIONS.find((d) => d.tabName === TAB_NAME)!.headers;
const COL = Object.fromEntries(TODO_HEADERS.map((h, i) => [h, i])) as Record<string, number>;

// --- Pure Helpers ---

/** Compute display status from stored status + due date vs today (IST-aware). */
export function computeDisplayStatus(
  status: TodoStatus,
  dueDate: string,
  today?: string,
): TodoDisplayStatus {
  if (status === 'done') return 'done';
  // status === 'pending'
  const todayStr =
    today ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (dueDate && dueDate < todayStr) return 'overdue';
  return 'pending';
}

/** Sort todos by display status priority, then secondary sort within each status. */
export function sortTodos(todos: TodoWithDisplay[]): TodoWithDisplay[] {
  const STATUS_PRIORITY: Record<TodoDisplayStatus, number> = {
    overdue: 0,
    pending: 1,
    done: 2,
  };

  return [...todos].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.displayStatus];
    const pb = STATUS_PRIORITY[b.displayStatus];
    if (pa !== pb) return pa - pb;

    switch (a.displayStatus) {
      case 'overdue':
        // Oldest due first
        return (a.dueDate || '').localeCompare(b.dueDate || '');
      case 'pending':
        // With due date (soonest first) before without due date
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        // Both without due date: newest created first
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      case 'done':
        // Most recent done_date first
        return (b.doneDate || '').localeCompare(a.doneDate || '');
      default:
        return 0;
    }
  });
}

/** Parse a comma-separated reminder offsets string into a number array. */
export function parseReminderOffsets(csv: string): number[] {
  if (!csv || !csv.trim()) return [];
  return csv.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
}

// --- Parse / Serialize ---

const VALID_TODO_STATUSES: string[] = ['pending', 'done'];

export function parseRow(row: RowWithIndex): Todo | null {
  const v = row.values;
  if (!v || v.length === 0) return null;
  const id = v[COL.id];
  if (!id) return null;

  const rawStatus = v[COL.status] ?? 'pending';
  const status: TodoStatus = VALID_TODO_STATUSES.includes(rawStatus)
    ? (rawStatus as TodoStatus)
    : 'pending';

  return {
    _rowIndex: row.rowIndex,
    id,
    title: v[COL.title] ?? '',
    description: v[COL.description] ?? '',
    categoryId: v[COL.category_id] ?? '',
    dueDate: v[COL.due_date] ?? '',
    originalDueDate: v[COL.original_due_date] ?? '',
    status,
    doneDate: v[COL.done_date] ?? '',
    recurrencePatternId: v[COL.recurrence_pattern_id] ?? '',
    parentTodoId: v[COL.parent_todo_id] ?? '',
    reminderOffsetsDays: v[COL.reminder_offsets_days] ?? '',
    attachmentFileIds: v[COL.attachment_file_ids] ?? '',
    calendarEventIds: v[COL.calendar_event_ids] ?? '',
    notes: v[COL.notes] ?? '',
    createdAt: v[COL.created_at] ?? '',
    updatedAt: v[COL.updated_at] ?? '',
    deletedAt: v[COL.deleted_at] ?? '',
  };
}

export function serializeRow(todo: Todo): string[] {
  return [
    todo.id,
    todo.title,
    todo.description,
    todo.categoryId,
    todo.dueDate,
    todo.originalDueDate,
    todo.status,
    todo.doneDate,
    todo.recurrencePatternId,
    todo.parentTodoId,
    todo.reminderOffsetsDays,
    todo.attachmentFileIds,
    todo.calendarEventIds,
    todo.notes,
    todo.createdAt,
    todo.updatedAt,
    todo.deletedAt,
  ];
}

// --- CRUD ---

/** Fetch all non-deleted todos, enriched with resolved names and display status. */
export async function fetchTodos(
  accessToken: string,
  spreadsheetId: string,
  categoryMap: Map<string, { name: string; color: string }>,
  patternMap: Map<string, { name: string; intervalValue: number }>,
): Promise<TodoWithDisplay[]> {
  const rows = await readAllRows(accessToken, spreadsheetId, TAB_NAME);
  const result: TodoWithDisplay[] = [];

  for (const row of rows) {
    const parsed = parseRow(row);
    if (!parsed || parsed.deletedAt !== '') continue;

    const catInfo = categoryMap.get(parsed.categoryId);
    const patInfo = patternMap.get(parsed.recurrencePatternId);
    result.push({
      ...parsed,
      categoryName: catInfo?.name ?? '',
      categoryColor: catInfo?.color ?? '',
      recurrenceName: (patInfo && patInfo.intervalValue > 0) ? (patInfo.name ?? '') : '',
      displayStatus: computeDisplayStatus(parsed.status, parsed.dueDate),
    });
  }

  return sortTodos(result);
}

/** Add a new to-do. Generates UUID, sets defaults, appends row. */
export async function addTodo(
  accessToken: string,
  spreadsheetId: string,
  data: TodoFormData,
): Promise<Todo> {
  const id = uuidv4();
  const now = new Date().toISOString();

  const todo: Todo = {
    _rowIndex: -1,
    id,
    title: data.title,
    description: data.description,
    categoryId: data.categoryId,
    dueDate: data.dueDate,
    originalDueDate: data.dueDate,
    status: 'pending',
    doneDate: '',
    recurrencePatternId: data.recurrencePatternId,
    parentTodoId: '',
    reminderOffsetsDays: data.reminderOffsetsDays,
    attachmentFileIds: '',
    calendarEventIds: '',
    notes: data.notes,
    createdAt: now,
    updatedAt: now,
    deletedAt: '',
  };

  await appendRows(accessToken, spreadsheetId, TAB_NAME, [serializeRow(todo)]);
  return todo;
}

/** Update a to-do's editable fields with full-row-safety. */
export async function updateTodo(
  accessToken: string,
  spreadsheetId: string,
  existingTodo: Todo,
  data: TodoFormData,
): Promise<Todo> {
  const updatedTodo: Todo = {
    ...existingTodo,
    title: data.title,
    description: data.description,
    categoryId: data.categoryId,
    dueDate: data.dueDate,
    recurrencePatternId: data.recurrencePatternId,
    reminderOffsetsDays: data.reminderOffsetsDays,
    notes: data.notes,
    updatedAt: new Date().toISOString(),
  };

  await updateRow(accessToken, spreadsheetId, TAB_NAME, existingTodo._rowIndex, serializeRow(updatedTodo));
  return updatedTodo;
}

/** Mark a to-do as done with full-row-safety. */
export async function markTodoDone(
  accessToken: string,
  spreadsheetId: string,
  existingTodo: Todo,
  data: MarkDoneFormData,
): Promise<Todo> {
  const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  const doneTodo: Todo = {
    ...existingTodo,
    status: 'done',
    doneDate: todayIST,
    notes: data.notes || existingTodo.notes,
    updatedAt: new Date().toISOString(),
  };

  await updateRow(accessToken, spreadsheetId, TAB_NAME, existingTodo._rowIndex, serializeRow(doneTodo));
  return doneTodo;
}

/** Create the next recurrence instance after marking a to-do done. */
export async function createNextRecurrence(
  accessToken: string,
  spreadsheetId: string,
  completedTodo: Todo,
  pattern: RecurrencePattern,
): Promise<Todo> {
  const id = uuidv4();
  const now = new Date().toISOString();

  // Compute next due date
  const nextDueDate = completedTodo.dueDate
    ? computeNextDueDate(
        completedTodo.dueDate,
        pattern.intervalValue,
        pattern.intervalUnit,
        pattern.anchorDay,
      )
    : '';

  // Root reference: flat chain — child's parent_todo_id always points to root
  const rootId = completedTodo.parentTodoId || completedTodo.id;

  const nextTodo: Todo = {
    _rowIndex: -1,
    id,
    title: completedTodo.title,
    description: completedTodo.description,
    categoryId: completedTodo.categoryId,
    dueDate: nextDueDate,
    originalDueDate: nextDueDate,
    status: 'pending',
    doneDate: '',
    recurrencePatternId: completedTodo.recurrencePatternId,
    parentTodoId: rootId,
    reminderOffsetsDays: completedTodo.reminderOffsetsDays,
    attachmentFileIds: '',
    calendarEventIds: '',
    notes: '',
    createdAt: now,
    updatedAt: now,
    deletedAt: '',
  };

  await appendRows(accessToken, spreadsheetId, TAB_NAME, [serializeRow(nextTodo)]);
  return nextTodo;
}

// --- Postpone ---

/** Postpone a to-do to a new due date and log the change. Does NOT touch calendar. */
export async function postponeTodo(
  accessToken: string,
  spreadsheetId: string,
  todo: Todo,
  newDueDate: string,
  reason: string,
): Promise<Todo> {
  // Capture original due date on first postpone (write-once)
  const originalDueDate = todo.originalDueDate === '' ? todo.dueDate : todo.originalDueDate;

  const updatedTodo: Todo = {
    ...todo,
    dueDate: newDueDate,
    originalDueDate,
    updatedAt: new Date().toISOString(),
  };

  // Write full row to sheet
  await updateRow(accessToken, spreadsheetId, TAB_NAME, todo._rowIndex, serializeRow(updatedTodo));

  // Append postpone log entry
  const logEntry = {
    id: uuidv4(),
    itemType: 'todo',
    itemId: todo.id,
    fromDate: todo.dueDate,
    toDate: newDueDate,
    reason: reason.trim(),
    postponedBy: 'user',
    postponedAt: new Date().toISOString(),
  };

  // If log throws after row update, rethrow (accepted trade-off)
  await appendPostponeLog(accessToken, spreadsheetId, logEntry);

  return updatedTodo;
}

// --- Soft Delete / Undo ---

/** Soft-delete a to-do by setting deleted_at. Uses updateCell only — NEVER full-row write. */
export async function softDeleteTodo(
  accessToken: string,
  spreadsheetId: string,
  todo: Todo,
): Promise<void> {
  const isoNow = new Date().toISOString();
  await updateCell(accessToken, spreadsheetId, TAB_NAME, todo._rowIndex, COL.deleted_at, isoNow);
}

/** Undo a soft-delete by clearing deleted_at. Uses updateCell only. */
export async function undoDeleteTodo(
  accessToken: string,
  spreadsheetId: string,
  todo: Todo,
): Promise<void> {
  await updateCell(accessToken, spreadsheetId, TAB_NAME, todo._rowIndex, COL.deleted_at, '');
}

// --- Calendar Event ID Setter ---

/** Replace a to-do's calendarEventIds with full-row-safety. Pass [] to clear. */
export async function setCalendarEventIds(
  accessToken: string,
  spreadsheetId: string,
  todo: Todo,
  eventIds: string[],
): Promise<Todo> {
  const updatedTodo: Todo = {
    ...todo,
    calendarEventIds: serializeEventIds(eventIds),
    updatedAt: new Date().toISOString(),
  };
  await updateRow(accessToken, spreadsheetId, TAB_NAME, todo._rowIndex, serializeRow(updatedTodo));
  return updatedTodo;
}
