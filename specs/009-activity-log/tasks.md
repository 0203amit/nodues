# Tasks: Activity Log

**Input**: Design documents from `/specs/009-activity-log/`

**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: No automated tests. Manual testing via quickstart.md.

**Organization**: Tasks ordered bottom-up: types → service → 5 page integrations (Chunk 1) → relativeTime utility → ActivityLogPage → SettingsPage card + routing (Chunk 2) → final validation. Grouped by implementation chunk for independent testing.

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no dependencies)

## User Story Map

| Story | Spec Section | Priority | Summary |
|-------|-------------|----------|---------|
| US1 | User Story 1 | P1 | Silent activity logging on every CRUD action |
| US2 | User Story 2 | P1 | Recent Activity viewer page |
| US3 | User Story 3 | P1 | Activity Log card in Settings hub |

---

## Chunk 1: Types + Service + Write-Side Integration (all 5 pages)

**Purpose**: Foundation types, append-only service, and all 25 `appendActivityLogSafe` call sites across 5 handler pages. After this chunk, every CRUD action silently writes an ActivityLog row.

### Phase 1: Types + Service

- [ ] T001 [P] Add Activity Log types to `src/types/index.ts`
  - Append after the existing `CATEGORY_COLOR_PALETTE` block at end of file
  - Add `ActionType` — 25-member string union:
    ```typescript
    export type ActionType =
      | 'bill_added' | 'bill_updated' | 'bill_paid' | 'bill_postponed'
      | 'bill_deleted' | 'bill_restored'
      | 'todo_added' | 'todo_updated' | 'todo_done' | 'todo_recurrence_created'
      | 'todo_postponed' | 'todo_deleted' | 'todo_restored'
      | 'property_added' | 'property_updated' | 'property_deleted' | 'property_restored'
      | 'billtype_added' | 'billtype_updated' | 'billtype_deleted' | 'billtype_restored'
      | 'category_added' | 'category_updated' | 'category_deleted' | 'category_restored';
    ```
  - Add `ActivityEntityType`:
    ```typescript
    export type ActivityEntityType = 'bill' | 'todo' | 'property' | 'billtype' | 'category';
    ```
  - Add `ActivityLogEntry` interface:
    ```typescript
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
    ```
  - Property names are camelCase mapped from snake_case sheet columns (CL-001): `user_email` → `userEmail`, `entity_type` → `entityType`, `entity_id` → `entityId`
  - Follows same `_rowIndex` pattern as `PostponeLogEntry`

- [ ] T002 [P] Create `src/services/activityLogService.ts` — mirrors `postponeLogService.ts`
  - **Column index map**: Derive `COL` from `HEADER_DEFINITIONS` for `'ActivityLog'` tab — do NOT hardcode column indices:
    ```typescript
    const TAB_NAME = 'ActivityLog';
    const ACTIVITY_HEADERS = HEADER_DEFINITIONS.find(d => d.tabName === TAB_NAME)!.headers;
    const COL = Object.fromEntries(ACTIVITY_HEADERS.map((h, i) => [h, i])) as Record<string, number>;
    ```
    Headers from schema.ts: `[id, timestamp, user_email, action, entity_type, entity_id, summary]`
  - **`formatShortDate(dateStr: string): string`** — exported helper for postpone summaries. Formats `"2026-06-05"` as `"5 Jun"` (no year):
    ```typescript
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    export function formatShortDate(dateStr: string): string {
      const [, month, day] = dateStr.split('-').map(Number);
      return `${day} ${MONTHS[month - 1]}`;
    }
    ```
  - **`parseRow(row: RowWithIndex): ActivityLogEntry | null`** — return `null` if row is empty or has no `id` (defensive null guard, same as postponeLogService). Map snake_case columns to camelCase: `v[COL.user_email]` → `userEmail`, `v[COL.entity_type]` → `entityType` (cast to `ActivityEntityType`), `v[COL.action]` → `action` (cast to `ActionType`), `v[COL.entity_id]` → `entityId`
  - **`serializeRow(entry: ActivityLogEntry): string[]`** — output values in HEADER_DEFINITIONS column order: `[id, timestamp, userEmail, action, entityType, entityId, summary]`
  - **`fetchActivityLog(accessToken, spreadsheetId): Promise<ActivityLogEntry[]>`** — read all rows via `readAllRows`, parse (skip nulls), sort by `timestamp` descending (newest first): `entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp))`
  - **`appendActivityLog(accessToken, spreadsheetId, entry: Omit<ActivityLogEntry, '_rowIndex'>): Promise<void>`** — serialize and append single row via `appendRows`
  - **`appendActivityLogSafe(accessToken, spreadsheetId, entry: Omit<ActivityLogEntry, '_rowIndex'>): Promise<void>`** — the ONLY function call sites use. Wraps `appendActivityLog` in try/catch:
    ```typescript
    export async function appendActivityLogSafe(
      accessToken: string,
      spreadsheetId: string,
      entry: Omit<ActivityLogEntry, '_rowIndex'>,
    ): Promise<void> {
      try {
        await appendActivityLog(accessToken, spreadsheetId, entry);
      } catch (e) {
        console.warn('Activity log append failed:', e);
      }
    }
    ```
    NEVER throws. NEVER toasts. Single error boundary at service level (DD-001, FR-010, FR-033).
  - Imports: `HEADER_DEFINITIONS` from `../config/schema`, `readAllRows`, `appendRows` from `./sheetsService`, `formatDueDate` from `./calendarReminders`, `ActivityLogEntry`, `RowWithIndex` from `../types`

