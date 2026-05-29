# Implementation Plan: Activity Log

**Branch**: `009-activity-log` | **Date**: 2026-05-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-activity-log/spec.md`

## Summary

Record every meaningful CRUD action (bills, to-dos, properties, bill types, categories) as an append-only row in the existing ActivityLog sheet tab, then expose a read-only "Recent Activity" viewer page at Settings > Activity Log. The write side is best-effort: it fires after the critical-path write and after any calendar best-effort, wrapped in a silent try/catch. The read side displays the 100 newest entries with entity-type icons, friendly labels, summaries, and relative timestamps.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, ES2022+

**Primary Dependencies**: React 19, React Router, Tailwind CSS, Lucide React, Google Sheets API v4

**Storage**: Google Sheets (primary data via Sheets API). No local database. ActivityLog tab already exists with headers `[id, timestamp, user_email, action, entity_type, entity_id, summary]`.

**Testing**: Manual testing against live Google APIs (no test framework in the project)

**Target Platform**: Mobile-first web app (PWA-capable), primary viewport 375px (iPhone). Runs in any modern browser.

**Project Type**: Single-page web application (React + Vite). No backend server.

**Performance Goals**: Activity log append should be invisible to the user — no perceptible delay on the parent operation. Viewer page should load within 1-2 seconds for 100 entries.

**Constraints**: Best-effort architecture — activity log failures must never prevent or delay the parent CRUD operation. Single-user app — no concurrent-write protection needed. OAuth token already has Sheets scope.

**Scale/Scope**: Single household user. Typically 10-30 actions per session. 100-entry cap on the viewer page.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`constitution.md`) contains only template placeholders — no real principles or gates have been defined. No gates to evaluate. Proceeding with standard engineering practices.

**Post-design re-check**: No violations. The design reuses existing service patterns (`postponeLogService.ts`), page patterns (`PropertiesPage.tsx`), and routing patterns (`App.tsx`). No new abstractions, dependencies, or architectural layers introduced.

## Project Structure

### Documentation (this feature)

```text
specs/009-activity-log/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: research decisions
├── data-model.md        # Phase 1: entity documentation
├── quickstart.md        # Phase 1: implementation guide
└── contracts/
    ├── activityLogService.ts   # Service contract
    └── ActivityLogPage.tsx     # Page component contract
```

### Source Code (files to create / modify)

```text
src/
├── services/
│   └── activityLogService.ts   # NEW: parseRow, serializeRow, fetch, append, appendSafe
├── pages/
│   ├── ActivityLogPage.tsx     # NEW: viewer page (read side)
│   ├── BillsPage.tsx           # MODIFY: add appendActivityLogSafe calls (6 handlers)
│   ├── TodosPage.tsx           # MODIFY: add appendActivityLogSafe calls (7 handlers)
│   ├── PropertiesPage.tsx      # MODIFY: add appendActivityLogSafe calls (4 handlers)
│   ├── BillTypesPage.tsx       # MODIFY: add appendActivityLogSafe calls (4 handlers)
│   ├── CategoriesPage.tsx      # MODIFY: add appendActivityLogSafe calls (4 handlers)
│   └── SettingsPage.tsx        # MODIFY: add Activity Log card to CARDS array
├── utils/
│   └── relativeTime.ts         # NEW: formatRelativeTime pure function
├── types/
│   └── index.ts                # MODIFY: add ActionType, ActivityEntityType, ActivityLogEntry
└── App.tsx                     # MODIFY: add /settings/activity-log route
```

**Structure Decision**: Three new files created (`activityLogService.ts`, `ActivityLogPage.tsx`, `relativeTime.ts`). All other changes extend existing files. The `relativeTime.ts` utility lives in `src/utils/` for testability and potential reuse in Phase 10 Dashboard.

## Implementation Design

### Decision: Best-Effort Wrapping Strategy — `appendActivityLogSafe`

**Chosen**: Option (c) — a `appendActivityLogSafe()` function inside `activityLogService.ts` that wraps `appendActivityLog` in a try/catch with `console.warn`. This avoids duplicating ~25 try/catch blocks across five pages.

**Signature**:
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

Each call site constructs the entry object inline (with `uuidv4()`, `new Date().toISOString()`, etc.) and calls `appendActivityLogSafe(...)`. No hook, no context needed — just `accessToken` and `spreadsheetId` which are already in scope at every call site.

### Decision: Postpone Date Formatting in Summaries

**Chosen**: Reuse `formatDueDate` from `calendarReminders.ts` for the "toDay" side (e.g., "12 Jun 2026"). Create a small `formatShortDate(dateStr: string): string` helper inside `activityLogService.ts` that omits the year (e.g., "5 Jun") for the "fromDay" side. The year only appears on the toDay.

**Implementation**:
```typescript
/** Format "2026-06-05" as "5 Jun" (no year). */
function formatShortDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}
```

Postpone summary: `"${name} · ${formatShortDate(fromDate)} → ${formatDueDate(toDate)}"` where `formatDueDate` produces "12 Jun 2026".

### Decision: relativeTime Utility Location

**Chosen**: `src/utils/relativeTime.ts` — a small standalone module with a single export `formatRelativeTime(isoTimestamp: string, now?: Date): string`. Placed in `utils/` for testability and future reuse by Phase 10 Dashboard. The `now` parameter allows deterministic testing.

### Decision: ACTION_LABELS and ENTITY_ICONS Location

**Chosen**: Both `ACTION_LABELS` (a `Record<ActionType, string>` map) and `ENTITY_ICONS` (a `Record<ActivityEntityType, LucideIcon>` map) live inside `ActivityLogPage.tsx` as module-level constants. They are only used by the viewer page. Phase 10 can extract them if the Dashboard widget needs them.

### Layer 1: Types (src/types/index.ts additions)

Add at the end of the file, after the existing `MarkDoneFormData` / `CATEGORY_COLOR_PALETTE` block:

```typescript
// --- Activity Log Types ---

