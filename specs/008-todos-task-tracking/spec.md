# Feature Specification: To-Dos Task Tracking

**Feature Branch**: `008-todos-task-tracking`

**Created**: 2026-05-29

**Status**: Draft

**Input**: User description: "To-Dos task tracking with categories, recurrence, due dates, reminders, mark-done, postpone, soft-delete-with-undo (Phase 8 of the Build Order)"

---

## User Scenarios & Testing

### User Story 1 — View and Filter To-Dos (Priority: P1)

The user navigates to the To-Dos page (replacing the current placeholder at `/todos`) and sees a list of all non-deleted to-dos. Each to-do card shows its title, category badge (colored), status badge (Pending / Overdue / Done), recurrence label (if any), and due date (if any). The list is sorted: overdue first, then pending, then done (most recent first within each group). The user can filter by category and by status using dropdown selectors.

**Why this priority**: The list page is the entry point for every other to-do action. Without it, nothing else is reachable.

**Independent Test**: Navigate to `/todos`, verify to-dos render with correct badges and sorting. Apply filters and confirm the list narrows correctly.

**Acceptance Scenarios**:

1. **Given** the user has 3 pending, 2 overdue, and 1 done to-do, **When** they open `/todos`, **Then** the to-dos appear in order: 2 overdue (sorted by due date ascending) → 3 pending (sorted by due date ascending) → 1 done (most recent done_date first).

2. **Given** to-dos exist across categories Insurance, Tax, and Society, **When** the user selects "Insurance" in the category filter, **Then** only Insurance-category to-dos are shown.

3. **Given** filters are set to category "Tax" and status "Pending", **When** no to-dos match, **Then** an empty state message "No to-dos match your filters" is shown with a suggestion to adjust filters.

4. **Given** the user has zero to-dos, **When** they open `/todos`, **Then** an empty state with a ListTodo icon, "No to-dos yet", and an "Add a to-do" button is shown.

---

### User Story 2 — Add a To-Do (Priority: P1)

The user taps "Add To-Do" to open a modal form. They enter a title (required), select a category from a dropdown of active non-deleted TodoCategories, optionally set a due date, pick a recurrence pattern from a dropdown (seeded set including "One-time"), enter reminder offsets (defaults to "3,1"), and optionally add notes. On save, a new Todos row is appended. If a due date is set, calendar reminders are created (best-effort).

**Why this priority**: Creating to-dos is the core write action for the entire feature.

**Independent Test**: Open Add To-Do modal, fill in fields, submit, and verify the Todos sheet row is created with correct values. Verify calendar events are created when a due date is provided.

**Acceptance Scenarios**:

1. **Given** the user taps "Add To-Do", **When** they enter title "Renew flat insurance", select category "Insurance", set due date 2026-07-15, select recurrence "Every year", leave reminder offsets as "3,1", and save, **Then** a new Todos row appears with status "pending", recurrence_pattern_id pointing to the "Every year" pattern, reminder_offsets_days "3,1", and calendar events are created for 2026-07-12 and 2026-07-14.

2. **Given** the user opens Add To-Do, **When** they enter only a title "Quick reminder" with no due date, no category, recurrence "One-time", and save, **Then** the to-do is created with status "pending", empty due_date, no calendar events.

3. **Given** the user submits with an empty title, **Then** a validation error "Title is required." appears and submission is blocked.

4. **Given** the calendar API is unreachable, **When** the user saves a to-do with a due date and reminder offsets, **Then** the to-do row is saved successfully and a toast shows "To-do added, but reminders couldn't be set."

---

### User Story 3 — Mark a To-Do as Done (Priority: P1)

The user taps "Mark Done" on a pending or overdue to-do. A modal opens where they can optionally add notes. On submit, the to-do's status becomes "done", done_date is set to today (IST), and calendar reminders for this to-do are deleted (best-effort). If the to-do has a non-One-time recurrence pattern, a NEW pending to-do is auto-generated with the next due date computed from the current due_date + the recurrence interval.

**Why this priority**: Completing to-dos is the primary lifecycle action. Recurrence auto-generation is integral to it.

**Independent Test**: Mark a recurring to-do as done. Verify the original becomes "done" and a new pending to-do appears with the correct next due date. Verify calendar events are cleaned up on the original and created on the new instance.

**Acceptance Scenarios**:

