# Feature Specification: Bills Recurrence

**Feature Branch**: `015-bills-recurrence`

**Created**: 2026-06-04

**Status**: Draft

**Input**: User description: "Bills Recurrence — auto-create next bill on Mark Paid (Phase 15). When a bill is marked paid and its Bill Type has a recurring frequency (monthly/quarterly/annual), the system auto-creates the next bill instance. Mirrors the to-do recurrence pattern from Phase 8."

---

## User Scenarios & Testing

### User Story 1 — Mark Paid with Auto-Recurrence (Priority: P1)

The user marks a recurring bill as paid via the existing MarkPaidModal. After the bill is marked paid, if the Bill Type has frequency `monthly`, `quarterly`, or `annual`, the system automatically creates the next bill in the series. A success toast confirms the auto-creation: "Next {billTypeName} bill created for {monthYear}". The new bill appears in the bills list immediately. Two activity log entries are written: `bill_paid` for the paid transition and `bill_added` for the auto-created bill.

**Why this priority**: This is the entire feature. Without it, nothing else exists.

**Independent Test**: Mark a monthly bill as paid. Verify the bill transitions to paid, a new pending bill appears for the next month with the correct due date and default amount, the success toast names the next month, and two activity log entries are created.

**Acceptance Scenarios**:

1. **Given** a pending bill for "Electricity" (BillType frequency=monthly, default_amount=1500, default_due_day=15) for month 2026-06 with due_date 2026-06-15, **When** the user marks it paid via MarkPaidModal, **Then** the bill transitions to paid AND a new pending bill is auto-created with month=2026-07, due_date=2026-07-15, amount=1500, status=pending, same billTypeId, same compositeKey pattern, empty attachments/payment fields.

2. **Given** a pending bill for "Society Maintenance" (BillType frequency=quarterly, default_due_day=10) for month 2026-04 with due_date 2026-04-10, **When** the user marks it paid, **Then** the next bill is created with month=2026-07, due_date=2026-07-10 (3 months later).

3. **Given** a pending bill for "Property Tax" (BillType frequency=annual, default_due_day=31) for month 2026-01 with due_date 2026-01-31, **When** the user marks it paid, **Then** the next bill is created with month=2027-01, due_date=2027-01-31 (12 months later).

4. **Given** a pending bill with BillType frequency=monthly and due_date 2026-01-31, **When** the user marks it paid, **Then** the next bill has due_date=2026-02-28 (month-end clamped; Feb has 28 days).

5. **Given** a pending bill whose paid amount was overridden to 2000 but the BillType default_amount is 1500, **When** the user marks it paid, **Then** the next bill's amount is 1500 (uses BillType.defaultAmount, not the paid bill's amount).

6. **Given** a bill marked paid, **When** the auto-created bill appears, **Then** the user sees a toast: "Next {billTypeName} bill created for {formatted month}".

---

### User Story 2 — Mark Paid Without Recurrence (Priority: P1)

When a bill's BillType has frequency `one-time`, Mark Paid behaves exactly as today: the bill transitions to paid, one `bill_paid` activity log entry is written, and no new bill is created. No additional toasts or side-effects occur.

**Why this priority**: This is the no-change path. It must not regress.

**Independent Test**: Mark a one-time bill as paid. Verify only the existing behavior occurs — no new bill, no recurrence toast, one activity log entry.

**Acceptance Scenarios**:

1. **Given** a pending bill with BillType frequency=one-time, **When** the user marks it paid, **Then** the bill transitions to paid, the toast says "Bill marked as paid." (existing message), and no new bill is created.

2. **Given** a pending bill with BillType frequency=one-time, **When** the user marks it paid, **Then** exactly one activity log entry is written: `bill_paid`. No `bill_added` entry is created.

---

### User Story 3 — Idempotency Guard (Priority: P1)

If the user has already manually pre-created next month's bill (or marks the same bill paid twice in quick succession), the system detects the duplicate and skips auto-creation. No error is shown — the Mark Paid itself completes normally. The idempotency check uses the existing composite key: BillType + Property + target month.

**Why this priority**: Without idempotency, users who pre-create bills manually would get duplicates on every Mark Paid.

**Independent Test**: Pre-create July's bill manually, then mark June's bill as paid. Verify no duplicate July bill is created.

