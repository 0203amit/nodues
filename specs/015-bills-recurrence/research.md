# Research: Bills Recurrence

**Feature**: Bills Recurrence (Phase 15)
**Date**: 2026-06-04

---

## R-001: Calendar Event ID Attachment Workflow (FR-022)

**Question**: The spec says append new bill, refetch, setCalendarEventIds — that's 3 Sheet API calls per Mark Paid. Does this match the existing `saveNewBill` flow? Should we deviate?

**Decision**: Match the existing pattern exactly. 3 Sheet API calls is the established norm.

**Evidence — saveNewBill in BillsPage.tsx (lines 271–326)**:
1. `addBill()` — calls `appendRows` (Sheet write #1)
2. `refetchBills()` — calls `readAllRows` via `fetchBills` (Sheet read #2) — needed to get `_rowIndex`
3. `setCalendarEventIds(fresh, result.eventIds)` — calls `updateRow` (Sheet write #3)

The `addBill` function returns a `Bill` with `_rowIndex: -1` (line 245), which is unusable for `setCalendarEventIds` (which calls `updateRow` at the `_rowIndex`). The refetch is mandatory to obtain the real row index.

**Evidence — handleMarkDoneSubmit in TodosPage.tsx (lines 384–479)**:
Same pattern for the recurrence case:
1. `createNextRecurrence()` — `appendRows` (write #1)
2. `createReminders()` — Calendar API (no Sheet call)
3. `refetchTodos()` — `readAllRows` (read #2) — gets `_rowIndex`
4. `setCalendarEventIds(freshNext, result.eventIds)` — `updateRow` (write #3)

**Rationale**: Both existing flows require the refetch because `appendRows` returns no row index. The Sheets API `append` endpoint does return the updated range, but the project's `appendRows` abstraction in `sheetsService.ts` doesn't surface it. Modifying `appendRows` to return the row index would reduce calls but would be a refactor outside scope.

**Alternatives considered**:
- Modify `appendRows` to parse and return the appended row index — reduces 3 calls to 2 but is a cross-cutting refactor that affects all append callers. Out of scope for this feature.
- Skip calendar event ID persistence on auto-created bills — would leave `calendarEventIds` empty, making future calendar cleanup impossible when the bill is edited/postponed/deleted.

---

## R-002: Frequency Value Normalization

**Question**: Do the TypeScript `Frequency` union values match what's stored in the Sheet? Any case/hyphen/capitalization mismatches?

**Decision**: No normalization needed. The values match exactly.

**Evidence**:
- `src/types/index.ts` line 3: `export type Frequency = 'monthly' | 'quarterly' | 'annual' | 'one-time';`
- `billTypesService.ts` line 38 (parse): `frequency: (v[COL.frequency] ?? 'monthly') as Frequency` — reads the raw Sheet value and casts directly
- `billTypesService.ts` line 54 (serialize): `billType.frequency` — writes the TypeScript value directly to the Sheet
- Form submission: `data.frequency` is typed as `Frequency` and stored directly

The Sheet stores the exact lowercase strings: `monthly`, `quarterly`, `annual`, `one-time`. The TypeScript type and the Sheet values are identical. The hyphen in `one-time` is consistent.

**Rationale**: The parse logic casts `as Frequency` without transformation. The serialize logic writes the field without transformation. The form uses a `<select>` populated from `FREQUENCY_OPTIONS` which maps `Frequency` values directly. No normalization layer exists or is needed.

---

## R-003: createNextRecurrenceBill — allBills Parameter

**Question**: Does the caller already have `allBills` in memory after `handleMarkPaidSubmit`? Or should the function fetch internally?

**Decision**: The caller passes the in-memory `bills` React state. No extra fetch inside `createNextRecurrenceBill`.

**Evidence — handleMarkPaidSubmit flow (BillsPage.tsx lines 446–488)**:
```
markBillPaid()           ← critical path
calendar cleanup         ← best-effort
refetchBills()           ← currently at line 467
close modal, activity log, toast
```

The `bills` state (line 60: `const [bills, setBills] = useState<BillWithDisplay[]>([])`) contains the full bill list from the last `loadData()` or `refetchBills()` call. This is available at the point where recurrence fires.

**Flow restructuring**: Per the spec (FR-012, FR-017), recurrence fires AFTER mark paid + calendar cleanup, and refetchBills is the LAST step. The new flow:
```
1. markBillPaid()                    ← critical path
2. calendar cleanup on paid bill     ← best-effort
3. recurrence logic (uses bills state for idempotency)
4. calendar on new bill (if needed)  ← best-effort
5. activity log entries
6. refetchBills()                    ← final refresh
7. toast
```

The `bills` state at step 3 is from the last full load — it contains all non-deleted bills as of the page load / last refetch. For the idempotency check (has someone pre-created next month's bill?), this is sufficient:
- Pre-created bills from the current session are in state
- Pre-created bills from other sessions are in state (loaded at page load)
- The only blind spot: a bill created by another tab between page load and Mark Paid — acceptable for a single-user app

**For the double-tap case**: The `isSaving` guard (line 448: `setIsSaving(true)`) prevents concurrent execution of `handleMarkPaidSubmit`, so double-tap creates at most one recurrence bill.

**Function signature**:
```typescript
export async function createNextRecurrenceBill(
  accessToken: string,
  spreadsheetId: string,
  paidBill: Bill,
  billType: BillType | BillTypeWithProperty,
  allBills: BillWithDisplay[],
): Promise<Bill | null>
```

The `allBills` parameter accepts `BillWithDisplay[]` because that's what `checkDuplicate` expects (line 193 of billsService.ts: `checkDuplicate(compositeKey: string, bills: BillWithDisplay[], ...)`).

---

## R-004: Chunk Breakdown

**Decision**: Confirmed 2 chunks. Refined task list below.

**Chunk 1: Core Recurrence (service layer + handler integration)**

| Task | File | What |
|------|------|------|
| C1-T1 | `billsService.ts` | Add `frequencyToInterval` helper mapping |
| C1-T2 | `billsService.ts` | Add `createNextRecurrenceBill` function |
| C1-T3 | `BillsPage.tsx` | Restructure `handleMarkPaidSubmit` — add recurrence call after calendar cleanup |
| C1-T4 | `BillsPage.tsx` | Add activity log entry for `bill_added` on recurrence |
| C1-T5 | `BillsPage.tsx` | Add toast messages (recurrence success, idempotency skip, error) |
| C1-T6 | `BillsPage.tsx` | Add error handling per FR-016 (recurrence failure doesn't roll back mark paid) |

**Chunk 2: Calendar Reminders on Auto-Created Bill + Testing**

| Task | File | What |
|------|------|------|
| C2-T1 | `BillsPage.tsx` | Add calendar reminder creation on new bill (createReminders + refetch + setCalendarEventIds) |
| C2-T2 | `BillsPage.tsx` | Add calendar failure handling (FR-023 secondary error toast) |
| C2-T3 | Manual | Test: monthly bill mark paid → verify next bill created |
| C2-T4 | Manual | Test: quarterly and annual frequency intervals |
| C2-T5 | Manual | Test: one-time frequency → no recurrence |
| C2-T6 | Manual | Test: idempotency — pre-create next month, then mark paid |
| C2-T7 | Manual | Test: month-end clamping (Jan 31 → Feb 28) |
| C2-T8 | `npm run build` | Verify no type errors |

**Rationale for 2 chunks instead of 1**: Chunk 1 delivers the complete core feature (recurrence on mark paid) and can be tested independently. Chunk 2 adds calendar integration which depends on the core being correct and is best-effort per the architecture.

---

## R-005: computeNextDueDate Signature and anchorDay

**Question**: Does `computeNextDueDate` accept raw params or a recurrencePattern object? Do we need a synthetic pattern?

**Decision**: The function accepts raw params. No synthetic pattern object needed. Pass `billType.defaultDueDay` as the `anchorDay` parameter.

**Evidence — recurrencePatternsService.ts lines 65–103**:
```typescript
export function computeNextDueDate(
  currentDueDate: string,   // YYYY-MM-DD
  intervalValue: number,     // 1, 3, etc.
  intervalUnit: string,      // 'months', 'years', etc.
  anchorDay: number | null,  // override day, or null to use day from currentDueDate
): string
```

For the `months` case (line 84–91):
```typescript
const targetDay = anchorDay ?? day;
const lastDay = new Date(targetYear, targetMon, 0).getDate();
const clampedDay = Math.min(targetDay, lastDay);
```

**Why `anchorDay = billType.defaultDueDay` (not `null`)**:

Consider the chain: Bill with defaultDueDay=31.
- Jan 31 → Feb: `anchorDay=31`, targetDay=31, lastDay=28 → Feb 28 (clamped)
- Feb 28 → Mar: If `anchorDay=null`, day=28 from Feb 28, targetDay=28 → Mar 28 (WRONG — lost the 31st intent)
- Feb 28 → Mar: If `anchorDay=31`, targetDay=31, lastDay=31 → Mar 31 (CORRECT — preserves the original day)

The spec's acceptance scenario 4 implies the chain should preserve the original day after clamping. Passing `billType.defaultDueDay` ensures this. This matches how the todo recurrence uses `pattern.anchorDay` (todosService.ts line 258):
```typescript
computeNextDueDate(completedTodo.dueDate, pattern.intervalValue, pattern.intervalUnit, pattern.anchorDay)
```

**Frequency-to-interval mapping (concrete)**:
```typescript
function frequencyToInterval(freq: Frequency): { intervalValue: number; intervalUnit: string } | null {
  switch (freq) {
    case 'monthly':   return { intervalValue: 1, intervalUnit: 'months' };
    case 'quarterly': return { intervalValue: 3, intervalUnit: 'months' };
    case 'annual':    return { intervalValue: 1, intervalUnit: 'years' };
    case 'one-time':  return null;
  }
}
```

Call site:
```typescript
const interval = frequencyToInterval(billType.frequency);
if (!interval) return null; // one-time
const nextDueDate = computeNextDueDate(paidBill.dueDate, interval.intervalValue, interval.intervalUnit, billType.defaultDueDay);
```

---

## R-006: Spec Minor Correction — postponedUntil Field

**Finding**: FR-008 in the spec references `postponedUntil` as a field to leave empty. The `Bill` interface has no `postponedUntil` field.

**Evidence**: `src/types/index.ts` lines 100–121 — the `Bill` interface fields are: `_rowIndex`, `id`, `billTypeId`, `month`, `amount`, `dueDate`, `originalDueDate`, `status`, `paidDate`, `paymentMethod`, `transactionRef`, `billFileIds`, `receiptFileIds`, `calendarEventIds`, `notes`, `createdAt`, `updatedAt`, `deletedAt`, `compositeKey`. No `postponedUntil`.

Postponement is handled by modifying `dueDate` directly and logging to the PostponeLog sheet (see `postponeBill` in billsService.ts). The reference in FR-008 is a spec error.

**Impact**: None. The implementation simply sets all the listed fields to empty strings. The `postponedUntil` reference is ignored — there is no such column to set.

---

## R-007: Month Derivation When defaultDueDay Is Null (FR-003)

**Question**: How to compute the next `month` field when no due date can be computed?

**Decision**: Use simple YYYY-MM arithmetic on the paid bill's `month` field. Do not use `computeNextDueDate` (which requires a valid date).

**Implementation**:
```typescript
// When billType.defaultDueDay is null, compute month from paid bill's month
function addMonthsToMonth(month: string, months: number): string {
  const [y, m] = month.split('-').map(Number);
  const total = (y * 12 + (m - 1)) + months;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, '0')}`;
}
```

For `annual` frequency, pass 12 months. This avoids a separate years path and keeps the logic simple.

**Edge case**: If the paid bill's `month` is empty (shouldn't happen for a bill being marked paid, but defensive), skip recurrence entirely.
