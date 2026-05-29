# Tasks: Bill Postpone

**Input**: Design documents from `/specs/007-bill-postpone/`

**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: No automated tests. Manual testing via quickstart.md.

**Organization**: Tasks ordered bottom-up: types, postponeLogService, billsService extension, PostponeModal, BillCard + BillsPage wiring, validation. Grouped by user story for independent testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)

## User Story Map

| Story | Spec Section | Priority | Summary |
|-------|-------------|----------|---------|
| US1 | User Story 1 | P1 | Postpone an upcoming bill (core action) |
| US2 | User Story 2 | P1 | Validation and same-date no-op guard |
| US3 | User Story 3 | P2 | Calendar reminders replaced after postpone |
| US4 | User Story 4 | P1 | Postpone button visibility gating |

---

## Phase 1: Foundational — Types & PostponeLog Service

**Purpose**: Core types and data service that ALL user stories depend on. Must complete before any UI or business logic work.

- [ ] T001 [P] Add `PostponeLogEntry` and `PostponeFormData` interfaces to `src/types/index.ts`
  - `PostponeLogEntry`: `_rowIndex`, `id`, `itemType`, `itemId`, `fromDate`, `toDate`, `reason`, `postponedBy`, `postponedAt`
  - `PostponeFormData`: `newDueDate` (required YYYY-MM-DD string), `reason` (optional string)
  - Append after the existing `MarkPaidFormData` interface

- [ ] T002 [P] Create `src/services/postponeLogService.ts` — full service mirroring `propertiesService.ts` pattern
  - Tab/column setup: derive `COL` from `HEADER_DEFINITIONS` for `'PostponeLog'` tab — do NOT hardcode column positions. Column names match HEADER_DEFINITIONS exactly: `id`, `item_type`, `item_id`, `from_date`, `to_date`, `reason`, `postponed_by`, `postponed_at`
  - `parseRow(row: RowWithIndex): PostponeLogEntry | null` — return `null` if `id` is missing (malformed-row tolerance). Map snake_case sheet columns to camelCase TypeScript fields. `itemType` read from `COL.item_type`, `itemId` from `COL.item_id`, `fromDate` from `COL.from_date`, `toDate` from `COL.to_date`, `postponedBy` from `COL.postponed_by`, `postponedAt` from `COL.postponed_at`
  - `serializeRow(entry: PostponeLogEntry): string[]` — output columns in HEADER_DEFINITIONS order: `[entry.id, entry.itemType, entry.itemId, entry.fromDate, entry.toDate, entry.reason, entry.postponedBy, entry.postponedAt]`
  - `fetchPostponeLog(accessToken, spreadsheetId): Promise<PostponeLogEntry[]>` — read all rows via `readAllRows`, parse each with `parseRow`, skip nulls, sort by `postponedAt` descending. For future use (FR-017)
  - `appendPostponeLog(accessToken, spreadsheetId, entry: Omit<PostponeLogEntry, '_rowIndex'>): Promise<void>` — build row via `serializeRow` (pass `{ ...entry, _rowIndex: -1 }`) and call `appendRows` to the `'PostponeLog'` tab
  - Imports: `HEADER_DEFINITIONS` from `../config/schema`, `readAllRows`, `appendRows` from `./sheetsService`, `PostponeLogEntry`, `RowWithIndex` from `../types`

**Checkpoint**: Types and data layer ready. Can be verified by inspecting TypeScript compilation and import resolution.

---

## Phase 2: User Story 1 — Postpone an Upcoming Bill (Priority: P1) — MVP

**Goal**: A user can postpone a pending or overdue bill to a new date. The bill's due date updates, `original_due_date` is captured on first postpone, and the change is logged in PostponeLog.

**Independent Test**: Open a pending/overdue bill, tap Postpone, enter a new date and optional reason, submit. Verify: bill row shows new `due_date` and `updated_at` in the sheet, `original_due_date` is set if previously empty, a new PostponeLog row appears with correct `from_date`/`to_date`, and the UI badge refreshes without page reload.

### Implementation

