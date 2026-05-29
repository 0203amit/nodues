# Feature Specification: Activity Log

**Feature Branch**: `009-activity-log`

**Created**: 2026-05-29

**Status**: Draft

**Input**: User description: "Activity Log — record meaningful user actions to the ActivityLog tab + add a Recent Activity viewer page in Settings (Phase 9 of the Build Order)"

---

## Clarifications

### CL-001: Schema Column Names (Source of Truth)

The ActivityLog tab is already defined in `schema.ts` HEADER_DEFINITIONS with these exact column names:

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Unique log entry identifier |
| `timestamp` | ISO 8601 string | When the action occurred (equivalent to "performed_at") |
| `user_email` | string | Who performed the action (hardcoded `'user'` — single-user app) |
| `action` | ActionType string | The action type code (e.g., `bill_paid`, `todo_done`) |
| `entity_type` | EntityType string | The entity category (`'bill'` \| `'todo'` \| `'property'` \| `'billtype'` \| `'category'`) |
| `entity_id` | UUID | The id of the affected row |
| `summary` | string | Short human-readable description of what happened |

These are the **authoritative** column names. All code (service, types, serialization) MUST align to these names, not the conceptual names used elsewhere in this document.

### CL-002: Deliberate Redundancy — bill_postponed and todo_postponed

`bill_postponed` and `todo_postponed` are logged in BOTH ActivityLog (high-level overview: "Maintenance — Mira Shop · 5 Jun → 12 Jun 2026") AND PostponeLog (legal-audit detail with from_date, to_date, reason). These are deliberately redundant — they serve different purposes:

- **PostponeLog**: structured audit trail with machine-readable fields, used for compliance/dispute resolution.
- **ActivityLog**: human-readable timeline of all actions, used for the Recent Activity viewer.

### CL-003: todo_recurrence_created Is a Separate Log Entry

When Mark Done auto-generates the next recurring to-do instance, TWO ActivityLog entries are written:
1. `todo_done` on the parent to-do (the one being marked done).
2. `todo_recurrence_created` on the NEW to-do row (the auto-generated next instance).

These are separate entries because they affect separate entity_ids.

---

## User Scenarios & Testing

### User Story 1 — Activity Log Is Silently Written on Every CRUD Action (Priority: P1)

Every meaningful user action across Bills, To-Dos, Properties, Bill Types, and Categories appends an ActivityLog row AFTER the critical-path write succeeds. The user never sees or interacts with the log write directly — it is invisible during normal operation.

**Why this priority**: The write side is the foundation. Without it, the viewer page has nothing to display.

**Independent Test**: Perform each CRUD action (add, update, delete, restore, pay, postpone, mark done) and verify that the ActivityLog sheet tab has a new row with the correct action, entity_type, entity_id, and summary.

**Acceptance Scenarios**:

1. **Given** the user adds a new bill "Maintenance — Mira Shop · Jun 2026", **When** the bill row is appended to the Bills sheet, **Then** an ActivityLog row is appended with action=`bill_added`, entity_type=`bill`, entity_id=the new bill's id, summary="Maintenance — Mira Shop · Jun 2026", timestamp=now ISO, user_email=`user`.

2. **Given** the user marks a bill as paid, **When** the bill row is updated with status=paid, **Then** an ActivityLog row is appended with action=`bill_paid` and summary including the amount (e.g., "Maintenance — Mira Shop · Jun 2026 · ₹1,100").

3. **Given** the user postpones a bill, **When** the bill's due_date is updated AND the PostponeLog row is appended, **Then** an ActivityLog row is ALSO appended with action=`bill_postponed` and summary showing the date shift (e.g., "Maintenance — Mira Shop · 5 Jun → 12 Jun 2026"). Both logs coexist (CL-002).

4. **Given** the user marks a recurring to-do as done, **When** the to-do is marked done AND a new recurring instance is auto-generated, **Then** TWO ActivityLog rows are appended: one with action=`todo_done` for the parent and one with action=`todo_recurrence_created` for the new instance (CL-003).

5. **Given** the ActivityLog sheet write fails (network error, quota, etc.), **When** the user's primary action (e.g., bill_added) has already succeeded, **Then** no error toast is shown, a `console.warn` is emitted, and the parent operation completes normally. The user is NEVER informed of log failures.

