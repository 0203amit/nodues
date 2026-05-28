# Quickstart: Calendar Reminders for Bills

**Feature Branch**: `006-calendar-reminders`
**Date**: 2026-05-28

## What This Feature Does

When a bill has a due date, the system automatically creates all-day Google Calendar events on the "NoDues Reminders" calendar as reminders. Events are created N days before the due date, where N comes from the bill type's `reminderOffsetsDays` (e.g., `[7, 3, 1]` creates events 7, 3, and 1 day before due). Events are managed as side effects of bill operations (add/edit/mark-paid/delete/undo).

## Architecture at a Glance

```
BillsPage Handler (orchestrator)
    │
    │  1. Bill write (always first, always succeeds)
    ├──▶ billsService.addBill / updateBill / markBillPaid / softDeleteBill
    │
    │  2. Calendar side-effect (best-effort, post-write)
    ├──▶ billsService.createReminders / cleanupReminders
    │       └──▶ calendarService.createAllDayEvent / deleteEvent
    │              └──▶ googleApi.withRetry(googleApiFetch)
    │
    │  3. Event ID persistence (best-effort)
    ├──▶ billsService.setCalendarEventIds
    │
    │  4. UI refresh
    └──▶ setBills (in-memory update for Bell indicator)
```

**Key invariant**: Step 1 always completes before steps 2-4. Calendar failures in steps 2-3 are caught and surfaced as toasts. The bill is never lost.

## Files to Modify

| File | Changes |
|------|---------|
| `src/services/calendarService.ts` | Add `createAllDayEvent`, `deleteEvent` |
| `src/services/billsService.ts` | Add event-ID helpers, date helpers, `setCalendarEventIds`, `createReminders`, `cleanupReminders` |
| `src/components/bills/BillCard.tsx` | Add Bell indicator icon |
| `src/pages/BillsPage.tsx` | Wire calendar side-effects into all bill handlers |

No new files. No type changes (Bill type already has `calendarEventIds`).

## Key Patterns

### 1. Calendar Event Creation

```typescript
// calendarService.ts
export async function createAllDayEvent(
  accessToken: string,
  calendarId: string,
  dateYYYYMMDD: string,
  title: string,
  description: string,
): Promise<string> {
  const nextDayStr = nextDay(dateYYYYMMDD); // exclusive end
  const event = await withRetry(() =>
    googleApiFetch<GoogleCalendarEvent>(
      accessToken,
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        body: {
          summary: title,
          description,
          start: { date: dateYYYYMMDD },
          end: { date: nextDayStr },     // exclusive: next day for single-day event
          reminders: {
            useDefault: false,
            overrides: [{ method: 'popup', minutes: 0 }],
          },
        },
      },
    ),
  );
  return event.id;
}
```

### 2. Event Deletion (404/410 tolerant)

```typescript
// calendarService.ts
export async function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  try {
    await withRetry(() =>
      googleApiFetch(
        accessToken,
        `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        { method: 'DELETE' },
      ),
    );
  } catch (error) {
    if (
      error instanceof GoogleApiRequestError &&
      (error.status === 404 || error.status === 410)
    ) {
      return; // already gone — success
    }
    throw error;
  }
}
```

### 3. Best-Effort Orchestration in BillsPage

```typescript
// BillsPage.tsx — inside saveNewBill handler (pattern for all handlers)
const newBill = await addBill(accessToken!, spreadsheetId, data, propertyId);
const freshBills = await refetchBills(); // returns BillWithDisplay[]

// Calendar side-effect (best-effort)
const billType = billTypes.find(bt => bt.id === data.billTypeId);
if (newBill.dueDate && billType && billType.reminderOffsetsDays.length > 0) {
  try {
    const result = await createReminders(
      accessToken!, calendarId,
      newBill.dueDate, billType.reminderOffsetsDays,
      billType.name, billType.propertyName,
      newBill.amount, newBill.month,
    );
    if (result.eventIds.length > 0) {
      const freshBill = freshBills.find(b => b.id === newBill.id);
      if (freshBill) {
        const updated = await setCalendarEventIds(
          accessToken!, spreadsheetId, freshBill, result.eventIds,
        );
        setBills(prev => prev.map(b =>
          b.id === updated.id ? { ...b, calendarEventIds: updated.calendarEventIds } : b
        ));
      }
    }
    if (!result.allSucceeded) {
      showToast('Bill saved, but some reminders couldn\'t be set.', 'error');
    }
  } catch {
    showToast('Bill saved, but reminders couldn\'t be set.', 'error');
  }
}
```

### 4. Bell Indicator on BillCard

```tsx
// BillCard.tsx — in the action buttons row, between Paperclip and Delete
{bill.calendarEventIds && (
  <span className="inline-flex items-center justify-center min-h-11 min-w-11 px-2 py-1">
    <Bell className="w-4 h-4 text-slate-400" aria-hidden="true" />
  </span>
)}
```

## Reminder Date Math

```typescript
function computeReminderDate(dueDateStr: string, offsetDays: number): string {
  const [year, month, day] = dueDateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day - offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
```

JavaScript's Date constructor handles month/year rollover automatically. No date libraries needed.

## Handler Decision Matrix

| Operation | Due Date Condition | Calendar Action |
|-----------|--------------------|-----------------|
| addBill | Has dueDate + offsets | createReminders → setCalendarEventIds |
| addBill | No dueDate or no offsets | None |
| updateBill | dueDate changed | cleanupReminders (old) → createReminders (new) → setCalendarEventIds |
| updateBill | dueDate removed | cleanupReminders → setCalendarEventIds([]) |
| updateBill | dueDate unchanged | None |
| markBillPaid | Has calendarEventIds | cleanupReminders → setCalendarEventIds([]) |
| softDeleteBill | Has calendarEventIds | cleanupReminders only (no sheet write for IDs) |
| undoDeleteBill | Has dueDate + offsets | createReminders → setCalendarEventIds |

## Testing Checklist

1. Add bill with due date 2026-06-15, bill type offsets [7,3,1] → verify 3 events on June 8, 12, 14
2. Edit bill to change due date to June 20 → old events gone, new events on June 13, 17, 19
3. Edit bill to remove due date → events deleted, calendarEventIds cleared
4. Edit bill without changing due date → no calendar ops
5. Mark bill as paid → events deleted, calendarEventIds cleared
6. Delete bill → events deleted; undo → events recreated
7. Add bill with no due date → no events created
8. Add bill with bill type with empty offsets → no events created
9. Simulate calendar API failure → bill still saved, toast shown
10. Verify Bell icon appears/disappears on BillCard as calendarEventIds changes
