# Feature Specification: Bill Postpone

**Feature Branch**: `007-bill-postpone`

**Created**: 2026-05-29

**Status**: Draft

**Input**: User description: "Postpone — change a bill's due date with a logged audit trail (Phase 7 of the Build Order)"

## User Scenarios & Testing

### User Story 1 — Postpone an Upcoming Bill (Priority: P1)

A user has a pending or overdue bill whose real-world deadline has shifted (e.g. the housing society pushed the maintenance due date by a week). The user opens the bill's action row, taps "Postpone", enters the new due date and an optional reason, and confirms. The bill's due date updates immediately, the change is logged in the PostponeLog sheet for future audit, and calendar reminders are replaced to reflect the new date.

**Why this priority**: This is the core action of the entire feature. Without it, nothing else matters.

**Independent Test**: Can be fully tested by postponing any pending or overdue bill and verifying the bill row, PostponeLog row, and calendar events all update correctly.

**Acceptance Scenarios**:

1. **Given** a pending bill with due date 2026-06-05, **When** the user taps Postpone, enters 2026-06-12 as the new date with reason "Society shifted by 7 days", and taps Submit, **Then** the bill's due date becomes 2026-06-12, `updated_at` is refreshed, a new row appears in the PostponeLog tab with the old and new dates plus the reason, and old calendar reminder events are deleted and new ones are created for 2026-06-12.

2. **Given** an overdue bill with due date 2026-05-20, **When** the user postpones it to 2026-06-01, **Then** the bill's display status recalculates (may become pending if 2026-06-01 is in the future), and the PostponeLog records the shift.

3. **Given** a pending bill whose `original_due_date` is empty (legacy data), **When** the user postpones for the first time, **Then** `original_due_date` is set to the bill's previous `due_date` before overwriting it. On any subsequent postpone, `original_due_date` remains unchanged.

4. **Given** a pending bill whose `original_due_date` is already populated, **When** the user postpones, **Then** `original_due_date` is NOT modified — it stays pinned to the very first due date ever assigned.

---

### User Story 2 — Validation and No-Op Guard (Priority: P1)

The user opens the Postpone modal and either enters the same date as the current due date, or leaves the new date field empty. The system prevents a pointless write.

**Why this priority**: Prevents data pollution in the PostponeLog and unnecessary calendar churn. Integral to the core action.

**Independent Test**: Open Postpone modal, submit without changing the date, and verify no sheet writes or calendar calls occur.

**Acceptance Scenarios**:

1. **Given** a bill with due date 2026-06-05, **When** the user opens Postpone and submits with 2026-06-05 as the new date, **Then** the system shows a gentle informational toast ("New date is the same as the current due date.") and does not write to the Bills or PostponeLog tabs.

2. **Given** the Postpone modal is open, **When** the user submits with the new date field empty, **Then** a validation error appears below the field ("Please enter a new due date.") and submission is blocked.

---

### User Story 3 — Calendar Reminders Replaced (Priority: P2)

After a successful postpone, the old calendar reminder events are deleted and new ones are created for the new due date, using the bill type's configured reminder offsets. This happens as a best-effort side effect — if it fails, the bill and PostponeLog writes have already succeeded and the user sees a toast about the calendar failure.

**Why this priority**: Depends on the core postpone action (P1) being complete. Adds significant value but the postpone is still useful without it.

**Independent Test**: Postpone a bill whose bill type has reminder offsets configured, then check Google Calendar for the new events and confirm old ones are removed.

**Acceptance Scenarios**:

1. **Given** a postponed bill whose bill type has `reminder_offsets_days = [3, 1]` and old calendar events exist, **When** the postpone succeeds, **Then** old events are deleted (best-effort), new events are created for (newDueDate - 3 days) and (newDueDate - 1 day), and the bill's `calendar_event_ids` is updated with the new event IDs.

2. **Given** a postponed bill whose bill type has no reminder offsets, **When** the postpone succeeds, **Then** no calendar operations occur.

3. **Given** a postponed bill where the calendar API is unreachable, **When** the postpone succeeds (bill + PostponeLog written), **Then** the user sees a toast "Bill postponed, but calendar reminders couldn't be updated." and the bill's `calendar_event_ids` may be stale.

---

### User Story 4 — Postpone Button Visibility (Priority: P1)

The Postpone action button only appears on bills where postponing is meaningful — i.e. the bill has a due date that can shift. Bills that are paid, skipped, or not yet generated (no due date) do not show the button.

**Why this priority**: Part of the core UI contract. Without correct visibility, users hit confusing states.

**Independent Test**: View bills in each display status and confirm the Postpone button appears only for pending and overdue bills.

**Acceptance Scenarios**:

1. **Given** a bill with `displayStatus = 'pending'`, **When** the user views its BillCard, **Then** a "Postpone" button with a calendar-clock icon is visible in the action row.

