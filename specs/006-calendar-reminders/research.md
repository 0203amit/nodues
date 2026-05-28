# Research: Calendar Reminders for Bills

**Feature Branch**: `006-calendar-reminders`
**Date**: 2026-05-28

## R1: Google Calendar All-Day Event end.date Behavior

**Decision**: For a single-day all-day event, set `end.date` to the **day after** `start.date`.

**Rationale**: Google Calendar API v3 treats `end.date` as **exclusive** for all-day events. If `start.date = "2026-06-08"` and `end.date = "2026-06-08"`, the event has zero duration and may not render correctly. Setting `end.date = "2026-06-09"` creates a single-day all-day event that displays on June 8 only. This is confirmed by the Events resource documentation: "end.date — The date, in the format 'yyyy-mm-dd', if this is an all-day event" with the note that the end date is exclusive.

**Alternatives considered**:
- Same-day end.date (`start.date === end.date`): Creates a zero-duration event that may not display at all or render incorrectly across calendar clients.
- Using `dateTime` instead of `date`: Creates a timed event, not an all-day event — rejected since the app does not collect time-of-day information.

---

## R2: Reminder Notification Timing for All-Day Events

**Decision**: Use `reminders.useDefault: false` with `reminders.overrides: [{ method: 'popup', minutes: 0 }]`.

**Rationale**: For all-day events, the reminder `minutes` value is relative to midnight at the start of the event day. `minutes: 0` triggers a notification at midnight (00:00) on the event day. In practice:
- On Android, the notification appears in the notification tray and the user sees it when they first check their phone (typically 6-8 AM in India).
- On iOS, behavior is similar — the notification fires at midnight and surfaces when the device is next unlocked.
- Most Indian users have phones in DND mode overnight, so the notification surfaces at a reasonable morning hour.

**Tuning note**: If midnight notifications prove disruptive during testing on a real phone, the value can be changed to a single constant:
- `minutes: 360` = notification at 6 PM the evening before (6 hours before midnight)
- `minutes: 180` = notification at 9 PM the evening before (3 hours before midnight)
No code restructuring is needed — only the constant changes.

