# Data Model: Bills Recurrence

**Feature**: Bills Recurrence (Phase 15)
**Date**: 2026-06-04

---

## Schema Changes

**None.** This feature reuses all existing types and Sheet schema without modification.

---

## Existing Entities Used

### Bill (Sheet: `Bills`)

Auto-created bills use the exact same `Bill` interface and column layout. No new columns, no new fields.

| Field | Source for Auto-Created Bill |
|-------|------------------------------|
| id | `uuidv4()` |
| billTypeId | Same as paid bill's `billTypeId` |
| month | Derived from computed next due date (YYYY-MM), or from paid bill's month + interval if no due date |
| amount | `billType.defaultAmount` (may be null) |
| dueDate | `computeNextDueDate(paidBill.dueDate, intervalValue, intervalUnit, billType.defaultDueDay)` |
| originalDueDate | Same as dueDate |
| status | `'pending'` if dueDate computed, `'not_yet_generated'` if no dueDate |
| paidDate | `''` |
| paymentMethod | `''` |
| transactionRef | `''` |
| billFileIds | `''` |
| receiptFileIds | `''` |
| calendarEventIds | `''` (populated later by calendar reminder flow) |
| notes | `''` |
| createdAt | `new Date().toISOString()` |
| updatedAt | `new Date().toISOString()` |
| deletedAt | `''` |
| compositeKey | `computeCompositeKey(billType.propertyId, billType.id, newMonth)` |

### BillType (Sheet: `BillTypes`)

Read-only in this feature. Fields used:

| Field | Usage |
|-------|-------|
| id | Carried to new bill's `billTypeId` |
| propertyId | Used in `computeCompositeKey` and activity log |
| name | Used in toast messages and activity log summary |
| defaultAmount | Sets new bill's `amount` |
| defaultDueDay | Passed as `anchorDay` to `computeNextDueDate`; null triggers no-due-date path |
| frequency | Determines whether recurrence fires and the interval mapping |
| reminderOffsetsDays | Determines whether calendar reminders are created on the new bill |

### Frequency (Type only, no Sheet tab)

```typescript
type Frequency = 'monthly' | 'quarterly' | 'annual' | 'one-time';
```

Mapping to `computeNextDueDate` parameters:

| Frequency | intervalValue | intervalUnit | Recurs? |
|-----------|--------------|--------------|---------|
| `'monthly'` | 1 | `'months'` | Yes |
| `'quarterly'` | 3 | `'months'` | Yes |
| `'annual'` | 1 | `'years'` | Yes |
| `'one-time'` | — | — | No |

### ActionType (Type only)

Both action types already exist in the union:
- `'bill_paid'` — logged for the paid bill (existing behavior)
- `'bill_added'` — logged for the auto-created bill (new usage, existing value)

No changes to the `ActionType` union.

---

## Idempotency Key

The composite key `propertyId|billTypeId|month` serves as the deduplication key. The `checkDuplicate` function (billsService.ts line 189) searches non-deleted bills by composite key. This is unchanged — the recurrence function calls it before appending.
