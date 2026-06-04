# Tasks: Bills Recurrence

**Feature**: Bills Recurrence (Phase 15)
**Branch**: `015-bills-recurrence`
**Generated**: 2026-06-04

---

## Chunk 1: Core Recurrence (service layer + handler integration)

**Goal**: Mark Paid on a recurring bill auto-creates the next bill instance. One-time bills unchanged. Idempotency guard works. No calendar reminders yet on the new bill.

### T001: Add `frequencyToInterval` to `src/services/billsService.ts`

**File**: `src/services/billsService.ts`
**FR**: FR-002, DD-006

Add a new exported pure function `frequencyToInterval` that maps `Frequency` values to `computeNextDueDate` parameters. ~10 lines.

```typescript
export function frequencyToInterval(freq: Frequency): { intervalValue: number; intervalUnit: string } | null {
  switch (freq) {
    case 'monthly':   return { intervalValue: 1, intervalUnit: 'months' };
    case 'quarterly': return { intervalValue: 3, intervalUnit: 'months' };
    case 'annual':    return { intervalValue: 1, intervalUnit: 'years' };
    case 'one-time':  return null;
  }
}
```

Import `Frequency` from `../types` (add to existing type import line).

**Before**: `billsService.ts` exports: `computeDisplayStatus`, `computeDueDate`, `computeCompositeKey`, `formatMonth`, `formatCurrency`, `checkDuplicate`, `fetchBills`, `addBill`, `updateBill`, `markBillPaid`, `deleteBill`, `restoreBill`, `setCalendarEventIds`. No frequency mapping.
**After**: `billsService.ts` additionally exports `frequencyToInterval(freq: Frequency)`.

**Done when**: `npm run build` compiles. `frequencyToInterval` is importable from `billsService`. Returns correct interval for monthly/quarterly/annual, null for one-time.

---

### T002: Add `createNextRecurrenceBill` to `src/services/billsService.ts`

**File**: `src/services/billsService.ts`
**FR**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011

Add a new exported async function `createNextRecurrenceBill`. ~50 lines. This is the core recurrence logic.

**Signature**:
```typescript
export async function createNextRecurrenceBill(
  accessToken: string,
  spreadsheetId: string,
  paidBill: Bill,
  billType: BillType | BillTypeWithProperty,
  allBills: BillWithDisplay[],
): Promise<Bill | null>
```

**Logic** (in order):
1. Call `frequencyToInterval(billType.frequency)` — return `null` if one-time.
2. Compute next due date:
   - If `paidBill.dueDate` is non-empty: call `computeNextDueDate(paidBill.dueDate, interval.intervalValue, interval.intervalUnit, billType.defaultDueDay)` — pass `billType.defaultDueDay` as `anchorDay` (R-005: preserves day intent across month-end clamping).
   - If `paidBill.dueDate` is empty: next due date = `''`.
3. Derive `month` (YYYY-MM):
   - If next due date was computed: extract `YYYY-MM` from it (slice first 7 chars).
   - If no next due date: add interval months to `paidBill.month` using simple arithmetic (monthly=1, quarterly=3, annual=12 months). Use an inline `addMonthsToMonth` helper (R-007).
4. Compute `compositeKey` via `computeCompositeKey(billType.propertyId, billType.id, newMonth)`.
5. Idempotency check: `checkDuplicate(compositeKey, allBills)` — if duplicate exists, return `null`.
6. Build `Bill` object per data-model.md field mapping:
   - `id`: `uuidv4()`
   - `billTypeId`: `paidBill.billTypeId`
   - `month`: computed above
   - `amount`: `billType.defaultAmount` (may be null)
   - `dueDate` + `originalDueDate`: computed next due date (or `''`)
   - `status`: `'pending'` if dueDate computed, `'not_yet_generated'` if no dueDate
   - `paidDate`, `paymentMethod`, `transactionRef`, `billFileIds`, `receiptFileIds`, `calendarEventIds`, `notes`: `''`
   - `createdAt` + `updatedAt`: `new Date().toISOString()`
   - `deletedAt`: `''`
   - `compositeKey`: computed above
   - `_rowIndex`: `-1` (not yet persisted)
7. `serializeRow(bill)` + `appendRows(accessToken, spreadsheetId, TAB_NAME, [serialized])` to write.
8. Return the new `Bill`.

**New import**: `computeNextDueDate` from `../services/recurrencePatternsService`. Add `BillType` to the types import if not already present.

**Before**: `billsService.ts` has `addBill` for manual bill creation. No recurrence-aware creation.
**After**: `billsService.ts` additionally exports `createNextRecurrenceBill` that computes next due date, checks idempotency, builds bill, and appends row.