2. **Given** a bill with `displayStatus = 'overdue'`, **When** the user views its BillCard, **Then** the "Postpone" button is visible.

3. **Given** a bill with `displayStatus = 'paid'`, **When** the user views its BillCard, **Then** no "Postpone" button is shown.

4. **Given** a bill with `displayStatus = 'not_yet_generated'`, **When** the user views its BillCard, **Then** no "Postpone" button is shown (there is no due date to shift).

5. **Given** a bill with `displayStatus = 'skipped'`, **When** the user views its BillCard, **Then** no "Postpone" button is shown.

---

### Edge Cases

- **Concurrent edit**: Single-user app; no concurrent-write protection needed. If the user has two tabs open and postpones in both, the second write wins (last-write-wins, same as all other bill operations).
- **Bill deleted between modal open and submit**: The postpone will fail on the sheet write (row may be soft-deleted). The catch block shows a generic error toast. Acceptable — same as Edit and Mark Paid.
- **Calendar event already manually deleted from Google Calendar**: The `deleteEvent` call returns 404/410, which is treated as success (event already gone). No error surfaced.
- **PostponeLog append fails**: This is part of the critical path (not best-effort). If the append fails, the entire `postponeBill` call fails and neither the bill update nor the log row persist (the bill update happens first, then the log append; if the append throws, the bill row was already written — see FR-007 for the accepted trade-off and mitigation).

## Requirements

### Functional Requirements

#### Postpone Action

- **FR-001**: The system MUST provide a "Postpone" action on each bill card, visible only when the bill's computed display status is `pending` or `overdue`.
- **FR-002**: The Postpone action MUST NOT appear on bills with display status `paid`, `not_yet_generated`, or `skipped`.
- **FR-003**: Tapping Postpone MUST open a modal dialog ("Postpone bill") showing the bill's current due date (read-only) and requesting a new due date (required) and an optional reason (free text).
- **FR-004**: The new due date field MUST be required. Submission without a date MUST show a validation error.
- **FR-005**: If the user submits a new due date that is identical to the current due date, the system MUST show an informational toast ("New date is the same as the current due date.") and perform no writes.
- **FR-006**: The modal MUST close on Escape key press and on backdrop click (consistent with existing modals). Closing while a save is in progress MUST be blocked.

#### Bill Update (Critical Path)

- **FR-007**: On valid submission, the system MUST update the bill row in the Bills sheet tab using full-row-safety: set `due_date` to the new date, set `updated_at` to the current ISO timestamp, and preserve all other fields unchanged.
- **FR-008**: The system MUST preserve `original_due_date` according to this rule:
  - If `original_due_date` is empty (blank string) at the time of postpone, set it to the bill's **current** `due_date` (the value being replaced) so the original deadline is captured on the first shift.
  - If `original_due_date` is already populated, leave it unchanged.
  - This is a **deliberate design decision**: `original_due_date` pins to the very first due date ever assigned to the bill; subsequent postponements do not overwrite it.
- **FR-009**: The bill's stored `status` field MUST NOT change during postpone (it remains `pending`). The computed `displayStatus` will recalculate based on the new due date vs. today.

#### PostponeLog Append (Critical Path)

- **FR-010**: After the bill row update succeeds, the system MUST append a new row to the PostponeLog sheet tab with these columns (matching the schema exactly):

  | Column           | Value                                            |
  | ---------------- | ------------------------------------------------ |
  | `id`             | New UUID (v4)                                    |
  | `item_type`      | `"bill"` (literal string)                        |
  | `item_id`        | The bill's `id`                                  |
  | `from_date`      | The bill's previous `due_date` (before this postpone) |
  | `to_date`        | The new due date                                 |
  | `reason`         | User-provided reason text (may be empty string)  |
  | `postponed_by`   | `"user"` (literal string; single-user app)       |
  | `postponed_at`   | Current ISO timestamp                            |