**Acceptance Scenarios**:

1. **Given** a pending bill for June with BillType frequency=monthly, AND a non-deleted bill already exists for July with the same BillType and Property, **When** the user marks June's bill as paid, **Then** Mark Paid succeeds, no new July bill is created, and the toast says "Bill marked as paid." (no recurrence message).

2. **Given** the user rapidly double-taps the Mark Paid submit button, **When** the second call reaches the recurrence logic, **Then** the idempotency check prevents a second auto-created bill (the first call already created it).

---

### User Story 4 — Calendar Reminders on Auto-Created Bill (Priority: P2)

When the auto-created next bill has a due date and the BillType has `reminderOffsetsDays` configured, calendar reminder events are created for the new bill (best-effort). This mirrors the existing `saveNewBill` flow in BillsPage.tsx where new bills get calendar reminders.

**Why this priority**: Depends on the core recurrence (P1). Calendar reminders are a convenience enhancement — the bill is still created even if reminders fail.

**Independent Test**: Mark a monthly bill as paid where the BillType has reminderOffsetsDays=[3,1]. Verify the auto-created next bill gets calendar events at the expected reminder dates.

**Acceptance Scenarios**:

1. **Given** a pending bill with BillType frequency=monthly, reminderOffsetsDays=[3,1], and due_date 2026-06-15, **When** the user marks it paid, **Then** the auto-created July bill (due_date=2026-07-15) gets calendar events on 2026-07-12 and 2026-07-14.

2. **Given** the calendar API is unreachable, **When** a recurring bill is marked paid, **Then** the next bill is still created successfully, and a toast says "Bill marked paid, but reminders couldn't be set for the next bill."

3. **Given** a BillType with empty reminderOffsetsDays, **When** the user marks a bill paid, **Then** the next bill is created with no calendar events (no reminder creation attempted).

---

### User Story 5 — Recurrence Failure Resilience (Priority: P1)

If the auto-creation of the next bill fails (e.g., Google Sheets write error), the Mark Paid itself must NOT be rolled back. The paid transition is critical; recurrence is convenience. A separate error toast informs the user: "Bill marked paid, but couldn't auto-create next bill. Try again or add manually."

**Why this priority**: Mark Paid is the critical-path operation. It must never fail because of a recurrence side-effect.

**Independent Test**: Simulate a Sheets write error during appendRows (e.g., by temporarily revoking write access). Mark a recurring bill as paid. Verify the bill is marked paid and the error toast appears.

**Acceptance Scenarios**:

1. **Given** the Sheet write for the next bill fails, **When** the user marks a recurring bill paid, **Then** the original bill is marked paid successfully, the `bill_paid` activity log is written, and an error toast says "Bill marked paid, but couldn't auto-create next bill. Try again or add manually."

2. **Given** the Sheet write for the next bill fails, **When** the user retries by manually adding the bill, **Then** the manual add works normally with no interference from the failed recurrence.

---

### Edge Cases

- **BillType with defaultAmount=null**: The next bill is created with amount=null. The user can set the amount later via Edit.
- **BillType with defaultDueDay=null**: The next bill is created with an empty due_date and status `not_yet_generated`. No calendar reminders are attempted. The user must edit the bill to set a due date.
- **Overdue bill marked paid**: Recurrence still fires. The next due date is computed from the bill's `due_date` field (not from today). An overdue June bill with due_date 2026-06-15 marked paid in July still creates a July bill with due_date 2026-07-15.
- **Skipped bill**: The Mark Paid button is not available on skipped bills in the current UI. If a skipped bill's status were changed to paid programmatically, the recurrence would fire — but this is not a supported user flow.
- **Bill with status `not_yet_generated`**: Mark Paid is only shown for pending/overdue bills. `not_yet_generated` bills cannot be marked paid directly.
- **Month derivation edge**: For due dates like 2026-01-31 + 1 month = 2026-02-28, the month field is "2026-02" (derived from the computed due date).
- **Deleted next-month bill**: The idempotency check only considers non-deleted bills. If the user deleted next month's bill, the recurrence will re-create it.

---

## Design Decisions

### DD-001: Trigger — Mark Paid Only (CHOSEN)

**Decision**: Recurrence fires ONLY on Mark Paid. Not on Dashboard load, Add Bill, Edit, or any other action.