**Checkpoint**: `npx tsc --noEmit` passes. Types compile. Service exports all functions.

---

### Phase 2: Write-Side Integration — 5 Pages (25 call sites)

**Side-effect ordering at EVERY handler** (DD-002): critical-path sheet write → calendar (best-effort) → **activity log (best-effort, `appendActivityLogSafe`) — LAST**.

**Entry construction pattern** — every call site builds the entry inline:
```typescript
await appendActivityLogSafe(accessToken!, spreadsheetId, {
  id: uuidv4(),
  timestamp: new Date().toISOString(),
  userEmail: 'user',
  action: '<ActionType>',
  entityType: '<ActivityEntityType>',
  entityId: <entity.id>,
  summary: <constructed per DD-003>,
});
```

- [ ] T003 [P] Integrate `appendActivityLogSafe` into `src/pages/BillsPage.tsx` — 6 call sites
  - **New imports**: `import { v4 as uuidv4 } from 'uuid'` and `import { appendActivityLogSafe, formatShortDate } from '../services/activityLogService'`
  - **Side-effect ordering**: Each `appendActivityLogSafe` call goes AFTER all calendar best-effort work completes (success or failure), before or alongside the success toast. The log fires in both "has calendar" and "no calendar" branches.
  - **6 call sites with exact summary expressions**:

  1. **`saveNewBill`** — action: `'bill_added'`, entityType: `'bill'`, entityId: `newBill.id`
     - Insert AFTER the calendar if/else block (~line 268), before the outer `} catch {`
     - Summary: `` `${btInfo?.name ?? ''} \u2014 ${btInfo?.propertyName ?? ''} \u00b7 ${formatMonth(data.month)}` ``
     - Note: `btInfo` is already in scope (resolved from `billTypeMap.get(data.billTypeId)` on line 238)

  2. **`saveEditBill`** — action: `'bill_updated'`, entityType: `'bill'`, entityId: `bill.id`
     - Insert AFTER `refetchBills()` and `setFormModal(null)` (~line 328), before the `if (!calendarFailed)` toast
     - Summary: `` `${bill.billTypeName} \u2014 ${bill.propertyName} \u00b7 ${formatMonth(data.month)}` ``

  3. **`handleMarkPaidSubmit`** — action: `'bill_paid'`, entityType: `'bill'`, entityId: `markPaidTarget.id`
     - Insert AFTER `refetchBills()` and `setMarkPaidTarget(null)` (~line 405), before the `if (!calendarFailed)` toast
     - Summary: `` `${markPaidTarget.billTypeName} \u2014 ${markPaidTarget.propertyName} \u00b7 ${formatMonth(markPaidTarget.month)}${markPaidTarget.amount !== null ? ` \u00b7 ${formatCurrency(markPaidTarget.amount)}` : ''}` ``

  4. **`handlePostponeSubmit`** — action: `'bill_postponed'`, entityType: `'bill'`, entityId: `postponeTarget.id`
     - Insert AFTER the calendar try/catch block (~line 491), before `setPostponeTarget(null)`
     - Summary: `` `${postponeTarget.billTypeName} \u2014 ${postponeTarget.propertyName} \u00b7 ${formatShortDate(postponeTarget.dueDate)} \u2192 ${formatDueDate(data.newDueDate)}` ``

  5. **`handleDeleteConfirm`** — action: `'bill_deleted'`, entityType: `'bill'`, entityId: `bill.id`
     - Insert AFTER calendar cleanup block (~line 539), before `showUndo(...)` call
     - Summary: `` `${bill.billTypeName} \u2014 ${bill.propertyName} \u00b7 ${formatMonth(bill.month)}` ``

  6. **undo callback** (inside `showUndo`) — action: `'bill_restored'`, entityType: `'bill'`, entityId: `bill.id`
     - Insert AFTER calendar recreation try/catch (~line 567), before `setBills(prev => ...)` reinsert
     - Summary: `` `${bill.billTypeName} \u2014 ${bill.propertyName} \u00b7 ${formatMonth(bill.month)}` ``

