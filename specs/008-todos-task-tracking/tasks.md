# Tasks: To-Dos Task Tracking

**Input**: Design documents from `/specs/008-todos-task-tracking/`

**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: No automated tests. Manual testing via quickstart.md.

**Organization**: Tasks ordered bottom-up: types + schema + services foundation → calendar extraction + todosService → components (including shared PostponeModal genericization) → TodosPage rewrite → CategoriesPage + Settings + routing → final validation. Grouped by implementation chunk for independent testing.

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no dependencies)

## User Story Map

| Story | Spec Section | Priority | Summary |
|-------|-------------|----------|---------|
| US1 | User Story 1 | P1 | View and filter to-dos |
| US2 | User Story 2 | P1 | Add a to-do |
| US3 | User Story 3 | P1 | Mark a to-do as done (with recurrence) |
| US4 | User Story 4 | P2 | Postpone a to-do |
| US5 | User Story 5 | P1 | Edit a to-do |
| US6 | User Story 6 | P1 | Soft-delete a to-do with undo |
| US7 | User Story 7 | P1 | Manage to-do categories |

---

## Phase 1: Foundation — Types + Schema + Bootstrap

**Purpose**: Core types, seed generators, and bootstrap update that ALL subsequent work depends on. Must complete before any service or UI work.

- [ ] T001 [P] Add Todo types and `CATEGORY_COLOR_PALETTE` to `src/types/index.ts`
  - Append after the existing `PostponeFormData` / file-attachment types block
  - Add `TodoStatus` type: `'pending' | 'done'`
  - Add `TodoDisplayStatus` type: `'pending' | 'overdue' | 'done'`
  - Add `Todo` interface: `_rowIndex`, `id`, `title`, `description`, `categoryId`, `dueDate`, `originalDueDate`, `status` (TodoStatus), `doneDate`, `recurrencePatternId`, `parentTodoId`, `reminderOffsetsDays` (string, CSV), `attachmentFileIds`, `calendarEventIds`, `notes`, `createdAt`, `updatedAt`, `deletedAt`
  - Add `TodoWithDisplay` interface extending `Todo`: `categoryName`, `categoryColor`, `recurrenceName`, `displayStatus` (TodoDisplayStatus)
  - Add `TodoCategory` interface: `_rowIndex`, `id`, `name`, `color`, `active` (boolean), `deletedAt`
  - Add `TodoCategoryFormData` interface: `name`, `color`
  - Add `RecurrencePattern` interface: `_rowIndex`, `id`, `name`, `intervalValue` (number), `intervalUnit` (string), `anchorDay` (number | null), `endCondition` (string), `endValue` (string), `active` (boolean)
  - Add `TodoFormData` interface: `title`, `description`, `categoryId`, `dueDate`, `recurrencePatternId`, `reminderOffsetsDays`, `notes`
  - Add `MarkDoneFormData` interface: `notes`
  - Note: `PostponeFormData` already exists — reused as-is for to-do postpone
  - Add `CATEGORY_COLOR_PALETTE` exported const array with 8 `{ name, hex }` pairs: Slate `#64748B`, Red `#EF4444`, Amber `#F59E0B`, Emerald `#10B981`, Cyan `#06B6D4`, Indigo `#6366F1`, Purple `#A855F7`, Pink `#EC4899`. Use `as const`

- [ ] T002 [P] Add `generateSeedRecurrencePatterns()` and update `generateSeedTodoCategories()` in `src/config/schema.ts`
  - Import `v4 as uuidv4` from `uuid` (already imported)
  - Add `generateSeedRecurrencePatterns(): string[][]` returning 5 seed rows per DD-007. Column order matches HEADER_DEFINITIONS for RecurrencePatterns: `[id, name, interval_value, interval_unit, anchor_day, end_condition, end_value, active]`
    - `[uuidv4(), 'One-time', '0', '', '', 'never', '', 'true']`
    - `[uuidv4(), 'Every month', '1', 'months', '', 'never', '', 'true']`
    - `[uuidv4(), 'Every 3 months', '3', 'months', '', 'never', '', 'true']`
    - `[uuidv4(), 'Every 6 months', '6', 'months', '', 'never', '', 'true']`
    - `[uuidv4(), 'Every year', '1', 'years', '', 'never', '', 'true']`
  - Update existing `generateSeedTodoCategories()` to include default colors from the palette:
    - Insurance → `#6366F1` (Indigo)
    - Tax → `#EF4444` (Red)
    - Society → `#10B981` (Emerald)
    - Maintenance → `#F59E0B` (Amber)
  - Export `generateSeedRecurrencePatterns`

- [ ] T003 [P] Add RecurrencePatterns seeding block to `src/services/bootstrapService.ts`
  - Import `generateSeedRecurrencePatterns` from `../config/schema`
  - In the seed data section, AFTER the TodoCategories seeding block (line ~328), add a RecurrencePatterns seeding block:
    - Read `"'RecurrencePatterns'!A2:A"` to check if rows exist
    - If no existing rows, call `generateSeedRecurrencePatterns()` and `appendRows` to `'RecurrencePatterns'`
  - This handles NEW users. Existing users get the backfill via migrationService (T006)

**Checkpoint**: Build passes. All new types compile. Seed generators produce correct row counts and column order.

---

## Phase 2: Services Foundation — recurrencePatternsService + todoCategoriesService + migrationService

**Purpose**: Read-only recurrence service, CRUD category service, and migration backfills. Required before todosService (which imports `computeNextDueDate`) and before any UI work.