1. **Given** a pending to-do "Renew insurance" with due_date 2026-07-15 and recurrence "Every year", **When** the user marks it done with notes "Renewed with HDFC", **Then** the to-do's status becomes "done", done_date is today, notes include "Renewed with HDFC", and a NEW pending to-do "Renew insurance" is created with due_date 2027-07-15, same category, same recurrence, parent_todo_id = the original's id, and reminder offsets copied.

2. **Given** a pending to-do "Submit Form 15G" with recurrence "One-time", **When** the user marks it done, **Then** the to-do becomes "done" and NO new to-do is created.

3. **Given** a pending to-do with calendar_event_ids "evt1,evt2", **When** it is marked done, **Then** events evt1 and evt2 are deleted from Google Calendar (best-effort), and the to-do's calendar_event_ids is cleared.

4. **Given** a recurring to-do "Tank cleaning" with recurrence "Every 3 months" and due_date 2026-05-31, **When** marked done, **Then** the next instance has due_date 2026-08-31 (3 months later, with month-end clamping if needed).

5. **Given** a recurring to-do with recurrence "Every 1 month" and due_date 2026-01-31, **When** marked done, **Then** the next instance has due_date 2026-02-28 (Feb has 28 days; clamped to last day of month).

---

### User Story 4 — Postpone a To-Do (Priority: P2)

The user taps "Postpone" on a pending or overdue to-do. The flow is identical to bill postpone: a modal shows the current due date and requests a new due date + optional reason. On submit, the to-do's due_date is updated, original_due_date is captured on first postpone (write-once), a PostponeLog row is appended with item_type='todo', and calendar reminders are replaced.

**Why this priority**: Depends on P1 to-do lifecycle being in place. Reuses the bill postpone pattern.

**Independent Test**: Postpone a to-do. Verify the Todos row updates, PostponeLog row is created, and calendar events are replaced.

**Acceptance Scenarios**:

1. **Given** a pending to-do with due_date 2026-06-15 and empty original_due_date, **When** the user postpones to 2026-06-22 with reason "Waiting for documents", **Then** due_date becomes 2026-06-22, original_due_date is set to 2026-06-15, updated_at is refreshed, and a PostponeLog row is appended with item_type "todo", from_date "2026-06-15", to_date "2026-06-22", reason "Waiting for documents".

2. **Given** a to-do already postponed once (original_due_date = "2026-06-01"), **When** the user postpones again, **Then** original_due_date remains "2026-06-01" (write-once).

3. **Given** a to-do with due_date 2026-06-15, **When** the user submits the same date 2026-06-15, **Then** an info toast "New date is the same as the current due date." appears and no writes occur.

4. **Given** a to-do with calendar events and reminder offsets "3,1", **When** postponed to 2026-06-22, **Then** old calendar events are deleted (best-effort) and new events are created for 2026-06-19 and 2026-06-21.

---

### User Story 5 — Edit a To-Do (Priority: P1)

The user taps "Edit" on any non-deleted to-do. The TodoFormModal opens in edit mode, pre-filled with current values. On save, the Todos row is updated with full-row-safety. If the due date changed, calendar reminders are replaced (same pattern as bill edit).

**Why this priority**: Correcting data-entry mistakes is essential for any CRUD system.

**Independent Test**: Edit a to-do's title and due date. Verify the row updates and calendar events are replaced if the due date changed.

**Acceptance Scenarios**:

1. **Given** a pending to-do "Rnew insurance" (typo), **When** the user edits it to "Renew insurance" and saves, **Then** the title is updated, updated_at is refreshed, and no calendar changes occur (due date unchanged).

2. **Given** a pending to-do with due_date 2026-07-15, **When** the user changes the due date to 2026-08-01 and saves, **Then** old calendar events are cleaned up and new ones are created for the new date.

---

### User Story 6 — Soft-Delete a To-Do with Undo (Priority: P1)

The user taps "Delete" on a to-do. A confirmation dialog appears ("Delete this to-do? You can undo within 10 seconds."). On confirm, the to-do is optimistically removed from the list, deleted_at is set in the sheet, calendar events are cleaned up (best-effort), and a toast with an "Undo" button appears for 10 seconds. If the user taps Undo, deleted_at is cleared and the to-do reappears.

**Why this priority**: Soft-delete with undo is part of the core CRUD contract, consistent with bills and properties.

**Independent Test**: Delete a to-do, verify it disappears. Tap Undo within 10 seconds, verify it reappears. Delete again without undoing, verify deleted_at is set in the sheet.

**Acceptance Scenarios**:

1. **Given** a pending to-do, **When** the user confirms delete, **Then** the to-do is removed from the list immediately, deleted_at is set in the sheet, calendar events are deleted (best-effort), and a toast "To-do deleted." with an Undo button appears.

