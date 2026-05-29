# Implementation Plan: To-Dos Task Tracking

**Branch**: `008-todos-task-tracking` | **Date**: 2026-05-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-todos-task-tracking/spec.md`

## Summary

Build the full To-Dos lifecycle: a todosService (mirroring billsService), todoCategoriesService (mirroring propertiesService), recurrencePatternsService (read-only + computeNextDueDate), calendar reminder extraction to a shared module, migration service for seed data backfill, and UI components (TodoCard, TodoFormModal, MarkDoneModal, CategoriesPage + CategoryFormModal). The TodosPage replaces the current placeholder with full CRUD, mark-done with recurrence auto-generation, postpone, soft-delete-with-undo, and category/status filters. PostponeModal is genericized to accept both bills and to-dos.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, ES2022+

**Primary Dependencies**: React 19, React Router, Tailwind CSS, Lucide React, Google Calendar API v3, Google Sheets API v4

**Storage**: Google Sheets (primary data via Sheets API), Google Calendar (reminder events via Calendar API). No local database.

**Testing**: Manual testing against live Google APIs (no test framework in the project)

**Target Platform**: Mobile-first web app (PWA-capable), primary viewport 375px (iPhone). Runs in any modern browser.

**Project Type**: Single-page web application (React + Vite). No backend server.

**Constraints**: Critical path = sheet writes first, calendar after in try/catch (best-effort). Single-user app — no concurrent-write protection needed.

## Constitution Check

The project constitution (`constitution.md`) contains only template placeholders — no real principles or gates have been defined. No gates to evaluate. Proceeding with standard engineering practices.

## Project Structure

### Documentation (this feature)

```text
specs/008-todos-task-tracking/
├── plan.md              # This file
└── spec.md              # Feature specification
```

### Source Code (files to create and modify)

```text
src/
├── types/
│   └── index.ts                        # MODIFY: add Todo types
├── config/
│   └── schema.ts                       # MODIFY: add generateSeedRecurrencePatterns, update generateSeedTodoCategories
├── services/
│   ├── calendarReminders.ts            # CREATE: extracted shared calendar orchestration
│   ├── recurrencePatternsService.ts    # CREATE: read-only service + computeNextDueDate
│   ├── todoCategoriesService.ts        # CREATE: CRUD for TodoCategories
│   ├── todosService.ts                 # CREATE: full CRUD + helpers
│   ├── migrationService.ts            # CREATE: one-time backfills
│   ├── billsService.ts                # MODIFY: import from calendarReminders.ts
│   └── bootstrapService.ts            # MODIFY: add RecurrencePatterns seeding
├── components/
│   ├── shared/
│   │   ├── PostponeModal.tsx           # CREATE: genericized from bills/PostponeModal
│   │   └── TodoStatusBadge.tsx         # CREATE: status badge for to-dos
│   ├── bills/
│   │   └── PostponeModal.tsx           # DELETE: replaced by shared/PostponeModal
│   ├── todos/
│   │   ├── TodoCard.tsx                # CREATE: mirrors BillCard
│   │   ├── TodoFormModal.tsx           # CREATE: mirrors BillFormModal
│   │   └── MarkDoneModal.tsx           # CREATE: mirrors MarkPaidModal (simpler)
│   └── settings/
│       ├── CategoryCard.tsx            # CREATE: mirrors PropertyCard
│       └── CategoryFormModal.tsx       # CREATE: mirrors PropertyFormModal
├── pages/
│   ├── TodosPage.tsx                   # REWRITE: full to-do list page
│   ├── CategoriesPage.tsx             # CREATE: mirrors PropertiesPage
│   ├── BillsPage.tsx                  # MODIFY: update PostponeModal import
│   ├── SettingsPage.tsx               # MODIFY: add Categories card
│   └── App.tsx                         # MODIFY: add /settings/categories route
```

**Structure Decision**: Calendar orchestration extracted to shared module (not duplicated) because both bills and todos call the same `createReminders`/`cleanupReminders`/`setCalendarEventIds` pattern with different title formats. Extraction avoids divergence and keeps a single source of truth. PostponeModal genericized to `shared/PostponeModal.tsx` for the same reason — single source of truth over parallel components that drift.

## Implementation Design

### Layer 1: Types (src/types/index.ts)

Add these types at the end of the file:

#### `TodoStatus`

```typescript
export type TodoStatus = 'pending' | 'done';
```

Stored values in the Todos sheet. Default: `'pending'`.

#### `TodoDisplayStatus`

```typescript
export type TodoDisplayStatus = 'pending' | 'overdue' | 'done';
```

Computed at runtime. `'overdue'` is derived when status is `'pending'` AND `dueDate < today (IST)`.

#### `Todo`

```typescript
export interface Todo {
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
```

Mirrors Bill structure. `reminderOffsetsDays` stored as CSV string (e.g. `"3,1"`).

#### `TodoWithDisplay`

```typescript
export interface TodoWithDisplay extends Todo {
  categoryName: string;
  categoryColor: string;
  recurrenceName: string;
  displayStatus: TodoDisplayStatus;
}
```

Enriched with resolved display fields from TodoCategories and RecurrencePatterns lookups.

#### `TodoCategory`

```typescript
export interface TodoCategory {
  _rowIndex: number;
  id: string;
  name: string;
  color: string;
  active: boolean;
  deletedAt: string;
}
```

#### `TodoCategoryFormData`

```typescript
export interface TodoCategoryFormData {
  name: string;
  color: string;
}
```

#### `RecurrencePattern`

```typescript
export interface RecurrencePattern {
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
```

#### `TodoFormData`

```typescript
export interface TodoFormData {
  title: string;
  description: string;
  categoryId: string;
  dueDate: string;
  recurrencePatternId: string;
  reminderOffsetsDays: string;
  notes: string;
}
```

#### `MarkDoneFormData`

```typescript
export interface MarkDoneFormData {
  notes: string;
}
```

`PostponeFormData` already exists — reused as-is.

#### `CATEGORY_COLOR_PALETTE`

```typescript
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
```

Used by CategoryFormModal's color picker and by the seed generators.

### Layer 2: Schema + Bootstrap Updates

#### schema.ts — `generateSeedRecurrencePatterns()`

New function returning 5 seed rows per DD-007:

```typescript
export function generateSeedRecurrencePatterns(): string[][] {
  return [
    [uuidv4(), 'One-time', '0', '', '', 'never', '', 'true'],
    [uuidv4(), 'Every month', '1', 'months', '', 'never', '', 'true'],
    [uuidv4(), 'Every 3 months', '3', 'months', '', 'never', '', 'true'],
    [uuidv4(), 'Every 6 months', '6', 'months', '', 'never', '', 'true'],
    [uuidv4(), 'Every year', '1', 'years', '', 'never', '', 'true'],
  ];
}
```

Column order matches HEADER_DEFINITIONS for RecurrencePatterns: `id, name, interval_value, interval_unit, anchor_day, end_condition, end_value, active`.

#### schema.ts — Update `generateSeedTodoCategories()`

Currently generates empty color values. Update to include default colors from the palette:

```typescript
export function generateSeedTodoCategories(): string[][] {
  return [
    [uuidv4(), 'Insurance', '#6366F1', 'true', ''],   // Indigo
    [uuidv4(), 'Tax', '#EF4444', 'true', ''],          // Red
    [uuidv4(), 'Society', '#10B981', 'true', ''],      // Emerald
    [uuidv4(), 'Maintenance', '#F59E0B', 'true', ''],  // Amber
  ];
}
```

#### bootstrapService.ts

Import `generateSeedRecurrencePatterns` from schema.ts. In the seed data section (after TodoCategories seeding), add:

```typescript
// RecurrencePatterns
const existingPatterns = await readValues(
  accessToken, spreadsheetId, "'RecurrencePatterns'!A2:A",
);
if (!existingPatterns?.values?.length) {
  const seedPatterns = generateSeedRecurrencePatterns();
  await appendRows(accessToken, spreadsheetId, 'RecurrencePatterns', seedPatterns);
}
```

This handles NEW users. Existing users get the backfill via migrationService.

### Layer 3: Shared Calendar Reminders Module (src/services/calendarReminders.ts)

Extract `createReminders`, `cleanupReminders`, `setCalendarEventIds`, `ReminderResult`, `parseEventIds`, `serializeEventIds`, `computeReminderDate`, `nextDay`, and `formatDueDate` from `billsService.ts` into this new shared module.

The key change to `createReminders`: accept a generic `title` and `description` string instead of bill-specific fields:

```typescript
export interface ReminderResult {
  eventIds: string[];
  allSucceeded: boolean;
}

export async function createReminders(
  accessToken: string,
  calendarId: string,
  dueDate: string,
  reminderOffsetsDays: number[],
  title: string,
  description: string,
): Promise<ReminderResult> {
  if (reminderOffsetsDays.length === 0) {
    return { eventIds: [], allSucceeded: true };
  }
  const eventIds: string[] = [];
  let allSucceeded = true;
  for (const offset of reminderOffsetsDays) {
    const reminderDate = computeReminderDate(dueDate, offset);
    try {
      const eventId = await createAllDayEvent(accessToken, calendarId, reminderDate, title, description);
      eventIds.push(eventId);
    } catch {
      allSucceeded = false;
    }
  }
  return { eventIds, allSucceeded };
}
```

`cleanupReminders` stays unchanged (already generic).

`setCalendarEventIds` becomes a thin helper that takes the tab name as a parameter, or is left in each service (since it also involves serializeRow which is tab-specific). **Decision**: Keep `setCalendarEventIds` in each service (billsService, todosService) since it requires tab-specific serialize/update logic. Only `createReminders`, `cleanupReminders`, and the shared pure helpers are extracted.

#### billsService.ts update

Remove the extracted functions. Re-export from calendarReminders for backward compatibility (BillsPage.tsx currently imports them from billsService). OR update BillsPage.tsx imports to point to calendarReminders.ts. **Decision**: Update all imports to point to calendarReminders.ts (clean separation, no re-exports).

`billsService.ts` still exports `setCalendarEventIds` (bill-specific). It calls `createReminders` from calendarReminders.ts, building the bill-specific title/description at the call site:

```typescript
// In BillsPage.tsx (or wherever called):
const title = `${billTypeName} — ${propertyName} due ${formatDueDate(dueDate)}`;
const description = `Month: ${formatMonth(month)}` + (amount !== null ? `\nAmount: ${formatCurrency(amount)}` : '');
const result = await createReminders(accessToken, calendarId, dueDate, offsets, title, description);
```

### Layer 4: recurrencePatternsService.ts

Read-only service + the `computeNextDueDate` pure function.

#### `parseRow`

```typescript
export function parseRow(row: RowWithIndex): RecurrencePattern | null {
  const v = row.values;
  if (!v || v.length === 0) return null;
  const id = v[COL.id];
  if (!id) return null;

  const intervalValue = parseInt(v[COL.interval_value] ?? '0', 10);
  const anchorDayStr = v[COL.anchor_day] ?? '';

  return {
    _rowIndex: row.rowIndex,
    id,
    name: v[COL.name] ?? '',
    intervalValue: isNaN(intervalValue) ? 0 : intervalValue,
    intervalUnit: v[COL.interval_unit] ?? '',
    anchorDay: anchorDayStr === '' ? null : parseInt(anchorDayStr, 10),
    endCondition: v[COL.end_condition] ?? 'never',
    endValue: v[COL.end_value] ?? '',
    active: v[COL.active] !== 'false',
  };
}
```

#### `fetchRecurrencePatterns`

```typescript
export async function fetchRecurrencePatterns(
  accessToken: string,
  spreadsheetId: string,
): Promise<RecurrencePattern[]> {
  const rows = await readAllRows(accessToken, spreadsheetId, TAB_NAME);
  const patterns: RecurrencePattern[] = [];
  for (const row of rows) {
    const parsed = parseRow(row);
    if (parsed && parsed.active) {
      patterns.push(parsed);
    }
  }
  return patterns;
}
```

#### `computeNextDueDate` (DD-002)

Pure function implementing the next-due-date algorithm:

```typescript
export function computeNextDueDate(
  currentDueDate: string,
  intervalValue: number,
  intervalUnit: string,
  anchorDay: number | null,
): string {
  if (!currentDueDate || intervalValue <= 0) return '';

  const [year, month, day] = currentDueDate.split('-').map(Number);

  switch (intervalUnit) {
    case 'days': {
      const d = new Date(year, month - 1, day + intervalValue);
      return formatYMD(d);
    }
    case 'weeks': {
      const d = new Date(year, month - 1, day + intervalValue * 7);
      return formatYMD(d);
    }
    case 'months': {
      const targetMonth = month - 1 + intervalValue;  // 0-indexed
      const targetYear = year + Math.floor(targetMonth / 12);
      const targetMon = (targetMonth % 12) + 1;       // back to 1-indexed
      const targetDay = anchorDay ?? day;
      const lastDay = new Date(targetYear, targetMon, 0).getDate();
      const clampedDay = Math.min(targetDay, lastDay);
      return `${targetYear}-${String(targetMon).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
    }
    case 'years': {
      const targetYear = year + intervalValue;
      const targetDay = anchorDay ?? day;
      const lastDay = new Date(targetYear, month, 0).getDate();
      const clampedDay = Math.min(targetDay, lastDay);
      return `${targetYear}-${String(month).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
    }
    default:
      return '';
  }
}

function formatYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
```

**Verification against DD-002 examples**:
- Every 1 month, 2026-01-31 → month=2, lastDay=28 → 2026-02-28 ✓
- Every 1 month, 2026-03-31 → month=4, lastDay=30 → 2026-04-30 ✓
- Every 3 months, 2026-05-15 → month=8, day=15 → 2026-08-15 ✓
- Every 1 year, 2024-02-29 → year=2025, month=2, lastDay=28 → 2025-02-28 ✓
- Every 6 months, 2026-01-31, anchor_day=31 → month=7, lastDay=31 → 2026-07-31 ✓

### Layer 5: todoCategoriesService.ts

Mirrors `propertiesService.ts` exactly:

1. **Tab/column setup**: Derive `COL` from `HEADER_DEFINITIONS` for `'TodoCategories'` tab.

2. **`parseRow(row): TodoCategory | null`**: Parse sheet row. Return null if id is missing.

3. **`serializeRow(cat): string[]`**: `[id, name, color, String(active), deletedAt]`.

4. **`fetchCategories(accessToken, spreadsheetId): Promise<TodoCategory[]>`**: Read all rows, parse, filter `deletedAt === ''`. Returns ALL non-deleted (including inactive) — caller decides whether to filter by active.

5. **`fetchAllCategories(accessToken, spreadsheetId): Promise<TodoCategory[]>`**: Like `fetchCategories` but includes deleted ones. Used for resolving category names on to-dos that reference deleted categories (per edge case in spec).

6. **`addCategory(accessToken, spreadsheetId, data: TodoCategoryFormData): Promise<TodoCategory>`**: Append new row with UUID, data.name, data.color, active=true, deletedAt=''.

7. **`updateCategory(accessToken, spreadsheetId, cat: TodoCategory, data: TodoCategoryFormData): Promise<TodoCategory>`**: Full-row update of name and color.

8. **`toggleCategoryActive(accessToken, spreadsheetId, cat: TodoCategory): Promise<TodoCategory>`**: updateCell on `active` column.

9. **`softDeleteCategory` / `undoDeleteCategory`**: updateCell on `deleted_at`.

### Layer 6: todosService.ts

The primary template is `billsService.ts`. This is the largest new file.

#### Column setup

```typescript
const TAB_NAME = 'Todos';
const TODO_HEADERS = HEADER_DEFINITIONS.find((d) => d.tabName === TAB_NAME)!.headers;
const COL = Object.fromEntries(TODO_HEADERS.map((h, i) => [h, i])) as Record<string, number>;
```

#### `computeDisplayStatus`

```typescript
export function computeDisplayStatus(
  status: TodoStatus,
  dueDate: string,
  today?: string,
): TodoDisplayStatus {
  if (status === 'done') return 'done';
  // status === 'pending'
  const todayStr = today ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (dueDate && dueDate < todayStr) return 'overdue';
  return 'pending';
}
```

#### `sortTodos` (FR-002)

```typescript
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
```

#### `parseRow`

```typescript
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
```

#### `serializeRow`

```typescript
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
```

#### `parseReminderOffsets`

Helper to convert CSV string to number array:

```typescript
export function parseReminderOffsets(csv: string): number[] {
  if (!csv || !csv.trim()) return [];
  return csv.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
}
```

#### `fetchTodos`

```typescript
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
```

Note: `recurrenceName` is empty for One-time (intervalValue === 0) since we don't show a recurrence label for non-recurring items.

#### `addTodo`

```typescript
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
```

#### `updateTodo`

```typescript
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
```

#### `markTodoDone`

```typescript
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
```

#### `createNextRecurrence`

Called after `markTodoDone` when the pattern is recurring (intervalValue > 0):

```typescript
export async function createNextRecurrence(
  accessToken: string,
  spreadsheetId: string,
  completedTodo: Todo,
  pattern: RecurrencePattern,
): Promise<Todo> {
  const id = uuidv4();
  const now = new Date().toISOString();

  // Compute next due date
  let nextDueDate = '';
  if (completedTodo.dueDate) {
    nextDueDate = computeNextDueDate(
      completedTodo.dueDate,
      pattern.intervalValue,
      pattern.intervalUnit,
      pattern.anchorDay,
    );
  }

  // Root ID: if the completed todo has a parentTodoId, use that; otherwise use its own id
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
```

Note: `computeNextDueDate` imported from `recurrencePatternsService.ts`.

#### `postponeTodo`

Mirrors `postponeBill`:

```typescript
export async function postponeTodo(
  accessToken: string,
  spreadsheetId: string,
  todo: Todo,
  newDueDate: string,
  reason: string,
): Promise<Todo> {
  const originalDueDate = todo.originalDueDate === '' ? todo.dueDate : todo.originalDueDate;

  const updatedTodo: Todo = {
    ...todo,
    dueDate: newDueDate,
    originalDueDate,
    updatedAt: new Date().toISOString(),
  };

  await updateRow(accessToken, spreadsheetId, TAB_NAME, todo._rowIndex, serializeRow(updatedTodo));

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

  await appendPostponeLog(accessToken, spreadsheetId, logEntry);
  return updatedTodo;
}
```

#### `softDeleteTodo` / `undoDeleteTodo`

```typescript
export async function softDeleteTodo(accessToken: string, spreadsheetId: string, todo: Todo): Promise<void> {
  await updateCell(accessToken, spreadsheetId, TAB_NAME, todo._rowIndex, COL.deleted_at, new Date().toISOString());
}

export async function undoDeleteTodo(accessToken: string, spreadsheetId: string, todo: Todo): Promise<void> {
  await updateCell(accessToken, spreadsheetId, TAB_NAME, todo._rowIndex, COL.deleted_at, '');
}
```

#### `setCalendarEventIds` (todo-specific)

```typescript
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
```

Imports `serializeEventIds` from `calendarReminders.ts`.

### Layer 7: migrationService.ts

Small module that runs idempotent backfills on app load.

```typescript
import { readAllRows, appendRows } from './sheetsService';
import { generateSeedRecurrencePatterns } from '../config/schema';
import { CATEGORY_COLOR_PALETTE } from '../types';

export async function runMigrations(
  accessToken: string,
  spreadsheetId: string,
): Promise<void> {
  // Migration 1: Seed RecurrencePatterns if empty
  try {
    const rows = await readAllRows(accessToken, spreadsheetId, 'RecurrencePatterns');
    if (rows.length === 0) {
      const seedPatterns = generateSeedRecurrencePatterns();
      await appendRows(accessToken, spreadsheetId, 'RecurrencePatterns', seedPatterns);
    }
  } catch {
    // Non-blocking — user can still use the app; recurrence dropdown will be empty
    console.warn('Migration: Failed to seed RecurrencePatterns');
  }

  // Migration 2: Backfill empty TodoCategory colors
  try {
    const rows = await readAllRows(accessToken, spreadsheetId, 'TodoCategories');
    // ... check for empty color fields, assign from palette in order
    // (Implementation detail: iterate rows, for each with empty color,
    //  assign CATEGORY_COLOR_PALETTE[index % palette.length].hex)
  } catch {
    console.warn('Migration: Failed to backfill TodoCategory colors');
  }
}
```

Called from `TodosPage` on mount (after bootstrap is complete). Runs before data load. Idempotent: checks before writing.

**Alternative considered**: Running on every app load from App.tsx. Recommended approach is from TodosPage mount since the migrations only matter for to-do functionality and we avoid adding latency to non-todo routes.

**Decision**: Run from TodosPage mount. It's cheap (one read of RecurrencePatterns, conditional append) and only matters when the user navigates to `/todos`.

### Layer 8: Genericized PostponeModal (src/components/shared/PostponeModal.tsx)

Move and genericize the existing `bills/PostponeModal.tsx`:

```typescript
export interface PostponeModalProps {
  title: string;              // e.g. "Postpone bill" or "Postpone to-do"
  itemTitle: string;          // e.g. "Maintenance — Mira Flat" or "Renew insurance"
  contextLine: string;        // e.g. "Jun 2026 · ₹5,000" or "Insurance · Every year"
  currentDueDate: string;     // YYYY-MM-DD
  isSaving: boolean;
  onSubmit: (data: PostponeFormData) => void;
  onClose: () => void;
}
```

The modal body is identical to the current PostponeModal — just the context section at the top changes to use `itemTitle`, `contextLine`, and `currentDueDate` props instead of reading from a `BillWithDisplay` object directly.

**BillsPage.tsx update**: Change the import from `../components/bills/PostponeModal` to `../components/shared/PostponeModal` and build the props at the call site:

```tsx
{postponeTarget && (
  <PostponeModal
    title="Postpone bill"
    itemTitle={`${postponeTarget.billTypeName} — ${postponeTarget.propertyName}`}
    contextLine={`${formatMonth(postponeTarget.month)}${postponeTarget.amount !== null ? ` · ${formatCurrency(postponeTarget.amount)}` : ''}`}
    currentDueDate={postponeTarget.dueDate}
    isSaving={isSaving}
    onSubmit={handlePostponeSubmit}
    onClose={() => !isSaving && setPostponeTarget(null)}
  />
)}
```

**TodosPage.tsx usage**:

```tsx
{postponeTarget && (
  <PostponeModal
    title="Postpone to-do"
    itemTitle={postponeTarget.title}
    contextLine={[postponeTarget.categoryName, postponeTarget.recurrenceName].filter(Boolean).join(' · ')}
    currentDueDate={postponeTarget.dueDate}
    isSaving={isSaving}
    onSubmit={handlePostponeSubmit}
    onClose={() => !isSaving && setPostponeTarget(null)}
  />
)}
```

Delete `src/components/bills/PostponeModal.tsx` after the migration.

### Layer 9: TodoStatusBadge Component

New file `src/components/shared/TodoStatusBadge.tsx`:

```typescript
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import type { TodoDisplayStatus } from '../../types';

const STATUS_CONFIG: Record<
  TodoDisplayStatus,
  { bg: string; text: string; Icon: typeof CheckCircle2; label: string }
> = {
  done: { bg: 'bg-emerald-50', text: 'text-emerald-700', Icon: CheckCircle2, label: 'Done' },
  overdue: { bg: 'bg-red-50', text: 'text-red-700', Icon: AlertCircle, label: 'Overdue' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', Icon: Clock, label: 'Pending' },
};
```

Same visual pattern as `BillStatusBadge`.

### Layer 10: TodoCard Component

Mirrors BillCard layout. Key differences:

- Icon: `ListTodo` (from Lucide) instead of `Receipt`
- Title: `todo.title` (primary line), subtitle shows `categoryName · recurrenceName` (if present)
- No amount
- Status badge uses `TodoStatusBadge`
- Action buttons:
  - **Pending/Overdue**: Edit, Mark Done, Postpone (only if dueDate exists), Delete
  - **Done**: Edit, Delete
- Category badge: colored dot + name (if category exists)
- Bell indicator: same as BillCard (if calendarEventIds non-empty)

Props:

```typescript
export interface TodoCardProps {
  todo: TodoWithDisplay;
  onEdit: (todo: TodoWithDisplay) => void;
  onMarkDone: (todo: TodoWithDisplay) => void;
  onPostpone: (todo: TodoWithDisplay) => void;
  onDelete: (todo: TodoWithDisplay) => void;
  isLoading: boolean;
}
```

### Layer 11: TodoFormModal Component

Mirrors BillFormModal. Fields:

1. **Title** (text input, required) — validation: "Title is required."
2. **Category** (dropdown) — active non-deleted TodoCategories + empty "No category" option
3. **Due date** (date input, optional)
4. **Recurrence pattern** (dropdown) — active RecurrencePatterns, default "One-time"
5. **Reminder offsets** (text input, default "3,1") — validation: comma-separated positive integers
6. **Description** (textarea, optional)
7. **Notes** (textarea, optional)

Props:

```typescript
export interface TodoFormModalProps {
  todo: TodoWithDisplay | null;
  categories: TodoCategory[];
  recurrencePatterns: RecurrencePattern[];
  isSaving: boolean;
  onSubmit: (data: TodoFormData) => void;
  onClose: () => void;
}
```

Escape key close, backdrop close, save-in-progress blocking — same pattern as all existing modals.

### Layer 12: MarkDoneModal Component

Simpler than MarkPaidModal — no payment fields. Shows:

1. **Context**: To-do title, category, due date (read-only)
2. **Notes** (textarea, optional) — "Add any notes about completing this to-do"
3. **Actions**: Cancel + "Mark Done" button

Props:

```typescript
export interface MarkDoneModalProps {
  todo: TodoWithDisplay;
  isSaving: boolean;
  onSubmit: (data: MarkDoneFormData) => void;
  onClose: () => void;
}
```

### Layer 13: TodosPage (rewrite)

Replaces the current placeholder. Follows `BillsPage.tsx` pattern closely.

#### State

```typescript
const [todos, setTodos] = useState<TodoWithDisplay[]>([]);
const [categories, setCategories] = useState<TodoCategory[]>([]);
const [allCategories, setAllCategories] = useState<TodoCategory[]>([]);
const [patterns, setPatterns] = useState<RecurrencePattern[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [isSaving, setIsSaving] = useState(false);

// Filters
const [filterCategory, setFilterCategory] = useState<string>('all');
const [filterStatus, setFilterStatus] = useState<string>('all');

// Modals
const [formModal, setFormModal] = useState<{ mode: 'add' | 'edit'; todo?: TodoWithDisplay } | null>(null);
const [markDoneTarget, setMarkDoneTarget] = useState<TodoWithDisplay | null>(null);
const [postponeTarget, setPostponeTarget] = useState<TodoWithDisplay | null>(null);
const [deleteTarget, setDeleteTarget] = useState<TodoWithDisplay | null>(null);
```

#### Data loading

```typescript
const loadData = useCallback(async () => {
  // Run migrations first (idempotent)
  await runMigrations(accessToken!, spreadsheetId);

  // Fetch reference data
  const [catData, allCatData, patternData] = await Promise.all([
    fetchCategories(accessToken!, spreadsheetId),       // non-deleted only
    fetchAllCategories(accessToken!, spreadsheetId),     // includes deleted (for display)
    fetchRecurrencePatterns(accessToken!, spreadsheetId),
  ]);
  setCategories(catData);
  setAllCategories(allCatData);
  setPatterns(patternData);

  // Build maps for enrichment
  const categoryMap = new Map(allCatData.map(c => [c.id, { name: c.name, color: c.color }]));
  const patternMap = new Map(patternData.map(p => [p.id, { name: p.name, intervalValue: p.intervalValue }]));

  // Fetch todos
  const todoData = await fetchTodos(accessToken!, spreadsheetId, categoryMap, patternMap);
  setTodos(todoData);
}, [accessToken, spreadsheetId]);
```

#### Filters

```typescript
const filteredTodos = useMemo(() => {
  let result = todos;
  if (filterCategory !== 'all') {
    result = result.filter(t => t.categoryId === filterCategory);
  }
  if (filterStatus !== 'all') {
    result = result.filter(t => t.displayStatus === filterStatus);
  }
  return sortTodos(result);
}, [todos, filterCategory, filterStatus]);
```

Category filter options derived from todos (categories with at least one to-do). Status filter: All / Pending / Overdue / Done.

#### handleMarkDoneSubmit — Critical Path

```
1. setIsSaving(true)
2. try {
     // Step 1: Mark current to-do done
     const doneTodo = await markTodoDone(accessToken!, spreadsheetId, markDoneTarget, data);

     // Step 2: If recurring, create next instance
     let nextTodo: Todo | null = null;
     const pattern = patterns.find(p => p.id === markDoneTarget.recurrencePatternId);
     if (pattern && pattern.intervalValue > 0) {
       nextTodo = await createNextRecurrence(accessToken!, spreadsheetId, doneTodo, pattern);
     }

     // Step 3: Calendar cleanup on completed to-do (best-effort)
     try {
       const oldIds = parseEventIds(markDoneTarget.calendarEventIds);
       if (oldIds.length > 0) {
         await cleanupReminders(accessToken!, calendarId, oldIds);
         await setCalendarEventIds(accessToken!, spreadsheetId, doneTodo, []);
       }
     } catch { /* best-effort */ }

     // Step 4: Calendar create on new instance (best-effort)
     if (nextTodo && nextTodo.dueDate) {
       try {
         const offsets = parseReminderOffsets(nextTodo.reminderOffsetsDays);
         if (offsets.length > 0) {
           const title = `[To-Do] ${nextTodo.title} due ${formatDueDate(nextTodo.dueDate)}`;
           const catInfo = categoryMap.get(nextTodo.categoryId);
           const desc = catInfo ? `Category: ${catInfo.name}` : '';
           const result = await createReminders(accessToken!, calendarId, nextTodo.dueDate, offsets, title, desc);
           // Need to refetch to get _rowIndex for the new todo
           // OR use setCalendarEventIds after refetch
         }
       } catch { /* best-effort */ }
     }

     // Step 5: Refetch all todos
     await refetchTodos();
     setMarkDoneTarget(null);

     // Step 6: Toast
     if (nextTodo) {
       showToast('To-do marked as done. Next occurrence created.', 'success');
     } else {
       showToast('To-do marked as done.', 'success');
     }
   } catch {
     showToast('Failed to mark to-do as done.', 'error');
   } finally {
     setIsSaving(false);
   }
```

**Note on calendar event IDs for new instances**: After `createNextRecurrence` appends the row, we need its `_rowIndex` to call `setCalendarEventIds`. The simplest approach is to refetch all todos, find the newly created one by id, and then call `setCalendarEventIds` on it. This mirrors the bill flow where `refetchBills` is called to get fresh row indices.

#### handlePostponeSubmit

Identical pattern to BillsPage's `handlePostponeSubmit`, adapted for todos:

1. Same-date guard (info toast, return)
2. `postponeTodo` (critical path)
3. Best-effort calendar replacement
4. Refetch / update in-memory state
5. Close modal + success toast

#### handleDeleteConfirm

Same optimistic delete + undo pattern as BillsPage. Calendar cleanup on delete, calendar recreate on undo (both best-effort).

#### Render

Structure mirrors BillsPage:
- Header with title "To-Dos" + "Add To-Do" button
- Two filter dropdowns (category + status)
- Loading spinner
- Empty state (zero to-dos): ListTodo icon + "No to-dos yet" + "Add a to-do" button
- Filtered empty state: "No to-dos match your filters"
- Todo list (flex col gap-3)
- Modals: TodoFormModal, MarkDoneModal, PostponeModal, ConfirmDialog

### Layer 14: CategoriesPage + CategoryFormModal + CategoryCard

#### CategoriesPage (src/pages/CategoriesPage.tsx)

Mirrors `PropertiesPage.tsx` exactly:

- Back link to `/settings`
- Title "Categories" + "Add Category" button
- Loading spinner
- Empty state: Tags icon + "No categories yet"
- Category list (flex col gap-3 of CategoryCard)
- CategoryFormModal (add/edit)
- ConfirmDialog for delete + undo

State: categories, isLoading, loadingItemId, modalMode, editTarget, isSaving, deleteTarget.

CRUD handlers follow PropertiesPage pattern: add → refetch, edit → in-memory update, toggle → updateCell, delete → optimistic remove + undo.

#### CategoryCard (src/components/settings/CategoryCard.tsx)

Mirrors PropertyCard. Shows:
- Color dot (inline circle with `style={{ backgroundColor: category.color }}`)
- Category name
- Active/inactive toggle
- Edit + Delete buttons

#### CategoryFormModal (src/components/settings/CategoryFormModal.tsx)

Fields:
1. **Name** (text input, required) — "Category name is required."
2. **Color** (preset palette picker) — 8 color swatches from `CATEGORY_COLOR_PALETTE`. Each swatch is a button with the hex background. Selected swatch gets a check mark or ring indicator.

### Layer 15: Settings + Routing Updates

#### SettingsPage.tsx

Add a Categories card to the `CARDS` array:

```typescript
import { Tags } from 'lucide-react';

// Add to CARDS array, after Bill Types:
{
  label: 'Categories',
  description: 'Manage to-do categories',
  icon: Tags,
  to: '/settings/categories',
},
```

#### App.tsx

Add the CategoriesPage route inside the BootstrapLayout:

```tsx
import CategoriesPage from './pages/CategoriesPage';

// Add after /settings/bill-types route:
<Route path="/settings/categories" element={<ProtectedRoute><CategoriesPage /></ProtectedRoute>} />
```

### Cross-Cutting Concerns

#### Toast Messages

| Scenario | Message | Severity |
|----------|---------|----------|
| Add success | "To-do added." | success |
| Add + calendar fail | "To-do added, but reminders couldn't be set." | error |
| Edit success | "To-do updated." | success |
| Edit + calendar fail | "To-do updated, but reminders couldn't be updated." | error |
| Mark done (non-recurring) | "To-do marked as done." | success |
| Mark done (recurring) | "To-do marked as done. Next occurrence created." | success |
| Mark done + calendar fail | "To-do marked as done, but calendar reminders couldn't be updated." | error |
| Mark done failure | "Failed to mark to-do as done." | error |
| Postpone success | "To-do postponed." | success |
| Postpone + calendar fail | "To-do postponed, but calendar reminders couldn't be updated." | error |
| Postpone failure | "Failed to postpone to-do." | error |
| Same-date no-op | "New date is the same as the current due date." | info |
| Delete success | "To-do deleted." | undo toast |
| Delete failure | "Failed to delete to-do." | error |
| Undo failure | "Failed to undo delete." | error |
| Category add | "Category added." | success |
| Category edit | "Category updated." | success |
| Category delete | `"${name}" deleted.` | undo toast |

#### Calendar Event Title Format

Bills: `"${billTypeName} — ${propertyName} due ${formatDueDate(dueDate)}"`
Todos: `"[To-Do] ${title} due ${formatDueDate(dueDate)}"`
Todo description: `"Category: ${categoryName}"` (if category exists, else empty)

#### Full-Row-Safety

All CRUD operations use the same read-modify-write-entire-row pattern via `updateRow`. Soft-delete/undo use `updateCell` on `deleted_at` only.

## Implementation Chunks

### Chunk 1: Types + Schema Seeds + migrationService + recurrencePatternsService + todoCategoriesService

**Files created**: `src/services/recurrencePatternsService.ts`, `src/services/todoCategoriesService.ts`, `src/services/migrationService.ts`

**Files modified**: `src/types/index.ts`, `src/config/schema.ts`, `src/services/bootstrapService.ts`

**Deliverables**:
- All new types in `index.ts` (TodoStatus, TodoDisplayStatus, Todo, TodoWithDisplay, TodoCategory, TodoCategoryFormData, RecurrencePattern, TodoFormData, MarkDoneFormData, CATEGORY_COLOR_PALETTE)
- `generateSeedRecurrencePatterns()` in schema.ts
- Updated `generateSeedTodoCategories()` with colors
- RecurrencePatterns seeding in bootstrapService.ts
- Complete `recurrencePatternsService.ts`: parseRow, fetchRecurrencePatterns, computeNextDueDate
- Complete `todoCategoriesService.ts`: parseRow, serializeRow, fetchCategories, fetchAllCategories, addCategory, updateCategory, toggleCategoryActive, softDeleteCategory, undoDeleteCategory
- Complete `migrationService.ts`: runMigrations (seed RecurrencePatterns if empty, backfill empty TodoCategory colors)

**Dependencies**: None — foundational layer

**Verification**: Build passes. `computeNextDueDate` can be verified via console against the DD-002 test cases.

### Chunk 2: todosService + calendarReminders extraction

**Files created**: `src/services/calendarReminders.ts`, `src/services/todosService.ts`

**Files modified**: `src/services/billsService.ts`, `src/pages/BillsPage.tsx`

**Deliverables**:
- `calendarReminders.ts`: createReminders (generic title/description), cleanupReminders, parseEventIds, serializeEventIds, computeReminderDate, nextDay, formatDueDate, ReminderResult
- `billsService.ts` updated: remove extracted functions, keep bill-specific `setCalendarEventIds`. Remove `createReminders`'s bill-specific parameters.
- `BillsPage.tsx` updated: import calendar helpers from `calendarReminders.ts`, build bill-specific title/description at call sites
- Complete `todosService.ts`: parseRow, serializeRow, computeDisplayStatus, sortTodos, parseReminderOffsets, fetchTodos, addTodo, updateTodo, markTodoDone, createNextRecurrence, postponeTodo, softDeleteTodo, undoDeleteTodo, setCalendarEventIds

**Dependencies**: Chunk 1 (types, recurrencePatternsService for computeNextDueDate)

**Verification**: Build passes. BillsPage still works identically (regression check — calendar operations unchanged).

### Chunk 3: TodoCard + TodoFormModal + MarkDoneModal + TodoStatusBadge + Genericized PostponeModal

**Files created**: `src/components/shared/TodoStatusBadge.tsx`, `src/components/shared/PostponeModal.tsx`, `src/components/todos/TodoCard.tsx`, `src/components/todos/TodoFormModal.tsx`, `src/components/todos/MarkDoneModal.tsx`

**Files modified**: `src/pages/BillsPage.tsx` (update PostponeModal import + props)

**Files deleted**: `src/components/bills/PostponeModal.tsx`

**Deliverables**:
- `TodoStatusBadge`: 3-state badge (Pending/Overdue/Done) with semantic colors
- `PostponeModal` (shared): generic props (title, itemTitle, contextLine, currentDueDate)
- BillsPage.tsx: updated to use shared PostponeModal with bill-specific props
- `TodoCard`: card component with category badge, status badge, recurrence label, action buttons
- `TodoFormModal`: add/edit form with title, category, due date, recurrence, reminder offsets, description, notes
- `MarkDoneModal`: simple modal with optional notes input

**Dependencies**: Chunks 1-2 (types, todosService)

**Verification**: Build passes. BillsPage postpone still works with the genericized modal.

### Chunk 4: TodosPage (rewrite) — first testable to-do flow

**Files modified**: `src/pages/TodosPage.tsx`

**Deliverables**:
- Full page rewrite replacing placeholder
- Data loading (migrations + categories + patterns + todos)
- Filters (category + status)
- All handlers: add, edit, mark done (with recurrence), postpone, delete (with undo)
- Best-effort calendar operations on all mutations
- All modals wired: TodoFormModal, MarkDoneModal, PostponeModal, ConfirmDialog
- Loading, empty, filtered-empty states
- Document title "NoDues · To-Dos"

**Dependencies**: Chunks 1-3 (all services + all components)

**Verification**: Full manual testing of the to-do lifecycle:
1. Add a one-time to-do with no due date → appears in list
2. Add a recurring to-do with due date and reminders → calendar events created
3. Mark recurring to-do done → next occurrence auto-generated with correct next due date
4. Postpone a to-do → PostponeLog row created, calendar replaced
5. Edit a to-do → row updated, calendar replaced if due date changed
6. Delete a to-do → soft-deleted, undo works
7. Filter by category and status

### Chunk 5: CategoriesPage + CategoryFormModal + CategoryCard + Settings hub + routing

**Files created**: `src/pages/CategoriesPage.tsx`, `src/components/settings/CategoryCard.tsx`, `src/components/settings/CategoryFormModal.tsx`

**Files modified**: `src/pages/SettingsPage.tsx`, `src/App.tsx`

**Deliverables**:
- `CategoriesPage`: full CRUD page (list/add/edit/toggle/soft-delete-with-undo)
- `CategoryCard`: card with color dot, name, active toggle, edit/delete buttons
- `CategoryFormModal`: name input + preset palette color picker
- SettingsPage: "Categories" card added (Tags icon, link to /settings/categories)
- App.tsx: /settings/categories route added

**Dependencies**: Chunks 1-2 (todoCategoriesService, types)

**Verification**:
1. Navigate to Settings → Categories card visible
2. Click → CategoriesPage shows seeded categories with colors
3. Add a category with name + color → appears in list
4. Edit category name/color → updates
5. Toggle active → dropdown in TodoFormModal updates
6. Delete with undo → soft-delete works, existing to-dos still show old category

## Complexity Tracking

No constitution violations to justify. The implementation extends existing patterns consistently:

- **Services**: todosService follows billsService exactly. todoCategoriesService follows propertiesService. recurrencePatternsService is a minimal read-only service.
- **Components**: TodoCard/TodoFormModal/MarkDoneModal follow their bill counterparts with to-do-specific simplifications (no amount, no composite key, no payment fields).
- **Calendar extraction**: The only structural change — extracting 7 functions from billsService to a shared module. This is a net simplification (removes duplication) rather than new complexity.
- **PostponeModal genericization**: Replaces one bill-specific component with one generic component. Net zero in component count, reduces future maintenance.
- **migrationService**: ~30 lines of idempotent backfill code. Non-blocking on failure.
- **computeNextDueDate**: Single pure function (~30 lines) with well-defined DD-002 test cases.
