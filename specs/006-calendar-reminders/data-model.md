# Data Model: Calendar Reminders for Bills

**Feature Branch**: `006-calendar-reminders`
**Date**: 2026-05-28

## Entities

### 1. Google Calendar Reminder Event (external resource, not stored locally)

An all-day Google Calendar event on the "NoDues Reminders" secondary calendar, representing a reminder for an upcoming bill due date.

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `id` | string | Calendar API response | Google Calendar event ID (returned by `events.insert`) |
| `summary` | string | Computed | Event title: `{BillTypeName} — {PropertyName} due {D MMM YYYY}` |
| `description` | string | Computed | `Month: {MMM YYYY}` + optional `Amount: {formatted INR}` |
| `start.date` | string (YYYY-MM-DD) | Computed | Reminder date = `dueDate - offsetDays` |
| `end.date` | string (YYYY-MM-DD) | Computed | Day after `start.date` (exclusive end for single-day all-day event) |
| `reminders.useDefault` | boolean | Constant | `false` |
| `reminders.overrides` | array | Constant | `[{ method: 'popup', minutes: 0 }]` |

**Storage**: Google Calendar only. The only local persistence is the event `id` stored in `Bill.calendarEventIds`.

### 2. Bill (existing entity - extended column usage)

The `calendar_event_ids` column (index 12, 0-based) already exists in the Bills tab header definitions. Currently empty for all bills. This feature populates and manages it.

| Column Index | Sheet Header | TS Field | Type | Description |
|-------------|-------------|----------|------|-------------|
| 12 | `calendar_event_ids` | `calendarEventIds` | `string` | CSV of Google Calendar event IDs. Empty string = no reminders. |

**No schema changes needed.** The column was provisioned during Phase 2 bootstrapping (confirmed in `src/config/schema.ts` line 37).

### 3. BillType (existing entity - field reference only)

| TS Field | Type | Description |
|----------|------|-------------|
| `reminderOffsetsDays` | `number[]` | Days before due date for each reminder event. Parsed from CSV. E.g., `[7, 3, 1]` = reminders at 7, 3, and 1 day before due. Empty array = no reminders. |

**No changes needed.** Already parsed in the TypeScript type (confirmed in `src/types/index.ts` line 44).

### 4. SetupResult (existing entity - field reference only)

| TS Field | Type | Description |
|----------|------|-------------|
| `calendarId` | `string` | Google Calendar ID for the "NoDues Reminders" calendar, created during bootstrapping. |

**No changes needed.** Available via `useBootstrap().setupResult.calendarId` (confirmed in `specs/002-first-run-bootstrapping/contracts/bootstrap-context.ts` line 43).

## Relationships

```
BillType.reminderOffsetsDays
    │
    │  (each offset produces one event)
    ▼
Bill.dueDate - offset ──▶ Reminder Date (YYYY-MM-DD)
    │
    │  (createAllDayEvent)
    ▼
Google Calendar Event (on calendarId from SetupResult)
    │
    │  (event.id stored)
    ▼
Bill.calendarEventIds (CSV of event IDs)
```

## State Transitions

### Calendar Event Lifecycle per Bill

```
                              addBill (with dueDate + offsets)
                     ┌─────────────────────────────────────────┐
                     ▼                                         │
             ┌──────────────┐                          ┌───────┴──────┐
             │  No Events   │                          │ Events Active │
             │  (empty CSV) │                          │ (IDs in CSV)  │
             └──────┬───────┘                          └───────┬───────┘
                    │                                          │
                    │  addBill (no dueDate or no offsets)       │
                    │  ──▶ stays here                           │
                    │                                          │
                    │  edit (dueDate added)                     │  edit (dueDate changed)
                    │  ──▶ create events ──▶ Events Active      │  ──▶ delete old + create new
                    │                                          │
                    │                                          │  edit (dueDate removed)
                    │  ◀── delete events + clear CSV ──────────│
                    │                                          │
                    │                                          │  markPaid
                    │  ◀── delete events + clear CSV ──────────│
                    │                                          │
                    │                                          │  softDelete
                    │  ◀── delete events (CSV not cleared*) ───│
                    │                                          │
                    │  undoDelete                               │
                    │  ──▶ recreate events ──▶ Events Active    │
                    │                                          │
                    │  edit (dueDate unchanged)                 │
                    │  ──▶ no calendar ops                      │
                    └──────────────────────────────────────────┘
```

*On soft-delete, events are deleted from Google Calendar but `calendarEventIds` is not cleared in the sheet to avoid a full-row write that could conflict with the `deleted_at` cell update. Stale IDs are harmless for a deleted bill and are replaced on undo.

## Validation Rules

| Field | Rule |
|-------|------|
| `calendarEventIds` | No structural validation. Opaque Google event IDs. |
| CSV parsing | Empty segments, whitespace, trailing commas filtered by `parseEventIds`. |
| No max count | Number of event IDs determined by bill type's `reminderOffsetsDays` length. |
| No concurrent-write protection | Acceptable for single-user household app. |