6. **Given** the user soft-deletes a property "Mira Shop", **Then** an ActivityLog row with action=`property_deleted` is appended. **Given** the user taps Undo within 10 seconds, **Then** an ActivityLog row with action=`property_restored` is appended.

---

### User Story 2 — Recent Activity Viewer Page (Priority: P1)

The user navigates to Settings > Activity Log and sees a chronological list (newest first) of all logged actions. Each entry shows a friendly action label, the summary string, a relative timestamp, and an entity-type icon.

**Why this priority**: Without a viewer, the log data is only accessible by opening the raw Sheet.

**Independent Test**: Perform several CRUD actions across different entities. Navigate to Settings > Activity Log. Verify entries appear in reverse chronological order with correct labels, summaries, icons, and relative timestamps.

**Acceptance Scenarios**:

1. **Given** the user navigates to `/settings/activity-log`, **Then** the page title is "Activity Log", there is a back link to `/settings`, and the document title is set to "NoDues · Activity Log".

2. **Given** there are 5 activity log entries, **When** the page loads, **Then** entries are displayed newest-first. Each entry shows: a Lucide icon for the entity type, a friendly label (e.g., "Bill paid", "To-do added"), the summary string, and a relative-time string.

3. **Given** an entry's timestamp is 2 minutes ago, **Then** the relative time shows "2 minutes ago". **Given** an entry is from yesterday, **Then** it shows "Yesterday". **Given** an entry is 3 days old, **Then** "3 days ago". **Given** an entry is older than ~7 days, **Then** the formatted date (e.g., "5 Jun 2026").

4. **Given** a `bill_paid` entry, **Then** the icon is Receipt. **Given** a `todo_done` entry, **Then** the icon is ListTodo. **Given** a `property_added` entry, **Then** the icon is Home. **Given** a `billtype_updated` entry, **Then** the icon is FileText. **Given** a `category_deleted` entry, **Then** the icon is Tags.

5. **Given** there are zero activity log entries, **When** the page loads, **Then** an empty state is shown with a History icon, heading "No activity yet", and supporting text "Actions you perform will appear here."

6. **Given** there are 150 entries in the ActivityLog sheet, **When** the page loads, **Then** only the first 100 entries (newest) are displayed. No "load more" button; excess entries are accessible via the raw Sheet.

7. **Given** the page is loading data, **Then** a loading spinner is shown (same pattern as PropertiesPage).

---

### User Story 3 — Activity Log Card in Settings Hub (Priority: P1)

The Settings page includes an "Activity Log" card that links to the viewer page, positioned after Categories and before Notifications.

**Why this priority**: Without the Settings hub entry, the viewer page is unreachable via navigation.

**Independent Test**: Navigate to `/settings`. Verify the Activity Log card appears with a History icon, label "Activity Log", description "View recent actions", and links to `/settings/activity-log`.

**Acceptance Scenarios**:

1. **Given** the user is on the Settings page, **Then** the CARDS list contains (in order): Properties, Bill Types, Categories, **Activity Log**, Notifications.

2. **Given** the user taps the Activity Log card, **Then** they are navigated to `/settings/activity-log`.

---

### Edge Cases

- **Rapid sequential actions**: Each action appends independently. No batching, no deduplication. Two quick edits produce two `_updated` entries.
- **Undo after delete**: Both `_deleted` and `_restored` are logged as separate entries. The log is append-only — the delete entry is NOT removed on undo.
- **Calendar best-effort fires before activity log**: The side-effect chain is: critical-path write → calendar (best-effort) → activity log (best-effort). If calendar fails, activity log still fires. If activity log fails, no toast, no retry.
- **Large summary strings**: Summaries are constructed from user-entered data (property names, bill type names, to-do titles). No truncation is applied — Google Sheets cells can hold up to 50,000 characters. Summaries are expected to be short (under 100 characters) by construction.
- **Deleted entity names**: The summary is captured at log-write time. If the entity is later renamed or deleted, the summary retains the original name. This is correct behavior — the log records what happened at the time.
- **Empty amount on bill_paid**: If a bill has no amount (null), the summary omits the amount portion (e.g., "Maintenance — Mira Shop · Jun 2026" without the ₹ suffix).
- **todo_recurrence_created with no due date**: If a recurring to-do has no due date, the next-instance summary omits the date (e.g., "Renew insurance" without "· next 15 Jul 2027").