**Alternatives considered**:
- `useDefault: true` (delegate to user's Calendar settings): Rejected because the user might have reminders disabled for this calendar, leading to silently missing notifications.
- `minutes: 1440` (midnight the day before): Too early — a full-day-ahead reminder adds confusion when separate "N-1 days" events already exist.
- `minutes: 540` (3 PM the evening before): Reasonable but harder to reason about. Starting with `minutes: 0` and tuning post-testing is simpler.

---

## R3: Calendar Orchestration Layering

**Decision**: Calendar orchestration helper functions (`createReminders`, `cleanupReminders`) are defined in `billsService.ts`. They are called from `BillsPage` handlers **after** the primary bill Sheet write returns. The existing `addBill`/`updateBill`/`markBillPaid`/`softDeleteBill`/`undoDeleteBill` functions remain focused on Sheet operations only.

**Rationale**:
1. **Failure isolation**: The bill Sheet write has already committed by the time calendar functions are invoked. There is zero risk of a calendar error rolling back or corrupting a bill row.
2. **Context availability**: BillsPage handlers have direct access to `accessToken`, `setupResult.calendarId`, `billTypes` (for `reminderOffsetsDays`), and the bill's resolved `propertyName`/`billTypeName`. Passing these through `addBill` etc. would widen their signatures with unrelated calendar-specific parameters.
3. **Separation of concerns**: Sheet write functions (`addBill`, `updateBill`, etc.) have a clear, single responsibility. Calendar orchestration is a post-write side effect, not a primary data operation.
4. **In-memory refresh**: BillsPage handlers manage `setBills` state directly. After calendar ops update `calendarEventIds`, the handler updates the in-memory bill, so the Bell indicator refreshes without a full re-fetch.

**Why billsService.ts (not a separate file)**: The orchestration functions are bill-specific business logic. They compute reminder dates from bill data, format event titles with bill metadata, and manage the `calendarEventIds` column. A separate `reminderService.ts` would split bill-related logic across files for only 2-3 functions. Keeping them in `billsService.ts` alongside the event-ID helpers (`parseEventIds`, `serializeEventIds`, `setCalendarEventIds`) keeps the bill domain cohesive.

**Alternatives considered**:
- Embedding calendar ops inside `addBill`/`updateBill` etc.: Rejected — mixes Sheet and Calendar concerns, requires passing `calendarId` into Sheet functions, makes calendar failures harder to isolate from bill writes.
- Creating a separate `calendarReminderService.ts`: Viable but over-engineered for 2 orchestration functions that are tightly coupled to bill data and bill event-ID helpers.

---

## R4: Partial Failure Handling Strategy

**Decision**: The `createReminders` function creates events sequentially (one `createAllDayEvent` call per offset). It collects successfully created event IDs in an array. If any single creation fails, the error is caught, the already-created IDs are preserved, and the function returns the partial result with a boolean `allSucceeded` flag.

**Rationale**: Sequential creation is simple, predictable, and debuggable. For typical bill types (2-3 offsets), sequential calls add negligible latency (each API call is ~200-400ms). Preserving partial results ensures the user gets some reminders rather than none, and the partial IDs are stored in `calendarEventIds` for future cleanup.

**Alternatives considered**:
- `Promise.all`: Fails fast on first error, discarding all successfully created event IDs. Violates the partial-success requirement.
- `Promise.allSettled` with parallel calls: Creates events in parallel, then collects results. Viable but adds complexity for no meaningful performance gain with 2-3 events. Also makes the partial-success ordering harder to reason about.

---

## R5: parseEventIds / serializeEventIds Implementation

**Decision**: Export `parseEventIds` and `serializeEventIds` as aliases for the existing `parseFileIds` / `serializeFileIds` functions. The CSV format is identical (opaque string IDs separated by commas, with empty-segment/whitespace filtering).

**Rationale**: The parsing and serialization logic is the same: split on commas, trim, filter empty strings, join with commas. Using aliases (rather than duplicating) prevents drift and keeps the codebase DRY. Named exports make intent clear at call sites: `parseEventIds(bill.calendarEventIds)` reads better than `parseFileIds(bill.calendarEventIds)`.

**Alternatives considered**:
- Copy-paste the implementation: Introduces maintenance burden if parsing logic changes.
- Use `parseFileIds` directly for event IDs: Works but obscures intent — "file IDs" and "event IDs" are different domains.

---

## R6: Reminder Date Computation

**Decision**: Use JavaScript's `Date` constructor with component arguments: `new Date(year, month - 1, day - offsetDays)`. JavaScript auto-handles month/year rollover when the day value goes below 1. Extract year/month/day from the resulting Date and reformat to `YYYY-MM-DD`.

**Rationale**: JavaScript's Date constructor correctly handles all edge cases — month rollover (e.g., June 1 - 3 = May 29), year rollover (e.g., January 1 - 7 = December 25 of the prior year), and leap years. This is simpler and more reliable than manual arithmetic with modular day/month calculations.

**Implementation**:
```typescript
function computeReminderDate(dueDateStr: string, offsetDays: number): string {
  const [year, month, day] = dueDateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day - offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
```

**Alternatives considered**:
- Date library (date-fns, luxon): Adds a dependency for a single arithmetic operation.
- `Date.setDate(getDate() - offset)`: Equivalent but mutates the Date object; constructor approach is cleaner.
- UTC methods: Not needed since we only manipulate calendar dates (YYYY-MM-DD), not timestamps.

---

## R7: Due Date Formatting for Event Title

**Decision**: Add a pure helper `formatDueDate(dateStr: string): string` that converts `"2026-06-05"` to `"5 Jun 2026"`. Follows the same month-abbreviation table as the existing `formatMonth` helper.

**Rationale**: The spec requires event titles formatted as `{BillTypeName} — {PropertyName} due 5 Jun 2026`. The day is unpadded (no leading zero), the month is a 3-letter English abbreviation, and the year is 4 digits. This matches common Indian date formatting conventions.

---

## R8: In-Memory Bill State Refresh After Calendar Ops

**Decision**: After calendar operations, update the bill's `calendarEventIds` in BillsPage's `setBills` state using the same in-memory map pattern already used by `handleBillUpdated` (from the attachments feature). For `addBill`, modify `refetchBills` to return the fresh bill list so the handler can locate the newly added bill by ID.

**Rationale**: The `handleBillUpdated` pattern (`setBills(prev => prev.map(b => b.id === updatedBill.id ? { ...b, ...updatedBill } : b))`) already exists and is proven. Reusing it for calendar updates keeps the codebase consistent. Returning the bill list from `refetchBills` solves the React state closure issue (stale `bills` reference inside the handler).

---

## R9: Delete/Undo Calendar Flow

**Decision**:
- **Delete**: After `softDeleteBill`, call `cleanupReminders` to delete events from Google Calendar. Do NOT call `setCalendarEventIds` to clear the IDs in the sheet — the bill is soft-deleted and won't appear in the UI. Stale event IDs are harmless.
- **Undo**: After `undoDeleteBill`, call `createReminders` to recreate events, then `setCalendarEventIds` to store the new IDs.

**Rationale**: `softDeleteBill` uses `updateCell` to set `deleted_at`. If we subsequently called `setCalendarEventIds` (which does a full-row write using the pre-delete `bill` object with `deletedAt = ''`), it would overwrite the `deleted_at` that was just set, effectively un-deleting the bill. Avoiding the `setCalendarEventIds` call on delete sidesteps this race condition entirely. The stale event IDs are cleaned up on undo (replaced with new IDs) or remain inert if the 10-second undo window expires.

**Alternatives considered**:
- Clearing `calendarEventIds` before soft-delete: Adds an extra Sheet write before the delete. Complicates the flow for no user-visible benefit.
- Using `updateCell` to clear just the `calendarEventIds` column: Viable but inconsistent with the full-row-safety pattern used everywhere else. The stale-IDs-are-harmless approach is simpler.