- **FR-011**: The bill row update and PostponeLog append together form the critical path. Both MUST succeed for the postpone to be considered successful. If the PostponeLog append fails after the bill row was already updated, the user sees an error toast. (Accepted trade-off: the bill's due date is already written. A future reconciliation or retry could address this; for a single-user app the risk is minimal.)

#### Calendar Reminder Replacement (Best-Effort)

- **FR-012**: After the critical-path writes succeed, the system MUST attempt to replace calendar reminders for the new due date, following the same best-effort pattern as Phase 6:
  1. Parse existing `calendar_event_ids` from the bill.
  2. Delete old events via `cleanupReminders` (best-effort, never throws).
  3. Create new events via `createReminders` using the bill type's `reminderOffsetsDays` and the new due date.
  4. Update the bill's `calendar_event_ids` in the sheet via `setCalendarEventIds`.
- **FR-013**: Calendar failures MUST NOT block or roll back the postpone. On failure, the system MUST show a toast: "Bill postponed, but calendar reminders couldn't be updated."
- **FR-014**: If the bill type has no `reminderOffsetsDays` configured, no calendar operations are performed.
- **FR-015**: If creating reminders partially succeeds (some events created, others fail), the successfully created event IDs MUST still be saved to `calendar_event_ids`, and the toast MUST indicate partial failure: "Bill postponed, but some reminders couldn't be set."

#### Postpone vs. Edit Distinction

- **FR-016**: The Postpone action is the deliberately-logged path for shifting a real-world deadline. Edit is for correcting data-entry mistakes and is not logged. Both can change `due_date`; the system does not lock `due_date` in Edit mode. The distinction is conceptual and communicated via UI context (separate button, separate modal title/copy, audit trail only for Postpone).

#### PostponeLog Service

- **FR-017**: A new service (`postponeLogService`) MUST provide functions to parse and serialize PostponeLog rows, fetch all log entries (for future use), and append a new log entry.

#### User Feedback

- **FR-018**: On successful postpone (including calendar success): toast "Bill postponed." with success severity.
- **FR-019**: On successful postpone with calendar failure: toast "Bill postponed, but calendar reminders couldn't be updated." with error severity.
- **FR-020**: On successful postpone with partial calendar failure: toast "Bill postponed, but some reminders couldn't be set." with error severity.
- **FR-021**: On postpone failure (bill update or PostponeLog append fails): toast "Failed to postpone bill." with error severity.
- **FR-022**: On same-date no-op: toast "New date is the same as the current due date." with info severity.

### Key Entities

- **PostponeLogEntry**: A record of a single postpone action. Key attributes: unique ID, the type of item postponed (`item_type`), the item's ID (`item_id`), the date it was moved from (`from_date`), the date it was moved to (`to_date`), an optional reason, who performed it (`postponed_by`), and when (`postponed_at`). Stored in the PostponeLog sheet tab.
- **Bill** (extended behavior): The existing Bill entity gains postpone behavior. The `due_date` field is mutable via postpone; `original_due_date` is write-once (set on first postpone if previously empty, then frozen). `calendar_event_ids` is replaced after each postpone.
- **PostponeFormData**: The data collected from the Postpone modal: `newDueDate` (required string, YYYY-MM-DD) and `reason` (optional string).

## Success Criteria

### Measurable Outcomes

- **SC-001**: A user can postpone a pending or overdue bill to a new date in under 30 seconds (open modal, enter date, submit, see confirmation toast).
- **SC-002**: Every successful postpone produces exactly one new row in the PostponeLog sheet tab with correct `from_date`, `to_date`, and timestamp.
- **SC-003**: After postpone, the bill's displayed due date reflects the new date without requiring a page reload.
- **SC-004**: Calendar reminders reflect the new due date within the same user session (old events removed, new events created) when the calendar service is available.
- **SC-005**: Calendar failures never prevent the bill update or PostponeLog write from completing.
- **SC-006**: The Postpone button is invisible on 100% of paid, skipped, and not-yet-generated bills.
- **SC-007**: `original_due_date` is set exactly once per bill lifetime (on first postpone if previously empty) and never overwritten by subsequent postponements.

## Assumptions

- Phases 1 through 6 are complete and deployed on master: sign-in, bootstrapping (all 9 sheet tabs including PostponeLog), Properties + Bill Types, Bills core loop, file attachments, and calendar reminders.
- The PostponeLog tab already exists in the spreadsheet with headers matching `schema.ts` HEADER_DEFINITIONS: `id`, `item_type`, `item_id`, `from_date`, `to_date`, `reason`, `postponed_by`, `postponed_at`.
- `accessToken` is available via `useAuth()` and `spreadsheetId`/`calendarId` via `useBootstrap().setupResult`.
- The existing Phase 6 calendar orchestration functions (`createReminders`, `cleanupReminders`, `setCalendarEventIds`) are stable and reusable without modification.
- `postponed_by` is always `"user"` since this is a single-user app with no multi-user identity system.
- Edit (via BillFormModal) continues to allow `due_date` changes without logging. The user is trusted to choose the right action for their intent.

## Out of Scope

- **PostponeLog history UI**: Displaying the postpone audit trail on the bill detail or as a dedicated view. The data is persisted in the sheet for future use but no UI is built in this phase. A future polish phase could add an expandable "History" section on the bill card or a dedicated log page.
- **Recurring bill auto-generation**: Separate future phase.
- **Dashboard / aggregate views**: Phase 10.
- **Push notifications**: Phase 11.
- **Undo for postpone**: Unlike delete (which has a 10-second undo window), postpone is not undoable in one tap. The user can manually re-postpone or edit the bill to revert. Adding undo would require rolling back the PostponeLog entry and calendar events, adding complexity without clear user demand.