- [ ] T004 [P] Create `src/services/recurrencePatternsService.ts` — read-only service + `computeNextDueDate`
  - Tab/column setup: derive `COL` from `HEADER_DEFINITIONS` for `'RecurrencePatterns'` tab (same pattern as billsService/propertiesService)
  - `parseRow(row: RowWithIndex): RecurrencePattern | null` — return `null` if `id` is missing. Parse `intervalValue` with `parseInt(v[COL.interval_value] ?? '0', 10)`, default to `0` if `NaN`. Parse `anchorDay`: empty string → `null`, otherwise `parseInt`. `active`: `v[COL.active] !== 'false'`
  - `fetchRecurrencePatterns(accessToken, spreadsheetId): Promise<RecurrencePattern[]>` — read all rows via `readAllRows`, parse each, filter `parsed.active === true`, return array
  - `computeNextDueDate(currentDueDate: string, intervalValue: number, intervalUnit: string, anchorDay: number | null): string` — pure function, handle all 4 interval units:
    - Guard: if `!currentDueDate || intervalValue <= 0` return `''`
    - Parse `[year, month, day]` from `currentDueDate.split('-').map(Number)`
    - `'days'`: `new Date(year, month - 1, day + intervalValue)` → `formatYMD(d)`
    - `'weeks'`: `new Date(year, month - 1, day + intervalValue * 7)` → `formatYMD(d)`
    - `'months'`: `targetMonth = month - 1 + intervalValue` (0-indexed); `targetYear = year + Math.floor(targetMonth / 12)`; `targetMon = (targetMonth % 12) + 1` (back to 1-indexed); `targetDay = anchorDay ?? day`; `lastDay = new Date(targetYear, targetMon, 0).getDate()`; `clampedDay = Math.min(targetDay, lastDay)`; format as `YYYY-MM-DD`
    - `'years'`: `targetYear = year + intervalValue`; `targetDay = anchorDay ?? day`; `lastDay = new Date(targetYear, month, 0).getDate()`; `clampedDay = Math.min(targetDay, lastDay)`; format as `YYYY-MM-DD`
    - Default: return `''`
  - Private `formatYMD(d: Date): string` — zero-padded `YYYY-MM-DD`
  - **Verification comments** (inline or at function top): include DD-002 examples:
    - Every 1 month, 2026-01-31 → 2026-02-28 (Feb 28 days)
    - Every 1 month, 2026-03-31 → 2026-04-30 (Apr 30 days)
    - Every 3 months, 2026-05-15 → 2026-08-15
    - Every 1 year, 2024-02-29 → 2025-02-28 (non-leap)
    - Every 6 months, 2026-01-31, anchor_day=31 → 2026-07-31
  - Imports: `HEADER_DEFINITIONS` from `../config/schema`, `readAllRows` from `./sheetsService`, `RecurrencePattern`, `RowWithIndex` from `../types`

- [ ] T005 [P] Create `src/services/todoCategoriesService.ts` — full CRUD mirroring `propertiesService.ts`
  - Tab/column setup: `TAB_NAME = 'TodoCategories'`, derive `COL` from `HEADER_DEFINITIONS`
  - `parseRow(row: RowWithIndex): TodoCategory | null` — return `null` if `id` missing. Map: `id`, `name`, `color` (default `''`), `active` (`v[COL.active] === 'true'`), `deletedAt`
  - `serializeRow(cat: TodoCategory): string[]` — output in HEADER_DEFINITIONS order: `[id, name, color, String(active), deletedAt]`
  - `fetchCategories(accessToken, spreadsheetId): Promise<TodoCategory[]>` — read all rows, parse, filter `deletedAt === ''`. Returns ALL non-deleted (including inactive)
  - `fetchAllCategories(accessToken, spreadsheetId): Promise<TodoCategory[]>` — like `fetchCategories` but includes deleted ones (for resolving category names on to-dos that reference deleted categories)
  - `addCategory(accessToken, spreadsheetId, data: TodoCategoryFormData): Promise<TodoCategory>` — append with UUID, `data.name`, `data.color`, `active=true`, `deletedAt=''`
  - `updateCategory(accessToken, spreadsheetId, cat: TodoCategory, data: TodoCategoryFormData): Promise<TodoCategory>` — full-row update via `updateRow`, update name and color
  - `toggleCategoryActive(accessToken, spreadsheetId, cat: TodoCategory): Promise<TodoCategory>` — `updateCell` on `active` column, toggle value
  - `softDeleteCategory(accessToken, spreadsheetId, cat: TodoCategory): Promise<void>` — `updateCell` on `deleted_at` with ISO timestamp. Non-cascading: existing to-dos keep their category_id
  - `undoDeleteCategory(accessToken, spreadsheetId, cat: TodoCategory): Promise<void>` — `updateCell` on `deleted_at` with `''`
  - Imports: `v4 as uuidv4` from `uuid`, `HEADER_DEFINITIONS` from `../config/schema`, `readAllRows`, `updateRow`, `updateCell`, `appendRows` from `./sheetsService`, `TodoCategory`, `TodoCategoryFormData`, `RowWithIndex` from `../types`

