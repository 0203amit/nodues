# Implementation Plan: Bills Recurrence

**Branch**: `015-bills-recurrence` | **Date**: 2026-06-04 | **Spec**: `specs/015-bills-recurrence/spec.md`

**Input**: Feature specification from `specs/015-bills-recurrence/spec.md`

## Summary

Add auto-creation of the next bill instance when a recurring bill is marked as paid. When `handleMarkPaidSubmit` completes the critical mark-paid write, it checks the bill type's frequency. If not `one-time`, it calls a new `createNextRecurrenceBill` function in `billsService.ts` that computes the next due date via `computeNextDueDate`, checks for idempotency via `checkDuplicate`, and appends the new bill row. Calendar reminders are created best-effort for the new bill. Two activity log entries are written: `bill_paid` + `bill_added`. No schema changes, no new UI components — only service logic + handler integration.

## Technical Context

**Language/Version**: TypeScript 5.x (React 19 + Vite SPA)

**Primary Dependencies**: React Router v6, Tailwind CSS v3, Lucide React, uuid (all existing)

**Storage**: Google Sheets via existing `sheetsService.ts` (OAuth token, client-side)

**Testing**: Manual testing; `npm run build` for type checking

**Target Platform**: Web PWA (mobile-first)

**Project Type**: SPA (no server-side changes)

**Scale/Scope**: 1 modified service file, 1 modified page file, ~20 functional requirements, 0 new files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution is not configured (template only). No gates to evaluate. Proceeding.

## Project Structure

### Documentation (this feature)

```text
specs/015-bills-recurrence/
├── plan.md              # This file
├── research.md          # Phase 0 output — 7 research decisions
├── data-model.md        # Phase 1 output — no schema changes, entity field mapping
├── quickstart.md        # Phase 1 output — dev setup, testing checklist
└── spec.md              # Feature specification (23 FRs, 7 DDs)
```

### Source Code (changes)

```text
src/
├── services/
│   └── billsService.ts              # MODIFY — +frequencyToInterval, +createNextRecurrenceBill
└── pages/
    └── BillsPage.tsx                # MODIFY — extend handleMarkPaidSubmit with recurrence logic
```

No new files. No changes to types, schema, or other services.

---

## Key Design Decisions (from Research)

### 1. Calendar Event ID Workflow — Match Existing Pattern (R-001)

The auto-created bill's calendar event IDs require 3 Sheet API calls, matching the existing `saveNewBill` and `handleMarkDoneSubmit` patterns:

1. `appendRows` — write the new bill row (returns `_rowIndex: -1`)
2. `fetchBills` (via `refetchBills`) — read all rows to get real `_rowIndex`
3. `updateRow` (via `setCalendarEventIds`) — write event IDs using the fresh `_rowIndex`

This is unavoidable because `appendRows` doesn't return the appended row index. Refactoring `appendRows` to return it would be a cross-cutting change outside scope.

### 2. Frequency Values — No Normalization Needed (R-002)

The TypeScript `Frequency` union values (`'monthly'`, `'quarterly'`, `'annual'`, `'one-time'`) are stored directly in the Sheet without transformation. `billTypesService.ts` casts the raw Sheet value `as Frequency` on read and writes it directly on serialize. No normalization layer needed.

### 3. allBills Parameter — Caller Passes React State (R-003)

`createNextRecurrenceBill` accepts `allBills: BillWithDisplay[]` from the caller. The caller passes the `bills` React state, which contains all non-deleted bills from the last load/refetch. This is sufficient for idempotency:
- Pre-created bills from the current session are in state
- The `isSaving` guard prevents concurrent `handleMarkPaidSubmit` execution (double-tap safety)
- No extra Sheet fetch inside the function

### 4. anchorDay — Use billType.defaultDueDay (R-005)

Pass `billType.defaultDueDay` as the `anchorDay` parameter to `computeNextDueDate`. This preserves the original day intent across month-end clamping:
- Jan 31 → Feb 28 (clamped) → Mar 31 (snaps back to 31, not 28)
- Without anchorDay: Jan 31 → Feb 28 → Mar 28 → Apr 28... (loses intent)

### 5. Spec Correction — No postponedUntil Field (R-006)

FR-008 references `postponedUntil` but the `Bill` interface has no such field. Postponement is handled by modifying `dueDate` + PostponeLog. Implementation ignores this reference.

---

## Implementation Details

### New Functions in billsService.ts

#### `frequencyToInterval(freq: Frequency): { intervalValue: number; intervalUnit: string } | null`

Pure mapping function. Returns `null` for `'one-time'`.

```typescript
// monthly   → { intervalValue: 1, intervalUnit: 'months' }
// quarterly → { intervalValue: 3, intervalUnit: 'months' }
// annual    → { intervalValue: 1, intervalUnit: 'years' }
// one-time  → null
```

#### `createNextRecurrenceBill(accessToken, spreadsheetId, paidBill, billType, allBills): Promise<Bill | null>`

Full logic:
1. Call `frequencyToInterval(billType.frequency)` — return `null` if one-time
2. Compute next due date:
   - If `paidBill.dueDate` is non-empty: `computeNextDueDate(paidBill.dueDate, interval.intervalValue, interval.intervalUnit, billType.defaultDueDay)`
   - If `paidBill.dueDate` is empty: next due date = `''`
3. Derive `month`:
   - If next due date computed: extract YYYY-MM from it
   - If no next due date: add interval months to `paidBill.month` (simple arithmetic; annual = 12 months)