2. **Given** the user just deleted a to-do, **When** they tap Undo, **Then** deleted_at is cleared, the to-do reappears at its original position in the list, and calendar reminders are recreated (best-effort).

---

### User Story 7 — Manage To-Do Categories (Priority: P1)

The user navigates to Settings > Categories (mirroring Properties and Bill Types pages). They see a list of all non-deleted categories with name and color badge. They can add a new category (name required, color from a preset palette), edit an existing one, toggle active/inactive, and soft-delete with undo. Deleting a category does NOT cascade to existing to-dos — those to-dos retain their category_id.

**Why this priority**: Categories must exist before to-dos can be categorized. This is a prerequisite for the Add To-Do form.

**Independent Test**: Add a category, verify it appears in the list. Edit its name and color. Soft-delete it and verify existing to-dos still show the old category. Undo the delete.

**Acceptance Scenarios**:

1. **Given** the user opens Settings > Categories, **Then** the 4 seeded categories (Insurance, Tax, Society, Maintenance) are shown with their color badges.

2. **Given** the user adds a category "Legal" with color #6366F1 (indigo), **Then** it appears in the list and is available in the Add To-Do form's category dropdown.

3. **Given** a category "Society" is soft-deleted, **When** a to-do has category_id pointing to "Society", **Then** the to-do still displays "Society" as its category (non-cascading delete). The deleted category does NOT appear in the Add To-Do dropdown.

4. **Given** a category "Tax" is toggled inactive, **Then** it does not appear in the Add To-Do dropdown but existing to-dos with category "Tax" still display it.

---

### Edge Cases

- **No due date**: A to-do without a due_date has status "pending" and no "overdue" computation. It sorts after overdue and before done. No calendar events are created.
- **Mark Done on a to-do with no due date and recurrence**: The next instance is created with no due_date (recurrence cannot compute a next date without a base). The user must manually set the due date on the new instance. **Design decision**: this is acceptable because One-time is the default recurrence; if the user picked a recurring pattern without a due date, that's an unusual edge case they can fix via Edit.
- **Concurrent edit**: Single-user app; no concurrent-write protection needed. Last-write-wins, same as all other operations.
- **To-do deleted between modal open and submit**: The operation fails on sheet write. Catch block shows a generic error toast. Same pattern as bills.
- **Calendar event already manually deleted**: deleteEvent returns 404/410, treated as success. No error surfaced.
- **PostponeLog append fails**: Same accepted trade-off as bills (FR-011 in the bill-postpone spec). The to-do row was already updated; the log append failure surfaces an error toast.
- **Category deleted after to-do was created**: The to-do still references the category_id. The display resolves category name/color from a map that includes all categories (not just active/non-deleted ones) to handle this case.

---

## Design Decisions

### DD-001: Recurrence Behavior — Auto-Generate Next Instance (CHOSEN)

**Decision**: When a recurring to-do (recurrence pattern != One-time) is marked Done, the system auto-generates the next instance.

**Behavior**:
- The current to-do row's status becomes "done" and done_date is set.
- A NEW pending Todo row is appended with the same title, description, category_id, recurrence_pattern_id, and reminder_offsets_days. The new row's due_date is computed from the current due_date + the recurrence pattern's interval (with month-end clamping). The new row's parent_todo_id is set to the current to-do's id (or the original parent_todo_id if the current to-do is itself a child — the chain always points to the root).
- Calendar events are created for the new instance (best-effort).

**Rationale**: History is preserved per instance — each completed occurrence remains as its own row with its own done_date and notes. This matches the user's mental model of "every 6 months I need to do X" where each occurrence is a distinct event. It also keeps the Todos list naturally growing with a clear history trail.

**Alternatives rejected**:
- **Manual continuation**: User must manually create the next to-do after marking done. Rejected because it adds friction and defeats the purpose of setting up recurrence. The user would forget.
- **Snooze-same-row**: The same to-do row resets to "pending" with the next due date. Rejected because it destroys history — there's no record of when previous occurrences were completed or what notes were added.

### DD-002: Next-Due-Date Computation

**Algorithm**: Given the current due_date and a recurrence pattern (interval_value, interval_unit, anchor_day):