- [ ] T006 Create `src/services/migrationService.ts` — idempotent backfills
  - `runMigrations(accessToken, spreadsheetId): Promise<void>`
  - **Migration 1**: Seed RecurrencePatterns if empty
    - `try/catch` — read all rows from `'RecurrencePatterns'`. If `rows.length === 0`, call `generateSeedRecurrencePatterns()` and `appendRows`
    - Catch: `console.warn('Migration: Failed to seed RecurrencePatterns')` — non-blocking
  - **Migration 2**: Backfill empty TodoCategory colors
    - `try/catch` — read all rows from `'TodoCategories'`. Iterate rows, for each parsed row with empty `color`, assign `CATEGORY_COLOR_PALETTE[index % palette.length].hex` and `updateCell` on the color column
    - Idempotent: only updates rows with empty color
    - Catch: `console.warn('Migration: Failed to backfill TodoCategory colors')` — non-blocking
  - Called from TodosPage mount (NOT App.tsx). Non-blocking on failure
  - Imports: `readAllRows`, `appendRows`, `updateCell` from `./sheetsService`, `generateSeedRecurrencePatterns` from `../config/schema`, `CATEGORY_COLOR_PALETTE` from `../types`, `HEADER_DEFINITIONS` from `../config/schema`

**Checkpoint**: Build passes. Services compile and export correctly. `computeNextDueDate` can be verified via console against the 5 DD-002 test cases.

---

## Phase 3: Calendar Extraction + todosService

**Purpose**: Extract shared calendar orchestration to a common module, update BillsPage call sites, then build the full todosService. This is the critical-path data layer for all to-do operations.

- [ ] T007 Extract `src/services/calendarReminders.ts` from `billsService.ts` + update `billsService.ts`
  - **Create** `src/services/calendarReminders.ts` — extract these from `billsService.ts`:
    - `ReminderResult` interface: `{ eventIds: string[]; allSucceeded: boolean }`
    - `parseEventIds` (alias for `parseFileIds` pattern — parse CSV string to string array)
    - `serializeEventIds` (alias — join array to CSV string)
    - `computeReminderDate(dueDateStr, offsetDays): string`
    - `nextDay(dateStr): string`
    - `formatDueDate(dateStr): string` (formats "2026-06-05" as "5 Jun 2026")
    - `createReminders` — **SIGNATURE CHANGE**: accept generic `title: string` and `description: string` instead of bill-specific `billTypeName`, `propertyName`, `amount`, `month`. Remove internal title/description construction. The function now receives pre-built title and description strings
    - `cleanupReminders(accessToken, calendarId, eventIds): Promise<void>` — unchanged (already generic)
  - **Modify** `src/services/billsService.ts`:
    - Remove the extracted functions: `parseEventIds`, `serializeEventIds` (aliases), `computeReminderDate`, `nextDay`, `formatDueDate`, `ReminderResult`, `createReminders`, `cleanupReminders`
    - Keep `parseFileIds` and `serializeFileIds` (bill-specific, used for attachment IDs)
    - Keep `setCalendarEventIds` (bill-specific — uses `serializeRow` with Bill type)
    - Import `parseEventIds`, `serializeEventIds`, `formatDueDate`, `computeReminderDate`, `createReminders`, `cleanupReminders` from `./calendarReminders` for internal use
    - Re-export `parseEventIds`, `cleanupReminders`, `setCalendarEventIds`, `formatDueDate`, `formatMonth`, `formatCurrency` so existing external imports still resolve (BillsPage will be updated in T008, but keep re-exports as safety net)

- [ ] T008 Update `src/pages/BillsPage.tsx` to use `calendarReminders.ts` imports + build bill-specific title/description at call sites
  - Change imports: move `parseEventIds`, `createReminders`, `cleanupReminders` from `../services/billsService` to `../services/calendarReminders`. Keep `setCalendarEventIds`, `formatMonth`, `formatCurrency`, `computeDisplayStatus`, etc. from `billsService`
  - Import `formatDueDate` from `../services/calendarReminders`
  - Update ALL `createReminders` call sites (there are 4: `saveNewBill`, `saveEditBill`, `handlePostponeSubmit`, `handleDeleteConfirm` undo) to build the bill-specific title and description before calling:
    - Title: `` `${billTypeName} \u2014 ${propertyName} due ${formatDueDate(dueDate)}` ``
    - Description: `` `Month: ${formatMonth(month)}` + (amount !== null ? `\nAmount: ${formatCurrency(amount)}` : '') ``
    - Pass these as `title` and `description` args instead of `billTypeName`, `propertyName`, `amount`, `month`
  - **REGRESSION CHECK**: After this task, BillsPage must work identically from the user's perspective:
    - Add bill + calendar → title/description format unchanged
    - Edit bill (due date change) + calendar → cleanup + create still works
    - Postpone + calendar replacement → works identically
    - Mark paid + calendar cleanup → works
    - Delete + calendar cleanup → works
    - Undo delete + calendar recreation → works

