# Data Model: Bills Core Loop

**Feature**: 004-bills-core-loop | **Date**: 2026-05-28

## Entities

### Bill

A specific bill instance for a property's bill type in a given billing month. Stored as a row in the `Bills` tab.

| Field | Type | Required | Mutable | Sheet Column | Notes |
|-------|------|----------|---------|--------------|-------|
| `id` | `string` (UUID v4) | Yes | No | A | Generated on create |
| `bill_type_id` | `string` (UUID v4) | Yes | No | B | FK to BillTypes.id; **immutable after create** |
| `month` | `string` (YYYY-MM) | Yes | Yes | C | Billing month, e.g., "2026-06" |
| `amount` | `number \| null` | No | Yes | D | Stored as string; `""` = null; must be >= 0 |
| `due_date` | `string` (YYYY-MM-DD) or `""` | No | Yes | E | Current due date; nullable when not_yet_generated |
| `original_due_date` | `string` (YYYY-MM-DD) or `""` | No | No* | F | First due date set; **immutable after first save** (Phase 7 postpone may change it via PostponeLog) |
| `status` | `BillStatus` | Yes | Yes | G | One of: `not_yet_generated`, `pending`, `paid`, `skipped` |
| `paid_date` | `string` (YYYY-MM-DD) or `""` | No | Yes | H | Set when marking paid |
| `payment_method` | `string` | No | Yes | I | Free-text from dropdown: GPay, PhonePe, NEFT, Net Banking, Cash, Other |
| `transaction_ref` | `string` | No | Yes | J | UTR or transaction reference, optional |
| `bill_file_ids` | `string` | No | No** | K | CSV of Drive file IDs; **empty in this phase** (Phase 5) |
| `receipt_file_ids` | `string` | No | No** | L | CSV of Drive file IDs; **empty in this phase** (Phase 5) |
| `calendar_event_ids` | `string` | No | No** | M | CSV of Calendar event IDs; **empty in this phase** (Phase 6) |
| `notes` | `string` | No | Yes | N | Free-text, optional |
| `created_at` | `string` (ISO 8601) | Yes | No | O | Set on create |
| `updated_at` | `string` (ISO 8601) | Yes | Yes | P | Set on create and every update |
| `deleted_at` | `string` (ISO 8601) or `""` | Yes | Yes | Q | Empty = not deleted; set for soft-delete |
| `composite_key` | `string` | Yes | Yes | R | `property_id\|bill_type_id\|month` — for duplicate detection |

\* `original_due_date` is set once when `due_date` is first assigned and is immutable in this phase. Phase 7 (Postpone) introduces a mechanism to change it via PostponeLog.

\** `bill_file_ids`, `receipt_file_ids`, `calendar_event_ids` are written as empty strings in this phase. They will be populated by Phases 5 and 6 respectively. **Full-row writes MUST preserve their current values** (even if empty) to avoid data loss when those phases are implemented.

**Column order**: Matches `HEADER_DEFINITIONS` in `schema.ts`: `['id', 'bill_type_id', 'month', 'amount', 'due_date', 'original_due_date', 'status', 'paid_date', 'payment_method', 'transaction_ref', 'bill_file_ids', 'receipt_file_ids', 'calendar_event_ids', 'notes', 'created_at', 'updated_at', 'deleted_at', 'composite_key']` (18 columns, A–R).

**Validation rules**:
- `bill_type_id` must reference an existing, active, non-deleted bill type on create.
- `month` must be a valid YYYY-MM string.
- `amount`, if provided, must be a non-negative number.
- `due_date`, if provided, must be a valid YYYY-MM-DD date.
- `status` must be one of the enum values.
- `composite_key` is computed, not user-entered.
- When `status = not_yet_generated`: `amount` and `due_date` may be empty.
- When `status = pending`: `amount` and `due_date` should be present.
- When `status = paid`: `paid_date` must be set, `payment_method` should be set.

**Sheet row structure**: Each bill occupies one row. Row index is 1-based (row 1 = header). Data rows start at row 2.

## Enums

### BillStatus (stored)

```typescript
type BillStatus = 'not_yet_generated' | 'pending' | 'paid' | 'skipped';
```

### BillDisplayStatus (computed, not stored)

```typescript
type BillDisplayStatus = 'paid' | 'overdue' | 'pending' | 'not_yet_generated' | 'skipped';
```

The display status is derived from the stored status + date comparison:

| Stored `status` | Condition | Display Status | Badge Color | Icon |
|----------------|-----------|----------------|-------------|------|
| `paid` | — | `paid` | emerald | `CheckCircle2` |
| `pending` | `due_date < today` | `overdue` | red | `AlertCircle` |
| `pending` | `due_date >= today` | `pending` | amber | `Clock` |
| `not_yet_generated` | — | `not_yet_generated` | cyan | `FileQuestion` |
| `skipped` | — | `skipped` | slate | `MinusCircle` |