**Done when**: `npm run build` compiles. `createNextRecurrenceBill` is importable. The function uses existing `computeNextDueDate`, `computeCompositeKey`, `checkDuplicate`, `serializeRow`, `appendRows` — no new dependencies beyond `computeNextDueDate`.

---

### T003: Restructure `handleMarkPaidSubmit` in `src/pages/BillsPage.tsx`

**File**: `src/pages/BillsPage.tsx`
**FR**: FR-012, FR-013, FR-016, FR-017, FR-018 (bill_paid ordering), FR-019

Restructure the `handleMarkPaidSubmit` function (currently lines ~446–488) to:

1. **Move `bill_paid` activity log BEFORE recurrence block** (FR-018: never rolled back even if recurrence fails).
2. **Add recurrence try/catch block** after calendar cleanup and activity log.
3. **Add import** for `createNextRecurrenceBill` from `../services/billsService` (add to existing billsService import).
4. **Resolve billType** from `billTypes` state: `const billType = billTypes.find(bt => bt.id === markPaidTarget.billTypeId)`.
5. **Guard on frequency**: only enter recurrence block if `billType && billType.frequency !== 'one-time'`.
6. **Call `createNextRecurrenceBill`** with `(accessToken!, spreadsheetId, paidBill, billType, bills)` — pass `bills` React state as `allBills` (R-003: no extra fetch).
7. **Ensure `refetchBills()`** is called as the LAST step regardless of recurrence outcome.

**New handler flow** (changes in bold):
```
1. markBillPaid(existingBill, data)             ← critical path (existing)
2. Calendar cleanup on paid bill                ← best-effort (existing)
3. appendActivityLogSafe(bill_paid)             ← MOVED earlier, before recurrence
4. if (billType.frequency !== 'one-time'):
   a. try { createNextRecurrenceBill(...) }
   b. if newBill: [toast + activity log — see T004, T005]
   c. if null: idempotency skip — no action
   d. catch: [error toast — see T004]
5. refetchBills()                               ← final refresh (moved to end)
6. Close modal
7. Show appropriate toast (if not already shown by recurrence)
```

**Before**: `handleMarkPaidSubmit` calls markBillPaid → calendar cleanup → refetchBills → close modal → activity log → toast. No recurrence logic. Activity log is after refetchBills.
**After**: `handleMarkPaidSubmit` calls markBillPaid → calendar cleanup → activity log (moved up) → recurrence block (new) → refetchBills (moved to end) → close modal → toast. Recurrence is wrapped in its own try/catch so mark-paid is never rolled back.

**Done when**: `npm run build` compiles. The handler calls `createNextRecurrenceBill` for non-one-time frequencies. Mark paid succeeds independently of recurrence outcome. `bill_paid` activity log is always written before recurrence is attempted.

---

### T004: Add recurrence toast messages in `src/pages/BillsPage.tsx`

**File**: `src/pages/BillsPage.tsx`
**FR**: FR-014b, FR-015, FR-016

Add toast messages for the three recurrence outcomes inside `handleMarkPaidSubmit`:

1. **Recurrence success** (FR-014b): `showToast(\`Next ${billTypeName} bill created for ${formatMonth(newBill.month)}.\`, 'success')` — shown instead of the generic "Bill marked as paid." toast.
2. **Idempotency skip** (FR-015): Show the existing `'Bill marked as paid.'` toast (no recurrence message). This is the default toast when `createNextRecurrenceBill` returns `null`.
3. **Recurrence error** (FR-016): `showToast("Bill marked paid, but couldn't auto-create next bill. Try again or add manually.", 'error')` — shown when the recurrence try/catch catches an error. The mark-paid itself is NOT rolled back.

The `billTypeName` for the success toast comes from `markPaidTarget.billTypeName` (already available on the `BillWithDisplay` target) or from the resolved `billType.name`.

**Before**: `handleMarkPaidSubmit` shows only two toasts: "Bill marked as paid." (success) or "Failed to mark bill as paid." (error).
**After**: Three additional toast paths for recurrence success, idempotency skip (existing message), and recurrence error.

**Done when**: `npm run build` compiles. Success toast includes bill type name and target month. Error toast communicates that mark-paid succeeded but recurrence failed. Idempotency skip shows generic paid toast.

---

### T005: Add `bill_added` activity log entry on recurrence in `src/pages/BillsPage.tsx`

**File**: `src/pages/BillsPage.tsx`
**FR**: FR-014a, FR-018

Inside the recurrence success block (when `createNextRecurrenceBill` returns a non-null `newBill`), write a second `appendActivityLogSafe` entry:

```typescript
await appendActivityLogSafe(accessToken!, spreadsheetId, {
  id: uuidv4(),
  timestamp: new Date().toISOString(),
  userEmail: 'user',
  action: 'bill_added',
  entityType: 'bill',
  entityId: newBill.id,
  summary: `Bill auto-created from recurrence: ${markPaidTarget.billTypeName} — ${markPaidTarget.propertyName} ${formatMonth(newBill.month)}`,
});
```

This is the SECOND activity log entry (after `bill_paid` which was already written in T003). The summary format matches FR-018: "Bill auto-created from recurrence: {billTypeName} — {propertyName} {formattedMonth}".

**Before**: `handleMarkPaidSubmit` writes one activity log entry: `bill_paid`.
**After**: On successful recurrence, a second `bill_added` entry is written with the auto-creation summary. On one-time bills or idempotency skip, only `bill_paid` is written (no change from current behavior).

**Done when**: `npm run build` compiles. Two activity log entries are written on recurring mark-paid. One entry on one-time mark-paid.

---

### T006: Chunk 1 build verification

**Action**: Run `npm run build`. Verify clean compile with zero errors.

**FR**: All Chunk 1 FRs (FR-001 through FR-019)

**Manual smoke test**:
- [ ] Mark a monthly bill as paid → verify next month's bill appears in the list with correct month, due date, amount, status=pending
- [ ] Verify toast: "Next {name} bill created for {month}."
- [ ] Verify Sheet: new row in Bills tab with correct composite key, empty payment/attachment fields
- [ ] Mark a one-time bill as paid → verify NO new bill created, toast says "Bill marked as paid."
- [ ] Verify Activity Log page: `bill_paid` + `bill_added` entries for the recurring bill; only `bill_paid` for the one-time bill