4. Compute `compositeKey` via `computeCompositeKey(billType.propertyId, billType.id, newMonth)`
5. Check idempotency: `checkDuplicate(compositeKey, allBills)` — if duplicate exists, return `null`
6. Build `Bill` object (see data-model.md for field mapping)
7. `serializeRow` + `appendRows` to write
8. Return the new `Bill`

Import needed: `computeNextDueDate` from `recurrencePatternsService.ts`.

### Handler Changes in BillsPage.tsx — handleMarkPaidSubmit

Restructured flow (changes in **bold**):

```
1. markBillPaid(existingBill, data)               ← critical path (existing)
2. Calendar cleanup on paid bill                    ← best-effort (existing)
3. appendActivityLogSafe(bill_paid)                 ← (moved earlier, before recurrence)
4. **if (billType.frequency !== 'one-time'):**
   a. **try { createNextRecurrenceBill(...) }**
   b. **if newBill:**
      - **appendActivityLogSafe(bill_added)**
      - **if dueDate && reminderOffsetsDays.length > 0:**
        - **createReminders(...)**
        - **refetchBills() to get _rowIndex**
        - **setCalendarEventIds(freshBill, eventIds)**
      - **show recurrence success toast**
   c. **if null: (idempotency skip) — no action**
   d. **catch: show "Bill marked paid, but couldn't auto-create..." toast**
5. refetchBills()                                   ← final refresh
6. Close modal
7. Show appropriate toast (if not already shown by recurrence)
```

Key points:
- The `bill_paid` activity log is written BEFORE recurrence attempts, ensuring it's always logged even if recurrence fails
- Recurrence is wrapped in its own try/catch (FR-016: mark paid never rolls back)
- Calendar on new bill is nested try/catch inside the recurrence try (FR-023: bill created even if reminders fail)
- `refetchBills()` at step 5 is called regardless, ensuring the UI always reflects the latest state

### New Import in BillsPage.tsx

```typescript
import { computeNextDueDate } from '../services/recurrencePatternsService';
// Not needed — createNextRecurrenceBill handles this internally

// Actually needed:
import { createNextRecurrenceBill } from '../services/billsService';
// Plus: formatDueDate already imported from calendarReminders
```

The `billType` for the recurrence call is resolved from `billTypes` state:
```typescript
const billType = billTypes.find(bt => bt.id === markPaidTarget.billTypeId);
```

---

## Chunk Breakdown

### Chunk 1: Core Recurrence (service layer + handler integration)

**Files modified**: `billsService.ts`, `BillsPage.tsx`

| # | Task | Details |
|---|------|---------|
| 1 | Add `frequencyToInterval` to `billsService.ts` | Pure mapping function, ~10 lines |
| 2 | Add `createNextRecurrenceBill` to `billsService.ts` | Core function: interval mapping → due date → month → composite key → idempotency check → build bill → append. ~50 lines. Import `computeNextDueDate` from `recurrencePatternsService.ts` |
| 3 | Restructure `handleMarkPaidSubmit` in `BillsPage.tsx` | Move activity log before recurrence block. Add recurrence try/catch after calendar cleanup. Call `createNextRecurrenceBill` with `bills` state |
| 4 | Add toast messages in `BillsPage.tsx` | Recurrence success: "Next {name} bill created for {month}". Error: "Bill marked paid, but couldn't auto-create next bill. Try again or add manually." Idempotency skip: existing "Bill marked as paid." toast |
| 5 | Add `bill_added` activity log entry | On successful recurrence, write second `appendActivityLogSafe` with summary format from FR-018 |
| 6 | Add import for `createNextRecurrenceBill` | In BillsPage.tsx |
| 7 | `npm run build` | Verify no type errors |

**Deliverable**: Mark Paid on a recurring bill auto-creates the next bill. One-time bills unchanged. Idempotency guard works. No calendar reminders yet on the new bill.

### Chunk 2: Calendar Reminders on Auto-Created Bill + E2E Testing

**Files modified**: `BillsPage.tsx`

| # | Task | Details |
|---|------|---------|
| 1 | Add calendar reminder creation | Inside the recurrence success block: check `billType.reminderOffsetsDays.length > 0 && newBill.dueDate`. Call `createReminders`. Mirror `saveNewBill`'s pattern |
| 2 | Add refetch + setCalendarEventIds | After createReminders: `refetchBills()` to get `_rowIndex`, find fresh bill by ID, call `setCalendarEventIds` |
| 3 | Add calendar failure handling | Nested try/catch. On failure: show "Bill marked paid, but reminders couldn't be set for the next bill." toast. Bill remains created |
| 4 | Manual test: monthly recurrence | Mark monthly bill paid → verify next month bill appears with correct due date, amount, status |
| 5 | Manual test: quarterly + annual | Verify 3-month and 12-month intervals |
| 6 | Manual test: one-time skip | Mark one-time bill paid → verify no new bill created |
| 7 | Manual test: idempotency | Pre-create next month's bill, then mark this month paid → verify no duplicate |
| 8 | Manual test: month-end clamping | Jan 31 → Feb 28; verify in Sheet |
| 9 | Manual test: calendar reminders | Mark paid on bill type with reminderOffsetsDays → verify calendar events created |
| 10 | `npm run build` | Final type check |

**Deliverable**: Complete feature with calendar reminders, all manual tests passing, clean build.

---

## Complexity Tracking

No constitution violations to justify. The feature adds ~60 lines to `billsService.ts` and ~40 lines to `BillsPage.tsx`, reusing existing functions throughout.