- [ ] T004 [P] Integrate `appendActivityLogSafe` into `src/pages/TodosPage.tsx` — 7 call sites
  - **New imports**: `import { v4 as uuidv4 } from 'uuid'` and `import { appendActivityLogSafe, formatShortDate } from '../services/activityLogService'`
  - Note: `formatDueDate` is already imported from `../services/calendarReminders`
  - **Side-effect ordering**: Each `appendActivityLogSafe` call goes AFTER all calendar best-effort work. Log call goes LAST.
  - **7 call sites with exact summary expressions**:

  1. **`saveNewTodo`** — action: `'todo_added'`, entityType: `'todo'`, entityId: `newTodo.id`
     - Insert AFTER the calendar if/else block (~line 233), before `setFormModal(null)` on line 235
     - Summary: `` `${newTodo.title}` ``

  2. **`saveEditTodo`** — action: `'todo_updated'`, entityType: `'todo'`, entityId: `todo.id`
     - Insert AFTER `refetchTodos()` and before `setFormModal(null)` (~line 298)
     - Summary: `` `${data.title}` ``

  3. **`handleMarkDoneSubmit` — `todo_done`** — action: `'todo_done'`, entityType: `'todo'`, entityId: `markDoneTarget.id`
     - Insert AFTER STEP 3 calendar cleanup (~line 339), BEFORE STEP 4 calendar create on next instance
     - Summary: `` `${markDoneTarget.title}` ``

  4. **`handleMarkDoneSubmit` — `todo_recurrence_created`** — action: `'todo_recurrence_created'`, entityType: `'todo'`, entityId: `nextTodo.id`
     - Insert AFTER STEP 4 calendar create on next instance completes (inside the `if (nextTodo)` block, after the calendar try/catch at ~line 367), BEFORE STEP 5 refetch
     - References the NEW todo's id (`nextTodo.id`), NOT the parent's
     - Summary: `` nextTodo.dueDate ? `${nextTodo.title} \u00b7 next ${formatDueDate(nextTodo.dueDate)}` : nextTodo.title ``

  5. **`handlePostponeSubmit`** — action: `'todo_postponed'`, entityType: `'todo'`, entityId: `postponeTarget.id`
     - Insert AFTER the calendar try/catch block (~line 463), before `setPostponeTarget(null)`
     - Summary: `` `${postponeTarget.title} \u00b7 ${formatShortDate(postponeTarget.dueDate)} \u2192 ${formatDueDate(data.newDueDate)}` ``

  6. **`handleDeleteConfirm`** — action: `'todo_deleted'`, entityType: `'todo'`, entityId: `todo.id`
     - Insert AFTER calendar cleanup block (~line 504), before `showUndo(...)` call
     - Summary: `` `${todo.title}` ``

  7. **undo callback** (inside `showUndo`) — action: `'todo_restored'`, entityType: `'todo'`, entityId: `todo.id`
     - Insert AFTER calendar recreation try/catch (~line 531), before `setTodos(prev => ...)` reinsert
     - Summary: `` `${todo.title}` ``

- [ ] T005 [P] Integrate `appendActivityLogSafe` into `src/pages/PropertiesPage.tsx` — 4 call sites
  - **New imports**: `import { v4 as uuidv4 } from 'uuid'` and `import { appendActivityLogSafe } from '../services/activityLogService'`
  - **Code change required**: In `handleFormSubmit` (add branch, line 74), the return value of `addProperty(...)` is currently discarded. Change:
    ```typescript
    // BEFORE:
    await addProperty(accessToken!, spreadsheetId, data);
    // AFTER:
    const newProp = await addProperty(accessToken!, spreadsheetId, data);
    ```
    This captures the new property's `id` for the activity log `entityId`.
  - **4 call sites with exact summary expressions**:

  1. **`handleFormSubmit` (add branch)** — action: `'property_added'`, entityType: `'property'`, entityId: `newProp.id`
     - Insert AFTER the refetch (~line 77), before `showToast('Property added.')` on line 78
     - Summary: `` `${data.name}` ``

  2. **`handleFormSubmit` (edit branch)** — action: `'property_updated'`, entityType: `'property'`, entityId: `editTarget.id`
     - Insert AFTER `updateProperty` and `setProperties(...)` (~line 83), before `showToast('Property updated.')`
     - Summary: `` `${data.name}` ``

  3. **`handleDeleteConfirm`** — action: `'property_deleted'`, entityType: `'property'`, entityId: `property.id`
     - Insert AFTER `softDeleteProperty` (~line 138), before `showUndo(...)` call
     - Summary: `` `${property.name}` ``

  4. **undo callback** (inside `showUndo`) — action: `'property_restored'`, entityType: `'property'`, entityId: `property.id`
     - Insert AFTER `undoDeleteProperty` (~line 141), before `setProperties(prev => ...)` reinsert
     - Summary: `` `${property.name}` ``

