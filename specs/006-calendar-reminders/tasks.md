# Task Breakdown: Calendar Reminders for Bills

**Branch**: `006-calendar-reminders` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

**Chunk 1 — Service Layer** (calendarService + billsService extensions)
**Chunk 2 — UI + Handler Wiring** (BillCard Bell indicator + BillsPage handlers)

---

## Chunk 1: Service Layer

### T1 · `createAllDayEvent` in calendarService.ts [P]

**File**: `src/services/calendarService.ts`

Add the `GoogleCalendarEvent` interface and `createAllDayEvent` function after `createCalendar`.

**Contract**: `contracts/calendarService-extensions.ts` — `createAllDayEvent`

**Implementation details**:

1. Add `GoogleCalendarEvent` interface: `{ id: string; summary: string; start: { date: string }; end: { date: string } }`.
2. Implement `createAllDayEvent(accessToken, calendarId, dateYYYYMMDD, title, description) → Promise<string>`.
3. Compute `nextDay` **inline** (parse YYYY-MM-DD → `new Date(y, m-1, d+1)` → reformat YYYY-MM-DD). This keeps calendarService independent of billsService.
4. **CRITICAL — end.date exclusivity**: `end.date` MUST be the day AFTER `start.date`. A single-day all-day event with `start.date = "2026-06-08"` needs `end.date = "2026-06-09"`. Without this, the event won't render in Google Calendar.
5. Request body:
   ```json
   {
     "summary": title,
     "description": description,
     "start": { "date": dateYYYYMMDD },
     "end": { "date": nextDayStr },
     "reminders": {
       "useDefault": false,
       "overrides": [{ "method": "popup", "minutes": 0 }]
     }
   }
   ```
6. Pattern: `withRetry(() => googleApiFetch<GoogleCalendarEvent>(accessToken, url, { method: 'POST', body }))` — same as `createCalendar`.
7. Return `event.id`.

**Verify**: Manual — create an all-day event via quickstart.md, confirm it appears in Google Calendar on the correct single day.

---

### T2 · `deleteEvent` in calendarService.ts [P]

**File**: `src/services/calendarService.ts`

Add `deleteEvent` after `createAllDayEvent`.

**Contract**: `contracts/calendarService-extensions.ts` — `deleteEvent`

**Implementation details**:

1. Implement `deleteEvent(accessToken, calendarId, eventId) → Promise<void>`.
2. URL: `` `${CALENDAR_API}/calendars/${calendarId}/events/${eventId}` ``
3. Use `withRetry(() => googleApiFetch(accessToken, url, { method: 'DELETE' }))` inside a try/catch.
4. **404/410 handling**: Catch `GoogleApiRequestError`. If `error.status === 404 || error.status === 410`, return silently (event already gone). Otherwise re-throw.
5. Import `GoogleApiRequestError` from `./googleApi`.
6. Returns `void` (204 No Content on success, already handled by `googleApiFetch`'s `response.status === 204` branch).

**Verify**: Manual — create an event, delete it, confirm it's gone. Delete again, confirm no error (404 → silent).

---

### T3 · Event ID aliases + pure date helpers in billsService.ts [P]

**File**: `src/services/billsService.ts`

Add under a new `// --- Calendar Helpers ---` section after the existing `parseFileIds`/`serializeFileIds`.

**Contract**: `contracts/billsService-extensions.ts` — sections 1 & 2

**Implementation details**:

1. **Aliases** — same CSV format as file IDs:
   ```ts
   export const parseEventIds = parseFileIds;
   export const serializeEventIds = serializeFileIds;
   ```

2. **`computeReminderDate(dueDateStr, offsetDays) → string`**:
   - Parse `dueDateStr` (YYYY-MM-DD) into `[year, month, day]`.
   - `new Date(year, month - 1, day - offsetDays)` — JS Date handles rollover automatically.
   - Reformat to YYYY-MM-DD with zero-padded month and day.
   - Pure, no side effects.

3. **`nextDay(dateStr) → string`**:
   - Parse YYYY-MM-DD into `[year, month, day]`.
   - `new Date(year, month - 1, day + 1)`.
   - Reformat to YYYY-MM-DD.

4. **`formatDueDate(dateStr) → string`**:
   - Parse YYYY-MM-DD into `[year, month, day]`.
   - Reuse the same `MONTHS` array from `formatMonth` (extract to module-level constant if not already).
   - Return `"{day} {MONTHS[month-1]} {year}"` (unpadded day, e.g., "5 Jun 2026").
   - Note: `formatMonth` already has a local `MONTHS` array. Extract it to a module-level `const MONTHS = [...]` and reuse in both `formatMonth` and `formatDueDate`.

**Verify**: Manual — call each function with edge cases (month rollover, year rollover, offset = 0).

---

### T4 · `setCalendarEventIds` in billsService.ts

**File**: `src/services/billsService.ts`

Add after the date helpers section.

**Contract**: `contracts/billsService-extensions.ts` — section 3

**Depends on**: T3 (uses `serializeEventIds`)

**Implementation details**:

1. Implement `setCalendarEventIds(accessToken, spreadsheetId, bill, eventIds) → Promise<Bill>`.
2. Full-row-safety pattern (mirrors `addFileIdToBill` exactly):
   ```ts
   const updatedBill: Bill = {
     ...bill,
     calendarEventIds: serializeEventIds(eventIds),
     updatedAt: new Date().toISOString(),
   };
   await updateRow(accessToken, spreadsheetId, TAB_NAME, bill._rowIndex, serializeRow(updatedBill));
   return updatedBill;
   ```
3. Pass `[]` to clear all event IDs (produces empty string via `serializeEventIds`).
4. **REQUIRES a valid `_rowIndex`** — caller must ensure the bill has been fetched (not the result of `addBill` which returns `_rowIndex = -1`).

**Verify**: Manual — set event IDs on a bill, read back from Sheet, confirm the value.

---

### T5 · `ReminderResult` + `createReminders` in billsService.ts

**File**: `src/services/billsService.ts`

Add after `setCalendarEventIds`.

**Contract**: `contracts/billsService-extensions.ts` — section 4, `ReminderResult` + `createReminders`

**Depends on**: T1 (`createAllDayEvent`), T3 (`computeReminderDate`, `formatDueDate`, `formatMonth`, `formatCurrency`)

**Implementation details**:

1. Add `ReminderResult` interface: `{ eventIds: string[]; allSucceeded: boolean }`.
2. Import `createAllDayEvent` from `./calendarService`.
3. Implement `createReminders(accessToken, calendarId, dueDate, reminderOffsetsDays, billTypeName, propertyName, amount, month) → Promise<ReminderResult>`.
4. If `reminderOffsetsDays` is empty → return `{ eventIds: [], allSucceeded: true }`.
5. Build title: `"{billTypeName} \u2014 {propertyName} due {formatDueDate(dueDate)}"` (em-dash).
6. Build description: `"Month: {formatMonth(month)}"` + optional `"\nAmount: {formatCurrency(amount)}"` if `amount !== null`.
7. For each offset (sequentially):
   - `reminderDate = computeReminderDate(dueDate, offset)`
   - Try `createAllDayEvent(accessToken, calendarId, reminderDate, title, description)`
   - On success: push event ID to `eventIds`.
   - On error: catch, set `allSucceeded = false`, continue to next offset.
8. Return `{ eventIds, allSucceeded }`.
9. **Partial-success aware**: if event 2 of 3 fails, events 1 and 3 (if they succeed) are still captured.

**Verify**: Manual — create reminders for a bill with 3 offsets, verify 3 events appear on the correct dates in Google Calendar.

---

### T6 · `cleanupReminders` in billsService.ts

**File**: `src/services/billsService.ts`

Add after `createReminders`.

**Contract**: `contracts/billsService-extensions.ts` — `cleanupReminders`

**Depends on**: T2 (`deleteEvent`)

**Implementation details**:

1. Import `deleteEvent` from `./calendarService`.
2. Implement `cleanupReminders(accessToken, calendarId, eventIds) → Promise<void>`.
3. For each event ID (sequentially):
   - Try `deleteEvent(accessToken, calendarId, eventId)`.
   - Catch any error — log it but **never throw**. Cleanup is best-effort.
4. Return void.
5. **Never throws** — all errors are swallowed. The 404/410 silencing already happens inside `deleteEvent` (T2), so the catch here is for unexpected errors only.

**Verify**: Manual — create reminders, then cleanup, confirm events are gone from calendar.

---

## Chunk 2: UI + Handler Wiring

### T7 · BillCard Bell indicator

**File**: `src/components/bills/BillCard.tsx`

**Depends on**: None (uses existing `bill.calendarEventIds` field)

**Reference**: `design-system/nodues/MASTER.md` — Section 6 (Icons: `Bell` for reminders, `w-4 h-4`, inherit color), Section 4 (touch targets: `min-h-11 min-w-11`).

**Implementation details**:

1. Import `Bell` from `lucide-react` (add to existing import).
2. In the action buttons row, **after** the Paperclip (attachments) button and **before** the Delete button, add:
   ```tsx
   {bill.calendarEventIds && (
     <span
       className="inline-flex items-center justify-center min-h-11 min-w-11 px-2 py-1"
       title="Calendar reminders set"
     >
       <Bell className="w-4 h-4 text-slate-400" aria-hidden="true" />
     </span>
   )}
   ```
3. **Passive indicator** — uses `<span>`, NOT `<button>`. No `onClick`, no `cursor-pointer`.
4. **Sizing**: `w-4 h-4` icon inside `min-h-11 min-w-11` container (matches action row item spacing from MASTER.md).
5. **Color**: `text-slate-400` — consistent with the Receipt icon and Paperclip icon styling in the existing BillCard.
6. **Accessibility**: `aria-hidden="true"` since it's a supplementary visual indicator. `title` provides hover tooltip.

**Verify**: Manual — add a bill with reminders, confirm bell appears. Add a bill without reminders, confirm no bell. Mark a bill paid (clearing events), confirm bell disappears.

---

### T8 · BillsPage prerequisites: `calendarId` + `refetchBills` return value

**File**: `src/pages/BillsPage.tsx`

**Depends on**: None (preparatory)

**Implementation details**:

1. **Extract `calendarId`** from `setupResult`:
   ```ts
   const calendarId = setupResult!.calendarId;
   ```
   Add after the existing `const folderId = setupResult!.folderId;` line.

2. **Modify `refetchBills` to return data**:
   ```ts
   async function refetchBills(): Promise<BillWithDisplay[]> {
     const billData = await fetchBills(accessToken!, spreadsheetId, billTypeMap);
     setBills(billData);
     return billData;
   }
   ```
   This allows handlers to find the freshly-added bill by ID (solves React state closure issue where `bills` in the handler is stale after `setBills`).

3. Add imports for calendar functions (prepare for T9–T12):
   ```ts
   import {
     // ... existing imports ...
     parseEventIds,
     createReminders,
     cleanupReminders,
     setCalendarEventIds,
   } from '../services/billsService';
   ```

**Verify**: Build succeeds, existing functionality unaffected.

---

### T9 · `saveNewBill` handler: calendar wiring (addBill)

**File**: `src/pages/BillsPage.tsx`

**Depends on**: T4 (`setCalendarEventIds`), T5 (`createReminders`), T8 (prerequisites)

**Implementation details**:

Rewrite `saveNewBill` to add calendar side-effects **after** the bill Sheet write:

1. `const newBill = await addBill(...)` — Sheet write (always first, always succeeds independently).
2. `const freshBills = await refetchBills()` — **REFETCH-before-calendar**: `addBill` returns `_rowIndex = -1` (unknown after `appendRows`). `setCalendarEventIds` needs a valid `_rowIndex` for `updateRow`. The refetch provides the correct index.
3. Find the bill type to get `reminderOffsetsDays`:
   ```ts
   const billType = billTypes.find(bt => bt.id === data.billTypeId);
   ```
4. If `newBill.dueDate && billType && billType.reminderOffsetsDays.length > 0`:
   - Try:
     - `const result = await createReminders(accessToken!, calendarId, newBill.dueDate, billType.reminderOffsetsDays, btInfo?.name ?? '', btInfo?.propertyName ?? '', parsedAmount, data.month)`
     - If `result.eventIds.length > 0`:
       - `const freshBill = freshBills.find(b => b.id === newBill.id)!`
       - `const updated = await setCalendarEventIds(accessToken!, spreadsheetId, freshBill, result.eventIds)`
       - `setBills(prev => prev.map(b => b.id === updated.id ? { ...b, calendarEventIds: updated.calendarEventIds } : b))`
     - If `!result.allSucceeded`:
       - `showToast('Bill saved, but some reminders couldn\'t be set.', 'error')` → skip the normal success toast.
   - Catch:
     - `showToast('Bill saved, but reminders couldn\'t be set.', 'error')` → skip the normal success toast.
5. If no calendar error occurred, show normal success toast: `showToast('Bill added.', 'success')`.

**Toast distinction**: The bill-success toast (`'Bill added.'`) is only shown if no calendar error toast was shown first. Use a `let calendarFailed = false` flag to gate it.

**Verify**: Manual — add a bill with due date and offsets, confirm events appear and bell shows. Add a bill without due date, confirm no events.

---

### T10 · `saveEditBill` handler: calendar wiring (updateBill)

**File**: `src/pages/BillsPage.tsx`

**Depends on**: T4 (`setCalendarEventIds`), T5 (`createReminders`), T6 (`cleanupReminders`), T8 (prerequisites)

**Implementation details**:

Rewrite `saveEditBill` to add calendar side-effects only when `dueDate` actually changed:

1. **Compare old vs new dueDate**: `const dueDateChanged = bill.dueDate !== data.dueDate`.
2. `const updatedBill = await updateBill(...)` — Sheet write (always first). `updatedBill` has valid `_rowIndex` (spreads from `existingBill`).
3. If `dueDateChanged`:
   - Try:
     - **Cleanup old events**: `const oldEventIds = parseEventIds(bill.calendarEventIds); if (oldEventIds.length > 0) await cleanupReminders(accessToken!, calendarId, oldEventIds);`
     - **If new date is not empty** (date changed, not removed):
       - Find bill type for offsets.
       - `const result = await createReminders(...)` with `data.dueDate`.
       - `const updated = await setCalendarEventIds(accessToken!, spreadsheetId, updatedBill, result.eventIds)`.
       - `setBills(prev => prev.map(b => b.id === updated.id ? { ...b, calendarEventIds: updated.calendarEventIds } : b))`.
       - If `!result.allSucceeded`: show partial warning toast.
     - **If new date is empty** (date removed → not_yet_generated):
       - `const updated = await setCalendarEventIds(accessToken!, spreadsheetId, updatedBill, [])`.
       - `setBills(prev => prev.map(b => b.id === updated.id ? { ...b, calendarEventIds: updated.calendarEventIds } : b))`.
   - Catch:
     - `showToast('Bill updated, but reminders couldn\'t be updated.', 'error')` → skip normal success toast.
4. If `!dueDateChanged`: **no calendar ops** — existing events left unchanged.
5. `await refetchBills()` — final refetch.

**Verify**: Manual — edit bill to change due date, confirm old events deleted + new events created. Edit without changing due date, confirm no calendar ops. Remove due date, confirm events deleted + IDs cleared.

---

### T11 · `handleMarkPaidSubmit` handler: calendar wiring (markBillPaid)

**File**: `src/pages/BillsPage.tsx`

**Depends on**: T4 (`setCalendarEventIds`), T6 (`cleanupReminders`), T8 (prerequisites)

**Implementation details**:

Add calendar cleanup **after** the bill Sheet write in `handleMarkPaidSubmit`:

1. `const paidBill = await markBillPaid(...)` — Sheet write (always first).
2. If `markPaidTarget.calendarEventIds`:
   - Try:
     - `await cleanupReminders(accessToken!, calendarId, parseEventIds(markPaidTarget.calendarEventIds))`
     - `await setCalendarEventIds(accessToken!, spreadsheetId, paidBill, [])` — clear IDs in Sheet.
   - Catch:
     - `showToast('Bill marked paid, but calendar reminders couldn\'t be removed.', 'error')` → skip normal success toast.
3. `await refetchBills()`.

**Verify**: Manual — mark a bill with reminders as paid, confirm events deleted from calendar and IDs cleared in Sheet.

---

### T12 · `handleDeleteConfirm` + undo callback: calendar wiring (softDelete + undoDelete)

**File**: `src/pages/BillsPage.tsx`

**Depends on**: T5 (`createReminders`), T6 (`cleanupReminders`), T8 (prerequisites)

**Implementation details**:

#### Delete path (`handleDeleteConfirm`):

1. After `await softDeleteBill(...)`:
2. If `bill.calendarEventIds`:
   - Try: `await cleanupReminders(accessToken!, calendarId, parseEventIds(bill.calendarEventIds))`
   - Catch: `showToast('Bill deleted, but calendar reminders couldn\'t be removed.', 'error')`
3. **WARNING — SOFT-DELETE must NOT call `setCalendarEventIds`**: `softDeleteBill` uses `updateCell` on `deleted_at`. A full-row `setCalendarEventIds` with the pre-delete bill object (where `deletedAt = ''`) would overwrite `deleted_at` and **un-delete the bill**. On delete: only `cleanupReminders` (delete the calendar events). Leave stale event IDs in the row — they are harmless for a deleted bill.

#### Undo path (undo callback inside `showUndo`):

1. After `await undoDeleteBill(...)`:
2. Resolve bill type: `const billType = billTypes.find(bt => bt.id === bill.billTypeId)`.
3. If `bill.dueDate && billType && billType.reminderOffsetsDays.length > 0`:
   - `let restoredBill: Bill = bill;`
   - Try:
     - `const result = await createReminders(accessToken!, calendarId, bill.dueDate, billType.reminderOffsetsDays, bill.billTypeName, bill.propertyName, bill.amount, bill.month)`
     - If `result.eventIds.length > 0`:
       - `restoredBill = await setCalendarEventIds(accessToken!, spreadsheetId, bill, result.eventIds)`
     - If `!result.allSucceeded`:
       - `showToast('Bill restored, but some reminders couldn\'t be recreated.', 'error')`
   - Catch:
     - `showToast('Bill restored, but reminders couldn\'t be recreated.', 'error')`
4. **Re-enrich before splicing back** into `bills` state:
   ```ts
   setBills(prev => {
     const next = [...prev];
     next.splice(originalIndex, 0, {
       ...restoredBill,
       billTypeName: bill.billTypeName,
       propertyName: bill.propertyName,
       propertyId: bill.propertyId,
       displayStatus: bill.displayStatus,
     });
     return next;
   });
   ```
   The display fields (`billTypeName`, `propertyName`, `propertyId`, `displayStatus`) are not on the base `Bill` — they must be re-attached from the original `bill` (which is a `BillWithDisplay`).

**Verify**: Manual — delete a bill with reminders, confirm events deleted. Undo, confirm events recreated and bell reappears.

---

### T13 · Validation pass

**Depends on**: T1–T12 all complete

**Implementation details**:

1. **TypeScript build**: `npm run build` — verify zero errors.
2. **Lint**: `npm run lint` — verify zero warnings/errors.
3. **Manual smoke test** (per quickstart.md):
   - Add a bill with due date + offsets → events appear on calendar, bell shows.
   - Edit to change due date → old events gone, new events on correct dates.
   - Edit without changing due date → no calendar ops.
   - Remove due date → events deleted, bell gone.
   - Mark paid → events deleted, bell gone.
   - Delete → events deleted. Undo → events recreated, bell reappears.
   - Add a bill with no due date → no events, no bell.
   - Add a bill with due date but no offsets → no events, no bell.

---

## Parallelism Summary

| Task | Parallel? | Depends on |
|------|-----------|------------|
| T1 | [P] | — |
| T2 | [P] | — |
| T3 | [P] | — |
| T4 | | T3 |
| T5 | | T1, T3 |
| T6 | | T2 |
| T7 | [P] | — |
| T8 | | — |
| T9 | | T4, T5, T8 |
| T10 | | T4, T5, T6, T8 |
| T11 | | T4, T6, T8 |
| T12 | | T5, T6, T8 |
| T13 | | T1–T12 |