- [ ] T009 Create `src/services/todosService.ts` — full CRUD + helpers
  - Tab/column setup: `TAB_NAME = 'Todos'`, derive `COL` from `HEADER_DEFINITIONS`
  - **`computeDisplayStatus(status: TodoStatus, dueDate: string, today?: string): TodoDisplayStatus`** — if `status === 'done'` return `'done'`. Otherwise check `dueDate < todayIST` → `'overdue'`, else `'pending'`. Default today via `new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })`
  - **`sortTodos(todos: TodoWithDisplay[]): TodoWithDisplay[]`** — sort order per requirement #8:
    - Status priority: overdue=0, pending=1, done=2
    - Within overdue: oldest due first (`a.dueDate.localeCompare(b.dueDate)`)
    - Within pending: with due_date soonest first → without due_date newest created first
    - Within done: most recent done_date first (`b.doneDate.localeCompare(a.doneDate)`)
    - Mirror `sortBills` structure
  - **`parseRow(row: RowWithIndex): Todo | null`** — per requirement #6: return `null` on missing `id`. Status defaults to `'pending'` on invalid/missing values (validate against `VALID_TODO_STATUSES = ['pending', 'done']`)
  - **`serializeRow(todo: Todo): string[]`** — per requirement #6: output in HEADER_DEFINITIONS order. 17 columns: `id, title, description, category_id, due_date, original_due_date, status, done_date, recurrence_pattern_id, parent_todo_id, reminder_offsets_days, attachment_file_ids, calendar_event_ids, notes, created_at, updated_at, deleted_at`
  - **`parseReminderOffsets(csv: string): number[]`** — split CSV, parseInt each, filter `!isNaN(n) && n > 0`
  - **`fetchTodos(accessToken, spreadsheetId, categoryMap, patternMap): Promise<TodoWithDisplay[]>`** — read all rows, parse, filter `deletedAt === ''`, enrich with category name/color and recurrence name (empty for One-time / intervalValue===0), compute `displayStatus`, sort via `sortTodos`
  - **`addTodo(accessToken, spreadsheetId, data: TodoFormData): Promise<Todo>`** — UUID, set `originalDueDate = dueDate`, `status = 'pending'`, `createdAt/updatedAt = now`, append via `appendRows`
  - **`updateTodo(accessToken, spreadsheetId, existingTodo, data: TodoFormData): Promise<Todo>`** — spread existing, update editable fields, `updatedAt = now`, full-row write via `updateRow`
  - **`markTodoDone(accessToken, spreadsheetId, existingTodo, data: MarkDoneFormData): Promise<Todo>`** — set `status = 'done'`, `doneDate = todayIST`, `notes = data.notes || existingTodo.notes`, `updatedAt = now`, full-row write
  - **`createNextRecurrence(accessToken, spreadsheetId, completedTodo, pattern: RecurrencePattern): Promise<Todo>`** — per requirement #3:
    - Compute next due date via `computeNextDueDate` (imported from recurrencePatternsService)
    - `parentTodoId = completedTodo.parentTodoId || completedTodo.id` (root reference, flat chain)
    - Copy title, description, categoryId, recurrencePatternId, reminderOffsetsDays. Clear attachmentFileIds, calendarEventIds, notes. Set `originalDueDate = nextDueDate`
    - Append via `appendRows`, return new Todo with `_rowIndex = -1`
  - **`postponeTodo(accessToken, spreadsheetId, todo, newDueDate, reason): Promise<Todo>`** — mirror `postponeBill`: capture `originalDueDate` (write-once), full-row update, append PostponeLog with `itemType: 'todo'`. Import `appendPostponeLog` from `./postponeLogService`
  - **`softDeleteTodo(accessToken, spreadsheetId, todo): Promise<void>`** — per requirement #9: `updateCell` on `deleted_at` only. NEVER call `setCalendarEventIds` on a deleted todo
  - **`undoDeleteTodo(accessToken, spreadsheetId, todo): Promise<void>`** — `updateCell` on `deleted_at` with `''`
  - **`setCalendarEventIds(accessToken, spreadsheetId, todo, eventIds): Promise<Todo>`** — todo-specific: update `calendarEventIds` via `serializeEventIds` (from calendarReminders), `updatedAt = now`, full-row write via `updateRow`
  - Imports: `v4 as uuidv4` from `uuid`, `HEADER_DEFINITIONS` from `../config/schema`, sheet operations from `./sheetsService`, `appendPostponeLog` from `./postponeLogService`, `computeNextDueDate` from `./recurrencePatternsService`, `serializeEventIds` from `./calendarReminders`, types from `../types`

**Checkpoint**: Build passes. billsService still exports what BillsPage needs. todosService compiles with full CRUD. BillsPage regression verified manually.

---

## Phase 4: Components — TodoStatusBadge + PostponeModal + TodoCard + TodoFormModal + MarkDoneModal

**Purpose**: All UI components needed before the TodosPage rewrite. PostponeModal genericization includes migrating BillsPage.

- [ ] T010 [P] Create `src/components/shared/TodoStatusBadge.tsx`
  - Props: `{ displayStatus: TodoDisplayStatus }`
  - `STATUS_CONFIG` record mapping each `TodoDisplayStatus` to `{ bg, text, Icon, label }`:
    - `done`: `bg-emerald-50`, `text-emerald-700`, `CheckCircle2`, `'Done'`
    - `overdue`: `bg-red-50`, `text-red-700`, `AlertCircle`, `'Overdue'`
    - `pending`: `bg-amber-50`, `text-amber-700`, `Clock`, `'Pending'`
  - Render: `<span>` with `inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium` + status bg/text classes. Include `aria-label={`Status: ${label}`}`. Icon at `w-3 h-3`
  - Same visual pattern as `BillStatusBadge`
  - Import `CheckCircle2`, `AlertCircle`, `Clock` from `lucide-react`, `TodoDisplayStatus` from `../../types`

- [ ] T011 [P] Create `src/components/shared/PostponeModal.tsx` — genericized from `bills/PostponeModal.tsx`
  - Per requirement #4: Props interface `PostponeModalProps`:
    - `title: string` (e.g. "Postpone bill" or "Postpone to-do")
    - `itemTitle: string` (e.g. "Maintenance — Mira Flat" or "Renew insurance")
    - `contextLine: string` (e.g. "Jun 2026 · ₹5,000" or "Insurance · Every year")
    - `currentDueDate: string` (YYYY-MM-DD)
    - `isSaving: boolean`
    - `onSubmit: (data: PostponeFormData) => void`
    - `onClose: () => void`
  - Body is identical to current `bills/PostponeModal.tsx` — context section uses props instead of reading from a `BillWithDisplay`:
    - `<h2>{title}</h2>`
    - `<p>{itemTitle}</p>`
    - `<p>{contextLine}</p>` (only render if non-empty)
    - Current due date displayed via `formatDueDate(currentDueDate)` — import from `../services/calendarReminders`
    - New due date input, reason textarea, Cancel/Postpone buttons — all identical to existing modal
  - Escape key close, backdrop close, validation, clearError helper — same patterns
  - Import `formatDueDate` from `../../services/calendarReminders`, `PostponeFormData` from `../../types`, `Loader2` from `lucide-react`