---

## Design Decisions

### DD-001: Best-Effort Architecture (CHOSEN)

**Decision**: `appendActivityLog` is wrapped in try/catch at every call site. On failure: `console.warn` only. NEVER throws out of the parent operation. NEVER shows a toast for log failure.

**Rationale**: ActivityLog is an audit/observability feature. It must never degrade the user's primary workflow. A failed log write is invisible to the user because:
1. Toasting on every log failure would be noisy and confusing ("What failed? My bill was saved fine.").
2. The log is append-only and non-critical — missing entries are acceptable.
3. This matches the calendar best-effort precedent established in Phase 6.

**Alternative rejected**: Queuing failed writes for retry. Over-engineered for a single-user Google Sheets app. The probability of log failure without primary-write failure is very low (both hit the same Sheets API).

### DD-002: Side-Effect Ordering (CHOSEN)

**Decision**: critical-path sheet write → calendar (best-effort) → activity log (best-effort).

**Rationale**: The activity log records the final state. By running after calendar work, the summary can (in theory) reflect the complete outcome. In practice, the summary is constructed from the write payload, not from calendar success/failure. The ordering ensures the log doesn't interfere with the more important calendar best-effort.

### DD-003: Summary String Construction

**Decision**: Each action type has a prescribed summary format. Summaries are terse, scannable, and constructed at the call site using data already available in the handler.

**Format table**:

| Action | Summary Format | Example |
|---|---|---|
| `bill_added` | `"{billType} — {property} · {month}"` | "Maintenance — Mira Shop · Jun 2026" |
| `bill_updated` | `"{billType} — {property} · {month}"` | "Maintenance — Mira Shop · Jun 2026" |
| `bill_paid` | `"{billType} — {property} · {month} · ₹{amount}"` | "Maintenance — Mira Shop · Jun 2026 · ₹1,100" |
| `bill_postponed` | `"{billType} — {property} · {fromDay} → {toDay} {year}"` | "Maintenance — Mira Shop · 5 Jun → 12 Jun 2026" |
| `bill_deleted` | `"{billType} — {property} · {month}"` | "Maintenance — Mira Shop · Jun 2026" |
| `bill_restored` | same as `bill_deleted` | "Maintenance — Mira Shop · Jun 2026" |
| `todo_added` | `"{title}"` | "Renew insurance" |
| `todo_updated` | `"{title}"` | "Renew insurance" |
| `todo_done` | `"{title}"` | "Renew insurance" |
| `todo_postponed` | `"{title} · {fromDay} → {toDay} {year}"` | "Renew insurance · 15 Jul → 22 Jul 2027" |
| `todo_recurrence_created` | `"{title} · next {dueDate}"` | "Renew insurance · next 15 Jul 2027" |
| `todo_deleted` | `"{title}"` | "Renew insurance" |
| `todo_restored` | `"{title}"` | "Renew insurance" |
| `property_added` | `"{name}"` | "Mira Shop" |
| `property_updated` | `"{name}"` | "Mira Shop" |
| `property_deleted` | `"{name}"` | "Mira Shop" |
| `property_restored` | `"{name}"` | "Mira Shop" |
| `billtype_added` | `"{name}"` | "Maintenance" |
| `billtype_updated` | `"{name}"` | "Maintenance" |
| `billtype_deleted` | `"{name}"` | "Maintenance" |
| `billtype_restored` | `"{name}"` | "Maintenance" |
| `category_added` | `"{name}"` | "Legal" |
| `category_updated` | `"{name}"` | "Legal" |
| `category_deleted` | `"{name}"` | "Legal" |
| `category_restored` | `"{name}"` | "Legal" |

**Date formatting in summaries**: Use short month format (e.g., "5 Jun", "12 Jun 2026"). For postpone summaries, include the year only on the `toDay` side to keep it concise. For `bill_paid` amounts, use `Intl.NumberFormat('en-IN', ...)` with no decimal places.

