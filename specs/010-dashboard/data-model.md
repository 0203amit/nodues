# Data Model: Dashboard

**Feature**: Dashboard (Phase 10)
**Date**: 2026-05-29

---

## New Types (added to `src/types/index.ts`)

### PropertyMoneySummary

Per-property financial breakdown for the current month.

| Field | Type | Description |
|---|---|---|
| `propertyId` | `string` | Property UUID |
| `propertyName` | `string` | Display name of the property |
| `outstanding` | `number` | Sum of amounts for pending/overdue bills this month |
| `paid` | `number` | Sum of amounts for paid bills this month |

```typescript
export interface PropertyMoneySummary {
  propertyId: string;
  propertyName: string;
  outstanding: number;
  paid: number;
}
```

### MoneyThisMonth

Aggregated financial summary for the current IST month.

| Field | Type | Description |
|---|---|---|
| `outstanding` | `number` | Total outstanding across all properties |
| `paid` | `number` | Total paid across all properties |
| `byProperty` | `PropertyMoneySummary[]` | Per-property breakdown (only non-zero rows) |

```typescript
export interface MoneyThisMonth {
  outstanding: number;
  paid: number;
  byProperty: PropertyMoneySummary[];
}
```

### AttentionItem (Discriminated Union)

Unified type for overdue bills and overdue to-dos in the Needs Attention section.

**Bill variant:**

| Field | Type | Description |
|---|---|---|
| `kind` | `'bill'` | Discriminant |
| `id` | `string` | Bill UUID |
| `billTypeName` | `string` | Bill type display name |
| `propertyName` | `string` | Property display name |
| `propertyId` | `string` | Property UUID (for clickthrough URL) |
| `month` | `string` | Bill month `YYYY-MM` (for clickthrough URL) |
| `dueDate` | `string` | Due date `YYYY-MM-DD` (for sorting + display) |
| `displayStatus` | `BillDisplayStatus` | Always `'overdue'` in this context |
| `amount` | `number \| null` | Bill amount (for optional display) |

**Todo variant:**

| Field | Type | Description |
|---|---|---|
| `kind` | `'todo'` | Discriminant |
| `id` | `string` | Todo UUID |
| `title` | `string` | Todo title |
| `categoryId` | `string` | Category UUID (for clickthrough URL) |
| `categoryName` | `string` | Category display name |
| `categoryColor` | `string` | Category hex color (for badge) |
| `dueDate` | `string` | Due date `YYYY-MM-DD` (for sorting + display) |
| `displayStatus` | `TodoDisplayStatus` | Always `'overdue'` in this context |

```typescript
export type AttentionItem =
  | {
      kind: 'bill';
      id: string;
      billTypeName: string;
      propertyName: string;
      propertyId: string;
      month: string;
      dueDate: string;
      displayStatus: BillDisplayStatus;
      amount: number | null;
    }
  | {
      kind: 'todo';
      id: string;
      title: string;
      categoryId: string;
      categoryName: string;
      categoryColor: string;
      dueDate: string;
      displayStatus: TodoDisplayStatus;
    };
```

---

## Existing Types (used, not modified)

| Type | Source | Used By |
|---|---|---|
| `BillWithDisplay` | `src/types/index.ts` | Money computation, attention items |
| `BillDisplayStatus` | `src/types/index.ts` | AttentionItem discriminant |
| `TodoWithDisplay` | `src/types/index.ts` | Attention items |
| `TodoDisplayStatus` | `src/types/index.ts` | AttentionItem discriminant |
| `Property` | `src/types/index.ts` | Property name lookups |
| `BillTypeWithProperty` | `src/types/index.ts` | Bill type map building |
| `TodoCategory` | `src/types/index.ts` | Category map building |
| `RecurrencePattern` | `src/types/index.ts` | Pattern map building |
| `ActivityLogEntry` | `src/types/index.ts` | Recent activity display |
| `ActionType` | `src/types/index.ts` | ACTION_LABELS key type |
| `ActivityEntityType` | `src/types/index.ts` | ENTITY_ICONS key type |

---

## Shared Constants (new file: `src/utils/activityLabels.ts`)

### ACTION_LABELS

```typescript
export const ACTION_LABELS: Record<ActionType, string> = {
  bill_added: 'Bill added',
  bill_updated: 'Bill updated',
  bill_paid: 'Bill paid',
  bill_postponed: 'Bill postponed',
  bill_deleted: 'Bill deleted',
  bill_restored: 'Bill restored',
  todo_added: 'To-do added',
  todo_updated: 'To-do updated',
  todo_done: 'To-do done',
  todo_recurrence_created: 'Recurrence created',
  todo_postponed: 'To-do postponed',
  todo_deleted: 'To-do deleted',
  todo_restored: 'To-do restored',
  property_added: 'Property added',
  property_updated: 'Property updated',
  property_deleted: 'Property deleted',
  property_restored: 'Property restored',
  billtype_added: 'Bill type added',
  billtype_updated: 'Bill type updated',
  billtype_deleted: 'Bill type deleted',
  billtype_restored: 'Bill type restored',
  category_added: 'Category added',
  category_updated: 'Category updated',
  category_deleted: 'Category deleted',
  category_restored: 'Category restored',
};
```

### ENTITY_ICONS

```typescript
export const ENTITY_ICONS: Record<ActivityEntityType, LucideIcon> = {
  bill: Receipt,
  todo: ListTodo,
  property: Home,
  billtype: FileText,
  category: Tags,
};
```

---

## Data Flow Diagram

```
DashboardPage mount
  │
  ├─ Phase 1 (Promise.allSettled) ─────────────────────┐
  │   ├─ fetchProperties(token, ssId)                   │
  │   ├─ fetchBillTypes(token, ssId)                    │
  │   ├─ fetchAllCategories(token, ssId)                │
  │   ├─ fetchRecurrencePatterns(token, ssId)           │
  │   └─ fetchActivityLog(token, ssId)                  │
  │                                                      │
  ├─ Build maps from Phase 1 results ──────────────────│
  │   ├─ billTypeMap: Map<id, {name, propertyId, ...}>  │
  │   ├─ categoryMap: Map<id, {name, color}>            │
  │   └─ patternMap: Map<id, {name, intervalValue}>     │
  │                                                      │
  ├─ Phase 2 (Promise.allSettled) ─────────────────────│
  │   ├─ fetchBills(token, ssId, billTypeMap)            │
  │   └─ fetchTodos(token, ssId, categoryMap, patternMap)│
  │                                                      │
  └─ Compute derived state ────────────────────────────│
      ├─ MoneyThisMonth (from current-month bills)      │
      ├─ AttentionItem[] (overdue bills + todos, sorted)│
      └─ ActivityLogEntry[] (first 5 entries)           │
```

---

## State Shape in DashboardPage

| State | Type | Purpose |
|---|---|---|
| `isLoading` | `boolean` | True during initial data fetch |
| `isRefreshing` | `boolean` | True during manual/auto refresh |
| `moneyThisMonth` | `MoneyThisMonth \| null` | Section 1 data |
| `attentionItems` | `AttentionItem[]` | Section 2 data |
| `recentActivity` | `ActivityLogEntry[]` | Section 3 data (max 5) |
| `lastFetchAt` | `useRef<number>` | Timestamp for staleness gate |
| `loadError` | `{ bills?: true; todos?: true; activity?: true }` | Per-section error tracking |