- [ ] T003 Add `postponeBill` function to `src/services/billsService.ts`
  - Signature: `postponeBill(accessToken, spreadsheetId, bill: Bill, newDueDate: string, reason: string): Promise<Bill>`
  - Import `appendPostponeLog` from `./postponeLogService` and `v4 as uuidv4` from `uuid`
  - Step 1 — Compute `originalDueDate`: if `bill.originalDueDate` is empty string, set to `bill.dueDate` (the PREVIOUS due date being replaced). If already populated, preserve unchanged. Use `bill.dueDate`, NOT `newDueDate`
  - Step 2 — Build `updatedBill`: spread `...bill`, set `dueDate: newDueDate`, `originalDueDate: <computed>`, `updatedAt: new Date().toISOString()`. Do NOT change `status`
  - Step 3 — `await updateRow(accessToken, spreadsheetId, 'Bills', bill._rowIndex, serializeRow(updatedBill))` (full-row-safety)
  - Step 4 — Build `PostponeLogEntry`: `id: uuidv4()`, `itemType: 'bill'` (hardcoded), `itemId: bill.id`, `fromDate: bill.dueDate` (PREVIOUS dueDate), `toDate: newDueDate`, `reason: reason.trim()`, `postponedBy: 'user'` (hardcoded, single-user app), `postponedAt: new Date().toISOString()`
  - Step 5 — `await appendPostponeLog(accessToken, spreadsheetId, entry)`. If this throws after step 3 succeeded, rethrow (accepted trade-off per FR-011 — no rollback)
  - Step 6 — Return `updatedBill`
  - Scope: bill update + log append ONLY. NO calendar work inside `postponeBill`

- [ ] T004 Create `src/components/bills/PostponeModal.tsx` — modal component following `MarkPaidModal.tsx` pattern
  - Props: `{ bill: BillWithDisplay, isSaving: boolean, onSubmit: (data: PostponeFormData) => void, onClose: () => void }`
  - Title: `<h2>` "Postpone bill"
  - Context line: `{bill.billTypeName} — {bill.propertyName}` and `{formatMonth(bill.month)}` with optional amount (same pattern as MarkPaidModal)
  - Current due date (read-only): display via `formatDueDate(bill.dueDate)`, formatted text not an input
  - New due date field: `<input type="date">`, required. Validation: non-empty only (error: "Please enter a new due date."). Same-date check is NOT in the modal
  - Reason field: `<textarea>`, optional. Placeholder "Optional". Trim before submit
  - Action buttons: Cancel (secondary, left) + Submit "Postpone" (primary, right). Both disabled when `isSaving`. Submit shows `Loader2` spinner when saving
  - Escape key: `useEffect` listener calls `onClose`
  - Backdrop: `fixed inset-0 bg-slate-900/50`, click-to-close (calls `onClose`). Dialog stops propagation
  - Dialog container: `bg-white rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto`
  - Form state: `useState` for `newDueDate` (initially empty), `reason` (initially empty), `errors` (record)
  - `clearError` helper matching MarkPaidModal pattern
  - Import `formatMonth`, `formatCurrency`, `formatDueDate` from `../../services/billsService`
  - Reference `design-system/nodues/MASTER.md` section 5.6 (Modals) for layout, section 5.1 (Buttons) for styling, section 5.3 (Form Inputs) for input styling

- [ ] T005 Add `onPostpone` prop and Postpone button to `src/components/bills/BillCard.tsx`
  - Add `onPostpone: (bill: BillWithDisplay) => void` to `BillCardProps`
  - Add `onPostpone` to the destructured props in the `forwardRef` component
  - Import `CalendarClock` from `lucide-react`
  - Add Postpone button AFTER the "Mark Paid" button, BEFORE the Paperclip attachments button. Gated by the existing `showMarkPaid` variable (same condition: `displayStatus === 'pending' || displayStatus === 'overdue'`)
  - Button: `onClick={() => onPostpone(bill)}`, `disabled={isLoading}`, `aria-label="Postpone bill"`
  - Styling: `text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50` (ghost/text button from MASTER.md section 5.1)
  - Classes: `font-medium text-sm px-2 py-1 rounded transition-colors cursor-pointer min-h-11 min-w-11 inline-flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`
  - Content: `<CalendarClock className="w-4 h-4" />` + `<span className="hidden sm:inline">Postpone</span>`

