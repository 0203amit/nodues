# Data Model: Activity Log

**Feature**: Activity Log (Phase 9) | **Date**: 2026-05-29

## Entities

### ActivityLogEntry

An append-only row in the `ActivityLog` Google Sheets tab. Each row represents one meaningful user action.

| Field | TS Type | Sheet Column | Description |
|---|---|---|---|
| `_rowIndex` | `number` | *(metadata)* | 1-based Sheet row number. Not stored — assigned during parse. |
| `id` | `string` | `id` | UUID v4. Unique per log entry. |
| `timestamp` | `string` | `timestamp` | ISO 8601 datetime string (e.g., `"2026-05-29T14:30:00.000Z"`). When the action occurred. |
| `userEmail` | `string` | `user_email` | Hardcoded `'user'` (single-user app). Matches PostponeLog's `postponed_by`. |
| `action` | `ActionType` | `action` | One of 26 action codes (e.g., `'bill_added'`, `'todo_done'`). |
| `entityType` | `ActivityEntityType` | `entity_type` | `'bill'` \| `'todo'` \| `'property'` \| `'billtype'` \| `'category'` |
| `entityId` | `string` | `entity_id` | UUID of the affected entity row. |
| `summary` | `string` | `summary` | Human-readable description constructed at write time. |

**Sheet tab**: `ActivityLog`
**Column order** (from `schema.ts` `HEADER_DEFINITIONS`): `id, timestamp, user_email, action, entity_type, entity_id, summary`

### ActionType (String Union)

26-member exhaustive union. Naming convention: `{entity}_{verb}`.

| Entity | Actions |
|---|---|
| `bill` | `bill_added`, `bill_updated`, `bill_paid`, `bill_postponed`, `bill_deleted`, `bill_restored` |
| `todo` | `todo_added`, `todo_updated`, `todo_done`, `todo_recurrence_created`, `todo_postponed`, `todo_deleted`, `todo_restored` |
| `property` | `property_added`, `property_updated`, `property_deleted`, `property_restored` |
| `billtype` | `billtype_added`, `billtype_updated`, `billtype_deleted`, `billtype_restored` |
| `category` | `category_added`, `category_updated`, `category_deleted`, `category_restored` |

### ActivityEntityType (String Union)

5-member union matching the `entity_type` sheet column values:

`'bill'` | `'todo'` | `'property'` | `'billtype'` | `'category'`

## Relationships

- `ActivityLogEntry.entityId` → references the `id` column of the entity's primary sheet tab (Bills, Todos, Properties, BillTypes, TodoCategories). This is a logical reference — no foreign key enforcement.
- `ActivityLogEntry.entityType` identifies which sheet tab `entityId` belongs to.
- Entries are append-only. No updates, no deletes. The log grows monotonically.

## Summary String Formats (DD-003)

| Action | Format | Example |
|---|---|---|
| `bill_added` | `{billType} — {property} · {month}` | `Maintenance — Mira Shop · Jun 2026` |
| `bill_updated` | `{billType} — {property} · {month}` | `Maintenance — Mira Shop · Jun 2026` |
| `bill_paid` | `{billType} — {property} · {month}[ · ₹{amount}]` | `Maintenance — Mira Shop · Jun 2026 · ₹1,100` |
| `bill_postponed` | `{billType} — {property} · {fromDay} → {toDay year}` | `Maintenance — Mira Shop · 5 Jun → 12 Jun 2026` |
| `bill_deleted` | `{billType} — {property} · {month}` | `Maintenance — Mira Shop · Jun 2026` |
| `bill_restored` | `{billType} — {property} · {month}` | `Maintenance — Mira Shop · Jun 2026` |
| `todo_added` | `{title}` | `Renew insurance` |
| `todo_updated` | `{title}` | `Renew insurance` |
| `todo_done` | `{title}` | `Renew insurance` |
| `todo_recurrence_created` | `{title}[ · next {dueDate}]` | `Renew insurance · next 15 Jul 2027` |
| `todo_postponed` | `{title} · {fromDay} → {toDay year}` | `Renew insurance · 15 Jul → 22 Jul 2027` |
| `todo_deleted` | `{title}` | `Renew insurance` |
| `todo_restored` | `{title}` | `Renew insurance` |
| `property_added` | `{name}` | `Mira Shop` |
| `property_updated` | `{name}` | `Mira Shop` |
| `property_deleted` | `{name}` | `Mira Shop` |
| `property_restored` | `{name}` | `Mira Shop` |
| `billtype_added` | `{name}` | `Maintenance` |
| `billtype_updated` | `{name}` | `Maintenance` |
| `billtype_deleted` | `{name}` | `Maintenance` |
| `billtype_restored` | `{name}` | `Maintenance` |
| `category_added` | `{name}` | `Legal` |
| `category_updated` | `{name}` | `Legal` |
| `category_deleted` | `{name}` | `Legal` |
| `category_restored` | `{name}` | `Legal` |

**Notes**:
- `—` is an em-dash (`\u2014`), `·` is a middle dot (`\u00b7`)
- `{month}` uses `formatMonth` → "Jun 2026"
- `{fromDay}` uses `formatShortDate` → "5 Jun" (no year)
- `{toDay year}` uses `formatDueDate` → "12 Jun 2026" (with year)
- `{amount}` uses `formatCurrency` → "₹1,100" (INR, no decimals)
- `[ ]` denotes conditional parts (omitted when value is null/empty)

## State Transitions

None. `ActivityLogEntry` is immutable once written. The log is append-only with no status changes.

## Validation Rules

- `id`: Must be a valid UUID v4 (generated via `uuidv4()`).
- `timestamp`: Must be a valid ISO 8601 string (generated via `new Date().toISOString()`).
- `userEmail`: Always `'user'` (hardcoded).
- `action`: Must be one of the 26 `ActionType` values (enforced by TypeScript at compile time).
- `entityType`: Must be one of 5 `ActivityEntityType` values (enforced by TypeScript at compile time).
- `entityId`: Must be the `id` of the affected entity. Must not be empty.
- `summary`: Constructed from in-scope data at the call site. No additional sheet reads.
- `parseRow` returns `null` for rows with missing/empty `id` (defensive parsing).