- [ ] T006 [P] Integrate `appendActivityLogSafe` into `src/pages/BillTypesPage.tsx` — 4 call sites
  - **New imports**: `import { v4 as uuidv4 } from 'uuid'` and `import { appendActivityLogSafe } from '../services/activityLogService'`
  - **Code change required**: In `handleFormSubmit` (add branch, line 83), the return value of `addBillType(...)` is currently discarded. Change:
    ```typescript
    // BEFORE:
    await addBillType(accessToken!, spreadsheetId, data);
    // AFTER:
    const newBt = await addBillType(accessToken!, spreadsheetId, data);
    ```
    This captures the new bill type's `id` for the activity log `entityId`.
  - **4 call sites with exact summary expressions**:

  1. **`handleFormSubmit` (add branch)** — action: `'billtype_added'`, entityType: `'billtype'`, entityId: `newBt.id`
     - Insert AFTER the refetch (~line 90), before `showToast('Bill type added.')` on line 91
     - Summary: `` `${data.name}` ``

  2. **`handleFormSubmit` (edit branch)** — action: `'billtype_updated'`, entityType: `'billtype'`, entityId: `editTarget.id`
     - Insert AFTER `updateBillType` and `setBillTypes(...)` (~line 100), before `showToast('Bill type updated.')`
     - Summary: `` `${data.name}` ``

  3. **`handleDeleteConfirm`** — action: `'billtype_deleted'`, entityType: `'billtype'`, entityId: `billType.id`
     - Insert AFTER `softDeleteBillType` (~line 159), before `showUndo(...)` call
     - Summary: `` `${billType.name}` ``

  4. **undo callback** (inside `showUndo`) — action: `'billtype_restored'`, entityType: `'billtype'`, entityId: `billType.id`
     - Insert AFTER `undoDeleteBillType` (~line 162), before `setBillTypes(prev => ...)` reinsert
     - Summary: `` `${billType.name}` ``

- [ ] T007 [P] Integrate `appendActivityLogSafe` into `src/pages/CategoriesPage.tsx` — 4 call sites
  - **New imports**: `import { v4 as uuidv4 } from 'uuid'` and `import { appendActivityLogSafe } from '../services/activityLogService'`
  - **Code change required**: In `handleFormSubmit` (add branch, line 74), the return value of `addCategory(...)` is currently discarded. Change:
    ```typescript
    // BEFORE:
    await addCategory(accessToken!, spreadsheetId, data);
    // AFTER:
    const newCat = await addCategory(accessToken!, spreadsheetId, data);
    ```
    This captures the new category's `id` for the activity log `entityId`.
  - **4 call sites with exact summary expressions**:

  1. **`handleFormSubmit` (add branch)** — action: `'category_added'`, entityType: `'category'`, entityId: `newCat.id`
     - Insert AFTER the refetch (~line 77), before `showToast('Category added.')` on line 78
     - Summary: `` `${data.name}` ``

  2. **`handleFormSubmit` (edit branch)** — action: `'category_updated'`, entityType: `'category'`, entityId: `editTarget.id`
     - Insert AFTER `updateCategory` and `setCategories(...)` (~line 83), before `showToast('Category updated.')`
     - Summary: `` `${data.name}` ``

  3. **`handleDeleteConfirm`** — action: `'category_deleted'`, entityType: `'category'`, entityId: `category.id`
     - Insert AFTER `softDeleteCategory` (~line 133), before `showUndo(...)` call
     - Summary: `` `${category.name}` ``

  4. **undo callback** (inside `showUndo`) — action: `'category_restored'`, entityType: `'category'`, entityId: `category.id`
     - Insert AFTER `undoDeleteCategory` (~line 136), before `setCategories(prev => ...)` reinsert
     - Summary: `` `${category.name}` ``