1. Parse the current due_date as (year, month, day).
2. Apply the interval:
   - **days**: Add interval_value days using `new Date(y, m-1, d + interval_value)`.
   - **weeks**: Add `interval_value * 7` days.
   - **months**: Add interval_value to the month. If anchor_day is set, use anchor_day as the target day; otherwise use the current day. Clamp to the last day of the target month (e.g., anchor_day 31 + target month February → Feb 28/29).
   - **years**: Add interval_value to the year. If anchor_day is set, use anchor_day as the target day for the target month. Clamp to the last day of the target month (handles Feb 29 → Feb 28 in non-leap years).
3. Return the computed date as YYYY-MM-DD.

**Month-end clamping**: Reuses the pattern from `computeDueDate` in billsService.ts — `new Date(year, month, 0).getDate()` gives the last day of the previous month, used to clamp.

**Examples**:
- Every 1 month, due_date 2026-01-31 → 2026-02-28 (Feb has 28 days)
- Every 1 month, due_date 2026-03-31 → 2026-04-30 (Apr has 30 days)
- Every 3 months, due_date 2026-05-15 → 2026-08-15
- Every 1 year, due_date 2024-02-29 → 2025-02-28 (non-leap year)
- Every 6 months, due_date 2026-01-31, anchor_day 31 → 2026-07-31

### DD-003: Duplicate Detection — Skipped for To-Dos

**Decision**: No duplicate detection for to-dos. Unlike bills (which have a natural composite key of property + bill_type + month), to-do titles can legitimately repeat. A user may have "Renew insurance" every year — each occurrence is a separate to-do. There is no meaningful composite key to deduplicate on.

### DD-004: Status Vocabulary

**Stored values**: `pending` and `done` (in the `status` column of the Todos sheet).

**Computed display state**: `overdue` is derived at runtime when status is `pending` AND due_date is before today (IST). This mirrors the bill pattern where `overdue` is a display-only status computed from `pending` + past due date.

The root spec also lists `skipped` as a possible status. For Phase 8, `skipped` is **not implemented** as a user action — there is no "Skip" button. The status column accepts it for forward-compatibility, but the UI only transitions between `pending` and `done`. (A future phase could add a "Skip" action if needed.)

### DD-005: Category Color — Preset Palette

**Decision**: The Categories form offers a preset palette of 8 colors for consistency. The user picks from the palette rather than entering a free-form hex code. This prevents clashing or unreadable colors. The palette is:

| Name | Hex | Tailwind |
|---|---|---|
| Slate | `#64748B` | `slate-500` |
| Red | `#EF4444` | `red-500` |
| Amber | `#F59E0B` | `amber-500` |
| Emerald | `#10B981` | `emerald-500` |
| Cyan | `#06B6D4` | `cyan-500` |
| Indigo | `#6366F1` | `indigo-500` |
| Purple | `#A855F7` | `purple-500` |
| Pink | `#EC4899` | `pink-500` |

The seeded categories (Insurance, Tax, Society, Maintenance) are assigned colors during bootstrap seed generation. If the seed currently has empty color values, the seed generator must be updated to assign default colors.

### DD-006: Reminder Offsets Default

**Decision**: The default reminder offsets for new to-dos is `"3,1"` — reminders at 3 days and 1 day before the due date. This matches the bill type default for monthly maintenance bills and is appropriate for most household to-dos. The user can change this per to-do.

### DD-007: RecurrencePatterns — Consume Seeded Set Only

**Decision**: Phase 8 does NOT build a Settings UI for adding/editing custom recurrence patterns. The seeded set is consumed via a dropdown. If the current seed set is insufficient, it is expanded in schema.ts during this phase.

**Required seed set** (verify against schema.ts and expand if needed):

| Name | interval_value | interval_unit | anchor_day |
|---|---|---|---|
| One-time | 0 | — | — |
| Every month | 1 | months | — |
| Every 3 months | 3 | months | — |
| Every 6 months | 6 | months | — |
| Every year | 1 | years | — |

**Current state**: schema.ts has NO `generateSeedRecurrencePatterns()` function. **Action required**: Add this function and call it during bootstrap (in bootstrapService.ts), similar to `generateSeedTodoCategories()`.

The "One-time" pattern is a special sentinel: interval_value=0 means "no recurrence." When marking a to-do done, the system checks if the pattern is One-time (interval_value === 0) and skips auto-generation if so.

---

## Requirements

### Functional Requirements

#### To-Dos Page (replaces placeholder)