**Rationale**: Matches the to-do Mark Done recurrence pattern (Phase 8, `handleMarkDoneSubmit` in TodosPage.tsx). Consistent UX across Bills and To-Dos: completing an item triggers the next instance. This is also the most intuitive trigger — the user explicitly signals "this bill is done" and the system responds "here's the next one."

**Alternatives rejected**:
- **Dashboard load / cron**: Would create bills unpredictably, surprise the user with new items appearing without action.
- **Time-based lead-time**: Adds complexity (scheduling, background jobs). Out of scope for v1.

### DD-002: Amount — Use BillType.defaultAmount (CHOSEN)

**Decision**: The next bill's amount is set to `BillType.defaultAmount`, NOT the paid bill's `amount`.

**Rationale**: The paid bill's amount may have been a one-off override (e.g., extra charges). The BillType's `defaultAmount` reflects the expected recurring amount. If `defaultAmount` is null, the bill is created with null amount — the user can set it later.

**Alternatives rejected**:
- **Copy paid bill's amount**: Would propagate overrides into future bills, causing silent inflation.
- **Always null**: Would force the user to enter the amount every time, even when a default exists.

### DD-003: Idempotency — Dedup on Composite Key (CHOSEN)

**Decision**: Before creating the next bill, check if any non-deleted bill exists with the same composite key (propertyId + billTypeId + target month). If yes, skip auto-creation silently.

**Rationale**: Reuses the existing `computeCompositeKey` and `checkDuplicate` functions from billsService.ts. Prevents duplicates when the user manually pre-creates bills or when rapid double-submission occurs.

**Implementation**: Read fresh bills via `fetchBills` (or use the in-memory bills list after refetch), call `checkDuplicate` with the target composite key. If a match is found, skip appendRows.

### DD-004: Activity Log — Two Entries per Recurrence (CHOSEN)

**Decision**: When recurrence fires on Mark Paid, TWO activity log entries are written:
1. `bill_paid` (existing) — for the paid transition of the current bill.
2. `bill_added` (existing action type) — for the auto-created next bill, with summary: "Bill auto-created from recurrence: {billTypeName} — {propertyName} {formattedMonth}".

**Rationale**: The user can trace the chain: this bill was paid, and that triggered the creation of the next one. Both entries use existing `ActionType` values — no schema changes needed.

### DD-005: Calendar Reminders — Inherit from BillType (CHOSEN)

**Decision**: Auto-created bills get calendar reminders if the BillType has `reminderOffsetsDays` configured AND the new bill has a due date. This mirrors the existing `saveNewBill` flow in BillsPage.tsx.

**Rationale**: Calendar reminders are configured at the BillType level. A newly created bill (whether manual or auto-generated) should respect those settings. Without this, auto-created bills would be "invisible" to the user's calendar — defeating the purpose of reminders for recurring bills.

**Best-effort**: Calendar reminder creation is wrapped in try/catch. If it fails, the bill is still created and a secondary error toast is shown.

### DD-006: Frequency-to-Interval Mapping (CHOSEN)

**Decision**: Map the `Frequency` type to `computeNextDueDate` parameters:
- `monthly` → intervalValue=1, intervalUnit='months'
- `quarterly` → intervalValue=3, intervalUnit='months'
- `annual` → intervalValue=1, intervalUnit='years'
- `one-time` → skip (no recurrence)

**Rationale**: Reuses the existing `computeNextDueDate` function from `recurrencePatternsService.ts` rather than reimplementing date arithmetic. The function already handles month-end clamping, leap years, and all edge cases.

### DD-007: Due Date Computation Base — Use paid_bill.due_date (CHOSEN)

**Decision**: The next due date is computed from the PAID bill's `due_date` field, not from today's date.

**Rationale**: If a user pays a June bill in July (overdue), the next bill should be for July (due_date = June due_date + interval), not August (today + interval). The due_date represents the bill's position in the series, not when it was paid.

---

## Requirements

### Functional Requirements

#### Service Layer — Recurrence Logic