### PaymentMethod (dropdown options)

```typescript
const PAYMENT_METHOD_OPTIONS = [
  { value: 'GPay', label: 'GPay' },
  { value: 'PhonePe', label: 'PhonePe' },
  { value: 'NEFT', label: 'NEFT' },
  { value: 'Net Banking', label: 'Net Banking' },
  { value: 'Cash', label: 'Cash' },
  { value: 'Other', label: 'Other' },
];
```

## Relationships

```text
Property (1) ──── (N) BillType (1) ──── (N) Bill
  │                     │                     │
  │ id ←──────── property_id          bill_type_id ──→ id │
  │                     │                     │
  └── soft-delete       └── soft-delete       └── soft-delete
      (non-cascading)       (non-cascading)       (independent)
```

- A BillType has zero or more Bills (via `bill_type_id`).
- A Bill belongs to exactly one BillType.
- The Bill does **not** directly reference a Property. The property is resolved via `BillType.property_id`.
- The `composite_key` includes `property_id` (resolved from the bill type) for fast duplicate detection without joins.
- Soft-deleting a BillType does **not** delete its Bills. Existing bills remain visible.
- Deactivating or soft-deleting a BillType removes it from the "Add Bill" dropdown, but existing bills remain.

## Display Model (UI enrichment)

For the Bills list, the UI needs resolved names and computed status:

```typescript
interface BillWithDisplay extends Bill {
  billTypeName: string;           // Resolved from bill_type_id → BillType.name
  propertyName: string;           // Resolved from BillType.property_id → Property.name
  propertyId: string;             // Resolved from BillType.property_id (for filtering)
  displayStatus: BillDisplayStatus; // Computed from status + due_date vs today
}
```

## Composite Key

The composite key enables O(1) duplicate detection:

```
composite_key = property_id + "|" + bill_type_id + "|" + month
```

Example: `"abc-123|def-456|2026-06"`

- `property_id` is resolved from the bill type (BillType.property_id), not entered by the user.
- The key is stored in the Sheet row for fast lookup without requiring a join.
- Two non-deleted bills MUST NOT share the same composite_key (enforced by pre-save check).

## State Transitions

### Bill Lifecycle

```text
[Create with amount + due_date]
  → status=pending, original_due_date=due_date
  │
  ├── [Mark Paid] → status=paid, paid_date set
  │
  ├── [Edit] → amount, due_date, month, notes updated; updated_at set
  │     └── [If month changes] → composite_key recomputed, duplicate check runs
  │
  └── [Soft Delete] → deleted_at set
        └── [Undo] (within 10s) → deleted_at cleared

[Create without amount/due_date]
  → status=not_yet_generated, amount="", due_date=""
  │
  ├── [Edit to add amount + due_date] → status auto-flips to pending
  │     └── original_due_date set (if was empty)
  │
  └── [Soft Delete] → deleted_at set
```

### Status auto-flip rules

| From | To | Trigger |
|------|----|---------|
| `not_yet_generated` | `pending` | Edit provides amount AND due_date |
| `pending` | `paid` | Mark Paid action |
| any | (display: `overdue`) | `status === 'pending'` AND `due_date < today` (display only, stored status stays `pending`) |

## Sheet ↔ TypeScript Serialization

| Sheet value | TypeScript type | Parse | Serialize |
|-------------|-----------------|-------|-----------|
| `""` for optional number | `null` | `value === '' ? null : Number(value)` | `value === null ? '' : String(value)` |
| `"pending"` / `"paid"` / etc. | `BillStatus` | Cast: `value as BillStatus` (with fallback to `'pending'`) | Direct string |
| `"2026-06"` | `string` | Pass through | Pass through |
| `"2026-06-15"` | `string` | Pass through | Pass through |
| ISO 8601 timestamp | `string` | Pass through | `new Date().toISOString()` |
| UUID string | `string` | Pass through | `uuidv4()` |
| `"abc\|def\|2026-06"` | `string` | Pass through | `propertyId + '\|' + billTypeId + '\|' + month` |

## Column Index Reference

Derived from `HEADER_DEFINITIONS` in `schema.ts`:

### Bills Tab (18 columns)

| Index | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 |
|-------|---|---|---|---|---|---|---|---|---|---|----|----|----|----|----|----|----|----|
| Column | A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P | Q | R |
| Header | id | bill_type_id | month | amount | due_date | original_due_date | status | paid_date | payment_method | transaction_ref | bill_file_ids | receipt_file_ids | calendar_event_ids | notes | created_at | updated_at | deleted_at | composite_key |