export type ActionType =
  | 'bill_added' | 'bill_updated' | 'bill_paid' | 'bill_postponed'
  | 'bill_deleted' | 'bill_restored'
  | 'todo_added' | 'todo_updated' | 'todo_done' | 'todo_recurrence_created'
  | 'todo_postponed' | 'todo_deleted' | 'todo_restored'
  | 'property_added' | 'property_updated' | 'property_deleted' | 'property_restored'
  | 'billtype_added' | 'billtype_updated' | 'billtype_deleted' | 'billtype_restored'
  | 'category_added' | 'category_updated' | 'category_deleted' | 'category_restored';

export type ActivityEntityType = 'bill' | 'todo' | 'property' | 'billtype' | 'category';

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

### Layer 2: activityLogService.ts

Mirror `postponeLogService.ts` exactly. Full contract:

```typescript
import { HEADER_DEFINITIONS } from '../config/schema';
import { readAllRows, appendRows } from './sheetsService';
import { formatDueDate } from './calendarReminders';
import type { ActivityLogEntry, RowWithIndex } from '../types';

const TAB_NAME = 'ActivityLog';
const ACTIVITY_HEADERS = HEADER_DEFINITIONS.find(d => d.tabName === TAB_NAME)!.headers;
const COL = Object.fromEntries(ACTIVITY_HEADERS.map((h, i) => [h, i])) as Record<string, number>;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Format "2026-06-05" as "5 Jun" (no year — used for the fromDay in postpone summaries). */
export function formatShortDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

// parseRow, serializeRow, fetchActivityLog, appendActivityLog, appendActivityLogSafe
// (see contracts/activityLogService.ts for full signatures)
```

**Column mapping** (snake_case sheet → camelCase TS):
- `id` → `id`
- `timestamp` → `timestamp`
- `user_email` → `userEmail`
- `action` → `action` (cast to `ActionType`)
- `entity_type` → `entityType` (cast to `ActivityEntityType`)
- `entity_id` → `entityId`
- `summary` → `summary`

### Layer 3: relativeTime.ts

Pure function with these boundaries:

| Condition | Output |
|---|---|
| < 60 seconds ago | `"Just now"` |
| 1–59 minutes ago | `"N minutes ago"` (singular: `"1 minute ago"`) |
| 1–23 hours ago | `"N hours ago"` (singular: `"1 hour ago"`) |
| Yesterday (1 day ago) | `"Yesterday"` |
| 2–7 days ago | `"N days ago"` |
| > 7 days ago | Formatted date via `formatDueDate` (e.g., "5 Jun 2026") |