- **FR-001**: `billsService.ts` MUST export a new function `createNextRecurrenceBill(accessToken, spreadsheetId, paidBill, billType, allBills)` that creates the next bill instance for a recurring bill.
- **FR-002**: The function MUST compute the next due date using `computeNextDueDate` from `recurrencePatternsService.ts` with the frequency-to-interval mapping defined in DD-006.
- **FR-003**: The function MUST derive the new bill's `month` field (YYYY-MM format) from the computed next due date. If `defaultDueDay` is null (no due date computable), `month` MUST be computed by adding the frequency interval to the paid bill's month directly.
- **FR-004**: The function MUST set the new bill's `amount` to `billType.defaultAmount` (DD-002).
- **FR-005**: The function MUST set the new bill's `status` to `'pending'` if a due date was computed, or `'not_yet_generated'` if no due date (defaultDueDay is null).
- **FR-006**: The function MUST set the new bill's `compositeKey` using `computeCompositeKey(billType.propertyId, billType.id, newMonth)`.
- **FR-007**: The function MUST set `dueDate` and `originalDueDate` to the computed due date (or empty if none).
- **FR-008**: The function MUST leave all payment, attachment, and postpone fields empty: `paidDate`, `paymentMethod`, `transactionRef`, `billFileIds`, `receiptFileIds`, `calendarEventIds`, `notes` = empty strings; `postponedUntil` = empty.
- **FR-009**: The function MUST set `createdAt` and `updatedAt` to the current ISO timestamp, and `deletedAt` to empty.

#### Idempotency Check

- **FR-010**: Before appending the new bill row, the function MUST check for an existing non-deleted bill with the same composite key (BillType + Property + target month) using `checkDuplicate`.
- **FR-011**: If a duplicate exists, the function MUST return `null` (indicating skip) without appending a row or throwing an error.

#### Handler Integration — BillsPage.tsx

- **FR-012**: The `handleMarkPaidSubmit` function in BillsPage.tsx MUST be extended to call the recurrence logic AFTER the critical-path Mark Paid write succeeds and AFTER the calendar cleanup.
- **FR-013**: The recurrence logic MUST only fire when `billType.frequency !== 'one-time'`.
- **FR-014**: If recurrence creates a new bill (non-null return), the handler MUST:
  a. Write a `bill_added` activity log entry with summary "Bill auto-created from recurrence: {billTypeName} — {propertyName} {formattedMonth}".
  b. Show a success toast: "Next {billTypeName} bill created for {formattedMonth}".
  c. If the BillType has reminderOffsetsDays and the new bill has a due date, create calendar reminders (best-effort, wrapped in try/catch).
- **FR-015**: If recurrence returns null (idempotency skip), the handler MUST show the existing "Bill marked as paid." toast with no recurrence message.
- **FR-016**: If recurrence throws an error, the handler MUST catch it and show toast: "Bill marked paid, but couldn't auto-create next bill. Try again or add manually." The Mark Paid itself MUST NOT be rolled back.
- **FR-017**: After all side-effects complete (recurrence, calendar, activity log), the handler MUST call `refetchBills()` to refresh the list.

#### Activity Log

- **FR-018**: On successful Mark Paid with recurrence, TWO activity log entries MUST be written via `appendActivityLogSafe`:
  1. `bill_paid` (existing) — logged for the paid bill.
  2. `bill_added` — logged for the auto-created bill with summary format: "Bill auto-created from recurrence: {billTypeName} — {propertyName} {formattedMonth}".
- **FR-019**: On Mark Paid without recurrence (one-time frequency), exactly ONE activity log entry MUST be written: `bill_paid` (no change from existing behavior).

#### Calendar Reminders (Best-Effort)

- **FR-020**: If the auto-created bill has a non-empty `dueDate` AND `billType.reminderOffsetsDays` is non-empty, the handler MUST create calendar reminders using `createReminders` from `calendarReminders.ts`.
- **FR-021**: The reminder event title MUST follow the existing bill format: `"{billTypeName} — {propertyName} due {formattedDueDate}"`.
- **FR-022**: After creating reminders, the handler MUST update the new bill's `calendarEventIds` via `setCalendarEventIds` (requires refetch to get `_rowIndex`).
- **FR-023**: If calendar reminder creation fails, the handler MUST show a secondary error toast: "Bill marked paid, but reminders couldn't be set for the next bill." The bill itself MUST remain created.

### Key Entities

