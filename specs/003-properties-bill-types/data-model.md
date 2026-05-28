# Data Model: Properties & Bill Types Management

**Feature**: 003-properties-bill-types | **Date**: 2026-05-28

## Entities

### Property

Represents a real-world property the owner manages (flat, shop, etc.). Stored as a row in the `Properties` tab.

| Field | Type | Required | Mutable | Sheet Column | Notes |
|-------|------|----------|---------|--------------|-------|
| `id` | `string` (UUID v4) | Yes | No | A | Generated on create |
| `name` | `string` | Yes | Yes | B | Non-empty, user-visible label |
| `address` | `string` | No | Yes | C | Free-text, optional |
| `notes` | `string` | No | Yes | D | Free-text, optional |
| `active` | `boolean` | Yes | Yes | E | Stored as `"true"` / `"false"` string |
| `created_at` | `string` (ISO 8601) | Yes | No | F | Set on create |
| `deleted_at` | `string` (ISO 8601) or `""` | Yes | Yes | G | Empty = not deleted; set for soft-delete |

**Column order**: Matches `HEADER_DEFINITIONS` in `schema.ts`: `['id', 'name', 'address', 'notes', 'active', 'created_at', 'deleted_at']` (7 columns, A–G).

**Validation rules**:
- `name` must be non-empty (trimmed length > 0).
- `active` defaults to `true` on create.
- `deleted_at` defaults to `""` on create.

**Sheet row structure**: Each property occupies one row. Row index is 1-based (row 1 = header). Data rows start at row 2.

### BillType

A category of bill scoped to a specific property. Stored as a row in the `BillTypes` tab.

| Field | Type | Required | Mutable | Sheet Column | Notes |
|-------|------|----------|---------|--------------|-------|
| `id` | `string` (UUID v4) | Yes | No | A | Generated on create |
| `property_id` | `string` (UUID v4) | Yes | No | B | FK to Property.id; **immutable after create** |
| `name` | `string` | Yes | Yes | C | Non-empty, user-visible label |
| `default_amount` | `number \| null` | No | Yes | D | Stored as string; `""` = null; must be >= 0 |
| `default_due_day` | `number \| null` | No | Yes | E | Stored as string; `""` = null; must be 1–31 |
| `frequency` | `Frequency` | Yes | Yes | F | One of: `monthly`, `quarterly`, `annual`, `one-time` |
| `reminder_offsets_days` | `number[]` | No | Yes | G | Stored as comma-separated string; `""` = empty array |
| `active` | `boolean` | Yes | Yes | H | Stored as `"true"` / `"false"` string |
| `created_at` | `string` (ISO 8601) | Yes | No | I | Set on create |
| `deleted_at` | `string` (ISO 8601) or `""` | Yes | Yes | J | Empty = not deleted |

**Column order**: Matches `HEADER_DEFINITIONS` in `schema.ts`: `['id', 'property_id', 'name', 'default_amount', 'default_due_day', 'frequency', 'reminder_offsets_days', 'active', 'created_at', 'deleted_at']` (10 columns, A–J).

**Validation rules**:
- `name` must be non-empty (trimmed length > 0).
- `property_id` must reference an existing property (active + non-deleted for create; displayed read-only on edit).
- `frequency` must be one of the enum values.
- `default_amount`, if provided, must be a non-negative number.
- `default_due_day`, if provided, must be an integer between 1 and 31 inclusive.
- `reminder_offsets_days`, if provided, must be a comma-separated list of positive integers. Whitespace around commas is tolerated.
- `active` defaults to `true` on create.
- `deleted_at` defaults to `""` on create.

## Enums

### Frequency

```typescript
type Frequency = 'monthly' | 'quarterly' | 'annual' | 'one-time';
```

## Relationships

```text
Property (1) ──── (N) BillType
  │                     │
  │ id ←──────── property_id
  │                     │
  └── soft-delete       └── independent soft-delete
      does NOT cascade       (non-cascading)
```

- A Property can have zero or more BillTypes.
- A BillType belongs to exactly one Property (via `property_id`).
- Soft-deleting a Property does **not** delete its BillTypes. The BillTypes remain visible on the Bill Types page, with the deleted property's name shown grayed out.
- Deactivating a Property excludes it from the "Add Bill Type" property dropdown, but existing BillTypes under that property remain visible and editable.

## Row With Index

All read operations return rows paired with their Sheet row index for subsequent updates:

```typescript
interface RowWithIndex {
  rowIndex: number;   // 1-based Sheet row number (data starts at 2)
  values: string[];   // Raw cell values in column order
}
```

The typed domain objects (`Property`, `BillType`) include a `_rowIndex` field (prefixed with underscore to denote it's metadata, not a Sheet column) for targeting updates and deletes:

```typescript
interface Property {
  _rowIndex: number;
  id: string;
  name: string;
  address: string;
  notes: string;
  active: boolean;
  createdAt: string;
  deletedAt: string;
}

interface BillType {
  _rowIndex: number;
  id: string;
  propertyId: string;
  name: string;
  defaultAmount: number | null;
  defaultDueDay: number | null;
  frequency: Frequency;
  reminderOffsetsDays: number[];
  active: boolean;
  createdAt: string;
  deletedAt: string;
}
```

## Display Model (UI enrichment)

For the Bill Types list, the UI needs the property name resolved from `property_id`:

```typescript
interface BillTypeWithProperty extends BillType {
  propertyName: string;       // Resolved from property_id → Property.name
  propertyDeleted: boolean;   // True if the parent property has been soft-deleted
  propertyActive: boolean;    // True if the parent property is active
}
```

## State Transitions

### Property Lifecycle

```text
[Create] → active=true, deleted_at=""
  │
  ├── [Toggle Active] → active=false / active=true
  │
  ├── [Edit] → name, address, notes updated
  │
  └── [Soft Delete] → deleted_at=<ISO timestamp>
        │
        └── [Undo] (within 10s) → deleted_at=""
```

### BillType Lifecycle

```text
[Create] → active=true, deleted_at="", property_id=<selected>
  │
  ├── [Toggle Active] → active=false / active=true
  │
  ├── [Edit] → name, default_amount, default_due_day, frequency, reminder_offsets_days updated
  │            (property_id is immutable)
  │
  └── [Soft Delete] → deleted_at=<ISO timestamp>
        │
        └── [Undo] (within 10s) → deleted_at=""
```

## Sheet ↔ TypeScript Serialization

| Sheet value | TypeScript type | Parse | Serialize |
|-------------|-----------------|-------|-----------|
| `"true"` / `"false"` | `boolean` | `value === 'true'` | `String(value)` |
| `""` (empty) for optional number | `null` | `value === '' ? null : Number(value)` | `value === null ? '' : String(value)` |
| `"7,3,1"` | `number[]` | `value === '' ? [] : value.split(',').map(s => parseInt(s.trim(), 10))` | `value.join(',')` |
| ISO 8601 string | `string` | Pass through | `new Date().toISOString()` |
| UUID string | `string` | Pass through | `crypto.randomUUID()` or `uuidv4()` |