Implementation: custom function (not `Intl.RelativeTimeFormat`) for precise control over wording and boundaries.

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

  // Older than 7 days — format as "5 Jun 2026"
  const dateStr = `${then.getFullYear()}-${String(then.getMonth()+1).padStart(2,'0')}-${String(then.getDate()).padStart(2,'0')}`;
  return formatDueDate(dateStr);
}
```

### Layer 4: ActivityLogPage.tsx

Mirrors `PropertiesPage.tsx` shell:
- Back link to `/settings`
- Page title "Activity Log"
- Document title `"NoDues · Activity Log"`
- Loading spinner (`Loader2`)
- Empty state (History icon + "No activity yet" + "Actions you perform will appear here.")
- Content list — 100 entries max, newest first

**Entry row layout** (mobile-first, single card per entry):
```
┌──────────────────────────────────────────────┐
│ [Icon]  Label                     rel. time  │
│         Summary text (line-clamped)           │
└──────────────────────────────────────────────┘
```

- Icon: `w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5` — entity-type icon from `ENTITY_ICONS` map
- Label: `text-sm font-medium text-slate-900` — from `ACTION_LABELS` map
- Relative time: `text-xs text-slate-400 ml-auto flex-shrink-0` — right-aligned
- Summary: `text-sm text-slate-600` — below the label+time row, wraps naturally

No Add button (read-only page). No filters. No pagination.

**Error handling**: If `fetchActivityLog` throws, show error toast and display empty state.

### Layer 5: Integration — Write Side (All 5 Pages)

Every page imports:
```typescript
import { v4 as uuidv4 } from 'uuid';
import { appendActivityLogSafe } from '../services/activityLogService';
```

Each call follows this pattern:
```typescript
await appendActivityLogSafe(accessToken!, spreadsheetId, {
  id: uuidv4(),
  timestamp: new Date().toISOString(),
  userEmail: 'user',
  action: '<ActionType>',
  entityType: '<ActivityEntityType>',
  entityId: entity.id,
  summary: '<constructed per DD-003>',
});
```

#### BillsPage.tsx — 6 Call Sites

**Import additions**: `v4 as uuidv4` from `uuid`, `appendActivityLogSafe` and `formatShortDate` from `activityLogService`.

1. **`saveNewBill`** — after calendar best-effort resolves (just before/after success toast):
   ```typescript
   // action: 'bill_added', entityType: 'bill', entityId: newBill.id
   // summary: `${btInfo?.name ?? ''} — ${btInfo?.propertyName ?? ''} · ${formatMonth(data.month)}`
   ```

2. **`saveEditBill`** — after calendar best-effort resolves (just before success toast):
   ```typescript
   // action: 'bill_updated', entityType: 'bill', entityId: bill.id
   // summary: `${bill.billTypeName} — ${bill.propertyName} · ${formatMonth(data.month)}`
   ```

3. **`handleMarkPaidSubmit`** — after calendar cleanup + refetch (just before success toast):
   ```typescript
   // action: 'bill_paid', entityType: 'bill', entityId: markPaidTarget.id
   // summary: `${markPaidTarget.billTypeName} — ${markPaidTarget.propertyName} · ${formatMonth(markPaidTarget.month)}${markPaidTarget.amount !== null ? ` · ${formatCurrency(markPaidTarget.amount)}` : ''}`
   ```

4. **`handlePostponeSubmit`** — after calendar best-effort resolves (just before success toast):
   ```typescript
   // action: 'bill_postponed', entityType: 'bill', entityId: postponeTarget.id
   // summary: `${postponeTarget.billTypeName} — ${postponeTarget.propertyName} · ${formatShortDate(postponeTarget.dueDate)} → ${formatDueDate(data.newDueDate)}`
   ```

5. **`handleDeleteConfirm`** — after softDeleteBill + calendar cleanup (just before showUndo):
   ```typescript
   // action: 'bill_deleted', entityType: 'bill', entityId: bill.id
   // summary: `${bill.billTypeName} — ${bill.propertyName} · ${formatMonth(bill.month)}`
   ```

6. **undo callback** — after undoDeleteBill + calendar recreation (just before setBills):
   ```typescript
   // action: 'bill_restored', entityType: 'bill', entityId: bill.id
   // summary: `${bill.billTypeName} — ${bill.propertyName} · ${formatMonth(bill.month)}`
   ```

#### TodosPage.tsx — 7 Call Sites

**Import additions**: `v4 as uuidv4` from `uuid`, `appendActivityLogSafe` and `formatShortDate` from `activityLogService`.

1. **`saveNewTodo`** — after calendar best-effort resolves:
   ```typescript
   // action: 'todo_added', entityType: 'todo', entityId: newTodo.id
   // summary: `${newTodo.title}`
   ```

2. **`saveEditTodo`** — after calendar best-effort resolves:
   ```typescript
   // action: 'todo_updated', entityType: 'todo', entityId: todo.id
   // summary: `${data.title}`
   ```

3. **`handleMarkDoneSubmit` — todo_done** — after STEP 3 calendar cleanup, before STEP 4:
   ```typescript
   // action: 'todo_done', entityType: 'todo', entityId: markDoneTarget.id
   // summary: `${markDoneTarget.title}`
   ```

4. **`handleMarkDoneSubmit` — todo_recurrence_created** — after STEP 4 calendar create on next instance (after refetch), inside the `if (nextTodo)` block:
   ```typescript
   // action: 'todo_recurrence_created', entityType: 'todo', entityId: nextTodo.id
   // summary: nextTodo.dueDate
   //   ? `${nextTodo.title} · next ${formatDueDate(nextTodo.dueDate)}`
   //   : nextTodo.title
   ```

5. **`handlePostponeSubmit`** — after calendar best-effort resolves:
   ```typescript
   // action: 'todo_postponed', entityType: 'todo', entityId: postponeTarget.id
   // summary: `${postponeTarget.title} · ${formatShortDate(postponeTarget.dueDate)} → ${formatDueDate(data.newDueDate)}`
   ```

6. **`handleDeleteConfirm`** — after softDeleteTodo + calendar cleanup:
   ```typescript
   // action: 'todo_deleted', entityType: 'todo', entityId: todo.id
   // summary: `${todo.title}`
   ```

7. **undo callback** — after undoDeleteTodo + calendar recreation:
   ```typescript
   // action: 'todo_restored', entityType: 'todo', entityId: todo.id
   // summary: `${todo.title}`
   ```

#### PropertiesPage.tsx — 4 Call Sites

**Import additions**: `v4 as uuidv4` from `uuid`, `appendActivityLogSafe` from `activityLogService`.

1. **`handleFormSubmit` (add branch)** — after refetch, before success toast:
   ```typescript
   // action: 'property_added', entityType: 'property', entityId: ???
   ```
   **Issue**: `addProperty` returns a `Property` but the return value isn't captured in the current code — only `fetchProperties` is used for the refetch. The `addProperty` service does return the new property (with `id`). We need to capture it: `const newProp = await addProperty(...)`. Then `entityId: newProp.id`, `summary: data.name`.

2. **`handleFormSubmit` (edit branch)** — after updateProperty, before success toast:
   ```typescript
   // action: 'property_updated', entityType: 'property', entityId: editTarget.id
   // summary: `${data.name}`
   ```

3. **`handleDeleteConfirm`** — after softDeleteProperty, before showUndo:
   ```typescript
   // action: 'property_deleted', entityType: 'property', entityId: property.id
   // summary: `${property.name}`
   ```

4. **undo callback** — after undoDeleteProperty, before setProperties:
   ```typescript
   // action: 'property_restored', entityType: 'property', entityId: property.id
   // summary: `${property.name}`
   ```

#### BillTypesPage.tsx — 4 Call Sites

**Import additions**: `v4 as uuidv4` from `uuid`, `appendActivityLogSafe` from `activityLogService`.

1. **`handleFormSubmit` (add branch)** — after refetch, before success toast. Same issue as Properties: `addBillType` returns a `BillType` but the return isn't captured. Capture it: `const newBt = await addBillType(...)`. Then `entityId: newBt.id`, `summary: data.name`.

2. **`handleFormSubmit` (edit branch)** — after updateBillType:
   ```typescript
   // action: 'billtype_updated', entityType: 'billtype', entityId: editTarget.id
   // summary: `${data.name}`
   ```

3. **`handleDeleteConfirm`** — after softDeleteBillType:
   ```typescript
   // action: 'billtype_deleted', entityType: 'billtype', entityId: billType.id
   // summary: `${billType.name}`
   ```

4. **undo callback** — after undoDeleteBillType:
   ```typescript
   // action: 'billtype_restored', entityType: 'billtype', entityId: billType.id
   // summary: `${billType.name}`
   ```

#### CategoriesPage.tsx — 4 Call Sites

**Import additions**: `v4 as uuidv4` from `uuid`, `appendActivityLogSafe` from `activityLogService`.

1. **`handleFormSubmit` (add branch)** — after refetch, before success toast. Same pattern: capture `addCategory` return. `entityId: newCat.id`, `summary: data.name`.

2. **`handleFormSubmit` (edit branch)** — after updateCategory:
   ```typescript
   // action: 'category_updated', entityType: 'category', entityId: editTarget.id
   // summary: `${data.name}`
   ```

3. **`handleDeleteConfirm`** — after softDeleteCategory:
   ```typescript
   // action: 'category_deleted', entityType: 'category', entityId: category.id
   // summary: `${category.name}`
   ```

4. **undo callback** — after undoDeleteCategory:
   ```typescript
   // action: 'category_restored', entityType: 'category', entityId: category.id
   // summary: `${category.name}`
   ```

### Layer 6: Settings Hub + Routing

**SettingsPage.tsx** — Insert after the Categories card, before Notifications:
```typescript
import { Building2, Receipt, Tags, History, Bell } from 'lucide-react';