No new types or schema changes. All existing types are reused:
- **Bill**: Existing interface — new bills use the same structure.
- **BillType**: Existing interface — `frequency` field drives recurrence behavior.
- **Frequency**: Existing type `'monthly' | 'quarterly' | 'annual' | 'one-time'`.
- **ActionType**: Existing union — `'bill_paid'` and `'bill_added'` are both already defined.

---

## Reuse Statements

| What | Source | How Reused |
|---|---|---|
| computeNextDueDate | `recurrencePatternsService.ts` | Called with frequency-mapped intervalValue/intervalUnit to compute next due date |
| computeCompositeKey | `billsService.ts` | Called to build composite key for the new bill |
| checkDuplicate | `billsService.ts` | Called for idempotency check before creating the next bill |
| computeDueDate | `billsService.ts` | Available for computing due date from month + defaultDueDay |
| addBill pattern | `billsService.ts` | New function mirrors addBill's row construction and appendRows call |
| appendActivityLogSafe | `activityLogService.ts` | Used for both bill_paid and bill_added entries |
| createReminders | `calendarReminders.ts` | Used for calendar events on the new bill |
| setCalendarEventIds | `billsService.ts` | Used to persist calendar event IDs on the new bill |
| formatMonth | `billsService.ts` | Used in toast messages and activity log summaries |
| Mark Done recurrence pattern | `TodosPage.tsx` handleMarkDoneSubmit | Handler structure mirrors the to-do pattern: critical write → recurrence → calendar → activity log → refetch |

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Marking a monthly bill as paid auto-creates the next month's bill with correct due_date, amount, and status — verifiable by inspecting the Bills sheet.
- **SC-002**: Marking a quarterly bill as paid creates a bill 3 months ahead with the correct month and due date.
- **SC-003**: Marking an annual bill as paid creates a bill 12 months ahead (same month next year).
- **SC-004**: Month-end clamping works correctly: Jan 31 + 1 month = Feb 28 (or 29 in leap years).
- **SC-005**: Marking a one-time bill as paid produces no auto-created bill and no change from current behavior.
- **SC-006**: Pre-creating next month's bill manually, then marking this month's bill as paid, does NOT create a duplicate.
- **SC-007**: The success toast includes the bill type name and the target month when recurrence fires.
- **SC-008**: Two activity log entries (bill_paid + bill_added) are visible in the Activity Log page after a recurring Mark Paid.
- **SC-009**: If recurrence creation fails, the paid transition is preserved and an appropriate error toast is shown.
- **SC-010**: Auto-created bills with BillType.reminderOffsetsDays get calendar events at the expected dates.

---

## Assumptions

- Phases 1–11 are complete: all bill CRUD, calendar reminders, activity log, and dashboard are functional.
- The `Frequency` type includes `'one-time'` as the sentinel value for non-recurring bill types.
- `BillType.frequency` is reliably populated for all bill types (defaulting to `'monthly'` per the parseRow fallback in billTypesService.ts).
- `computeNextDueDate` in `recurrencePatternsService.ts` is correct and handles all month-end clamping scenarios.
- `checkDuplicate` in `billsService.ts` correctly identifies non-deleted bills by composite key.
- The `handleMarkPaidSubmit` handler in `BillsPage.tsx` is the single call site for `markBillPaid` — no other code path marks bills as paid.
- `appendActivityLogSafe` never throws (it swallows errors internally).
- Calendar operations are best-effort and wrapped in try/catch per the existing architecture.

---

## Out of Scope

- **Lead-time-based creation**: No "create bill 10 days before due" behavior. Trigger is Mark Paid only.
- **Weekly recurrence**: The Frequency type does not include weekly. Bill Type frequency stays monthly/quarterly/annual/one-time.
- **"Pause recurrence" toggle**: Users can set frequency to `one-time` to stop recurrence. No dedicated pause UI.
- **Editing recurrence settings after Mark Paid**: Each Mark Paid is a one-shot trigger. No "undo recurrence" or "edit the auto-created bill's recurrence chain."
- **New schema or types**: No changes to the Google Sheets schema, HEADER_DEFINITIONS, or TypeScript interfaces.
- **New UI components**: No new modals, pages, or buttons. The only visible changes are the success toast and the new bill appearing in the list.
- **Batch recurrence**: No "catch up" logic for bills that were skipped for multiple months. Each Mark Paid creates exactly one next bill.