- **FR-001**: The `/todos` route MUST render a full To-Dos list page, replacing the current placeholder content.
- **FR-002**: The page MUST display all non-deleted to-dos (deleted_at === ''), sorted by: overdue (due_date ascending) → pending with due date (due_date ascending) → pending without due date (created_at descending) → done (done_date descending, most recent first).
- **FR-003**: Each to-do card MUST display: title, category badge (name + color), status badge (Pending/Overdue/Done using MASTER.md semantic colors), recurrence label (pattern name, if not One-time), due date (formatted as "5 Jun 2026"), and action buttons.
- **FR-004**: The page MUST provide two filter dropdowns: category (All categories + each category with at least one to-do) and status (All / Pending / Overdue / Done).
- **FR-005**: The page MUST show a loading spinner while data is being fetched.
- **FR-006**: The page MUST show an empty state (ListTodo icon, "No to-dos yet", "Add a to-do" button) when there are zero non-deleted to-dos.
- **FR-007**: The page MUST show a filtered-empty state ("No to-dos match your filters") when filters are active but yield no results.
- **FR-008**: The page header MUST include a "Add To-Do" button (primary style, Plus icon) to open the TodoFormModal.
- **FR-009**: The page MUST set the document title to "NoDues · To-Dos".

#### TodoCard Component

- **FR-010**: TodoCard MUST mirror the BillCard layout and interaction pattern: a card with content area and action buttons.
- **FR-011**: Action buttons per status:
  - Pending / Overdue: Edit, Mark Done, Postpone (only if due_date exists), Delete.
  - Done: Edit, Delete.
- **FR-012**: The Postpone button MUST NOT appear on to-dos without a due_date (there is no date to shift).
- **FR-013**: The Mark Done button MUST NOT appear on to-dos with status "done".
- **FR-014**: The category badge MUST display the category name with a colored dot or background using the category's hex color. If the to-do has no category, no badge is shown.
- **FR-015**: If the to-do has a recurrence pattern (not One-time), a recurrence label (e.g., "Every month") MUST be shown.
- **FR-016**: If the to-do has calendar_event_ids (non-empty), a Bell icon indicator MUST be shown (same pattern as BillCard).

#### Add / Edit To-Do Modal (TodoFormModal)

- **FR-017**: The modal MUST provide fields: title (text input, required), category (dropdown of active non-deleted TodoCategories + an empty "No category" option), due date (date input, optional), recurrence pattern (dropdown of active RecurrencePatterns, default "One-time"), reminder offsets (text input, default "3,1"), notes (textarea, optional).
- **FR-018**: In edit mode, all fields MUST be pre-filled with the to-do's current values.
- **FR-019**: Title validation: if empty, show "Title is required." and block submission.
- **FR-020**: Reminder offsets validation: if provided, must be a comma-separated list of positive integers. Invalid input shows "Enter comma-separated numbers (e.g., 3,1)."
- **FR-021**: The modal MUST close on Escape and backdrop click (consistent with existing modals). Closing while a save is in progress MUST be blocked.
- **FR-022**: No duplicate detection is performed for to-dos (DD-003).
- **FR-023**: In edit mode, the `description` field (free-text, optional) MUST also be editable. (The `description` column exists in the schema for richer notes; the form exposes it as a secondary textarea or combines it with notes — implementation detail.)

#### To-Do Creation (Service Layer)

- **FR-024**: On valid submission, the system MUST append a new row to the Todos sheet tab with: new UUID, title, description, category_id (or empty), due_date (or empty), original_due_date = due_date (or empty), status = "pending", empty done_date, recurrence_pattern_id (or empty), empty parent_todo_id, reminder_offsets_days, empty attachment_file_ids, empty calendar_event_ids, notes, created_at = now, updated_at = now, empty deleted_at.
- **FR-025**: If due_date is provided AND reminder_offsets_days is non-empty, the system MUST create calendar reminders using the same best-effort pattern as bills (createReminders adapted for to-do context). Event title format: "[To-Do] <Title> due <formatted date>". Event description: "Category: <categoryName>" (if set).
- **FR-026**: After creating reminders, the to-do's calendar_event_ids MUST be updated in the sheet.

#### To-Do Update (Service Layer)

- **FR-027**: On valid edit submission, the system MUST update the Todos row with full-row-safety: update title, description, category_id, due_date, recurrence_pattern_id, reminder_offsets_days, notes, updated_at. Preserve all other fields unchanged.
- **FR-028**: If the due_date changed during edit, calendar reminders MUST be replaced (old events deleted, new events created) using the same best-effort pattern as bill edit.
- **FR-029**: If the due_date was removed (set to empty), existing calendar events MUST be cleaned up and calendar_event_ids cleared.

#### Mark Done