**Checkpoint**: `npx tsc --noEmit` passes. Perform any CRUD action (add/edit/delete/restore a bill, postpone a bill, mark a bill paid, etc.) and verify a new row appears in the ActivityLog sheet tab with correct `action`, `entity_type`, `entity_id`, and `summary`. Verify that a simulated log failure (e.g., disconnect network after critical write) does NOT show a toast and the parent operation completes normally.

---

## Chunk 2: Viewer Page + Utility + Settings Card + Route (read side)

**Purpose**: Read-side viewer page with relative timestamps, settings hub integration, and routing. Depends on Chunk 1 (types and service must exist).

- [ ] T008 [P] Create `src/utils/relativeTime.ts` — `formatRelativeTime` pure function
  - Single export: `formatRelativeTime(isoTimestamp: string, now?: Date): string`
  - The optional `now` parameter enables deterministic testing
  - **6 boundary cases**:
    | Condition | Output |
    |---|---|
    | < 60 seconds ago | `"Just now"` |
    | 1–59 minutes ago | `"1 minute ago"` (singular) / `"N minutes ago"` (plural) |
    | 1–23 hours ago | `"1 hour ago"` (singular) / `"N hours ago"` (plural) |
    | 1 day ago | `"Yesterday"` |
    | 2–7 days ago | `"N days ago"` |
    | > 7 days ago | `formatDueDate(date)` — e.g., `"5 Jun 2026"` |
  - Implementation:
    ```typescript
    import { formatDueDate } from '../services/calendarReminders';

    export function formatRelativeTime(isoTimestamp: string, now?: Date): string {
      const then = new Date(isoTimestamp);
      const current = now ?? new Date();
      const diffMs = current.getTime() - then.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHr = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHr / 24);

      if (diffSec < 60) return 'Just now';
      if (diffMin < 60) return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
      if (diffHr < 24) return diffHr === 1 ? '1 hour ago' : `${diffHr} hours ago`;
      if (diffDay === 1) return 'Yesterday';
      if (diffDay <= 7) return `${diffDay} days ago`;

      const dateStr = `${then.getFullYear()}-${String(then.getMonth()+1).padStart(2,'0')}-${String(then.getDate()).padStart(2,'0')}`;
      return formatDueDate(dateStr);
    }
    ```
  - Custom implementation — NOT `Intl.RelativeTimeFormat` — for precise control over wording and boundaries

