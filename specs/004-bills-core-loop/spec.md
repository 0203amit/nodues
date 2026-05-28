# Feature Specification: Bills Core Loop

**Feature Branch**: `004-bills-core-loop`

**Created**: 2026-05-28

**Status**: Draft

**Input**: User description: "Bills Core Loop — Add, List, Mark Paid, Duplicate Detection (Phase 4 of the Build Order). The core bill-tracking loop: add a bill (picking a bill type, pre-filling defaults, selecting month), list bills with computed status badges (paid/overdue/pending/not yet generated), mark bills paid, edit, soft-delete with undo, and duplicate detection before save."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Owner adds a bill for a property (Priority: P1)

The owner navigates to the Bills page and taps "Add Bill". They select a bill type from a dropdown (which shows the property name alongside each bill type name). On selection, the amount and due date are pre-filled from the bill type's defaults. The owner picks a billing month, optionally adjusts the amount or due date, adds a note, and saves. The bill appears in the list immediately.

**Why this priority**: Adding bills is the entry point of the entire tracking loop. Without it, there is nothing to list, mark paid, or track.

**Independent Test**: Navigate to `/bills`. Tap "Add Bill". Select a bill type, pick a month, verify defaults pre-fill. Save and confirm a new row appears in the Bills tab of the Google Sheet with correct UUID, composite_key, status, and timestamps.

**Acceptance Scenarios**:

1. **Given** the owner is on the Bills page, **When** they tap "Add Bill", **Then** a form modal opens with fields: bill type (dropdown), month (month picker), amount, due date, and notes.
2. **Given** the Add Bill form is open, **When** the owner selects a bill type that has `default_amount = 5000` and `default_due_day = 15`, **Then** the amount field pre-fills with `5000` and the due date pre-fills based on the selected month + day 15 (e.g., selecting "2026-06" yields due date "2026-06-15").
3. **Given** the owner selects a bill type and month "2026-02" where the bill type's `default_due_day = 31`, **When** the due date is computed, **Then** it clamps to the last day of February (2026-02-28).
4. **Given** the owner fills in all required fields and saves, **Then** a new row is appended to the Bills tab with: generated UUID, `status = pending`, `original_due_date = due_date`, `created_at = now`, `updated_at = now`, `deleted_at = ""`, `composite_key = property_id|bill_type_id|month`, and empty `bill_file_ids`, `receipt_file_ids`, `calendar_event_ids`.
5. **Given** the owner leaves amount and due date empty and saves, **Then** the bill is created with `status = not_yet_generated`, `amount = ""`, `due_date = ""`, `original_due_date = ""`.
6. **Given** the owner does not select a bill type, **When** they try to submit, **Then** validation prevents submission with an error message "Please select a bill type."
7. **Given** the owner does not select a month, **When** they try to submit, **Then** validation prevents submission with an error message "Please select a billing month."
8. **Given** the bill type dropdown, **Then** it only shows bill types that are active and non-deleted. Each option displays the bill type name and its property name (e.g., "Maintenance — Mira Shop").

---

### User Story 2 - Owner views the bills list with computed status badges (Priority: P1)

The owner sees all non-deleted bills listed on the Bills page. Each bill shows the bill type name, property name, month, amount, due date, and a color-coded status badge. The status is computed from the stored data: paid (green), overdue (red), pending (amber), or not yet generated (cyan).

**Why this priority**: The list is the primary view for the owner to understand which bills are paid, overdue, or still pending. It drives all subsequent actions (pay, edit, delete).

**Independent Test**: After adding several bills in different states (one paid, one overdue, one pending, one not yet generated), navigate to `/bills`. Verify each bill shows the correct status badge color and label. Verify sort order places overdue and pending bills before paid ones.

**Acceptance Scenarios**:

1. **Given** multiple bills exist with various statuses, **When** the owner navigates to `/bills`, **Then** non-deleted bills are listed, sorted by: overdue first (oldest due date first), then pending (soonest due date first), then not yet generated, then paid (most recently paid first), then skipped.
2. **Given** a bill with `status = paid` and `paid_date` set, **Then** it displays a green (emerald) "Paid" badge with a `CheckCircle2` icon.
3. **Given** a bill with `status = pending` and `due_date` in the past (before today), **Then** it displays a red "Overdue" badge with an `AlertCircle` icon.
4. **Given** a bill with `status = pending` and `due_date` today or in the future, **Then** it displays an amber "Pending" badge with a `Clock` icon.
5. **Given** a bill with `status = not_yet_generated`, **Then** it displays a cyan "Not received yet" badge with an `Info` icon (or `FileQuestion`).
6. **Given** a bill with `status = skipped`, **Then** it displays a slate "Skipped" badge.
7. **Given** the bills list, **Then** each bill row shows: bill type name, property name, billing month (formatted, e.g., "Jun 2026"), amount (formatted as ₹ with `Intl.NumberFormat('en-IN')`), due date, and the status badge — following the BillRow reference component from MASTER.md section 11.
8. **Given** bills exist for multiple properties, **When** the owner selects a property from the filter dropdown, **Then** only bills belonging to that property are shown. An "All properties" option shows all bills.
9. **Given** bills exist across multiple months, **When** the owner selects a specific month from the month filter, **Then** only bills for that month are shown. An "All months" option shows all bills.
10. **Given** no bills exist yet, **Then** an empty state is shown with a message and a call-to-action to add the first bill.

---

### User Story 3 - Owner marks a bill as paid (Priority: P1)

The owner sees an unpaid bill (pending or overdue) and taps a "Mark Paid" action. A form appears pre-filled with today's date as the paid date. The owner can change the date, select a payment method, and optionally enter a transaction reference. On save, the bill status changes to paid and the bill moves to the paid section of the list.

**Why this priority**: Recording payment is the core purpose of the app — it closes the bill-tracking loop. Without this, bills stay pending forever.

**Independent Test**: Add a pending bill. Tap "Mark Paid". Verify the paid_date, payment_method, and transaction_ref are written to the Sheet. Verify the status badge changes to "Paid" (green). Reload and verify persistence.

**Acceptance Scenarios**:

1. **Given** a bill with `status = pending` or display status "Overdue", **When** the owner taps "Mark Paid", **Then** a form modal appears with: paid date (pre-filled with today's date, editable), payment method (dropdown: GPay, PhonePe, NEFT, Net Banking, Cash, Other), transaction reference (optional text input).
2. **Given** the owner fills in the mark-paid form and saves, **Then** the bill row in the Sheet is updated: `status = paid`, `paid_date = <selected date>`, `payment_method = <selected>`, `transaction_ref = <entered or empty>`, `updated_at = now`.
3. **Given** a bill with `status = not_yet_generated`, **Then** the "Mark Paid" action is not available (since the bill hasn't been received yet — the owner should first edit it to set amount and due date).
4. **Given** a bill with `status = paid`, **Then** the "Mark Paid" action is not shown (already paid).
5. **Given** the owner saves the mark-paid form, **Then** the bill's status badge in the list immediately updates to green "Paid" and a success toast is shown.

---

### User Story 4 - Owner edits a bill (Priority: P2)

The owner can edit a bill's amount, due date, month, and notes. The edit form pre-fills with the current values. On save, only the editable fields are updated — immutable fields (id, bill_type_id, created_at, original_due_date, file IDs, receipt IDs, calendar event IDs) are preserved.

**Why this priority**: Bills may have incorrect amounts or due dates that need correction after entry. Editing is essential for data accuracy but is less frequent than adding or marking paid.

**Independent Test**: Add a bill with amount ₹5000. Edit the amount to ₹6000. Verify the Sheet row updates only the amount and `updated_at` columns — `id`, `bill_type_id`, `created_at`, `original_due_date`, and the empty file/receipt/calendar columns remain unchanged.

**Acceptance Scenarios**:

1. **Given** the owner taps edit on a bill, **Then** a form modal appears pre-filled with the bill's current: bill type (shown read-only), month, amount, due date, and notes.
2. **Given** the owner changes the month, **When** they save, **Then** the `composite_key` is recomputed with the new month. If the new composite_key matches an existing non-deleted bill, duplicate detection triggers before saving.
3. **Given** the owner saves the edit form, **Then** the Sheet row is updated using full-row-safety: `id`, `bill_type_id`, `original_due_date`, `created_at`, `bill_file_ids`, `receipt_file_ids`, `calendar_event_ids` are preserved from the existing row. `updated_at` is set to now.
4. **Given** a bill with `status = not_yet_generated` and the owner edits to add amount and due_date, **When** they save, **Then** `status` auto-flips to `pending` and `original_due_date` is set (if it was previously empty).

---

### User Story 5 - Duplicate detection prevents accidental double entry (Priority: P1)

Before saving a new bill (or saving an edit that changes the month), the system checks whether a non-deleted bill with the same property + bill type + month already exists. If so, a warning modal appears with details about the existing bill and options to proceed.

**Why this priority**: The user manages 2-4 properties and may have multiple family members entering bills. Duplicate entry is a common mistake and can distort summaries. The spec explicitly requires duplicate detection.

**Independent Test**: Add a bill for "Maintenance — Mira Shop" for month "2026-06". Try adding another bill with the same bill type and month. Verify the duplicate warning modal appears with the existing bill's details.

**Acceptance Scenarios**:

1. **Given** the owner tries to add a bill whose `composite_key` (property_id|bill_type_id|month) matches an existing non-deleted bill, **When** they submit the form, **Then** the save is blocked and a duplicate warning modal appears showing: "A bill for {Property} {BillType} for {Month Year} already exists (₹{amount}, marked {status})."
2. **Given** the duplicate warning modal is shown, **When** the owner taps "Open existing", **Then** the form closes and the existing bill is highlighted/scrolled-to in the list.
3. **Given** the duplicate warning modal is shown, **When** the owner taps "Add anyway", **Then** the bill is saved despite the duplicate (rare case: genuine re-issue).
4. **Given** the duplicate warning modal is shown, **When** the owner taps "Cancel", **Then** the modal closes and the Add Bill form remains open with the entered data preserved.
5. **Given** the owner edits a bill and changes the month to one where a duplicate already exists, **Then** the same duplicate detection triggers on save.
6. **Given** the existing duplicate bill has been soft-deleted (`deleted_at` is set), **Then** no duplicate warning is shown (only non-deleted bills count for uniqueness).

---

### User Story 6 - Owner soft-deletes a bill with undo (Priority: P2)

The owner can delete a bill. A confirmation dialog appears. On confirmation, the bill disappears from the list immediately (optimistic removal), `deleted_at` is written to the Sheet, and an undo snackbar appears for 10 seconds.

**Why this priority**: Bills entered by mistake need to be removable. The soft-delete with undo pattern is consistent with Properties and Bill Types from Phase 3.

**Independent Test**: Add a bill. Delete it. Verify it disappears immediately. Tap "Undo" within 10 seconds. Verify it reappears. Delete again without undo. Reload and verify it's gone from the list.

**Acceptance Scenarios**:

1. **Given** the owner taps delete on a bill, **Then** a ConfirmDialog appears: "Are you sure you want to delete this bill? You can undo this within 10 seconds."
2. **Given** the owner confirms deletion, **Then** the bill is optimistically removed from the list, `deleted_at` is set in the Sheet, and an undo snackbar appears for 10 seconds.
3. **Given** the owner taps "Undo" on the snackbar, **Then** `deleted_at` is cleared in the Sheet and the bill reappears in the list at its original position.
4. **Given** the Sheet write for deletion fails, **Then** the bill reappears in the list (rollback) and an error toast is shown.
5. **Given** the undo timer expires, **Then** the snackbar disappears and the deletion stands.

---

### User Story 7 - Loading and error states (Priority: P2)

All reads from and writes to the Google Sheet show appropriate loading indicators and handle errors gracefully.

**Why this priority**: Network calls to the Sheets API can take 1-3 seconds. Without loading states the UI appears frozen. Without error handling, failed writes silently lose data.

**Independent Test**: Observe the UI during page load, form submission, mark-paid, and delete. Verify loading indicators appear. Simulate a network error and verify error toasts appear.

**Acceptance Scenarios**:

1. **Given** the owner navigates to `/bills`, **When** bills are being fetched from the Sheet, **Then** a loading spinner is shown.
2. **Given** the owner submits any form (add, edit, mark paid), **When** the write is in progress, **Then** the submit button is disabled with a spinner and the form cannot be re-submitted.
3. **Given** any Sheet operation fails, **Then** an error toast appears with a human-readable message and the UI remains usable.
4. **Given** a soft-delete write fails, **Then** the bill reappears in the list (optimistic rollback) and an error toast is shown.

---

### Edge Cases

- **Bill type with no default amount or due day**: The amount and due date fields start empty. If the user saves without filling them, `status = not_yet_generated`.
- **Month with fewer days than default_due_day**: Due date clamps to the last day of the month (e.g., Feb 28, Apr 30).
- **Bill type whose parent property was soft-deleted**: The bill type still appears in the dropdown if it is itself active and non-deleted (the property soft-delete is non-cascading). The bill's composite_key uses the original property_id. The bill row in the list shows the property name grayed out.
- **Bill type that was deactivated after bills were created**: Existing bills for that bill type remain visible and editable. The deactivated bill type does not appear in the "Add Bill" dropdown.
- **Editing a bill's month when duplicates exist**: Duplicate detection runs on save with the new composite_key.
- **Multiple browser tabs**: Last write wins, consistent with the Phase 3 approach.
- **Malformed bill rows in the Sheet**: Rows with missing id are skipped. Rows with invalid status default to `pending`. The UI never crashes on bad data.
- **User navigates away before undo timer expires**: The soft-delete stands (timer is client-side).
- **All bill types deleted or inactive**: The "Add Bill" form shows "No active bill types. Configure bill types in Settings first." and the form cannot be submitted.
- **Amount entered as negative**: Validation rejects amounts < 0.

## Requirements *(mandatory)*

### Functional Requirements

#### Service Layer

- **FR-001**: The service layer MUST provide a function to read all rows from the Bills tab, parse them into typed `Bill` objects, enrich each with `billTypeName`, `propertyName`, `propertyId`, and computed `displayStatus`, and filter out soft-deleted rows.
- **FR-002**: The service layer MUST provide a function to append a new bill row to the Bills tab with fields: `id` (UUID v4), `bill_type_id`, `month`, `amount`, `due_date`, `original_due_date` (= due_date on creation), `status` (pending if amount+due_date provided, not_yet_generated otherwise), `paid_date` (""), `payment_method` (""), `transaction_ref` (""), `bill_file_ids` (""), `receipt_file_ids` (""), `calendar_event_ids` (""), `notes`, `created_at`, `updated_at`, `deleted_at` (""), `composite_key`.
- **FR-003**: The service layer MUST provide a function to check for duplicate bills by comparing the `composite_key` (property_id|bill_type_id|month) against all non-deleted bills. It MUST return the matching bill (if any) for display in the warning modal.
- **FR-004**: The service layer MUST provide a function to update a bill row using full-row-safety: preserve `id`, `bill_type_id`, `original_due_date`, `created_at`, `bill_file_ids`, `receipt_file_ids`, `calendar_event_ids` from the existing row. Only `month`, `amount`, `due_date`, `notes`, `status`, `updated_at`, and `composite_key` change. If `status` was `not_yet_generated` and the edit provides amount+due_date, status auto-flips to `pending`.
- **FR-005**: The service layer MUST provide a function to mark a bill as paid: set `status = paid`, `paid_date`, `payment_method`, `transaction_ref`, and `updated_at`. Preserve all other fields via full-row write.
- **FR-006**: The service layer MUST provide a function to soft-delete a bill by setting `deleted_at` to the current ISO timestamp.
- **FR-007**: The service layer MUST provide a function to undo a soft-delete by clearing `deleted_at`.
- **FR-008**: All service functions MUST accept `accessToken` and `spreadsheetId` from the auth/bootstrap contexts.
- **FR-009**: The `composite_key` MUST be computed as `property_id + "|" + bill_type_id + "|" + month`, where `property_id` is resolved from the bill type's `property_id` field.

#### Bills List UI

- **FR-010**: The Bills page (`/bills`) MUST display all non-deleted bills. Each list item shows: bill type name, property name, billing month (human-readable, e.g., "Jun 2026"), amount (formatted as ₹ with `Intl.NumberFormat('en-IN')`), due date, and a computed status badge — following the BillRow component reference from MASTER.md section 11.
- **FR-011**: The display status MUST be computed as follows:
  - `status === 'paid'` → display "Paid" (emerald badge, `CheckCircle2` icon)
  - `status === 'pending'` and `due_date < today` → display "Overdue" (red badge, `AlertCircle` icon)
  - `status === 'pending'` and `due_date >= today` → display "Pending" (amber badge, `Clock` icon)
  - `status === 'not_yet_generated'` → display "Not received yet" (cyan badge, `FileQuestion` icon)
  - `status === 'skipped'` → display "Skipped" (slate badge, `MinusCircle` icon)
- **FR-012**: The bills list MUST be sorted: overdue first (oldest due date first), then pending (soonest due date first), then not yet generated (by month), then paid (most recently paid first), then skipped.
- **FR-013**: The Bills page MUST provide a filter dropdown for property (options: "All properties" + each property with bills). Filtering by property shows only bills for that property.
- **FR-014**: The Bills page MUST provide a filter for month (options: "All months" + each distinct month with bills). Filtering by month shows only bills for that month.

#### Add Bill UI

- **FR-015**: The Bills page MUST provide an "Add Bill" button that opens a form modal with fields: bill type (dropdown, required), month (month input, required), amount (number, optional), due date (date, optional — auto-computed from month + bill type's default_due_day when both are selected), notes (text, optional).
- **FR-016**: The bill type dropdown MUST show only active, non-deleted bill types. Each option MUST display the bill type name and its property name (e.g., "Maintenance — Mira Shop").
- **FR-017**: When the owner selects a bill type, the amount field MUST pre-fill with the bill type's `default_amount` (if set) and the due date MUST pre-fill when a month is also selected, using the bill type's `default_due_day` clamped to the month's last day.
- **FR-018**: The owner MUST be able to override the pre-filled amount and due date.

#### Mark Paid UI

- **FR-019**: Each unpaid bill (`status !== 'paid'` and `status !== 'not_yet_generated'` and `status !== 'skipped'`) MUST show a "Mark Paid" action.
- **FR-020**: The Mark Paid form MUST include: paid date (date input, pre-filled with today, required), payment method (dropdown: GPay, PhonePe, NEFT, Net Banking, Cash, Other — required), transaction reference (text, optional).

#### Edit Bill UI

- **FR-021**: Each bill MUST have an edit action that opens a form modal pre-filled with the bill's current values. Bill type is shown read-only. Editable fields: month, amount, due date, notes.
- **FR-022**: On edit save, if the month changed, duplicate detection MUST run with the new composite_key before persisting.

#### Duplicate Detection

- **FR-023**: Before saving a new bill (add) or saving an edit that changes the month, the system MUST check whether a non-deleted bill with the same `composite_key` already exists.
- **FR-024**: If a duplicate is detected, a warning modal MUST appear showing: "A bill for {Property} {BillType} for {Month Year} already exists (₹{amount}, {status})." with three options: "Open existing" (closes form, scrolls to the existing bill in the list), "Add anyway" (force-saves the bill), "Cancel" (returns to the form with data preserved).

#### Soft-Delete

- **FR-025**: Each bill MUST have a delete action that shows a ConfirmDialog. On confirmation: optimistic removal from the list, `deleted_at` written to the Sheet, undo snackbar for 10 seconds.
- **FR-026**: Undo MUST clear `deleted_at` in the Sheet and reinsert the bill into the list.
- **FR-027**: If the delete write fails, the bill MUST reappear (optimistic rollback) with an error toast.

#### Validation

- **FR-028**: Bill type selection is required. Submission blocked with error if not selected.
- **FR-029**: Month is required. Submission blocked with error if not selected.
- **FR-030**: Amount, if provided, MUST be a non-negative number.
- **FR-031**: Due date, if provided, MUST be a valid date in YYYY-MM-DD format.
- **FR-032**: Paid date is required when marking paid. Must be a valid date.
- **FR-033**: Payment method is required when marking paid.

#### Cross-Cutting

- **FR-034**: All list views MUST show a loading spinner while the initial Sheet read is in progress.
- **FR-035**: All write operations MUST show a loading state on the triggering control.
- **FR-036**: All Sheet operation failures MUST display an error toast. The UI MUST NOT crash.
- **FR-037**: The Bills page MUST set `document.title` to `"NoDues · Bills"`.

### Non-Functional Requirements

- **NFR-001**: All UI MUST follow MASTER.md: indigo-700 primary, IBM Plex Sans, Lucide icons, slate neutrals, rounded-lg corners, 44px touch targets, WCAG AA contrast, visible focus rings, no emoji as icons, no gradients, no heavy shadows.
- **NFR-002**: All pages MUST be responsive and mobile-first, tested at 375px width.
- **NFR-003**: The existing `sheetsService.ts` MUST be reused for all Sheet operations. No new generic Sheet helpers are needed (readAllRows, updateRow, updateCell, appendRows already exist).
- **NFR-004**: The `Bill` type MUST be defined in `src/types/index.ts` alongside existing types.
- **NFR-005**: Amounts MUST be formatted using `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })`.
- **NFR-006**: Status badge colors MUST match MASTER.md: emerald (paid), red (overdue), amber (pending), cyan (not yet generated), slate (skipped).

### Key Entities

- **Bill**: A specific bill instance for a property's bill type in a given month. Stored as a row in the Bills tab. 18 columns: id, bill_type_id, month, amount, due_date, original_due_date, status, paid_date, payment_method, transaction_ref, bill_file_ids, receipt_file_ids, calendar_event_ids, notes, created_at, updated_at, deleted_at, composite_key.
- **BillWithDisplay**: A Bill enriched with resolved names and computed display status for UI rendering. Adds: billTypeName, propertyName, propertyId, displayStatus.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After adding a bill via the form, a new row appears in the Bills tab with correct UUID, composite_key, status, and timestamps. The bill appears in the list without a page reload.
- **SC-002**: The bills list correctly computes and displays status badges: green "Paid", red "Overdue", amber "Pending", cyan "Not received yet" for bills in the respective states.
- **SC-003**: Marking a bill as paid updates `status`, `paid_date`, `payment_method`, and `transaction_ref` in the Sheet. The badge immediately changes to green "Paid".
- **SC-004**: Duplicate detection triggers when adding a bill with the same property + bill type + month as an existing non-deleted bill. The warning modal appears with correct details.
- **SC-005**: Editing a bill preserves immutable fields (`id`, `bill_type_id`, `original_due_date`, `created_at`, file/receipt/calendar IDs) while updating editable fields.
- **SC-006**: Soft-deleting a bill with undo: bill disappears immediately, `deleted_at` is set in the Sheet, undo restores it, and rollback works on write failure.
- **SC-007**: Property and month filters correctly narrow the displayed list.
- **SC-008**: Pre-fill works: selecting a bill type pre-fills amount and due date from defaults. Due date clamps to month's last day.
- **SC-009**: All validation rules prevent invalid submissions with clear error messages.
- **SC-010**: All loading states and error toasts function correctly during Sheet operations.

## Assumptions

- Phases 1, 2, and 3 are complete: sign-in works, the Sheet has all 9 tabs with headers and seed data, Properties and Bill Types CRUD are operational.
- The `accessToken` is available via `useAuth()` and the `spreadsheetId` via `useBootstrap().setupResult`.
- The Bills tab has exactly the 18 columns defined in `HEADER_DEFINITIONS` from `schema.ts`.
- The existing `sheetsService.ts` functions (`readAllRows`, `updateRow`, `updateCell`, `appendRows`) are sufficient — no new generic Sheet helpers are needed.
- Bill types and properties are already populated (seed data or user-created in Phase 3).
- File uploads (bill_file_ids, receipt_file_ids) and calendar events (calendar_event_ids) are Phase 5 and 6 respectively — these columns are stored as empty strings in this phase.
- Postpone functionality (modifying original_due_date via PostponeLog) is Phase 7 — `original_due_date` is simply set equal to `due_date` on creation and is immutable thereafter in this phase.
- Recurring bill auto-generation is a future phase — this phase is manual bill entry only.
- ActivityLog writes are noted as future enhancement points but are NOT implemented in this phase.
- No concurrent-write protection is needed for a 1-4 person household app.
