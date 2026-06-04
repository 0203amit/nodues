# Quickstart: Bills Recurrence

**Feature**: Bills Recurrence (Phase 15)
**Date**: 2026-06-04

---

## Prerequisites

- Node.js 18+, npm
- Phases 1-13 complete (all bill CRUD, calendar reminders, activity log)
- Branch: `015-bills-recurrence`
- At least one BillType with `frequency` set to `monthly`, `quarterly`, or `annual` (for testing)
- At least one pending bill for that BillType (for testing mark paid)

## Dev Server

```bash
npm run dev
```

## Build Check

```bash
npm run build
```

---

## Implementation Order

### Chunk 1: Core Recurrence

1. **billsService.ts** — Add `frequencyToInterval` helper and `createNextRecurrenceBill` function
2. **BillsPage.tsx** — Restructure `handleMarkPaidSubmit` to call recurrence after mark paid
3. **Build check** — `npm run build`

### Chunk 2: Calendar Reminders + Testing

1. **BillsPage.tsx** — Add calendar reminder creation on auto-created bill
2. **Manual testing** — All scenarios below
3. **Build check** — `npm run build`

---

## Testing Checklist

### Core Recurrence (Chunk 1)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| T001 | Monthly recurrence | Create a BillType with frequency=monthly, defaultAmount=1500, defaultDueDay=15. Add a bill for Jun 2026. Mark it paid | New bill appears: month=2026-07, dueDate=2026-07-15, amount=1500, status=pending. Toast: "Next {name} bill created for Jul 2026" |
| T002 | Quarterly recurrence | BillType frequency=quarterly, defaultDueDay=10. Bill for Apr 2026. Mark paid | New bill: month=2026-07, dueDate=2026-07-10 |
| T003 | Annual recurrence | BillType frequency=annual, defaultDueDay=31. Bill for Jan 2026. Mark paid | New bill: month=2027-01, dueDate=2027-01-31 |
| T004 | One-time — no recurrence | BillType frequency=one-time. Bill for Jun 2026. Mark paid | No new bill created. Toast: "Bill marked as paid." (existing message) |
| T005 | Idempotency guard | BillType frequency=monthly. Add bills for Jun and Jul 2026. Mark Jun paid | No duplicate Jul bill. Toast: "Bill marked as paid." |
| T006 | Month-end clamping | BillType frequency=monthly, defaultDueDay=31. Bill for Jan 2026, dueDate=2026-01-31. Mark paid | New bill: dueDate=2026-02-28 (Feb has 28 days) |
| T007 | Default amount null | BillType defaultAmount=null. Mark paid | New bill: amount=null (empty in Sheet) |
| T008 | Default due day null | BillType defaultDueDay=null. Mark paid | New bill: dueDate='', status='not_yet_generated' |
| T009 | Activity log entries | Mark a monthly bill paid. Check Activity Log page | Two entries: `bill_paid` + `bill_added` with recurrence summary |
| T010 | Error resilience | (Hard to simulate) If recurrence fails, mark paid should still succeed | Paid transition preserved, error toast shown |

### Calendar Reminders (Chunk 2)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| T011 | Reminders created | BillType with reminderOffsetsDays=[3,1], frequency=monthly. Mark bill paid | New bill gets calendar events 3 and 1 days before due date |
| T012 | No reminder offsets | BillType with empty reminderOffsetsDays. Mark paid | New bill created, no calendar events attempted |
| T013 | Calendar failure | Revoke calendar access, mark paid | New bill still created. Toast: "Bill marked paid, but reminders couldn't be set for the next bill." |

---

## Files Modified

| File | Change Type | What |
|------|-------------|------|
| `src/services/billsService.ts` | Add functions | `frequencyToInterval`, `createNextRecurrenceBill` |
| `src/pages/BillsPage.tsx` | Modify function | Extend `handleMarkPaidSubmit` with recurrence logic |

---

## Key Code Paths

- **Entry point**: `handleMarkPaidSubmit` in `BillsPage.tsx`
- **Core logic**: `createNextRecurrenceBill` in `billsService.ts`
- **Date computation**: `computeNextDueDate` in `recurrencePatternsService.ts`
- **Idempotency**: `checkDuplicate` + `computeCompositeKey` in `billsService.ts`
- **Calendar**: `createReminders` in `calendarReminders.ts`, `setCalendarEventIds` in `billsService.ts`
- **Activity log**: `appendActivityLogSafe` in `activityLogService.ts`
- **Reference pattern**: `handleMarkDoneSubmit` in `TodosPage.tsx` (todo recurrence)