- [ ] T009 Create `src/pages/ActivityLogPage.tsx` — viewer page (read side)
  - **Shell**: Mirrors `PropertiesPage.tsx` — back link to `/settings`, page title "Activity Log", document title `"NoDues · Activity Log"`, loading spinner (`Loader2`), empty state, content list
  - **No Add button** (read-only page). No filters. No pagination.
  - **MODULE-LEVEL CONSTANTS** (inside the page module, not exported):
    - `ACTION_LABELS: Record<ActionType, string>` — all 25 entries per DD-007:
      ```typescript
      const ACTION_LABELS: Record<ActionType, string> = {
        bill_added: 'Bill added',
        bill_updated: 'Bill updated',
        bill_paid: 'Bill paid',
        bill_postponed: 'Bill postponed',
        bill_deleted: 'Bill deleted',
        bill_restored: 'Bill restored',
        todo_added: 'To-do added',
        todo_updated: 'To-do updated',
        todo_done: 'To-do done',
        todo_recurrence_created: 'Recurrence created',
        todo_postponed: 'To-do postponed',
        todo_deleted: 'To-do deleted',
        todo_restored: 'To-do restored',
        property_added: 'Property added',
        property_updated: 'Property updated',
        property_deleted: 'Property deleted',
        property_restored: 'Property restored',
        billtype_added: 'Bill type added',
        billtype_updated: 'Bill type updated',
        billtype_deleted: 'Bill type deleted',
        billtype_restored: 'Bill type restored',
        category_added: 'Category added',
        category_updated: 'Category updated',
        category_deleted: 'Category deleted',
        category_restored: 'Category restored',
      };
      ```
    - `ENTITY_ICONS: Record<ActivityEntityType, LucideIcon>` — per DD-008:
      ```typescript
      const ENTITY_ICONS: Record<ActivityEntityType, LucideIcon> = {
        bill: Receipt,
        todo: ListTodo,
        property: Home,
        billtype: FileText,
        category: Tags,
      };
      ```
  - **Data loading**: On mount, call `fetchActivityLog(accessToken!, spreadsheetId)`. Display first 100 entries (already sorted newest-first by the service). Cap: `.slice(0, 100)`.
  - **Error handling**: If `fetchActivityLog` throws, show error toast (`showToast('Failed to load activity log.', 'error')`) and display empty state.
  - **Empty state**: History icon (`w-12 h-12 text-slate-400`) + heading "No activity yet" (`text-base font-semibold text-slate-900`) + "Actions you perform will appear here." (`text-sm text-slate-600`). Same pattern as PropertiesPage empty state.
  - **Loading state**: `<Loader2 className="w-8 h-8 text-indigo-700 animate-spin" />` — same as PropertiesPage.
  - **Entry row layout** — each entry renders as a card/div per plan Layer 4:
    ```
    ┌──────────────────────────────────────────────┐
    │ [Icon]  Label                     rel. time  │
    │         Summary text                         │
    └──────────────────────────────────────────────┘
    ```
    - Row container: `bg-white border border-slate-200 rounded-lg p-4` (or `px-4 py-3`)
    - Top line: `flex items-start gap-3`
      - Icon: entity-type icon from `ENTITY_ICONS[entry.entityType]` — `w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5`
      - Label wrapper: `flex-1 min-w-0`
        - Top row: `flex items-center gap-2`
          - Label: `ACTION_LABELS[entry.action]` — `text-sm font-medium text-slate-900`
          - Relative time: `formatRelativeTime(entry.timestamp)` — `text-xs text-slate-400 ml-auto flex-shrink-0`
        - Summary: `entry.summary` — `text-sm text-slate-600` below the label+time row, wraps naturally
  - **Content list**: `flex flex-col gap-3` containing entry rows
  - **Imports**: `fetchActivityLog` from `../services/activityLogService`, `formatRelativeTime` from `../utils/relativeTime`, `useAuth`, `useBootstrap`, `useToast`, Lucide icons (`ArrowLeft`, `Loader2`, `History`, `Receipt`, `ListTodo`, `Home`, `FileText`, `Tags`), types (`ActionType`, `ActivityEntityType`, `ActivityLogEntry`), `Link` from `react-router-dom`, `APP_TITLE_SUFFIX`
  - **MASTER.md compliance**: indigo-700 primary accents on back link, slate neutrals, 44px touch targets not needed (read-only page, no interactive elements beyond the back link), responsive at 375px/768px/1024px+, IBM Plex Sans inherited from global styles

- [ ] T010 [P] Add Activity Log card to `src/pages/SettingsPage.tsx`
  - Import `History` from `lucide-react` (add to existing import line: `{ Building2, Receipt, Tags, History, Bell }`)
  - Insert new card in `CARDS` array AFTER the Categories entry (index 2) and BEFORE Notifications (index 3):
    ```typescript
    {
      label: 'Activity Log',
      description: 'View recent actions',
      icon: History,
      to: '/settings/activity-log',
    },
    ```
  - Final CARDS order: Properties, Bill Types, Categories, **Activity Log**, Notifications

- [ ] T011 [P] Add `/settings/activity-log` route to `src/App.tsx`
  - Import `ActivityLogPage` from `./pages/ActivityLogPage`
  - Add route inside `<Route element={<BootstrapLayout />}>`, after the `/settings/categories` route:
    ```tsx
    <Route path="/settings/activity-log" element={<ProtectedRoute><ActivityLogPage /></ProtectedRoute>} />
    ```
  - Matches the pattern of `/settings/properties`, `/settings/bill-types`, `/settings/categories`

**Checkpoint**: Navigate to Settings → Activity Log card visible between Categories and Notifications. Click → ActivityLogPage loads with entries from Chunk 1. Verify: correct icons per entity type, correct friendly labels, correct summary strings, correct relative timestamps. Verify empty state with History icon when no entries exist. Verify loading spinner.

---

## Final Validation