**Done when**: `npm run build` passes with zero errors. All smoke test scenarios pass. No calendar reminders on auto-created bills yet (that's Chunk 2).

---

## Chunk 2: Calendar Reminders on Auto-Created Bill + Manual E2E Tests

**Goal**: Auto-created bills get calendar reminders (best-effort). All manual E2E tests pass. Clean build.

### T007: Add calendar reminder creation on auto-created bill in `src/pages/BillsPage.tsx`

**File**: `src/pages/BillsPage.tsx`
**FR**: FR-020, FR-021, FR-022

Inside the recurrence success block (after `bill_added` activity log from T005), add calendar reminder creation mirroring the existing `saveNewBill` pattern (lines ~271–326):

1. **Guard**: Only attempt if `newBill.dueDate` is non-empty AND `billType.reminderOffsetsDays.length > 0`.
2. **Build reminder title** (FR-021): `\`${billType.name} — ${propertyName} due ${formatDueDate(newBill.dueDate)}\`` — matches the existing bill reminder format in `saveNewBill`.
3. **Call `createReminders`**: `createReminders(accessToken!, calendarId, newBill.dueDate, billType.reminderOffsetsDays, title, description)`.
4. **Refetch to get `_rowIndex`**: `const freshBills = await refetchBills()` — needed because `appendRows` returns `_rowIndex: -1`.
5. **Find fresh bill by ID**: `const freshBill = freshBills.find(b => b.id === newBill.id)`.
6. **Persist event IDs**: `await setCalendarEventIds(accessToken!, spreadsheetId, freshBill, result.eventIds)` — writes calendar event IDs to the Sheet row.

This is the 3-API-call calendar pattern (R-001): append → refetch → updateRow. It matches `saveNewBill` and `handleMarkDoneSubmit` in TodosPage.

**Import**: `formatDueDate` from `../services/calendarReminders` (may already be imported — verify).

**Before**: Auto-created bills from recurrence have empty `calendarEventIds`. No calendar events created.
**After**: Auto-created bills get calendar reminder events if the BillType has `reminderOffsetsDays` and the bill has a due date. Event IDs are persisted to the Sheet.

**Done when**: `npm run build` compiles. Calendar events are created for auto-created bills with configured reminder offsets.

---

### T008: Add calendar failure handling in `src/pages/BillsPage.tsx`

**File**: `src/pages/BillsPage.tsx`
**FR**: FR-023

Wrap the calendar reminder block from T007 in a **nested try/catch** inside the recurrence try block. This ensures:

1. **Bill creation is preserved**: If calendar API fails, the auto-created bill still exists (it was already appended in `createNextRecurrenceBill`).
2. **Secondary error toast** (FR-023): On catch, show `showToast("Bill marked paid, but reminders couldn't be set for the next bill.", 'error')`.
3. **No re-throw**: The calendar error is swallowed — it doesn't propagate to the outer recurrence try/catch.

**Error handling nesting**:
```
try {                                         // outer: recurrence
  const newBill = await createNextRecurrenceBill(...)
  if (newBill) {
    appendActivityLogSafe(bill_added)          // never throws
    try {                                      // inner: calendar (best-effort)
      if (dueDate && reminderOffsets.length) {
        createReminders(...)
        refetchBills()
        setCalendarEventIds(...)
      }
    } catch {
      showToast("...reminders couldn't be set...", 'error')
    }
    showToast("Next {name} bill created for {month}.", 'success')
  }
} catch {                                      // outer catch: recurrence failed
  showToast("Bill marked paid, but couldn't auto-create...", 'error')
}
```

**Before**: No calendar error handling for recurrence (calendar code doesn't exist yet pre-T007).
**After**: Calendar failure on auto-created bill shows a secondary error toast but does NOT prevent the bill from being created or the mark-paid from succeeding.

**Done when**: `npm run build` compiles. Calendar failure does not roll back bill creation. Secondary error toast is shown.

---

### T009: Chunk 2 build verification

**Action**: Run `npm run build`. Verify clean compile with zero errors.

**FR**: FR-020, FR-021, FR-022, FR-023

**Done when**: `npm run build` passes with zero errors. All Chunk 1 + Chunk 2 code compiles cleanly.

---

### T010: Manual test — monthly, quarterly, and annual recurrence

**Action**: Manual E2E test in browser.

**FR**: SC-001, SC-002, SC-003

**Test steps**:
1. [ ] **Monthly**: Mark a monthly bill (e.g., "Electricity", due 2026-06-15) as paid → verify next bill appears with month=2026-07, dueDate=2026-07-15, amount=defaultAmount, status=pending
2. [ ] **Quarterly**: Mark a quarterly bill (e.g., "Society Maintenance", due 2026-04-10) as paid → verify next bill has month=2026-07, dueDate=2026-07-10
3. [ ] **Annual**: Mark an annual bill (e.g., "Property Tax", due 2026-01-31) as paid → verify next bill has month=2027-01, dueDate=2027-01-31
4. [ ] Verify all new bills have correct composite keys in the Sheet
5. [ ] Verify toast messages include bill type name and target month
6. [ ] Verify two activity log entries per recurrence (bill_paid + bill_added)

**Done when**: All monthly, quarterly, and annual recurrence scenarios produce correct next bills with expected due dates, amounts, and status.

---

### T011: Manual test — one-time skip, idempotency, and month-end clamping

**Action**: Manual E2E test in browser.

**FR**: SC-004, SC-005, SC-006

**Test steps**:
1. [ ] **One-time skip** (SC-005): Mark a one-time bill as paid → verify NO new bill created, toast says "Bill marked as paid.", only one activity log entry (bill_paid)
2. [ ] **Idempotency** (SC-006): Pre-create next month's bill manually (same BillType + Property + target month), then mark this month's bill as paid → verify no duplicate created, toast says "Bill marked as paid."
3. [ ] **Month-end clamping** (SC-004): Set up a monthly bill with defaultDueDay=31 and dueDate=2026-01-31. Mark paid → verify next bill has dueDate=2026-02-28 (clamped to Feb). Verify in Sheet.
4. [ ] **Amount from BillType**: Override paid amount to 2000 on a bill with defaultAmount=1500. Mark paid → verify next bill has amount=1500 (uses BillType.defaultAmount, not paid amount)

**Done when**: One-time bills produce no recurrence. Idempotency prevents duplicates. Month-end clamping works correctly. Amount is sourced from BillType.defaultAmount.

---

### T012: Manual test — calendar reminders on auto-created bill

**Action**: Manual E2E test in browser.

**FR**: SC-010, FR-020, FR-021, FR-022, FR-023

**Test steps**:
1. [ ] **Reminders created**: Set up a BillType with reminderOffsetsDays=[3,1] and frequency=monthly. Mark a bill as paid → verify the auto-created next bill gets calendar events at (dueDate - 3 days) and (dueDate - 1 day)
2. [ ] **Event IDs persisted**: Check the Bills Sheet — the auto-created bill's `calendarEventIds` column should contain the event IDs
3. [ ] **No reminders when empty offsets**: Mark paid on a BillType with empty reminderOffsetsDays → verify no calendar events created, calendarEventIds remains empty
4. [ ] **No reminders when no dueDate**: Mark paid on a BillType with defaultDueDay=null → verify no calendar events attempted, bill created with status=not_yet_generated
5. [ ] **Final `npm run build`**: Clean compile with zero errors

**Done when**: Calendar reminders are created correctly for auto-created bills. No reminders when offsets are empty or due date is missing. Build passes. Complete feature is working end-to-end.