- [ ] T012 Migrate BillsPage to shared PostponeModal + delete `src/components/bills/PostponeModal.tsx`
  - Update `src/pages/BillsPage.tsx`:
    - Change import from `../components/bills/PostponeModal` to `../components/shared/PostponeModal`
    - Update the `<PostponeModal>` render to build bill-specific props at the call site:
      ```
      title="Postpone bill"
      itemTitle={`${postponeTarget.billTypeName} — ${postponeTarget.propertyName}`}
      contextLine={`${formatMonth(postponeTarget.month)}${postponeTarget.amount !== null ? ` · ${formatCurrency(postponeTarget.amount)}` : ''}`}
      currentDueDate={postponeTarget.dueDate}
      isSaving={isSaving}
      onSubmit={handlePostponeSubmit}
      onClose={() => !isSaving && setPostponeTarget(null)}
      ```
  - DELETE `src/components/bills/PostponeModal.tsx`
  - Verify BillsPage postpone still works identically

- [ ] T013 [P] Create `src/components/todos/TodoCard.tsx` — mirrors BillCard layout
  - Props interface `TodoCardProps`: `todo: TodoWithDisplay`, `onEdit`, `onMarkDone`, `onPostpone`, `onDelete` (all `(todo: TodoWithDisplay) => void`), `isLoading: boolean`
  - Icon: `ListTodo` from `lucide-react` (instead of `Receipt`)
  - Top section: `todo.title` (primary line). Subtitle: `categoryName · recurrenceName` joined with ` · `, filter out empty strings. Show nothing if both empty
  - Category badge: if `todo.categoryColor` and `todo.categoryName`, render a small inline dot (8x8 circle div with `style={{ backgroundColor: todo.categoryColor }}`) + category name text
  - Status badge: `<TodoStatusBadge displayStatus={todo.displayStatus} />`
  - Due date: if `todo.dueDate`, format via `formatDueDate` (from calendarReminders)
  - Bell indicator: if `todo.calendarEventIds` non-empty, show `Bell` icon (same pattern as BillCard)
  - Action buttons per display status (per FR-011):
    - Pending / Overdue: Edit (`Pencil`), Mark Done (emerald, `CheckCircle2`), Postpone (`CalendarClock`, only if `todo.dueDate` is non-empty — per FR-012), Delete (`Trash2`)
    - Done: Edit (`Pencil`), Delete (`Trash2`)
  - Button styling: same as BillCard — ghost/text buttons with MASTER.md styling, `min-h-11 min-w-11`, focus rings
  - Card container: `bg-white border border-slate-200 rounded-lg p-4`

- [ ] T014 [P] Create `src/components/todos/TodoFormModal.tsx` — mirrors BillFormModal
  - Props: `{ todo: TodoWithDisplay | null, categories: TodoCategory[], recurrencePatterns: RecurrencePattern[], isSaving: boolean, onSubmit: (data: TodoFormData) => void, onClose: () => void }`
  - `isEdit = todo !== null`
  - Title: "Add To-Do" or "Edit To-Do"
  - Fields (in order):
    1. **Title** (text input, required) — validation: "Title is required." Block submission if empty
    2. **Category** (dropdown) — active non-deleted categories from `categories.filter(c => c.active && c.deletedAt === '')` + empty "No category" option. In edit mode, pre-filled with `todo.categoryId`
    3. **Due date** (date input, optional) — pre-filled from `todo.dueDate`
    4. **Recurrence pattern** (dropdown) — `recurrencePatterns` array. Default to "One-time" (the pattern with `intervalValue === 0`). In edit mode, pre-filled from `todo.recurrencePatternId`
    5. **Reminder offsets** (text input, default "3,1") — validation: comma-separated positive integers. Error: "Enter comma-separated numbers (e.g., 3,1)." Pre-filled from `todo.reminderOffsetsDays` in edit mode
    6. **Description** (textarea, optional) — pre-filled from `todo.description`
    7. **Notes** (textarea, optional) — pre-filled from `todo.notes`
  - Escape key close, backdrop close, save-in-progress blocking — same patterns as BillFormModal
  - Submit: trim strings, call `onSubmit` with `TodoFormData`

- [ ] T015 [P] Create `src/components/todos/MarkDoneModal.tsx` — simpler than MarkPaidModal
  - Props: `{ todo: TodoWithDisplay, isSaving: boolean, onSubmit: (data: MarkDoneFormData) => void, onClose: () => void }`
  - Title: "Mark as Done"
  - Context section (read-only): todo title, category name (if present), due date formatted (if present)
  - Fields:
    1. **Notes** (textarea, optional) — placeholder "Add any notes about completing this to-do"
  - Actions: Cancel (secondary) + "Mark Done" (primary, emerald or indigo). Both disabled when `isSaving`. Submit shows `Loader2` spinner
  - Escape key close, backdrop close — same patterns
  - No payment fields (simpler than MarkPaidModal)

**Checkpoint**: Build passes. All components render independently. BillsPage postpone verified with the genericized PostponeModal.

---

## Phase 5: TodosPage Rewrite — First Testable To-Do Flow

**Purpose**: Full page rewrite replacing the placeholder. This is where ALL user stories come together.