- [ ] T012 End-to-end validation of all 25 call sites + viewer page
  - **Write-side verification** — perform each action and check the ActivityLog sheet tab:
    - [ ] Add a bill → `bill_added` row with summary `"Maintenance — Mira Shop · Jun 2026"`
    - [ ] Edit a bill → `bill_updated` row with correct summary
    - [ ] Mark a bill paid → `bill_paid` row with amount suffix (e.g., `"· ₹1,100"`)
    - [ ] Mark a bill paid with no amount → `bill_paid` row WITHOUT amount suffix
    - [ ] Postpone a bill → `bill_postponed` row with date shift `"5 Jun → 12 Jun 2026"`
    - [ ] Delete a bill → `bill_deleted` row
    - [ ] Undo delete a bill → `bill_restored` row
    - [ ] Add a to-do → `todo_added` row with title as summary
    - [ ] Edit a to-do → `todo_updated` row with new title
    - [ ] Mark a to-do done (non-recurring) → 1 row: `todo_done`
    - [ ] Mark a recurring to-do done → 2 rows: `todo_done` + `todo_recurrence_created` with new todo's id and `"next 15 Jul 2027"` suffix
    - [ ] Mark a recurring to-do done (no dueDate on next) → `todo_recurrence_created` summary is just the title (no date)
    - [ ] Postpone a to-do → `todo_postponed` row with date shift
    - [ ] Delete a to-do → `todo_deleted` row
    - [ ] Undo delete a to-do → `todo_restored` row
    - [ ] Add a property → `property_added` row (verify `newProp.id` captured correctly)
    - [ ] Edit a property → `property_updated` row
    - [ ] Delete a property → `property_deleted` row
    - [ ] Undo delete a property → `property_restored` row
    - [ ] Add a bill type → `billtype_added` row (verify `newBt.id` captured correctly)
    - [ ] Edit a bill type → `billtype_updated` row
    - [ ] Delete a bill type → `billtype_deleted` row
    - [ ] Undo delete a bill type → `billtype_restored` row
    - [ ] Add a category → `category_added` row (verify `newCat.id` captured correctly)
    - [ ] Edit a category → `category_updated` row
    - [ ] Delete a category → `category_deleted` row
    - [ ] Undo delete a category → `category_restored` row
  - **Best-effort guarantee** (FR-010, FR-033):
    - Simulate activity log failure (e.g., temporarily break service) → parent operations still succeed, no error toast shown, `console.warn` emitted
  - **Viewer page** (US2):
    - [ ] Entries display newest-first
    - [ ] Correct entity-type icons (Receipt, ListTodo, Home, FileText, Tags)
    - [ ] Correct friendly action labels (DD-007)
    - [ ] Summary strings match DD-003 formats
    - [ ] Relative timestamps: "Just now", "N minutes ago", "Yesterday", "N days ago", formatted date for > 7 days
    - [ ] 100-entry cap — if > 100 entries exist, only newest 100 shown
    - [ ] Empty state: History icon + "No activity yet"
    - [ ] Error state: toast + empty state fallback
  - **Settings hub** (US3):
    - [ ] Activity Log card positioned after Categories, before Notifications
    - [ ] Card navigates to `/settings/activity-log`
  - **Routing**:
    - [ ] Direct navigation to `/settings/activity-log` works
    - [ ] Back link navigates to `/settings`
    - [ ] Document title is "NoDues · Activity Log"
  - **No regressions**: All existing CRUD flows (bills, to-dos, properties, bill types, categories) still work identically — activity log is invisible to the user during normal operation

---

## Dependencies & Execution Order

### Chunk 1

```
T001 ──┐
       ├── T002 ──→ T003 [P] ──┐
T001 ──┘            T004 [P] ──┤
                    T005 [P] ──┤── Chunk 1 complete
                    T006 [P] ──┤
                    T007 [P] ──┘
```

- T001 and T002 are parallelizable (types vs service, but T002 imports types — run T001 first or together)
- T003-T007 are all parallelizable (different page files, all depend on T001 + T002)

### Chunk 2

```
T008 [P] ──┐
T009 ──────┤── (T009 depends on T002 + T008)
T010 [P] ──┤
T011 [P] ──┤── Chunk 2 complete
           ↓
         T012 ── Final validation
```

- T008, T010, T011 are parallelizable (different files)
- T009 depends on T002 (service) and T008 (relativeTime)
- T012 depends on everything

### Critical Path

```
T001 → T002 → T003-T007 (parallel) → T008 → T009 → T012
                                      T010 (parallel with T008-T009)
                                      T011 (parallel with T008-T009)
```

---

## Summary of All 25 Summary Expressions

For quick reference, all summary JS expressions grouped by entity:

### Bills (6)