- [ ] T006 Wire postpone state, handlers, and modal in `src/pages/BillsPage.tsx`
  - Add import: `postponeBill` from `../services/billsService`, `PostponeModal` from `../components/bills/PostponeModal`, `PostponeFormData` from `../types`
  - Add state: `const [postponeTarget, setPostponeTarget] = useState<BillWithDisplay | null>(null);` (reuse existing `isSaving`)
  - Add `handlePostpone(bill: BillWithDisplay)`: sets `setPostponeTarget(bill)`
  - Add `handlePostponeSubmit(data: PostponeFormData)`:
    - Same-date guard: if `data.newDueDate === postponeTarget!.dueDate`, call `showToast("New date is the same as the current due date.", "info")` and return BEFORE `setIsSaving`. Modal stays open with data preserved
    - `setIsSaving(true)`
    - Critical path `try/catch`: `const updated = await postponeBill(accessToken!, spreadsheetId, postponeTarget!, data.newDueDate, data.reason)`
    - Best-effort calendar (nested `try/catch`, AFTER `postponeBill` returns):
      - Branch 1 — type has offsets: `cleanupReminders` + `createReminders` + `setCalendarEventIds`, then `setBills` with recomputed `displayStatus` via `computeDisplayStatus(updated.status, updated.dueDate)`. If `!result.allSucceeded`, show partial-failure toast
      - Branch 2 — type has no offsets but old IDs exist: `cleanupReminders` + `setCalendarEventIds([], [])` + clear column, then `setBills` with recomputed `displayStatus`
      - Branch 3 — neither: just `setBills` with `...updated` and recomputed `displayStatus`
    - Calendar catch: toast "Bill postponed, but calendar reminders couldn't be updated." (error). Still `setBills` with updated bill + recomputed `displayStatus`
    - After calendar block: `setPostponeTarget(null)`. If no calendar failure, toast "Bill postponed." (success)
    - Outer catch (critical path failed): toast "Failed to postpone bill." (error)
    - `finally`: `setIsSaving(false)`
  - Render `PostponeModal` when `postponeTarget` is set: `<PostponeModal bill={postponeTarget} isSaving={isSaving} onSubmit={handlePostponeSubmit} onClose={() => !isSaving && setPostponeTarget(null)} />`
  - Pass `onPostpone={handlePostpone}` to every `<BillCard>`

**Checkpoint**: Core postpone flow works end-to-end. User can postpone a bill, see the UI update, and verify the sheet writes.

---

## Phase 3: User Story 2 — Validation & Same-Date Guard (Priority: P1)

**Goal**: Prevent pointless writes when user submits the same date or an empty date.

**Independent Test**: Open Postpone modal, submit without entering a date (expect inline error). Enter the same date as current due date, submit (expect info toast, modal stays open, no sheet writes).

> Note: Both validation behaviors are already implemented in T004 (modal-level empty check) and T006 (page-level same-date guard). This phase exists as a verification checkpoint — no new tasks needed.

**Checkpoint**: Validation rules verified. Empty date shows inline error. Same date shows info toast, modal stays open.

---

## Phase 4: User Story 3 — Calendar Reminders Replaced (Priority: P2)

**Goal**: After a successful postpone, old calendar events are deleted and new ones created for the new due date. Calendar failures never block the postpone.

**Independent Test**: Postpone a bill whose bill type has `reminderOffsetsDays` configured. Check Google Calendar: old events removed, new events created for new date. Then test with calendar API unreachable: bill and log still update, toast shows calendar failure.

> Note: Calendar replacement logic is fully implemented in T006 (`handlePostponeSubmit` best-effort calendar block with three branches). This phase exists as a verification checkpoint — no new tasks needed.

**Checkpoint**: Calendar replacement works. Partial and full failure toasts appear correctly. Critical path is never blocked by calendar errors.

---

## Phase 5: User Story 4 — Postpone Button Visibility (Priority: P1)

**Goal**: Postpone button only appears on bills with `displayStatus` of `pending` or `overdue`. Invisible for `paid`, `skipped`, `not_yet_generated`.

**Independent Test**: View bills in each display status. Confirm Postpone button visible for pending/overdue, absent for all others.