### DD-004: Pagination — Hard Cap at 100 Entries (CHOSEN)

**Decision**: The Activity Log viewer page displays at most 100 entries (newest first). No "load more", no infinite scroll, no pagination controls.

**Rationale**: 100 entries covers several weeks of normal use. For a single-user household app, this is sufficient. Users who need older entries can open the Google Sheet directly. Building pagination would add complexity (cursor management, loading states) for a feature that's read-only and informational. This is a deliberate simplicity trade-off, not a limitation to fix later.

### DD-005: No Filters in v1 (CHOSEN)

**Decision**: The Activity Log viewer has no filter dropdowns (by entity type, action type, or date range).

**Rationale**: The viewer is a "glance" feature — the user wants to see "what happened recently." With a 100-entry cap, visual scanning is sufficient. Filters add UI complexity (dropdowns, clear buttons, empty-filtered states) for marginal benefit at this scale. If filtering becomes needed, it can be added in a future phase without schema changes.

### DD-006: Action Type Vocabulary — Exhaustive String Union

**Decision**: The `ActionType` is a TypeScript string union with exactly 26 members covering all CRUD actions across all 5 entity types.

```
bill_added, bill_updated, bill_paid, bill_postponed, bill_deleted, bill_restored
todo_added, todo_updated, todo_done, todo_recurrence_created, todo_postponed, todo_deleted, todo_restored
property_added, property_updated, property_deleted, property_restored
billtype_added, billtype_updated, billtype_deleted, billtype_restored
category_added, category_updated, category_deleted, category_restored
```

**Naming convention**: `{entity}_{verb}` where entity is the lowercase singular form matching the `entity_type` column value (except `billtype` which is one word to match the entity_type value `'billtype'`).

### DD-007: Friendly Action Labels for the Viewer

**Decision**: A `labelFor(action: ActionType): string` helper maps each action code to a human-readable label for the viewer page.

| Action | Label |
|---|---|
| `bill_added` | "Bill added" |
| `bill_updated` | "Bill updated" |
| `bill_paid` | "Bill paid" |
| `bill_postponed` | "Bill postponed" |
| `bill_deleted` | "Bill deleted" |
| `bill_restored` | "Bill restored" |
| `todo_added` | "To-do added" |
| `todo_updated` | "To-do updated" |
| `todo_done` | "To-do done" |
| `todo_recurrence_created` | "Recurrence created" |
| `todo_postponed` | "To-do postponed" |
| `todo_deleted` | "To-do deleted" |
| `todo_restored` | "To-do restored" |
| `property_added` | "Property added" |
| `property_updated` | "Property updated" |
| `property_deleted` | "Property deleted" |
| `property_restored` | "Property restored" |
| `billtype_added` | "Bill type added" |
| `billtype_updated` | "Bill type updated" |
| `billtype_deleted` | "Bill type deleted" |
| `billtype_restored` | "Bill type restored" |
| `category_added` | "Category added" |
| `category_updated` | "Category updated" |
| `category_deleted` | "Category deleted" |
| `category_restored` | "Category restored" |

### DD-008: Entity-Type Icons for the Viewer

| Entity Type | Lucide Icon | Rationale |
|---|---|---|
| `bill` | `Receipt` | Matches existing BillCard icon |
| `todo` | `ListTodo` | Matches existing TodoCard icon |
| `property` | `Home` | Intuitive for property/building |
| `billtype` | `FileText` | Represents a bill-type configuration/document |
| `category` | `Tags` | Matches existing CategoriesPage icon |

### DD-009: user_email Column — Hardcoded 'user'

**Decision**: The `user_email` column stores the literal string `'user'`, not an actual email address.

**Rationale**: NoDues is a single-user app. There is no multi-user auth context to pull from. This matches `postponeLogService.ts` where `postponed_by` is hardcoded to `'user'`. The column name (`user_email`) comes from the schema seed and cannot be renamed without a migration. The value is consistent and queryable.

---

## Requirements

### Functional Requirements

#### Service Layer — activityLogService.ts

- **FR-001**: A new file `src/services/activityLogService.ts` MUST be created, mirroring `postponeLogService.ts` in structure.