- **FR-030**: The Mark Done action MUST open a MarkDoneModal showing the to-do's title, category, and due date (read-only context) and requesting optional notes.
- **FR-031**: On submit, the system MUST update the to-do row with: status = "done", done_date = today (IST, YYYY-MM-DD), notes = user-provided notes (appended to existing notes if any, or set directly — implementation detail), updated_at = now.
- **FR-032**: After marking done, the system MUST delete calendar events for this to-do (best-effort) and clear calendar_event_ids.
- **FR-033**: If the to-do's recurrence_pattern_id points to a pattern with interval_value > 0 (i.e., not One-time), the system MUST auto-generate the next occurrence:
  - Compute the next due_date using DD-002 algorithm.
  - Append a NEW Todos row with: new UUID, same title, same description, same category_id, computed next due_date, original_due_date = computed next due_date, status = "pending", empty done_date, same recurrence_pattern_id, parent_todo_id = the root to-do's id (if current to-do has parent_todo_id, use that; otherwise use current to-do's id), same reminder_offsets_days, empty attachment_file_ids, empty calendar_event_ids, empty notes, created_at = now, updated_at = now, empty deleted_at.
  - Create calendar reminders for the new instance (best-effort).
- **FR-034**: If the to-do has no due_date and is recurring, the next instance is created with no due_date (user must set it manually via Edit). No calendar events are created for it.
- **FR-035**: User feedback toasts:
  - Success (non-recurring): "To-do marked as done."
  - Success (recurring, next instance created): "To-do marked as done. Next occurrence created."
  - Calendar failure: "To-do marked as done, but calendar reminders couldn't be updated."
  - Mark-done failure: "Failed to mark to-do as done."

#### Postpone

- **FR-036**: The Postpone action MUST only be available on to-dos with status "pending" or computed display status "overdue" AND a non-empty due_date.
- **FR-037**: The Postpone flow MUST reuse the PostponeModal component pattern. The modal shows the to-do's title and current due date (read-only) and requests a new due date (required) and optional reason.
  - **Implementation choice**: Either adapt PostponeModal to accept a generic item shape (title + current due date), or create a thin TodoPostponeModal wrapper that follows the same structure. The modal MUST NOT reference bill-specific fields (billTypeName, propertyName, month, amount).
- **FR-038**: On valid submission, the system MUST:
  1. Update the to-do row: set due_date to new date, set original_due_date (write-once per FR-008 bill-postpone pattern), set updated_at = now. Status NOT changed.
  2. Append a PostponeLog row via `postponeLogService.appendPostponeLog` with item_type = "todo", item_id = to-do's id, from_date = old due_date, to_date = new due_date, reason, postponed_by = "user", postponed_at = now.
- **FR-039**: Same-date guard: if new due date === current due date, show info toast "New date is the same as the current due date." and perform no writes.
- **FR-040**: Calendar replacement (best-effort): delete old events, create new events, update calendar_event_ids. Same pattern as bill postpone.
- **FR-041**: User feedback toasts: same pattern as bill postpone (FR-018 through FR-022 in the 007-bill-postpone spec, adapted for "To-do" wording).

#### Soft-Delete with Undo

- **FR-042**: The Delete action MUST show a ConfirmDialog: "Delete this to-do? You can undo within 10 seconds." with destructive confirm button.
- **FR-043**: On confirm, the system MUST: optimistically remove the to-do from the list, set deleted_at via updateCell (NOT full-row write), clean up calendar events (best-effort), and show a toast "To-do deleted." with an Undo button (10-second window).
- **FR-044**: On Undo, the system MUST: clear deleted_at via updateCell, recreate calendar reminders (best-effort), and reinsert the to-do at its original position in the list.
- **FR-045**: If the soft-delete write fails, the to-do MUST be reinserted (rollback) and an error toast shown.

#### Categories Management Page