- [ ] T016 Rewrite `src/pages/TodosPage.tsx` — full to-do list page
  - Replace the current placeholder content (lines 1-17)
  - **State** (mirrors BillsPage pattern):
    - `todos: TodoWithDisplay[]`, `categories: TodoCategory[]`, `allCategories: TodoCategory[]`, `patterns: RecurrencePattern[]`
    - `isLoading: boolean`, `isSaving: boolean`
    - `filterCategory: string` (default `'all'`), `filterStatus: string` (default `'all'`)
    - `formModal: { mode: 'add' | 'edit'; todo?: TodoWithDisplay } | null`
    - `markDoneTarget: TodoWithDisplay | null`, `postponeTarget: TodoWithDisplay | null`, `deleteTarget: TodoWithDisplay | null`
  - **Document title**: `NoDues · To-Dos` (already set in placeholder)
  - **Data loading** (`loadData` useCallback):
    1. Run migrations first: `await runMigrations(accessToken!, spreadsheetId)` (idempotent, per requirement #5)
    2. Parallel fetch: `Promise.all([fetchCategories, fetchAllCategories, fetchRecurrencePatterns])`
    3. Build `categoryMap` from allCategories, `patternMap` from patterns
    4. Fetch todos: `fetchTodos(accessToken!, spreadsheetId, categoryMap, patternMap)`
  - **Helper**: `refetchTodos` — rebuilds maps from current state and refetches
  - **Filters** (useMemo):
    - `filteredTodos`: filter by `filterCategory` and `filterStatus`, then `sortTodos`
    - `categoryOptions`: derived from todos (categories with at least one to-do)
    - `statusOptions`: All / Pending / Overdue / Done
  - **handleAddClick**: `setFormModal({ mode: 'add' })`
  - **handleEdit**: `setFormModal({ mode: 'edit', todo })`
  - **handleFormSubmit (add or edit)**:
    - Add mode: `addTodo` → refetch → calendar create (best-effort) → `setCalendarEventIds` after refetch → close modal → toast
    - Edit mode: `updateTodo` → if due date changed, calendar replacement (cleanup old + create new) → refetch → close modal → toast
    - Calendar event title: `` `[To-Do] ${todo.title} due ${formatDueDate(dueDate)}` ``
    - Calendar description: `catInfo ? `Category: ${catInfo.name}` : ''`
    - Toast messages per requirement #10: "To-do added." / "To-do added, but reminders couldn't be set." / "To-do updated." / "To-do updated, but reminders couldn't be updated."
  - **handleMarkDoneSubmit** — critical-path order per requirement #3:
    1. `setIsSaving(true)`
    2. `markTodoDone(accessToken!, spreadsheetId, markDoneTarget, data)` — CRITICAL PATH
    3. IF recurring (`pattern.intervalValue > 0`): `createNextRecurrence(accessToken!, spreadsheetId, doneTodo, pattern)` — CRITICAL PATH
    4. Calendar cleanup on completed (best-effort, own try/catch): `cleanupReminders` + `setCalendarEventIds(doneTodo, [])`
    5. Calendar create on next instance (best-effort, own try/catch): REQUIRES REFETCH to get new instance's `_rowIndex` before `setCalendarEventIds`. Call `refetchTodos()` first, find new todo by id, then create reminders and set event IDs
    6. Refetch all: `await refetchTodos()`
    7. Toast per requirement #10: "To-do marked as done." / "To-do marked as done. Next occurrence created." / "To-do marked as done, but calendar reminders couldn't be updated." / "Failed to mark to-do as done."
    8. Each calendar block in its own try/catch
  - **handlePostponeSubmit**:
    - Same-date guard: `data.newDueDate === postponeTarget.dueDate` → info toast "New date is the same as the current due date." + return (per requirement #10)
    - `postponeTodo` (critical path)
    - Best-effort calendar replacement (same pattern as BillsPage: cleanup old + create new + setCalendarEventIds)
    - In-memory update with recomputed `displayStatus`, OR refetch
    - Toast messages per requirement #10
  - **handleDeleteConfirm** — optimistic delete + undo (same pattern as BillsPage):
    - Optimistic remove from list
    - `softDeleteTodo` via `updateCell` on `deleted_at` only (per requirement #9 — NEVER call setCalendarEventIds on deleted todo)
    - Calendar cleanup (best-effort, own try/catch)
    - `showUndo('To-do deleted.', undoCallback)` — undo clears `deleted_at`, recreates calendar reminders (best-effort), reinserts at original position
    - Rollback on failure
    - Toast messages per requirement #10
  - **Render** (mirrors BillsPage structure):
    - `px-4 py-6 sm:px-6 lg:px-8 max-w-3xl mx-auto pb-24`
    - Header: "To-Dos" + "Add To-Do" button (Plus icon, primary style)
    - Two filter dropdowns (category + status) — shown only when `todos.length > 0`
    - Loading spinner
    - Empty state (zero todos): `ListTodo` icon + "No to-dos yet" + "Add a to-do" button
    - Filtered empty state: "No to-dos match your filters"
    - Todo list: `flex flex-col gap-3` of `<TodoCard>` components
    - Modals: `TodoFormModal`, `MarkDoneModal`, `PostponeModal` (shared, with todo-specific props), `ConfirmDialog`
  - **PostponeModal props at call site** (per requirement #4):
    ```
    title="Postpone to-do"
    itemTitle={postponeTarget.title}
    contextLine={[postponeTarget.categoryName, postponeTarget.recurrenceName].filter(Boolean).join(' · ')}
    currentDueDate={postponeTarget.dueDate}
    ```
  - Imports: services (`todosService`, `todoCategoriesService`, `recurrencePatternsService`, `migrationService`, `calendarReminders`), components (`TodoCard`, `TodoFormModal`, `MarkDoneModal`, shared `PostponeModal`, `ConfirmDialog`), contexts (`useAuth`, `useBootstrap`, `useToast`), types

**Checkpoint**: Full manual testing of the to-do lifecycle:
1. Add a one-time to-do with no due date → appears in list
2. Add a recurring to-do with due date and reminders → calendar events created
3. Mark recurring to-do done → next occurrence auto-generated with correct next due date
4. Postpone a to-do → PostponeLog row created, calendar replaced
5. Edit a to-do → row updated, calendar replaced if due date changed
6. Delete a to-do → soft-deleted, undo works
7. Filter by category and status → list narrows correctly

---

## Phase 6: CategoriesPage + Settings + Routing

**Purpose**: Category management UI and settings/routing integration. Can be done in parallel with Phase 5 since todoCategoriesService is already built.

- [ ] T017 [P] Create `src/components/settings/CategoryCard.tsx` — mirrors PropertyCard
  - Props: `{ category: TodoCategory, onEdit: (cat: TodoCategory) => void, onToggleActive: (cat: TodoCategory) => void, onDelete: (cat: TodoCategory) => void, isLoading: boolean }`
  - Card container: `bg-white border border-slate-200 rounded-lg p-4`
  - Top row: color dot (inline 8×8 circle `<span>` with `style={{ backgroundColor: category.color }}` and `rounded-full inline-block w-2 h-2`) + category name (`text-base font-semibold text-slate-900`) + `StatusBadge` (active/inactive)
  - Actions row: Edit (`Pencil`, indigo), Delete (`Trash2`, red), Toggle active (`ToggleRight`/`ToggleLeft`, slate) — same button styling as PropertyCard
  - Loading state on toggle: `Loader2` spinner replaces toggle icon

- [ ] T018 [P] Create `src/components/settings/CategoryFormModal.tsx` — mirrors PropertyFormModal
  - Props: `{ category: TodoCategory | null, isSaving: boolean, onSubmit: (data: TodoCategoryFormData) => void, onClose: () => void }`
  - `isEdit = category !== null`
  - Title: "Add Category" or "Edit Category"
  - Fields:
    1. **Name** (text input, required) — validation: "Category name is required."
    2. **Color** (preset palette picker per requirement #11) — render 8 swatches from `CATEGORY_COLOR_PALETTE` (imported from `../../types`). Each swatch is a `<button>` with `style={{ backgroundColor: swatch.hex }}`, `rounded-full w-8 h-8` (32px), `min-h-11` touch target via padding/margin. Selected swatch gets a white `Check` icon overlay or `ring-2 ring-offset-2 ring-indigo-500`. Display swatch name as tooltip (`title={swatch.name}`). Default to first palette color on add. Pre-fill from `category.color` on edit
  - Escape key close, backdrop close, save-in-progress blocking
  - Submit: `onSubmit({ name: name.trim(), color: selectedColor })`

- [ ] T019 Create `src/pages/CategoriesPage.tsx` — mirrors PropertiesPage
  - Same structure as `PropertiesPage.tsx`:
    - Back link to `/settings`
    - Title "Categories" + "Add Category" button (Plus icon, primary)
    - Loading spinner
    - Empty state: `Tags` icon + "No categories yet" + "Add a category" button
    - Category list: `flex flex-col gap-3` of `<CategoryCard>` components
    - `CategoryFormModal` (add/edit)
    - `ConfirmDialog` for delete + undo
  - State: `categories`, `isLoading`, `loadingItemId`, `modalMode`, `editTarget`, `isSaving`, `deleteTarget`
  - Data loading: `fetchCategories` (non-deleted only)
  - CRUD handlers (mirror PropertiesPage):
    - Add → refetch (to get valid `_rowIndex`)
    - Edit → in-memory update via `setCategories(prev => prev.map(...))`
    - Toggle active → `toggleCategoryActive` + in-memory update
    - Delete → optimistic remove + `softDeleteCategory` + `showUndo` with `undoDeleteCategory` callback
  - Toast messages per requirement #10: "Category added." / "Category updated." / `"${name}" deleted.` (undo toast)
  - Document title: `NoDues · Categories`
  - Imports: `todoCategoriesService` functions, `CategoryCard`, `CategoryFormModal`, `ConfirmDialog`, contexts

- [ ] T020 Add Categories card to `src/pages/SettingsPage.tsx` + route to `src/App.tsx`
  - **SettingsPage.tsx**:
    - Import `Tags` from `lucide-react`
    - Add to `CARDS` array AFTER the "Bill Types" entry, BEFORE "Notifications":
      ```
      { label: 'Categories', description: 'Manage to-do categories', icon: Tags, to: '/settings/categories' }
      ```
  - **App.tsx**:
    - Import `CategoriesPage` from `./pages/CategoriesPage`
    - Add route inside BootstrapLayout, after `/settings/bill-types`:
      ```
      <Route path="/settings/categories" element={<ProtectedRoute><CategoriesPage /></ProtectedRoute>} />
      ```

**Checkpoint**: Navigate to Settings → Categories card visible. Click → CategoriesPage shows seeded categories with colors. Add/edit/toggle/delete all work. Deleting a category does not affect existing to-dos.

---

## Phase 7: Final Validation

**Purpose**: End-to-end verification of all toast messages, edge cases, and cross-cutting concerns.

- [ ] T021 Verify all toast messages + end-to-end validation
  - **Toast messages** (per requirement #10 — verify each appears with correct severity):
    - Add success: "To-do added." (success)
    - Add + calendar fail: "To-do added, but reminders couldn't be set." (error)
    - Edit success: "To-do updated." (success)
    - Edit + calendar fail: "To-do updated, but reminders couldn't be updated." (error)
    - Mark done (non-recurring): "To-do marked as done." (success)
    - Mark done (recurring): "To-do marked as done. Next occurrence created." (success)
    - Mark done + calendar fail: "To-do marked as done, but calendar reminders couldn't be updated." (error)
    - Mark done failure: "Failed to mark to-do as done." (error)
    - Postpone success: "To-do postponed." (success)
    - Postpone + calendar fail: "To-do postponed, but calendar reminders couldn't be updated." (error)
    - Postpone failure: "Failed to postpone to-do." (error)
    - Same-date no-op: "New date is the same as the current due date." (info)
    - Delete success: "To-do deleted." (undo toast)
    - Delete failure: "Failed to delete to-do." (error)
    - Undo failure: "Failed to undo delete." (error)
    - Category add: "Category added." (success)
    - Category edit: "Category updated." (success)
    - Category delete: `"${name}" deleted.` (undo toast)
  - **Sort order verification**: overdue (oldest due first) → pending with due_date (soonest) → pending without due_date (newest created) → done (most recent done_date)
  - **computeNextDueDate verification**: run the 5 DD-002 examples through a real mark-done flow
  - **original_due_date**: verify write-once behavior (set on first postpone, preserved on subsequent)
  - **PostponeLog**: verify `item_type = 'todo'`, correct `from_date`/`to_date`
  - **Soft-delete safety**: verify `softDeleteTodo` uses `updateCell` only, never full-row write
  - **Calendar best-effort**: verify calendar failures never prevent critical-path writes from completing
  - **Category non-cascading delete**: delete a category, verify existing to-dos still display the old category name
  - **BillsPage regression**: postpone, add, edit, mark paid, delete all still work identically after PostponeModal genericization and calendar extraction

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Types + Schema + Bootstrap)**: No dependencies — start immediately. T001, T002, T003 are all parallelizable [P]
- **Phase 2 (Services Foundation)**: Depends on Phase 1
  - T004 depends on T001 (RecurrencePattern type)
  - T005 depends on T001 (TodoCategory, TodoCategoryFormData types)
  - T006 depends on T001 (CATEGORY_COLOR_PALETTE) + T002 (generateSeedRecurrencePatterns)
  - T004 and T005 are parallelizable with each other
- **Phase 3 (Calendar Extraction + todosService)**: Depends on Phase 2
  - T007 depends on nothing in Phase 2 (extracts from existing billsService)
  - T008 depends on T007
  - T009 depends on T004 (computeNextDueDate) + T007 (calendarReminders imports)
- **Phase 4 (Components)**: Depends on Phase 3
  - T010, T011, T013, T014, T015 are parallelizable (different files)
  - T012 depends on T011 (shared PostponeModal must exist before BillsPage migration)
- **Phase 5 (TodosPage)**: Depends on Phase 3 + Phase 4
  - T016 depends on T009-T015 (all services + all components)
- **Phase 6 (CategoriesPage)**: Depends on Phase 2 (T005 todoCategoriesService)
  - T017 and T018 are parallelizable [P]
  - T019 depends on T017 + T018
  - T020 depends on T019
  - **Can run in parallel with Phase 5** (different files, different service)
- **Phase 7 (Validation)**: Depends on all prior phases

### Critical Path

```
T001 ──┐
T002 ──┤── Phase 1
T003 ──┘
         ↓
T004 ──┐
T005 ──┤── Phase 2
T006 ──┘
         ↓
T007 → T008 ─┐
T009 ─────────┤── Phase 3
              ↓
T010 ──┐
T011 → T012 ─┤
T013 ──┤      ├── Phase 4
T014 ──┤      │
T015 ──┘      │
              ↓
         T016 ── Phase 5 (TodosPage)
              ↓
         T021 ── Phase 7 (Validation)
```

### Parallel Side Track (Phase 6)

```
Phase 2 complete ──→ T017 ──┐
                     T018 ──┤── T019 → T020
```

Phase 6 can run in parallel with Phases 3-5 since it only depends on `todoCategoriesService` (Phase 2).

---

## Notes

- [P] tasks = different files, no dependencies within that phase
- No automated test tasks (manual testing via quickstart.md)
- `computeNextDueDate` handles all 4 interval units: days, weeks, months, years. Month-end clamping via `new Date(targetYear, targetMon, 0).getDate()`. Year rollover via `Math.floor(targetMonth / 12)`. `anchorDay ?? day` fallback
- Calendar is best-effort EVERYWHERE. Critical-path writes (sheet CRUD) ALWAYS first, calendar AFTER in try/catch. Each calendar block in its own try/catch for mark-done flow
- Soft-delete uses `updateCell` on `deleted_at` only — NEVER call `setCalendarEventIds` on a deleted todo (full-row write would overwrite `deleted_at` and un-delete)
- `setCalendarEventIds` stays in each service (billsService + todosService) because it needs tab-specific `serializeRow`
- `createReminders` now accepts generic `title`/`description` strings — call sites build the format
- `PostponeFormData` already exists — reused as-is for to-do postpone
- `migrationService` runs from TodosPage mount (not App.tsx). Idempotent. Non-blocking on failure
- Sort order mirrors `sortBills` structure: status priority → secondary sort within each group
- `parseRow` returns null on missing `id`. `serializeRow` outputs in HEADER_DEFINITIONS order. Status defaults to `'pending'` on invalid/missing