- **FR-002**: The service MUST derive column indices from `HEADER_DEFINITIONS` for the `'ActivityLog'` tab (columns: `id`, `timestamp`, `user_email`, `action`, `entity_type`, `entity_id`, `summary`).

- **FR-003**: `parseRow(row: RowWithIndex): ActivityLogEntry | null` MUST return null if the row is empty or has no `id` value (defensive null guard, same as postponeLogService).

- **FR-004**: `serializeRow(entry: ActivityLogEntry): string[]` MUST produce values in HEADER_DEFINITIONS column order: `[id, timestamp, user_email, action, entity_type, entity_id, summary]`.

- **FR-005**: `fetchActivityLog(accessToken, spreadsheetId): Promise<ActivityLogEntry[]>` MUST read all rows, parse (skipping nulls), and sort by `timestamp` descending (newest first).

- **FR-006**: `appendActivityLog(accessToken, spreadsheetId, entry): Promise<void>` MUST append a single serialized row to the ActivityLog tab via `appendRows`.

#### Types — ActivityLogEntry and ActionType

- **FR-007**: The following types MUST be added to `src/types/index.ts`:

  ```typescript
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

- **FR-008**: The `ActivityLogEntry` interface MUST use camelCase property names (e.g., `userEmail`, `entityType`) mapped from the snake_case sheet column names (`user_email`, `entity_type`), consistent with all other entry types in the codebase.

#### Integration — Write Side (All CRUD Handlers)

- **FR-009**: Every CRUD handler across all 5 entity pages MUST call `appendActivityLog` AFTER the critical-path sheet write succeeds and AFTER any calendar best-effort work. The call chain is: **critical-path write → calendar (best-effort) → activity log (best-effort)**.

- **FR-010**: Every `appendActivityLog` call MUST be wrapped in its own try/catch. On catch: `console.warn('Activity log append failed:', error)`. NEVER re-throw. NEVER show a toast. NEVER block the parent operation's success flow.

- **FR-011**: The following actions MUST be logged in **BillsPage.tsx**:
  - `bill_added` — after successful bill creation + calendar best-effort.
  - `bill_updated` — after successful bill edit + calendar best-effort.
  - `bill_paid` — after successful Mark Paid write.
  - `bill_postponed` — after successful postpone write + PostponeLog append + calendar best-effort.
  - `bill_deleted` — after successful soft-delete write + calendar best-effort.
  - `bill_restored` — after successful undo (deleted_at cleared) + calendar recreation.

- **FR-012**: The following actions MUST be logged in **TodosPage.tsx**:
  - `todo_added` — after successful to-do creation + calendar best-effort.
  - `todo_updated` — after successful to-do edit + calendar best-effort.
  - `todo_done` — after successful Mark Done write + calendar cleanup.
  - `todo_recurrence_created` — after the NEW recurring to-do row is appended + its calendar best-effort. This is a SEPARATE log entry from `todo_done`, referencing the NEW row's entity_id.
  - `todo_postponed` — after successful postpone write + PostponeLog append + calendar best-effort.
  - `todo_deleted` — after successful soft-delete write + calendar best-effort.
  - `todo_restored` — after successful undo + calendar recreation.

- **FR-013**: The following actions MUST be logged in **PropertiesPage.tsx**:
  - `property_added` — after successful property creation.
  - `property_updated` — after successful property edit.
  - `property_deleted` — after successful soft-delete write.
  - `property_restored` — after successful undo.

- **FR-014**: The following actions MUST be logged in **BillTypesPage.tsx**:
  - `billtype_added` — after successful bill type creation.
  - `billtype_updated` — after successful bill type edit.
  - `billtype_deleted` — after successful soft-delete write.
  - `billtype_restored` — after successful undo.

- **FR-015**: The following actions MUST be logged in **CategoriesPage.tsx**:
  - `category_added` — after successful category creation.
  - `category_updated` — after successful category edit.
  - `category_deleted` — after successful soft-delete write.
  - `category_restored` — after successful undo.

- **FR-016**: The `entry` object passed to `appendActivityLog` MUST be constructed with:
  - `id`: new UUID (via `uuidv4()`).
  - `timestamp`: `new Date().toISOString()`.
  - `userEmail`: `'user'` (hardcoded, DD-009).
  - `action`: the appropriate `ActionType` string.
  - `entityType`: the appropriate `ActivityEntityType` string.
  - `entityId`: the id of the affected entity row.
  - `summary`: constructed per the format table in DD-003.

- **FR-017**: Summary strings MUST be constructed at the call site using data already available in the handler scope (bill/todo/property/billType/category objects, resolved display names). No additional sheet reads to build summaries.

- **FR-018**: For `bill_paid` summaries, the amount MUST be formatted using `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })` per MASTER.md.

- **FR-019**: For postpone summaries (`bill_postponed`, `todo_postponed`), dates MUST be formatted in short form (e.g., "5 Jun → 12 Jun 2026").

#### Read Side — Activity Log Viewer Page

- **FR-020**: A new page component `src/pages/ActivityLogPage.tsx` MUST be created.

- **FR-021**: The page MUST be routed at `/settings/activity-log`, wrapped in `ProtectedRoute` inside `BootstrapLayout`, consistent with other settings sub-pages.

- **FR-022**: The page MUST mirror the `PropertiesPage.tsx` shell: back link to `/settings`, page title "Activity Log", loading spinner, empty state, and content list.

- **FR-023**: The page MUST set the document title to "NoDues · Activity Log" via `useEffect`.

- **FR-024**: On mount, the page MUST call `fetchActivityLog` and display entries newest-first (already sorted by the service).

- **FR-025**: The page MUST display at most **100 entries** (the first 100 from the sorted result). No pagination controls, no "load more" (DD-004).

- **FR-026**: Each entry row MUST display:
  - A small Lucide icon for the `entity_type` (DD-008): Receipt for `bill`, ListTodo for `todo`, Home for `property`, FileText for `billtype`, Tags for `category`.
  - A friendly action label via the `labelFor()` helper (DD-007).
  - The `summary` string.
  - A relative-time timestamp: "2 minutes ago", "1 hour ago", "Yesterday", "3 days ago" for entries within ~7 days; formatted date "5 Jun 2026" for older entries.

- **FR-027**: The empty state MUST show a History icon (Lucide), heading "No activity yet", and supporting text "Actions you perform will appear here."

- **FR-028**: The page MUST show a loading spinner while `fetchActivityLog` is in progress.

- **FR-029**: If `fetchActivityLog` fails, an error toast MUST be shown and the page MUST display the empty state.

#### Settings Hub Integration

- **FR-030**: An "Activity Log" card MUST be added to the `CARDS` array in `SettingsPage.tsx`, positioned AFTER "Categories" and BEFORE "Notifications".

- **FR-031**: The card MUST use: label `'Activity Log'`, description `'View recent actions'`, icon `History` (from lucide-react), to `'/settings/activity-log'`.

#### Routing

- **FR-032**: `App.tsx` MUST add a route for `/settings/activity-log` → `ActivityLogPage`, wrapped in `ProtectedRoute` inside `BootstrapLayout`, matching the pattern of `/settings/properties`, `/settings/bill-types`, and `/settings/categories`.

### Cross-Cutting Concerns

- **FR-033**: `appendActivityLog` MUST NEVER block the parent operation. If the append fails, the parent operation's success toast still fires. The log failure is only visible in `console.warn`.

- **FR-034**: `parseRow` MUST return null on empty rows or missing `id` (defensive parsing, consistent with all other services).

- **FR-035**: `serializeRow` MUST output values in the exact column order defined in `HEADER_DEFINITIONS` for `'ActivityLog'`.

- **FR-036**: `user_email` is hardcoded to `'user'` (single-user app, consistent with PostponeLog's `postponed_by = 'user'`).

- **FR-037**: All viewer page UI MUST follow MASTER.md: indigo-700 primary, Lucide icons, 44px touch targets, visible focus rings, slate neutrals, IBM Plex Sans font.

- **FR-038**: The viewer page MUST be responsive at 375px (phone-first), 768px (tablet), and 1024px+ (desktop).

---

## Reuse Statements

These are explicit declarations of what is reused from prior phases to prevent reinvention:

| What | Source | How Reused |
|---|---|---|
| Service structure | `postponeLogService.ts` | `activityLogService.ts` mirrors the same pattern: column index map from HEADER_DEFINITIONS, parseRow/serializeRow, fetch (parse + skip nulls + sort), append |
| Sheet operations | `sheetsService.ts` → `readAllRows`, `appendRows` | Called by activityLogService — no changes needed |
| Page shell | `PropertiesPage.tsx` | ActivityLogPage mirrors the same layout: back link, title, loading spinner, empty state, content list |
| Settings hub | `SettingsPage.tsx` → `CARDS` array | New card entry added, same shape as existing cards |
| Routing pattern | `App.tsx` | New route added inside BootstrapLayout → ProtectedRoute, matching existing settings sub-pages |
| Type pattern | `PostponeLogEntry` in `types/index.ts` | `ActivityLogEntry` follows the same interface shape with `_rowIndex` |
| Auth / Bootstrap | `useAuth()`, `useBootstrap().setupResult` | Same access patterns for `accessToken` and `spreadsheetId` |
| Toast system | `useToast()` hook | Reused for error feedback on fetch failure in the viewer page (NOT used for log write failures) |
| UUID generation | `uuid` package → `v4 as uuidv4` | Used for generating log entry IDs at call sites |

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every CRUD action across Bills, To-Dos, Properties, Bill Types, and Categories produces exactly one ActivityLog row (except Mark Done on recurring to-dos, which produces two: `todo_done` + `todo_recurrence_created`).

- **SC-002**: No CRUD action is slowed, blocked, or errored due to ActivityLog failures. The best-effort guarantee holds: parent operations always succeed independently of log writes.

- **SC-003**: The Activity Log viewer at `/settings/activity-log` loads and displays entries correctly — newest first, with correct icons, labels, summaries, and relative timestamps.

- **SC-004**: The Settings hub shows the Activity Log card in the correct position (after Categories, before Notifications) and navigates to the viewer.

- **SC-005**: The `action` values in the sheet match the `ActionType` union exactly — no typos, no unexpected values.

- **SC-006**: Summary strings match the prescribed formats in DD-003 and are constructed from in-scope data without additional sheet reads.

- **SC-007**: The viewer page handles zero entries (empty state), loading state (spinner), and error state (toast + empty state) correctly.

---

## Assumptions

- Phases 1 through 8 are complete: sign-in, bootstrapping (all 9 sheet tabs including ActivityLog), Properties, Bill Types, Bills core loop, file attachments, calendar reminders, bill postpone, and to-dos task tracking.
- The ActivityLog sheet tab already exists with headers matching `schema.ts` HEADER_DEFINITIONS (columns: `id`, `timestamp`, `user_email`, `action`, `entity_type`, `entity_id`, `summary`), created during bootstrap Phase 2.
- `accessToken` is available via `useAuth()` and `spreadsheetId` via `useBootstrap().setupResult`.
- All CRUD handlers in BillsPage, TodosPage, PropertiesPage, BillTypesPage, and CategoriesPage are stable and follow the patterns documented in Phase 4/7/8 specs (critical-path write → calendar best-effort → [new] activity log best-effort).
- The `PostponeLog` service is already operational with `appendPostponeLog` for both bills and to-dos. ActivityLog is a second, independent append-only log.
- Lucide's `History` icon is available in `lucide-react` for the Settings card and empty state.

---

## Out of Scope

- **Filtering/search in the viewer**: No dropdowns or search bar for filtering by entity type, action type, or date range. Future polish if needed.
- **Pagination beyond 100 entries**: No "load more", no infinite scroll, no cursor-based pagination. Older entries accessible via the raw Sheet.
- **Editing or deleting log entries**: The ActivityLog is append-only. No UI or API for modifying or removing entries.
- **Dashboard integration**: Phase 10 — no "Recent Activity" widget on the Dashboard.
- **Push notifications for activity**: Phase 11 scope.
- **Multi-user attribution**: `user_email` is hardcoded `'user'`. Real email-based attribution is out of scope for this single-user app.
- **Retry/queue for failed log writes**: Over-engineered for this context. Failed writes are silently dropped.
- **Batch logging**: Each action produces one (or two) individual append calls. No batching of multiple log writes into a single Sheets API call.