- **FR-046**: A "Categories" page MUST be accessible under Settings (similar to Properties / Bill Types pages). Route: `/settings/categories` or integrated into the existing settings layout.
- **FR-047**: The page MUST list all non-deleted TodoCategories with: name, color badge (a circle or chip with the category's hex color), and active/inactive indicator.
- **FR-048**: The page MUST provide "Add Category" (primary button, Plus icon) to open a CategoryFormModal.
- **FR-049**: CategoryFormModal fields: name (text input, required), color (preset palette picker per DD-005, required). In edit mode, pre-filled.
- **FR-050**: Categories can be toggled active/inactive. Inactive categories do not appear in the Add/Edit To-Do dropdown but existing to-dos retain them.
- **FR-051**: Categories can be soft-deleted with undo (same 10-second pattern). Non-cascading: existing to-dos keep their category_id.
- **FR-052**: Category name validation: required, non-empty. No uniqueness check (user may have similar names).

#### RecurrencePatterns — Seed and Consume

- **FR-053**: A `generateSeedRecurrencePatterns()` function MUST be added to schema.ts returning the 5 seed rows defined in DD-007.
- **FR-054**: bootstrapService.ts MUST be updated to call `generateSeedRecurrencePatterns()` and append the seed rows to the RecurrencePatterns sheet tab during first-run setup.
- **FR-055**: The RecurrencePatterns tab MUST be read by todosService (or a shared recurrencePatternsService) to provide the dropdown options in TodoFormModal.
- **FR-056**: The "One-time" pattern (interval_value = 0) serves as the default selection in the recurrence dropdown.

#### Calendar Reminders (Reused)

- **FR-057**: To-do calendar reminders MUST reuse the existing calendar orchestration functions from billsService.ts — specifically `createReminders` (adapted signature), `cleanupReminders`, and `setCalendarEventIds` (adapted for Todos tab). The functions may need to be extracted to a shared module or duplicated with tab-specific wiring in todosService.
- **FR-058**: Event title format for to-dos: `"[To-Do] <title> due <formatted date>"`.
- **FR-059**: Same best-effort architecture: calendar failures never block critical-path writes.

### Key Entities (New Types)

These types MUST be added to `src/types/index.ts`:

- **TodoStatus**: `'pending' | 'done'` — stored values in the Todos sheet.
- **TodoDisplayStatus**: `'pending' | 'overdue' | 'done'` — computed at runtime.
- **Todo**: Mirrors Bill structure. Fields: `_rowIndex`, `id`, `title`, `description`, `categoryId`, `dueDate`, `originalDueDate`, `status` (TodoStatus), `doneDate`, `recurrencePatternId`, `parentTodoId`, `reminderOffsetsDays` (string, CSV), `attachmentFileIds`, `calendarEventIds`, `notes`, `createdAt`, `updatedAt`, `deletedAt`.
- **TodoWithDisplay**: Extends Todo with resolved display fields: `categoryName`, `categoryColor`, `recurrenceName`, `displayStatus` (TodoDisplayStatus).
- **TodoCategory**: Fields: `_rowIndex`, `id`, `name`, `color`, `active` (boolean), `deletedAt`.
- **TodoCategoryFormData**: Fields: `name`, `color`.
- **RecurrencePattern**: Fields: `_rowIndex`, `id`, `name`, `intervalValue` (number), `intervalUnit` (string), `anchorDay` (number | null), `endCondition` (string), `endValue` (string), `active` (boolean).
- **TodoFormData**: Fields: `title`, `description`, `categoryId`, `dueDate`, `recurrencePatternId`, `reminderOffsetsDays`, `notes`.
- **MarkDoneFormData**: Fields: `notes`.
- **PostponeFormData**: Already exists in types/index.ts — REUSED as-is for to-do postpone.

### Cross-Cutting Concerns

- **FR-060**: All sheet writes MUST use full-row-safety (read-modify-write entire row via updateRow) except for soft-delete/undo which use updateCell on deleted_at only.
- **FR-061**: parseRow MUST return null on missing id (defensive parsing, same as billsService).
- **FR-062**: All calendar operations are best-effort (never throw past the catch boundary).
- **FR-063**: Status defaults to "pending" when parsing invalid/missing status values from the sheet.
- **FR-064**: All UI components MUST follow MASTER.md: indigo-700 primary, Lucide icons, 44px touch targets, visible focus rings, slate neutrals, IBM Plex Sans.
- **FR-065**: The TodosPage and all todo components MUST be phone-first (work at 375px).

---

## Reuse Statements

These are explicit declarations of what is reused from prior phases to prevent reinvention:

| What | Source | How Reused |
|---|---|---|
| Calendar reminders | `billsService.ts` → `createReminders`, `cleanupReminders`, `setCalendarEventIds` | Extract to shared module or adapt in todosService with Todos-tab wiring |
| Calendar service | `calendarService.ts` → `createAllDayEvent`, `deleteEvent` | Called by the reminder orchestration functions — no changes needed |
| Postpone log | `postponeLogService.ts` → `appendPostponeLog` | Called with item_type='todo' — already generic |
| PostponeFormData type | `types/index.ts` | Reused as-is |
| PostponeModal | `components/bills/PostponeModal.tsx` | Either adapted to accept generic item shape or used as template for TodoPostponeModal |
| ConfirmDialog | `components/shared/ConfirmDialog.tsx` | Reused for delete confirmation |
| Toast system | `useToast()` hook | Reused for all user feedback |
| TodoCard | Mirrors `BillCard.tsx` | New component following same structure |
| TodoFormModal | Mirrors `BillFormModal.tsx` | New component following same form pattern |
| MarkDoneModal | Mirrors `MarkPaidModal.tsx` | New component, simpler (no payment fields) |
| CategoriesPage | Mirrors `PropertiesPage.tsx` / `BillTypesPage.tsx` | New page following same CRUD + modal + undo pattern |
| sheetsService | `readAllRows`, `updateRow`, `updateCell`, `appendRows` | Same sheet operations |
| Auth / Bootstrap | `useAuth()`, `useBootstrap()` | Same access patterns |
| Date formatting | `billsService.ts` → `formatDueDate`, `computeReminderDate` | Reused or imported |
| Sort pattern | `billsService.ts` → `sortBills` | Adapted to `sortTodos` with todo-specific status priority |

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: A user can add a to-do with title, category, due date, and recurrence in under 30 seconds.
- **SC-002**: To-dos are correctly sorted on the list page: overdue → pending → done.
- **SC-003**: Filters by category and status narrow the list correctly.
- **SC-004**: Marking a recurring to-do done auto-generates the next occurrence with correct next due date (verified by month-end clamping tests).
- **SC-005**: Every successful postpone produces exactly one PostponeLog row with item_type "todo" and correct dates.
- **SC-006**: Calendar reminders reflect the current due date for pending to-dos; reminders are cleaned up when a to-do is marked done or deleted.
- **SC-007**: The Categories page allows full CRUD with soft-delete and undo; deleting a category does not affect existing to-dos.
- **SC-008**: The Postpone and Mark Done buttons appear only on appropriate to-dos (Postpone: pending/overdue with due_date; Mark Done: pending/overdue only).
- **SC-009**: original_due_date is set exactly once per to-do lifetime (on first postpone if previously matching due_date).
- **SC-010**: The RecurrencePatterns seed rows are created during bootstrap and available in the dropdown.

---

## Assumptions

- Phases 1 through 7 are complete: sign-in, bootstrapping (all 9 sheet tabs), Properties + Bill Types, Bills core loop, file attachments, calendar reminders, and bill postpone.
- The Todos, TodoCategories, RecurrencePatterns, and PostponeLog sheet tabs already exist with headers matching schema.ts HEADER_DEFINITIONS (created during bootstrap Phase 2).
- TodoCategories are seeded during bootstrap (4 rows: Insurance, Tax, Society, Maintenance). RecurrencePatterns are NOT currently seeded — this phase adds the seed generator and bootstrap call.
- `accessToken` is available via `useAuth()` and `spreadsheetId`/`calendarId` via `useBootstrap().setupResult`.
- The existing calendar orchestration functions are stable and reusable without modification (possibly with extraction to a shared module).
- `postponeLogService.appendPostponeLog` already supports arbitrary item_type values (currently only "bill" is used; "todo" will be the second).
- The navigation sidebar or layout already has a "To-Dos" link pointing to `/todos`.

---

## Out of Scope

- **Activity log writes**: Phase 9 — no ActivityLog entries are written for to-do actions in this phase.
- **Dashboard integration**: Phase 10 — to-dos do NOT appear on the Dashboard pending list in this phase.
- **PWA / push notifications**: Phase 11.
- **Custom recurrence pattern UI**: No Settings page for adding/editing recurrence patterns. Only the seeded set is available.
- **Bulk operations**: No "mark all done", "delete selected", etc.
- **File attachments on to-dos**: The attachment_file_ids column exists in the schema for forward-compatibility, but no upload/view UI is built in this phase. (Separate future phase, following the bills attachment pattern from Phase 5.)
- **PostponeLog history UI**: No UI to view postpone history for a to-do. Data is persisted for future use.
- **To-do detail page**: No dedicated `/todos/:todoId` route. All actions happen from the list page via cards and modals.
- **Skipped status**: The schema supports "skipped" but no Skip button or transition is built in this phase.
- **end_condition / end_value on RecurrencePatterns**: The columns exist but are not used in this phase. Recurrence continues indefinitely (end_condition = "never"). A future phase could add "stop after N occurrences" or "stop after date" logic.