// In CARDS array, after Categories entry:
{
  label: 'Activity Log',
  description: 'View recent actions',
  icon: History,
  to: '/settings/activity-log',
},
```

**App.tsx** — Add route inside `<Route element={<BootstrapLayout />}>`:
```tsx
import ActivityLogPage from './pages/ActivityLogPage';

<Route path="/settings/activity-log" element={<ProtectedRoute><ActivityLogPage /></ProtectedRoute>} />
```

### Cross-Cutting Concerns

#### Best-Effort Guarantee (FR-010, FR-033)

All activity log writes use `appendActivityLogSafe()`. This function:
1. Catches ALL errors.
2. Logs via `console.warn('Activity log append failed:', e)`.
3. Never re-throws.
4. Never shows a toast.

The parent operation's success toast always fires regardless of log outcome.

#### Side-Effect Ordering (DD-002)

The chain at every handler is:
1. **Critical-path Sheet write** (addBill, updateBill, markBillPaid, etc.)
2. **Calendar best-effort** (createReminders / cleanupReminders) — existing
3. **Activity log best-effort** (appendActivityLogSafe) — NEW

Activity log calls are placed AFTER all calendar work completes (or fails), just before or alongside the success toast.

#### Return Value Capture in Properties/BillTypes/Categories

The existing `handleFormSubmit` (add branch) in PropertiesPage, BillTypesPage, and CategoriesPage does not capture the return value of `addProperty`/`addBillType`/`addCategory`. The plan requires capturing it to get the new entity's `id` for the activity log `entityId` field. This is a minor change — just `const newEntity = await addEntity(...)`.

## Implementation Chunks

### Chunk 1: Types + Service + Write-Side Integration (all 5 pages)

**New files**:
- `src/types/index.ts` — add `ActionType`, `ActivityEntityType`, `ActivityLogEntry`
- `src/services/activityLogService.ts` — full service (parseRow, serializeRow, fetchActivityLog, appendActivityLog, appendActivityLogSafe, formatShortDate)

**Modified files**:
- `src/pages/BillsPage.tsx` — 6 `appendActivityLogSafe` calls
- `src/pages/TodosPage.tsx` — 7 `appendActivityLogSafe` calls
- `src/pages/PropertiesPage.tsx` — 4 `appendActivityLogSafe` calls + capture `addProperty` return
- `src/pages/BillTypesPage.tsx` — 4 `appendActivityLogSafe` calls + capture `addBillType` return
- `src/pages/CategoriesPage.tsx` — 4 `appendActivityLogSafe` calls + capture `addCategory` return

**Verification**: `npx tsc --noEmit` — compile clean.

**Dependencies**: None.

### Chunk 2: Viewer Page + Utility + Settings Card + Route (read side)

**New files**:
- `src/utils/relativeTime.ts` — `formatRelativeTime` pure function
- `src/pages/ActivityLogPage.tsx` — viewer page component

**Modified files**:
- `src/pages/SettingsPage.tsx` — add Activity Log card (History icon) between Categories and Notifications
- `src/App.tsx` — add `/settings/activity-log` route

**Verification**: Browser-testable — Settings → Activity Log → see entries from Chunk 1 work.

**Dependencies**: Chunk 1 (types and service must exist).

## Complexity Tracking

No constitution violations to justify. The implementation extends existing patterns without introducing new abstractions, dependencies, or architectural layers.