> Note: Button visibility gating is implemented in T005 using the existing `showMarkPaid` variable. This phase exists as a verification checkpoint — no new tasks needed.

**Checkpoint**: Button visibility correct across all display statuses.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Toast message verification and end-to-end validation across all scenarios.

- [ ] T007 Verify all five toast messages work correctly across the full flow
  - Success: "Bill postponed." (success severity)
  - Calendar full failure: "Bill postponed, but calendar reminders couldn't be updated." (error severity)
  - Calendar partial failure: "Bill postponed, but some reminders couldn't be set." (error severity)
  - Critical-path failure: "Failed to postpone bill." (error severity)
  - Same-date guard: "New date is the same as the current due date." (info severity)
  - Verify `displayStatus` badge refreshes immediately after postpone (overdue -> pending if new date is future)
  - Verify `original_due_date` capture: set on first postpone, preserved on subsequent postpones
  - Verify PostponeLog row has correct `from_date` (previous dueDate) and `to_date` (newDueDate) — not swapped

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Types + Service)**: No dependencies — start immediately. T001 and T002 are parallelizable [P]
- **Phase 2 (Core Postpone)**: Depends on Phase 1 completion
  - T003 depends on T001 (types) + T002 (postponeLogService)
  - T004 depends on T001 (PostponeFormData type)
  - T005 depends on nothing in Phase 1 (only adds prop + button)
  - T004 and T005 are parallelizable with each other, but T003 must precede T006
  - T006 depends on T003 + T004 + T005
- **Phase 3-5 (Validation, Calendar, Visibility)**: Verification checkpoints — covered by T004/T005/T006 implementation
- **Phase 6 (Polish)**: Depends on all prior phases

### Within Phase 2

```
T003 (postponeBill)  ──┐
T004 (PostponeModal) ──┤── T006 (BillsPage wiring)
T005 (BillCard)      ──┘
```

T003, T004, T005 can be built in parallel (different files), then T006 wires them together.

### Parallel Opportunities

```
Phase 1:  T001 ═══╗
          T002 ═══╩═══ Phase 1 complete

Phase 2:  T003 ═══╗
          T004 ═══╬═══ T006 (wiring)
          T005 ═══╝
```

---

## Parallel Example: Phase 1

```bash
# Launch both type and service tasks in parallel (different files):
T001: "Add PostponeLogEntry and PostponeFormData to src/types/index.ts"
T002: "Create src/services/postponeLogService.ts"
```

## Parallel Example: Phase 2

```bash
# After Phase 1 completes, launch these three in parallel (different files):
T003: "Add postponeBill to src/services/billsService.ts"
T004: "Create src/components/bills/PostponeModal.tsx"
T005: "Add Postpone button to src/components/bills/BillCard.tsx"

# Then, after T003+T004+T005 complete:
T006: "Wire postpone state + handlers + modal in src/pages/BillsPage.tsx"
```

---

## Implementation Strategy

### MVP First (Phase 1 + Phase 2)

1. Complete Phase 1: Types + PostponeLog Service (T001, T002)
2. Complete Phase 2: Core postpone flow (T003-T006)
3. **STOP and VALIDATE**: Test postpone end-to-end with a real bill
4. Verify sheet writes, PostponeLog row, badge refresh, original_due_date capture

### Full Delivery

1. Complete Phase 1-2 (MVP)
2. Verify Phase 3-5 checkpoints (validation, calendar, visibility)
3. Complete Phase 6: Toast and edge-case verification (T007)

---

## Notes

- [P] tasks = different files, no dependencies
- No automated test tasks (manual testing via quickstart.md)
- `postponeBill` does NOT touch calendar — calendar lives in BillsPage handler (requirement #4)
- `itemType` is hardcoded `'bill'`, `postponedBy` is hardcoded `'user'` — single-user app (requirement #1)
- PostponeLog `from_date` = bill's PREVIOUS `dueDate`; `to_date` = `newDueDate` — don't swap (requirement #3)
- If log append throws after bill update, function rethrows. No rollback attempted (FR-011, requirement #9)
- Same-date guard at BillsPage level, BEFORE `setIsSaving` — modal stays open with data preserved (requirement #6)