| # | Action | Handler | Summary Expression |
|---|--------|---------|-------------------|
| 1 | `bill_added` | `saveNewBill` | `` `${btInfo?.name ?? ''} \u2014 ${btInfo?.propertyName ?? ''} \u00b7 ${formatMonth(data.month)}` `` |
| 2 | `bill_updated` | `saveEditBill` | `` `${bill.billTypeName} \u2014 ${bill.propertyName} \u00b7 ${formatMonth(data.month)}` `` |
| 3 | `bill_paid` | `handleMarkPaidSubmit` | `` `${markPaidTarget.billTypeName} \u2014 ${markPaidTarget.propertyName} \u00b7 ${formatMonth(markPaidTarget.month)}${markPaidTarget.amount !== null ? ` \u00b7 ${formatCurrency(markPaidTarget.amount)}` : ''}` `` |
| 4 | `bill_postponed` | `handlePostponeSubmit` | `` `${postponeTarget.billTypeName} \u2014 ${postponeTarget.propertyName} \u00b7 ${formatShortDate(postponeTarget.dueDate)} \u2192 ${formatDueDate(data.newDueDate)}` `` |
| 5 | `bill_deleted` | `handleDeleteConfirm` | `` `${bill.billTypeName} \u2014 ${bill.propertyName} \u00b7 ${formatMonth(bill.month)}` `` |
| 6 | `bill_restored` | undo callback | `` `${bill.billTypeName} \u2014 ${bill.propertyName} \u00b7 ${formatMonth(bill.month)}` `` |

### To-Dos (7)

| # | Action | Handler | Summary Expression |
|---|--------|---------|-------------------|
| 7 | `todo_added` | `saveNewTodo` | `` `${newTodo.title}` `` |
| 8 | `todo_updated` | `saveEditTodo` | `` `${data.title}` `` |
| 9 | `todo_done` | `handleMarkDoneSubmit` | `` `${markDoneTarget.title}` `` |
| 10 | `todo_recurrence_created` | `handleMarkDoneSubmit` | `` nextTodo.dueDate ? `${nextTodo.title} \u00b7 next ${formatDueDate(nextTodo.dueDate)}` : nextTodo.title `` |
| 11 | `todo_postponed` | `handlePostponeSubmit` | `` `${postponeTarget.title} \u00b7 ${formatShortDate(postponeTarget.dueDate)} \u2192 ${formatDueDate(data.newDueDate)}` `` |
| 12 | `todo_deleted` | `handleDeleteConfirm` | `` `${todo.title}` `` |
| 13 | `todo_restored` | undo callback | `` `${todo.title}` `` |

### Properties (4)

| # | Action | Handler | Summary Expression |
|---|--------|---------|-------------------|
| 14 | `property_added` | `handleFormSubmit` (add) | `` `${data.name}` `` |
| 15 | `property_updated` | `handleFormSubmit` (edit) | `` `${data.name}` `` |
| 16 | `property_deleted` | `handleDeleteConfirm` | `` `${property.name}` `` |
| 17 | `property_restored` | undo callback | `` `${property.name}` `` |

### Bill Types (4)

| # | Action | Handler | Summary Expression |
|---|--------|---------|-------------------|
| 18 | `billtype_added` | `handleFormSubmit` (add) | `` `${data.name}` `` |
| 19 | `billtype_updated` | `handleFormSubmit` (edit) | `` `${data.name}` `` |
| 20 | `billtype_deleted` | `handleDeleteConfirm` | `` `${billType.name}` `` |
| 21 | `billtype_restored` | undo callback | `` `${billType.name}` `` |

### Categories (4)

| # | Action | Handler | Summary Expression |
|---|--------|---------|-------------------|
| 22 | `category_added` | `handleFormSubmit` (add) | `` `${data.name}` `` |
| 23 | `category_updated` | `handleFormSubmit` (edit) | `` `${data.name}` `` |
| 24 | `category_deleted` | `handleDeleteConfirm` | `` `${category.name}` `` |
| 25 | `category_restored` | undo callback | `` `${category.name}` `` |

---

## Notes

- [P] tasks = different files, no dependencies within that phase
- No automated test tasks (manual testing via quickstart.md)
- `appendActivityLogSafe` is the ONLY function call sites use — never `appendActivityLog` directly. Single error boundary at service level
- `formatShortDate` (no year, e.g., "5 Jun") from `activityLogService.ts` is used for the "from" side of postpone summaries. `formatDueDate` (with year, e.g., "12 Jun 2026") from `calendarReminders.ts` is used for the "to" side
- Side-effect ordering: critical-path write → calendar (best-effort) → activity log (best-effort). Log call goes LAST
- T005/T006/T007 require capturing the return value of `addProperty`/`addBillType`/`addCategory` — currently discarded, needs `const newEntity = await addEntity(...)`
- `todo_recurrence_created` references the NEW todo's id (`nextTodo.id`), not the parent's. Fires AFTER the new instance row is created AND its calendar best-effort completes
- `user_email` hardcoded to `'user'` (DD-009, single-user app)
- COL derived from HEADER_DEFINITIONS — never hardcoded column indices
- MASTER.md reference for ActivityLogPage UI: slate neutrals, Lucide icons, 375px mobile-first, responsive
