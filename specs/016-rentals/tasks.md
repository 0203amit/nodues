# Tasks: Rentals

**Feature**: Rentals (Phase 16)
**Branch**: `016-rentals`
**Generated**: 2026-06-04

---

## Chunk 1: Schema + Types + Services (~14 tasks)

**Goal**: All 3 new entities (Tenancy, RentCollection, PaymentEvent) typed, header definitions registered, service-layer CRUD ready, `ensureRentalTabs` lazy bootstrap utility in place. No UI yet.

### T001: Add Tenancies header definition to `src/config/schema.ts`

**File**: `src/config/schema.ts`
**FR**: FR-001, DD-002 | **R**: R-006

Add a new entry to `HEADER_DEFINITIONS` (after the `PushSubscriptions` entry, before `Config`) with `tabName: 'Tenancies'` and 16 headers matching R-006 Tab: Tenancies.

```typescript
{
  tabName: 'Tenancies',
  headers: [
    'id', 'property_id', 'unit_label', 'name', 'phone', 'email',
    'rent_amount', 'security_deposit', 'rent_due_day', 'lease_start_date',
    'lease_end_date', 'is_active', 'notes', 'created_at', 'updated_at',
    'deleted_at',
  ],
},
```

Note: Do NOT add `'Tenancies'` to `TAB_NAMES`. Rental tabs are lazy-created on first access (R-006, R-010), not during bootstrap.

**Before**: `HEADER_DEFINITIONS` has 10 entries (Properties, BillTypes, Bills, TodoCategories, RecurrencePatterns, Todos, PostponeLog, ActivityLog, PushSubscriptions, Config). `TAB_NAMES` has 10 entries.
**After**: `HEADER_DEFINITIONS` has 11 entries with Tenancies before Config. `TAB_NAMES` unchanged (still 10 entries).

**Done when**: `npm run build` compiles. `HEADER_DEFINITIONS.find(d => d.tabName === 'Tenancies')` returns the 16-header definition.

---

### T002: Add RentCollections header definition to `src/config/schema.ts`

**File**: `src/config/schema.ts`
**FR**: DD-002, DD-003 | **R**: R-006

Add a new entry to `HEADER_DEFINITIONS` (after Tenancies, before Config) with `tabName: 'RentCollections'` and 10 headers matching R-006 Tab: RentCollections.

```typescript
{
  tabName: 'RentCollections',
  headers: [
    'id', 'tenancy_id', 'month', 'expected_amount', 'due_date',
    'notes', 'composite_key', 'created_at', 'updated_at', 'deleted_at',
  ],
},
```

**Before**: `HEADER_DEFINITIONS` has 11 entries (after T001).
**After**: `HEADER_DEFINITIONS` has 12 entries with RentCollections after Tenancies.

**Done when**: `npm run build` compiles. `HEADER_DEFINITIONS.find(d => d.tabName === 'RentCollections')` returns the 10-header definition.

---

### T003: Add PaymentEvents header definition to `src/config/schema.ts`

**File**: `src/config/schema.ts`
**FR**: DD-002 | **R**: R-006

Add a new entry to `HEADER_DEFINITIONS` (after RentCollections, before Config) with `tabName: 'PaymentEvents'` and 9 headers matching R-006 Tab: PaymentEvents.

```typescript
{
  tabName: 'PaymentEvents',
  headers: [
    'id', 'collection_id', 'amount', 'payment_date', 'payment_method',
    'notes', 'created_at', 'updated_at', 'deleted_at',
  ],
},
```

**Before**: `HEADER_DEFINITIONS` has 12 entries (after T002).
**After**: `HEADER_DEFINITIONS` has 13 entries with PaymentEvents after RentCollections. Config remains last.

**Done when**: `npm run build` compiles. All 3 new tabs have header definitions. `HEADER_DEFINITIONS` has 13 entries total.

---

### T004: Add Tenancy interface + form data types to `src/types/index.ts`

**File**: `src/types/index.ts`
**FR**: FR-001, FR-002, FR-003, DD-010 | **R**: R-006

After the `PushSubscription` interface (end of file, line ~383), add a new `// --- Rental Types ---` section with:

1. `Tenancy` interface — 16 fields matching data-model.md: `_rowIndex`, `id`, `propertyId`, `unitLabel`, `name`, `phone`, `email`, `rentAmount` (number), `securityDeposit` (number | null), `rentDueDay` (number), `leaseStartDate`, `leaseEndDate`, `isActive` (boolean), `notes`, `createdAt`, `updatedAt`, `deletedAt`.
2. `TenancyWithDisplay` interface — extends `Tenancy` with `propertyName: string`.
3. `TenancyFormData` interface — string-typed form fields: `propertyId`, `unitLabel`, `name`, `phone`, `email`, `rentAmount`, `securityDeposit`, `rentDueDay`, `leaseStartDate`, `leaseEndDate`, `notes`.

**Before**: File ends after `PushSubscription` interface (line 383).
**After**: File has `Tenancy`, `TenancyWithDisplay`, and `TenancyFormData` interfaces in a new Rental Types section.

**Done when**: `npm run build` compiles. All 3 types are importable from `../types`.

---

### T005: Add RentCollection interface + types to `src/types/index.ts`

**File**: `src/types/index.ts`
**FR**: FR-009, FR-010, FR-011, DD-003 | **R**: R-006

After the Tenancy types (from T004), add:

1. `RentDisplayStatus` type — `'received' | 'partial' | 'pending' | 'overdue'`.
2. `RentCollection` interface — 10 fields matching data-model.md: `_rowIndex`, `id`, `tenancyId`, `month`, `expectedAmount` (number), `dueDate`, `notes`, `compositeKey`, `createdAt`, `updatedAt`, `deletedAt`.
3. `RentCollectionWithDisplay` interface — extends `RentCollection` with `tenancyName`, `unitLabel`, `propertyId`, `propertyName`, `totalReceived` (number), `remainingBalance` (number), `displayStatus` (RentDisplayStatus).

**Before**: File has Tenancy types from T004.
**After**: File additionally has `RentDisplayStatus`, `RentCollection`, and `RentCollectionWithDisplay`.

**Done when**: `npm run build` compiles. All 3 types are importable.

---

### T006: Add PaymentEvent interface + types to `src/types/index.ts`

**File**: `src/types/index.ts`
**FR**: FR-031, DD-002 | **R**: R-006

After the RentCollection types (from T005), add:

1. `PaymentEvent` interface — 9 fields matching data-model.md: `_rowIndex`, `id`, `collectionId`, `amount` (number), `paymentDate`, `paymentMethod`, `notes`, `createdAt`, `updatedAt`, `deletedAt`.
2. `PaymentEventFormData` interface — string-typed form fields: `amount`, `paymentDate`, `paymentMethod`, `notes`.

**Before**: File has RentCollection types from T005.
**After**: File additionally has `PaymentEvent` and `PaymentEventFormData`.

**Done when**: `npm run build` compiles. Both types importable.

---

### T007: Extend ActionType + ActivityEntityType + AttentionItem in `src/types/index.ts`

**File**: `src/types/index.ts`
**FR**: FR-035, FR-036, FR-042 | **R**: R-007

Three modifications:

1. **ActionType union** (line ~306–314): Append 8 new values after `'push_disabled'`:
   ```typescript
   // Phase 16: Rentals
   | 'tenancy_added' | 'tenancy_updated' | 'tenancy_toggled'
   | 'tenancy_deleted' | 'tenancy_restored'
   | 'rent_auto_generated'
   | 'payment_received' | 'payment_deleted';
   ```

2. **ActivityEntityType union** (line ~316): Append 3 new values:
   ```typescript
   // Phase 16: Rentals
   | 'tenancy' | 'rent_collection' | 'payment_event';
   ```

3. **AttentionItem union** (line ~344–365): Add a third variant:
   ```typescript
   | {
       kind: 'rent';
       id: string;
       tenancyName: string;
       unitLabel: string;
       propertyId: string;
       propertyName: string;
       month: string;
       dueDate: string;
       expectedAmount: number;
       totalReceived: number;
       displayStatus: RentDisplayStatus;
     };
   ```

**Before**: `ActionType` has 26 values. `ActivityEntityType` has 6 values. `AttentionItem` has 2 variants (bill, todo).
**After**: `ActionType` has 34 values. `ActivityEntityType` has 9 values. `AttentionItem` has 3 variants (bill, todo, rent).

**Done when**: `npm run build` compiles. New action types, entity types, and `kind: 'rent'` variant are usable in code.

---

### T008: Add rental action labels + entity icons to `src/utils/activityLabels.ts`

**File**: `src/utils/activityLabels.ts`
**FR**: FR-035 | **R**: R-007

1. Add `Landmark` to the lucide-react import (line 2). `Landmark` is the rent/building icon.
2. Add 8 entries to `ACTION_LABELS` after `push_disabled`:
   ```typescript
   tenancy_added: 'Tenant added',
   tenancy_updated: 'Tenant updated',
   tenancy_toggled: 'Tenant toggled',
   tenancy_deleted: 'Tenant deleted',
   tenancy_restored: 'Tenant restored',
   rent_auto_generated: 'Rent auto-generated',
   payment_received: 'Payment received',
   payment_deleted: 'Payment deleted',
   ```
3. Add 3 entries to `ENTITY_ICONS` after `push_subscription`:
   ```typescript
   tenancy: Landmark,
   rent_collection: Landmark,
   payment_event: Landmark,
   ```

**Before**: `ACTION_LABELS` has 26 entries. `ENTITY_ICONS` maps 6 entity types.
**After**: `ACTION_LABELS` has 34 entries. `ENTITY_ICONS` maps 9 entity types.

**Done when**: `npm run build` compiles. Activity log renders all 8 new action types with the Landmark icon.

---

### T009: Create `src/services/tenanciesService.ts`

**File**: `src/services/tenanciesService.ts` (NEW)
**FR**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006 | **R**: R-001, R-006

New file following the `propertiesService.ts` pattern. Exports:

1. **Column index map**: Derive `COL` from `HEADER_DEFINITIONS.find(d => d.tabName === 'Tenancies')`.
2. `parseRow(row: RowWithIndex): Tenancy | null` — parse sheet row to typed Tenancy.
3. `serializeRow(tenancy: Tenancy): string[]` — serialize Tenancy to sheet row array (16 elements).
4. `ensureTenanciesTab(accessToken, spreadsheetId)` — lazy bootstrap mirroring `ensurePushSubscriptionsTab`: try readValues on A1 row → if 400 → addSheet + writeHeaders → if empty headers → writeHeaders.
5. `fetchTenancies(accessToken, spreadsheetId, propertyMap: Map<string, string>): Promise<TenancyWithDisplay[]>` — read all rows, parse, filter non-deleted, enrich with `propertyName` from map.
6. `addTenancy(accessToken, spreadsheetId, data: TenancyFormData): Promise<Tenancy>` — build Tenancy object with `uuidv4()`, serialize, appendRows.
7. `updateTenancy(accessToken, spreadsheetId, existing: Tenancy, data: Partial<TenancyFormData>): Promise<Tenancy>` — merge data, updateRow.
8. `toggleTenancyActive(accessToken, spreadsheetId, tenancy: Tenancy): Promise<Tenancy>` — flip `isActive`, updateRow.
9. `softDeleteTenancy(accessToken, spreadsheetId, tenancy: Tenancy): Promise<void>` — set `deletedAt` to ISO now via updateCell. Per R-001: does NOT cascade to linked records.
10. `undoDeleteTenancy(accessToken, spreadsheetId, tenancy: Tenancy): Promise<void>` — clear `deletedAt` via updateCell.

Imports: `uuid`, `schema.ts`, `sheetsService` (readAllRows, readValues, updateRow, updateCell, appendRows, writeHeaders, addSheet), `googleApi` (GoogleApiRequestError), `../types`.

**Before**: File does not exist.
**After**: File exists with 8 exported functions + parseRow + serializeRow.

**Done when**: `npm run build` compiles. All functions are importable from `../services/tenanciesService`.

---

### T010: Create `src/services/rentCollectionsService.ts`

**File**: `src/services/rentCollectionsService.ts` (NEW)
**FR**: FR-009, FR-011, FR-018, FR-019, FR-033, FR-034, DD-003 | **R**: R-004, R-006

New file following `billsService.ts` pattern (simpler — no calendar, no file attachments). Exports:

1. **Column index map**: Derive `COL` from `HEADER_DEFINITIONS.find(d => d.tabName === 'RentCollections')`.
2. `parseRow(row: RowWithIndex): RentCollection | null` — parse sheet row.
3. `serializeRow(collection: RentCollection): string[]` — serialize to 10-element row array.
4. `ensureRentCollectionsTab(accessToken, spreadsheetId)` — lazy bootstrap (same pattern as T009).
5. `fetchRentCollections(accessToken, spreadsheetId): Promise<RentCollection[]>` — read all, parse, return all (including deleted — caller filters).
6. `addRentCollection(accessToken, spreadsheetId, data): Promise<RentCollection>` — build with `uuidv4()`, serialize, appendRows.
7. `updateRentCollection(accessToken, spreadsheetId, existing, data): Promise<RentCollection>` — merge, updateRow.
8. `softDeleteRentCollection(accessToken, spreadsheetId, collection): Promise<void>` — set `deletedAt`.
9. `undoDeleteRentCollection(accessToken, spreadsheetId, collection): Promise<void>` — clear `deletedAt`.
10. `computeCompositeKey(tenancyId: string, month: string): string` — returns `${tenancyId}|${month}`.
11. `checkDuplicate(compositeKey: string, collections: RentCollection[], excludeId?: string): RentCollection | null` — find non-deleted match.
12. `computeRentStatus(expectedAmount: number, totalReceived: number, month: string, today?: string): RentDisplayStatus` — exact logic from data-model.md: received if sum >= expected, overdue if month ended, partial if sum > 0, else pending.

**Before**: File does not exist.
**After**: File exists with 10 exported functions + parseRow + serializeRow.

**Done when**: `npm run build` compiles. `computeRentStatus` returns correct status for all 4 cases. All functions importable.

---

### T011: Create `src/services/paymentEventsService.ts`

**File**: `src/services/paymentEventsService.ts` (NEW)
**FR**: FR-025, FR-029, FR-031, FR-032, DD-002 | **R**: R-006

Simplest service — no edit (payments are immutable once created, only soft-delete). Exports:

1. **Column index map**: Derive `COL` from `HEADER_DEFINITIONS.find(d => d.tabName === 'PaymentEvents')`.
2. `parseRow(row: RowWithIndex): PaymentEvent | null` — parse sheet row.
3. `serializeRow(event: PaymentEvent): string[]` — serialize to 9-element row array.
4. `ensurePaymentEventsTab(accessToken, spreadsheetId)` — lazy bootstrap (same pattern).
5. `fetchPaymentEvents(accessToken, spreadsheetId): Promise<PaymentEvent[]>` — read all, parse, return all.
6. `addPaymentEvent(accessToken, spreadsheetId, data: { collectionId: string; amount: number; paymentDate: string; paymentMethod: string; notes: string }): Promise<PaymentEvent>` — build with `uuidv4()`, serialize, appendRows.
7. `softDeletePaymentEvent(accessToken, spreadsheetId, event: PaymentEvent): Promise<void>` — set `deletedAt`.
8. `undoDeletePaymentEvent(accessToken, spreadsheetId, event: PaymentEvent): Promise<void>` — clear `deletedAt`.

**Before**: File does not exist.
**After**: File exists with 6 exported functions + parseRow + serializeRow.

**Done when**: `npm run build` compiles. All functions importable from `../services/paymentEventsService`.

---

### T012: Create `ensureRentalTabs` orchestrator utility

**File**: `src/services/tenanciesService.ts` (add to existing from T009)
**FR**: FR-017 | **R**: R-006, R-010

Add a new exported function `ensureRentalTabs` that calls all 3 tab-ensure functions in parallel:

```typescript
export async function ensureRentalTabs(
  accessToken: string,
  spreadsheetId: string,
): Promise<void> {
  await Promise.all([
    ensureTenanciesTab(accessToken, spreadsheetId),
    ensureRentCollectionsTab(accessToken, spreadsheetId),
    ensurePaymentEventsTab(accessToken, spreadsheetId),
  ]);
}
```

Import `ensureRentCollectionsTab` from `./rentCollectionsService` and `ensurePaymentEventsTab` from `./paymentEventsService`.

This function is called from:
1. `RentalsPage.tsx` — on mount (Chunk 2)
2. (Cron does NOT call this — per R-010 DEGRADE-ON-MISSING, cron never creates tabs)

**Before**: `tenanciesService.ts` has individual `ensureTenanciesTab`.
**After**: `tenanciesService.ts` additionally exports `ensureRentalTabs` orchestrator.

**Done when**: `npm run build` compiles. `ensureRentalTabs` is importable and calls all 3 ensure functions.

---

### T013: Add `computeDueDate` re-export or import path note

**File**: `src/services/rentCollectionsService.ts` (update from T010)
**FR**: FR-018 | **R**: R-006

The `computeDueDate` function already exists in `billsService.ts` (line 48). Import it directly for computing rent due dates from month + tenancy's `rentDueDay`:

```typescript
import { computeDueDate } from './billsService';
```

Use this in `addRentCollection` when computing the due date for a new rent collection record: `computeDueDate(month, rentDueDay)`.

Also import `formatCurrency` and `formatMonth` from `billsService` for later use in Chunk 2/3 (they are already exported).

**Before**: `rentCollectionsService.ts` does not reference `billsService`.
**After**: `rentCollectionsService.ts` imports `computeDueDate` from `billsService`.

**Done when**: `npm run build` compiles. Due date clamping works correctly (e.g., day 31 in February → Feb 28).

---

### T014: Chunk 1 build verification

**Action**: Run `npm run build`. Verify clean compile with zero errors.

**FR**: All Chunk 1 FRs | **R**: R-006, R-007

**Verification checklist**:
- [ ] `HEADER_DEFINITIONS` has 13 entries (10 existing + 3 new rental tabs)
- [ ] `TAB_NAMES` still has 10 entries (rental tabs NOT added — lazy bootstrap only)
- [ ] All 3 service files compile: `tenanciesService.ts`, `rentCollectionsService.ts`, `paymentEventsService.ts`
- [ ] All new types importable: `Tenancy`, `TenancyWithDisplay`, `TenancyFormData`, `RentCollection`, `RentCollectionWithDisplay`, `RentDisplayStatus`, `PaymentEvent`, `PaymentEventFormData`
- [ ] `ActionType` union has 34 values (26 existing + 8 new)
- [ ] `ActivityEntityType` union has 9 values (6 existing + 3 new)
- [ ] `AttentionItem` has 3 variants (bill, todo, rent)
- [ ] `ACTION_LABELS` has 34 entries, `ENTITY_ICONS` maps 9 entity types
- [ ] `ensureRentalTabs` is importable and calls all 3 tab-ensure functions

**Done when**: `npm run build` passes with zero errors. All Chunk 1 deliverables verified.

---

## Chunk 2: Tenancy Management UI (~14 tasks)

**Goal**: `/rentals` page with full tenancy CRUD — add, edit, toggle active/inactive, soft-delete with undo, property grouping, property filter, first-run empty state. No rent collection data yet.

### T015: Add `/rentals` route to `src/App.tsx`

**File**: `src/App.tsx`
**FR**: FR-008

1. Import `RentalsPage` from `./pages/RentalsPage`.
2. Add route inside the BootstrapLayout group (after the `/todos` route, line 49):
   ```tsx
   <Route path="/rentals" element={<ProtectedRoute><RentalsPage /></ProtectedRoute>} />
   ```

**Before**: BootstrapLayout has 9 routes: /dashboard, /bills, /todos, /settings, and 5 settings sub-routes. No /rentals route.
**After**: BootstrapLayout has 10 routes. `/rentals` renders `RentalsPage` inside `ProtectedRoute`.

**Done when**: `npm run build` compiles. Navigating to `/rentals` renders the RentalsPage.

---

### T016: Add Rentals nav item to `src/components/shared/Navbar.tsx`

**File**: `src/components/shared/Navbar.tsx`
**FR**: FR-007

1. Add `Landmark` to the lucide-react import (line 3–10).
2. Add a new entry to `navItems` array (line 15–20), after the `To-Dos` entry and before `Settings`:
   ```typescript
   { to: "/rentals", label: "Rentals", Icon: Landmark },
   ```

**Before**: `navItems` has 4 entries: Dashboard, Bills, To-Dos, Settings.
**After**: `navItems` has 5 entries: Dashboard, Bills, To-Dos, Rentals, Settings.

**Done when**: `npm run build` compiles. Navigation bar shows "Rentals" link between "To-Dos" and "Settings" on both desktop and mobile.

---

### T017: Create `src/pages/RentalsPage.tsx` shell

**File**: `src/pages/RentalsPage.tsx` (NEW)
**FR**: FR-001, FR-009, FR-012, FR-052 | **R**: R-009

Create the main Rentals page component with initial data loading and state management shell. This task creates the minimal page structure; subsequent tasks add components and handlers.

1. **Imports**: React hooks, `useAuth`, `useBootstrap`, `useToast`, `fetchProperties`, `fetchTenancies`, `ensureRentalTabs`, service imports, `APP_TITLE_SUFFIX`, types.
2. **Document title**: `NoDues · Rentals`.
3. **State**: `isLoading`, `isSaving`, `properties`, `tenancies`, `selectedMonth` (default: current YYYY-MM), `filterProperty` (default: 'all'), modal targets for add/edit tenancy.
4. **Data loading**: `loadData()` — call `ensureRentalTabs` → `Promise.all([fetchProperties, fetchTenancies])`. Shows loading spinner while fetching.
5. **Mount**: `useEffect` calling `loadData()`.
6. **Layout**: `px-4 py-6 sm:px-6 lg:px-8 max-w-3xl mx-auto pb-24` (matches DashboardPage).
7. **Header**: "Rentals" h1 + "Add Tenancy" button.
8. **Loading state**: `<Loader2>` spinner centered.
9. **Placeholder for tenancy list**: Empty div (populated in T020).

**Before**: File does not exist.
**After**: File exists with basic page shell, data loading, and loading state.

**Done when**: `npm run build` compiles. `/rentals` renders a page with "Rentals" header and loading spinner on mount.

---

### T018: Create `src/components/rentals/AddTenancyModal.tsx`

**File**: `src/components/rentals/AddTenancyModal.tsx` (NEW)
**FR**: FR-002, FR-003, FR-044, FR-045, FR-046, FR-047, FR-048, DD-010 | **R**: R-009

Dual-mode modal (add/edit) for tenancy forms. Props:

- `mode: 'add' | 'edit'`
- `tenancy?: Tenancy` (pre-fill in edit mode)
- `properties: Property[]` (for dropdown)
- `isSaving: boolean`
- `onSubmit: (data: TenancyFormData) => void`
- `onClose: () => void`

Form fields:
1. **Property** (dropdown, required) — shows active non-deleted properties. Read-only in edit mode (FR-003).
2. **Unit label** (text, optional) — e.g., "Room 1", "Flat 3A".
3. **Name** (text, required) — FR-044.
4. **Phone** (text, optional) — DD-010 v1 addition.
5. **Email** (text, optional) — DD-010 v1 addition.
6. **Rent amount** (number, required, > 0) — FR-045.
7. **Security deposit** (number, optional, >= 0) — FR-048.
8. **Rent due day** (number, required, 1–31, default: 1) — FR-046.
9. **Lease start date** (date, required) — FR-047.
10. **Lease end date** (date, optional).
11. **Notes** (textarea, optional).

Validation: name non-empty, rent amount > 0, rent due day 1–31, lease start date valid, security deposit >= 0 if provided.

No-properties guard: If `properties` is empty, show "No active properties. Add a property first." and disable submit.

**Before**: File does not exist.
**After**: File exists with dual-mode tenancy form modal.

**Done when**: `npm run build` compiles. Modal renders with all fields and validates required inputs.

---

### T019: Create `src/components/rentals/TenancyCard.tsx`

**File**: `src/components/rentals/TenancyCard.tsx` (NEW)
**FR**: FR-001, FR-004, FR-005 | **R**: R-009

Tenancy row display component. Props:

- `tenancy: TenancyWithDisplay`
- `onEdit: (tenancy: TenancyWithDisplay) => void`
- `onToggle: (tenancy: TenancyWithDisplay) => void`
- `onDelete: (tenancy: TenancyWithDisplay) => void`
- `isLoading: boolean`

Renders:
1. Tenant name + unit label (if any, in parentheses) — e.g., "Ramesh (Room 1)".
2. Rent amount (formatted as ₹ with Indian number formatting).
3. Active/Inactive badge — green "Active" or amber "Inactive".
4. Rent due day — e.g., "Due: 5th".
5. Lease dates — "Jan 2026 – Dec 2026" or "Jan 2026 – Indefinite".
6. Action buttons row: Edit, Toggle Active/Inactive, Delete.

**Before**: File does not exist.
**After**: File exists with tenancy row display and action buttons.

**Done when**: `npm run build` compiles. Component renders tenancy details with all action buttons.

---

### T020: Implement tenancy display with property grouping in `src/pages/RentalsPage.tsx`

**File**: `src/pages/RentalsPage.tsx`
**FR**: FR-001, FR-006 | **R**: R-009

1. Import `TenancyCard` from `../components/rentals/TenancyCard`.
2. Add `useMemo` to compute `groupedByProperty`: group non-deleted tenancies under property headings. Each group has `propertyId`, `propertyName`, and `tenancies[]` array.
3. Render property groups: for each group, render a property heading (h2 with property name) followed by `TenancyCard` for each tenancy.
4. Wire up placeholder handler stubs for `onEdit`, `onToggle`, `onDelete` (implemented in T022–T024).

**Before**: `RentalsPage.tsx` has a placeholder div for the tenancy list.
**After**: `RentalsPage.tsx` renders tenancies grouped under property headings.

**Done when**: `npm run build` compiles. Tenancies appear grouped by property with headings.

---

### T021: Implement Add Tenancy handler in `src/pages/RentalsPage.tsx`

**File**: `src/pages/RentalsPage.tsx`
**FR**: FR-002, FR-035 | **R**: R-007

1. Import `AddTenancyModal`.
2. Add state: `addTenancyModalOpen: boolean`.
3. Add `handleAddTenancy(data: TenancyFormData)`:
   - Set `isSaving(true)`.
   - Call `addTenancy(accessToken, spreadsheetId, data)`.
   - Call `appendActivityLogSafe` with action `'tenancy_added'`, entityType `'tenancy'`, summary: `Tenant added: {name} ({unitLabel}) — {propertyName}` (omit unitLabel parenthetical if empty).
   - Refresh data via `loadData()`.
   - Close modal, show success toast.
   - On error: show error toast, keep modal open.
4. Wire "Add Tenancy" button in header to open modal.
5. Render `AddTenancyModal` when `addTenancyModalOpen` is true.

**Before**: "Add Tenancy" button has no handler. No modal rendered.
**After**: Add Tenancy flow works end-to-end with activity logging.

**Done when**: `npm run build` compiles. Adding a tenancy creates a row in the Sheet, logs activity, and updates the list.

---

### T022: Implement tenancy toggle active/inactive in `src/pages/RentalsPage.tsx`

**File**: `src/pages/RentalsPage.tsx`
**FR**: FR-004, FR-035 | **R**: R-007

Add `handleToggleTenancy(tenancy: TenancyWithDisplay)`:
1. Set `isSaving(true)`.
2. Call `toggleTenancyActive(accessToken, spreadsheetId, tenancy)`.
3. Call `appendActivityLogSafe` with action `'tenancy_toggled'`, summary: `Tenant {active/inactive}: {name} ({unitLabel}) — {propertyName}`.
4. Refresh data.
5. Show toast: "Tenant set to {active/inactive}."

Wire to `TenancyCard`'s `onToggle` prop.

**Before**: Toggle handler is a stub.
**After**: Toggle active/inactive persists immediately with activity log.

**Done when**: `npm run build` compiles. Toggling a tenancy updates the badge and persists to Sheet.

---

### T023: Implement tenancy soft-delete with undo in `src/pages/RentalsPage.tsx`

**File**: `src/pages/RentalsPage.tsx`
**FR**: FR-005, FR-035, FR-055 | **R**: R-001, R-007

Add `handleDeleteTenancy(tenancy: TenancyWithDisplay)`:
1. Optimistic UI: remove tenancy from local state immediately.
2. Call `softDeleteTenancy(accessToken, spreadsheetId, tenancy)`.
3. Show undo snackbar (10-second window) via `showToast` with undo action.
4. If undo tapped: call `undoDeleteTenancy`, log `'tenancy_restored'`, refresh.
5. If undo not tapped: log `'tenancy_deleted'`.
6. On soft-delete error: rollback optimistic removal, show error toast.

Per R-001: only the tenancy's `deleted_at` is set. Linked RentCollections and PaymentEvents remain untouched.

Wire to `TenancyCard`'s `onDelete` prop.

**Before**: Delete handler is a stub.
**After**: Soft-delete with 10-second undo, optimistic UI, and activity logging. Orphan pattern per R-001.

**Done when**: `npm run build` compiles. Deleting a tenancy shows undo snackbar; undo restores it.

---

### T024: Implement tenancy edit flow in `src/pages/RentalsPage.tsx`

**File**: `src/pages/RentalsPage.tsx`
**FR**: FR-003, FR-035 | **R**: R-007

1. Add state: `editTenancyTarget: TenancyWithDisplay | null`.
2. Add `handleEditTenancy(data: TenancyFormData)`:
   - Call `updateTenancy(accessToken, spreadsheetId, editTenancyTarget!, data)`.
   - Log `'tenancy_updated'` with summary.
   - Refresh data, close modal, show toast.
3. Render `AddTenancyModal` in edit mode when `editTenancyTarget` is set (pass `mode='edit'`, `tenancy=editTenancyTarget`).

Wire to `TenancyCard`'s `onEdit` prop.

**Before**: Edit handler is a stub.
**After**: Edit flow pre-fills modal (property read-only), saves changes, logs activity.

**Done when**: `npm run build` compiles. Editing a tenancy persists changes and property field is read-only.

---

### T025: Implement property filter in `src/pages/RentalsPage.tsx`

**File**: `src/pages/RentalsPage.tsx`
**FR**: FR-014

1. Add a `<select>` dropdown above the tenancy list with options: "All Properties" + one option per property that has tenancies.
2. State: `filterProperty` (already declared in T017, default `'all'`).
3. Filter `groupedByProperty` by `filterProperty` before rendering.

**Before**: All property groups always shown.
**After**: Property filter dropdown filters the displayed tenancies.

**Done when**: `npm run build` compiles. Selecting a property shows only that property's tenancies.

---

### T026: Implement first-run empty state in `src/pages/RentalsPage.tsx`

**File**: `src/pages/RentalsPage.tsx`
**FR**: FR-052 (User Story 10)

1. When `tenancies` is empty and `isLoading` is false, show empty state:
   - Illustration or icon (e.g., `Landmark` from lucide).
   - Message: "No tenants yet. Add a tenant to start tracking rent collection."
   - Prominent "Add Tenancy" button that opens the `AddTenancyModal`.
2. When tenancies exist but none match the selected property filter, show: "No tenancies for this property."

**Before**: Empty list renders nothing.
**After**: Helpful empty state with CTA guides new users.

**Done when**: `npm run build` compiles. Empty state renders when no tenancies exist and button opens modal.

---

### T027: Activity log entries for tenancy actions

**File**: `src/pages/RentalsPage.tsx`
**FR**: FR-035, FR-036 | **R**: R-007

Verify all tenancy handlers from T021–T024 call `appendActivityLogSafe` with correct parameters:

| Handler | Action | Entity Type | Summary Format |
|---------|--------|-------------|----------------|
| Add | `tenancy_added` | `tenancy` | `Tenant added: {name} ({unitLabel}) — {propertyName}` |
| Edit | `tenancy_updated` | `tenancy` | `Tenant updated: {name} ({unitLabel}) — {propertyName}` |
| Toggle | `tenancy_toggled` | `tenancy` | `Tenant {active/inactive}: {name} ({unitLabel}) — {propertyName}` |
| Delete | `tenancy_deleted` | `tenancy` | `Tenant deleted: {name} ({unitLabel}) — {propertyName}` |
| Undo delete | `tenancy_restored` | `tenancy` | `Tenant restored: {name} ({unitLabel}) — {propertyName}` |

Note: `{unitLabel}` parenthetical is omitted when empty (single-unit property).

Import `appendActivityLogSafe` from `../services/activityLogService` and `uuidv4` from `uuid`.

**Before**: Activity log calls may be incomplete across T021–T024.
**After**: All 5 tenancy action types are logged with consistent summary format per R-007.

**Done when**: All tenancy CRUD operations produce activity log entries in the Sheet. Activity Log page displays them correctly with Landmark icon.

---

### T028: Chunk 2 build verification

**Action**: Run `npm run build`. Verify clean compile with zero errors.

**FR**: All Chunk 2 FRs (FR-001–FR-008, FR-014, FR-035, FR-036, FR-044–FR-048, FR-052–FR-055)

**Manual smoke test**:
- [ ] Navigate to `/rentals` — page loads with "Rentals" header
- [ ] Navigation bar shows "Rentals" between "To-Dos" and "Settings"
- [ ] Add a tenancy for a property with unit label "Room 1" → appears in list under property heading
- [ ] Add a second tenancy for the same property with unit label "Room 2" → both shown under same property
- [ ] Edit tenancy → property field is read-only, other fields editable
- [ ] Toggle inactive → "Inactive" badge appears
- [ ] Soft-delete → tenancy disappears, undo snackbar shows, undo restores
- [ ] Property filter → shows only selected property's tenancies
- [ ] Empty state → shows when no tenancies exist
- [ ] Activity Log page → shows all tenancy actions with Landmark icon
- [ ] Validation: empty name blocked, rent amount ≤ 0 blocked, due day 0 or 32 blocked

**Done when**: `npm run build` passes with zero errors. All smoke tests pass. No rent collection data yet (Chunk 3).

---

## Chunk 3: RentCollection + PaymentEvent UI (~16 tasks)

**Goal**: Full rent collection + payment event UI on the `/rentals` page — month navigator, summary header, collection cards with status badges, Mark Received Full/Partial modals, payment history, collection history, collection edit/delete.

### T029: Create `src/components/rentals/MonthNavigator.tsx`

**File**: `src/components/rentals/MonthNavigator.tsx` (NEW)
**FR**: FR-013 | **R**: R-009

Pure presentational component. Props:

- `selectedMonth: string` (YYYY-MM format)
- `onChange: (month: string) => void`

Renders: left chevron button, formatted month label (e.g., "Jun 2026" via `formatMonth`), right chevron button. Clicking left/right computes prev/next month string.

Import `formatMonth` from `../../services/billsService`. Import `ChevronLeft`, `ChevronRight` from `lucide-react`.

**Before**: File does not exist.
**After**: File exists with month navigator component.

**Done when**: `npm run build` compiles. Component navigates months forward/backward and displays formatted month label.

---

### T030: Create `src/components/rentals/RentSummaryHeader.tsx`

**File**: `src/components/rentals/RentSummaryHeader.tsx` (NEW)
**FR**: FR-012 | **R**: R-009

Pure presentational component. Props:

- `totalExpected: number`
- `totalReceived: number`
- `totalOutstanding: number`
- `pendingCount: number`

Renders a summary bar showing 4 values with ₹ formatting (via `formatCurrency`): total expected, total received, total outstanding, and count of pending/partial entries. Uses card-style layout consistent with Dashboard summary cards.

**Before**: File does not exist.
**After**: File exists with rent summary header.

**Done when**: `npm run build` compiles. Component renders 4 summary values with correct formatting.

---

### T031: Create `src/components/rentals/CollectionCard.tsx`

**File**: `src/components/rentals/CollectionCard.tsx` (NEW)
**FR**: FR-010, FR-011, FR-023, FR-026, FR-027, FR-030 | **R**: R-004, R-009

Collection row display component. Props:

- `collection: RentCollectionWithDisplay`
- `paymentEvents: PaymentEvent[]` (for this collection)
- `tenancy: TenancyWithDisplay`
- `onMarkReceivedFull: (collection: RentCollectionWithDisplay) => void`
- `onMarkReceivedPartial: (collection: RentCollectionWithDisplay) => void`
- `onEdit: (collection: RentCollectionWithDisplay) => void`
- `onDelete: (collection: RentCollectionWithDisplay) => void`
- `onDeletePaymentEvent: (event: PaymentEvent) => void`
- `isLoading: boolean`

Renders:
1. Expected amount, received total, remaining balance.
2. Status badge — green "Received", blue "Partial", amber "Pending", red "Overdue" (FR-011).
3. Action buttons:
   - "Mark Received Full" — **hidden when status is "received"** (FR-026, R-004).
   - "Mark Received Partial" — **hidden when status is "received"** (FR-030, R-004).
   - "Edit" and "Delete" always visible.
4. `PaymentHistorySection` (imported, rendered inline — created in T039).

**Before**: File does not exist.
**After**: File exists with collection row display, status badges, and conditional action buttons.

**Done when**: `npm run build` compiles. Status badge renders correctly for all 4 statuses. Mark Received buttons hidden when status is "received".

---

### T032: Integrate collection display into `src/pages/RentalsPage.tsx`

**File**: `src/pages/RentalsPage.tsx`
**FR**: FR-009, FR-010, FR-012 | **R**: R-009

1. Add state: `collections: RentCollection[]`, `paymentEvents: PaymentEvent[]`.
2. Extend `loadData()` to also fetch rent collections and payment events via `fetchRentCollections` and `fetchPaymentEvents` (added to the existing `Promise.all`).
3. Add `useMemo` to compute enriched collections for the selected month:
   - Filter collections by `selectedMonth` and non-deleted.
   - For each collection, compute `totalReceived` from non-deleted payment events, `remainingBalance`, `displayStatus` via `computeRentStatus`.
   - Build `RentCollectionWithDisplay[]` with tenancy and property info.
4. Integrate `MonthNavigator` above the collection list.
5. Integrate `RentSummaryHeader` with computed totals.
6. Under each tenancy in the property group, render `CollectionCard` for matching collections.

**Before**: RentalsPage shows tenancies only, no collection data.
**After**: RentalsPage shows month navigator, summary header, and collection cards under each tenancy.

**Done when**: `npm run build` compiles. Collections display under their tenancies with correct status and amounts.

---

### T033: Implement status badge computation and sorting in `src/pages/RentalsPage.tsx`

**File**: `src/pages/RentalsPage.tsx`
**FR**: FR-011, FR-015

1. Status badges are computed via `computeRentStatus` from `rentCollectionsService` (already called in T032).
2. Add sorting within each property group per FR-015: overdue first (oldest due date first), then pending (soonest due date first), then partial (soonest due date first), then received (most recently received first).
3. Define sort priority: `{ overdue: 0, pending: 1, partial: 2, received: 3 }`.

**Before**: Collections display unsorted.
**After**: Collections sorted per FR-015 within each property group.

**Done when**: `npm run build` compiles. Collections appear in correct priority order within each property group.

---

### T034: Create `src/components/rentals/MarkReceivedFullModal.tsx`

**File**: `src/components/rentals/MarkReceivedFullModal.tsx` (NEW)
**FR**: FR-023, FR-024, FR-025 | **R**: R-009

Quick form modal. Props:

- `collection: RentCollectionWithDisplay`
- `tenancy: TenancyWithDisplay`
- `remainingBalance: number`
- `isSaving: boolean`
- `onSubmit: (data: { paymentDate: string; paymentMethod: string; notes: string }) => void`
- `onClose: () => void`

Fields:
1. **Display** (read-only): Tenant name, expected amount, already received, remaining balance.
2. **Payment date** (date, default: today IST, required) — FR-024.
3. **Payment method** (dropdown, required) — reuse `PAYMENT_METHOD_OPTIONS` — FR-024.
4. **Notes** (textarea, optional) — FR-024.

Amount is NOT an input — it equals `remainingBalance` (FR-025).

**Before**: File does not exist.
**After**: File exists with Mark Received Full form modal.

**Done when**: `npm run build` compiles. Modal shows remaining balance as the amount to be recorded.

---

### T035: Implement Mark Received Full handler in `src/pages/RentalsPage.tsx`

**File**: `src/pages/RentalsPage.tsx`
**FR**: FR-025, FR-035 | **R**: R-007

1. Add state: `markReceivedFullTarget: RentCollectionWithDisplay | null`.
2. Add `handleMarkReceivedFull(data)`:
   - Call `addPaymentEvent` with amount = `markReceivedFullTarget.remainingBalance`, plus date/method/notes from form.
   - Log `'payment_received'` activity: `Rent received: {name} ({unitLabel}) — {propertyName} ₹{amount} {Mon YYYY}`.
   - Refresh data, close modal, show success toast.
3. Wire `CollectionCard`'s `onMarkReceivedFull` to set `markReceivedFullTarget`.
4. Render `MarkReceivedFullModal` when target is set.

**Before**: Mark Received Full is not functional.
**After**: Full payment recording works end-to-end.

**Done when**: `npm run build` compiles. Recording full payment creates PaymentEvent, recomputes status to "received", logs activity.

---

### T036: Create `src/components/rentals/MarkReceivedPartialModal.tsx`

**File**: `src/components/rentals/MarkReceivedPartialModal.tsx` (NEW)
**FR**: FR-027, FR-028, FR-029, FR-049 | **R**: R-009

Full form modal. Props:

- `collection: RentCollectionWithDisplay`
- `tenancy: TenancyWithDisplay`
- `remainingBalance: number`
- `isSaving: boolean`
- `onSubmit: (data: { amount: number; paymentDate: string; paymentMethod: string; notes: string }) => void`
- `onClose: () => void`

Fields:
1. **Display** (read-only): Tenant name, expected amount, already received, remaining balance.
2. **Amount** (number, required, > 0) — FR-049, FR-028.
3. **Payment date** (date, default: today IST, required) — FR-028.
4. **Payment method** (dropdown, required) — FR-028.
5. **Notes** (textarea, optional) — FR-028.

Validation: amount > 0 (FR-049).

**Before**: File does not exist.
**After**: File exists with Mark Received Partial form modal.

**Done when**: `npm run build` compiles. Modal accepts custom amount with validation.

---

### T037: Implement Mark Received Partial handler in `src/pages/RentalsPage.tsx`

**File**: `src/pages/RentalsPage.tsx`
**FR**: FR-029, FR-035 | **R**: R-007

1. Add state: `markReceivedPartialTarget: RentCollectionWithDisplay | null`.
2. Add `handleMarkReceivedPartial(data)`:
   - Call `addPaymentEvent` with amount from form.
   - Log `'payment_received'` activity with amount.
   - Refresh data, close modal, show success toast.
3. Wire `CollectionCard`'s `onMarkReceivedPartial` to set target.
4. Render `MarkReceivedPartialModal` when target is set.

**Before**: Mark Received Partial is not functional.
**After**: Partial payment recording works end-to-end.

**Done when**: `npm run build` compiles. Partial payment creates PaymentEvent, status recomputes to "partial" or "received".

---

### T038: Create `src/components/rentals/PaymentHistorySection.tsx`

**File**: `src/components/rentals/PaymentHistorySection.tsx` (NEW)
**FR**: FR-031 | **R**: R-009

Expandable payment events list. Props:

- `paymentEvents: PaymentEvent[]`
- `onDelete: (event: PaymentEvent) => void`
- `isLoading: boolean`

Renders:
1. Header: "Payment History" with expand/collapse toggle.
2. Event list in reverse chronological order (sort by `paymentDate` desc, then `createdAt` desc).
3. Each event shows: amount (₹ formatted), date, payment method, notes (if any), delete button.
4. Total received at the bottom.
5. Empty state: "No payments recorded yet." when no events.

**Before**: File does not exist.
**After**: File exists with expandable payment history list.

**Done when**: `npm run build` compiles. Payment events display in reverse chronological order with delete buttons.

---

### T039: Implement payment event soft-delete in `src/pages/RentalsPage.tsx`

**File**: `src/pages/RentalsPage.tsx`
**FR**: FR-032, FR-035, FR-055 | **R**: R-007

Add `handleDeletePaymentEvent(event: PaymentEvent)`:
1. Optimistic UI: remove event from local state.
2. Call `softDeletePaymentEvent(accessToken, spreadsheetId, event)`.
3. Show undo snackbar (10-second window).
4. If undo: call `undoDeletePaymentEvent`, refresh.
5. If no undo: log `'payment_deleted'` activity.
6. On error: rollback, show error toast.
7. After delete or undo, recompute collection status (sum changes → status may change, e.g., "received" → "partial").

Wire to `CollectionCard`'s `onDeletePaymentEvent` → `PaymentHistorySection`'s `onDelete`.

**Before**: Payment event delete is not functional.
**After**: Soft-delete with undo, status recomputation, and activity logging.

**Done when**: `npm run build` compiles. Deleting a payment event recomputes status (e.g., "received" reverts to "partial" or "pending").

---

### T040: Implement rent collection edit in `src/pages/RentalsPage.tsx`

**File**: `src/pages/RentalsPage.tsx`
**FR**: FR-033

1. Add state: `editCollectionTarget: RentCollectionWithDisplay | null`.
2. Add a simple inline edit modal or reuse a generic form for editing: expected amount, due date, and notes. Tenancy, month, and payment events are NOT editable (FR-033).
3. Add `handleEditCollection(data)`:
   - Call `updateRentCollection(accessToken, spreadsheetId, editCollectionTarget, data)`.
   - Refresh data, close modal, show toast.

Wire to `CollectionCard`'s `onEdit`.

**Before**: Collection edit is not functional.
**After**: Expected amount, due date, and notes editable on a rent collection record.

**Done when**: `npm run build` compiles. Editing a collection persists changes to Sheet.

---

### T041: Implement rent collection soft-delete in `src/pages/RentalsPage.tsx`

**File**: `src/pages/RentalsPage.tsx`
**FR**: FR-034, FR-055

Add `handleDeleteCollection(collection: RentCollectionWithDisplay)`:
1. Optimistic UI: remove collection from local state.
2. Call `softDeleteRentCollection(accessToken, spreadsheetId, collection)`.
3. Show undo snackbar (10-second window).
4. If undo: call `undoDeleteRentCollection`, refresh.
5. On error: rollback, show error toast.

Note per edge case in spec: If the owner deletes a collection and the cron runs again, the cron re-creates it (deleted records excluded from idempotency check, matching bills recurrence pattern).

Wire to `CollectionCard`'s `onDelete`.

**Before**: Collection delete is not functional.
**After**: Soft-delete with undo, optimistic UI.

**Done when**: `npm run build` compiles. Deleting a collection removes it with undo option.

---

### T042: Create `src/components/rentals/CollectionHistorySection.tsx`

**File**: `src/components/rentals/CollectionHistorySection.tsx` (NEW)
**FR**: FR-016 | **R**: R-009

Expandable past-months mini-view per tenancy. Props:

- `collections: RentCollectionWithDisplay[]` (past months for this tenancy, sorted newest first)
- `paymentEventsByCollection: Map<string, PaymentEvent[]>`

Renders:
1. Collapsible section: "Collection History" toggle.
2. Mini-table showing past 3–6 months: month label, expected amount, total received, status badge.
3. Each row is read-only (no action buttons — historical view).

**Before**: File does not exist.
**After**: File exists with expandable collection history.

**Done when**: `npm run build` compiles. Past months show with correct status badges.

---

### T043: Integrate CollectionHistorySection into `src/pages/RentalsPage.tsx`

**File**: `src/pages/RentalsPage.tsx`
**FR**: FR-016

1. For each tenancy in the grouped display, compute past collections (months before `selectedMonth`, non-deleted, sorted newest first, limit to 6).
2. Render `CollectionHistorySection` under each tenancy's current-month collection card(s).
3. Pass pre-computed `paymentEventsByCollection` map.

**Before**: No collection history shown.
**After**: Each tenancy row is expandable to show past 3–6 months of history.

**Done when**: `npm run build` compiles. Expanding a tenancy shows past collection records with status.

---

### T044: Activity log entries for payment and collection actions

**File**: `src/pages/RentalsPage.tsx`
**FR**: FR-035, FR-036 | **R**: R-007

Verify all payment/collection handlers from T035–T041 call `appendActivityLogSafe`:

| Handler | Action | Entity Type | Summary Format |
|---------|--------|-------------|----------------|
| Mark Received Full | `payment_received` | `payment_event` | `Rent received: {name} ({unitLabel}) — {propertyName} ₹{amount} {Mon YYYY}` |
| Mark Received Partial | `payment_received` | `payment_event` | `Rent received: {name} ({unitLabel}) — {propertyName} ₹{amount} {Mon YYYY}` |
| Delete Payment | `payment_deleted` | `payment_event` | `Payment deleted: {name} ({unitLabel}) — {propertyName} ₹{amount} {Mon YYYY}` |

Note: `{unitLabel}` parenthetical omitted when empty. `{Mon YYYY}` is the collection's month formatted (e.g., "Jun 2026").

**Before**: Activity log calls may be incomplete.
**After**: All payment actions produce correct activity log entries per R-007.

**Done when**: Payment received and deleted actions appear in the Activity Log page with correct summaries.

---

### T045: Chunk 3 build verification

**Action**: Run `npm run build`. Verify clean compile with zero errors.

**FR**: All Chunk 3 FRs (FR-009–FR-016, FR-023–FR-034, FR-049–FR-055)

**Manual smoke test**:
- [ ] Month navigator works — prev/next changes displayed month
- [ ] Summary header shows correct totals for the selected month
- [ ] Collection cards show correct status badges (pending/partial/received/overdue)
- [ ] Mark Received Full on a pending record → status changes to "Received", buttons hidden (R-004)
- [ ] Mark Received Partial with ₹4,000 on ₹10,000 → status "Partial", remaining ₹6,000 shown
- [ ] Second partial payment ₹6,000 → status changes to "Received"
- [ ] Payment history shows events in reverse chronological order
- [ ] Delete a payment event → status recomputes (e.g., "received" → "partial")
- [ ] Edit a collection's expected amount → persists
- [ ] Delete a collection → undo works
- [ ] Collection history expands to show past months
- [ ] Sorting: overdue first, then pending, then partial, then received (FR-015)
- [ ] Activity log shows payment_received and payment_deleted entries

**Done when**: `npm run build` passes with zero errors. All smoke tests pass.

---

## Chunk 4: Cron Extension + Dashboard + Push Notifications (~10 tasks)

**Goal**: Complete feature — cron auto-generates monthly rent collection records, includes overdue rents in push notifications, Dashboard shows rent data. DEGRADE-ON-MISSING: cron does NOT create tabs.

### T046: Add rental column index constants to `api/notify.ts`

**File**: `api/notify.ts`
**FR**: FR-017 | **R**: R-006

Add 3 new column index constant objects after the existing `PUSH_SUB_COL` (line ~53):

```typescript
const TENANCIES_COL = {
  ID: 0,
  PROPERTY_ID: 1,
  UNIT_LABEL: 2,
  NAME: 3,
  RENT_AMOUNT: 6,
  RENT_DUE_DAY: 8,
  LEASE_START_DATE: 9,
  LEASE_END_DATE: 10,
  IS_ACTIVE: 11,
  DELETED_AT: 15,
} as const;

const COLLECTIONS_COL = {
  ID: 0,
  TENANCY_ID: 1,
  MONTH: 2,
  EXPECTED_AMOUNT: 3,
  DUE_DATE: 4,
  COMPOSITE_KEY: 6,
  DELETED_AT: 9,
} as const;

const PAYMENTS_COL = {
  ID: 0,
  COLLECTION_ID: 1,
  AMOUNT: 2,
  DELETED_AT: 8,
} as const;
```

**Before**: `api/notify.ts` has column constants for Bills, BillTypes, Properties, Todos, PushSubscriptions.
**After**: Additionally has Tenancies, Collections, and Payments column constants.

**Done when**: `npm run build` compiles (api/ is eslint-ignored). Constants match R-006 column indices.

---

### T047: Add parallel rent tab reads to `api/notify.ts` (DEGRADE-ON-MISSING)

**File**: `api/notify.ts`
**FR**: FR-017 | **R**: R-005, R-010

Extend the existing `Promise.all` read block (line ~231–237) to include 3 new tab reads. Wrap the entire rental read in a **separate try/catch** (Block 1 of R-005):

```typescript
// Block 1: Read rent data (DEGRADE-ON-MISSING per R-010)
let tenancyRows: string[][] = [];
let collectionRows: string[][] = [];
let paymentRows: string[][] = [];
try {
  const [tenanciesResponse, collectionsResponse, paymentsResponse] =
    await Promise.all([
      sheetsGet(accessToken, sheetId, "'Tenancies'!A2:P"),
      sheetsGet(accessToken, sheetId, "'RentCollections'!A2:J"),
      sheetsGet(accessToken, sheetId, "'PaymentEvents'!A2:I"),
    ]);
  tenancyRows = tenanciesResponse.values || [];
  collectionRows = collectionsResponse.values || [];
  paymentRows = paymentsResponse.values || [];
} catch (e) {
  console.error('[notify] Failed to read rent data:', e);
  // Continue — rent features degraded but bills/todos unaffected
}
```

Place this AFTER the existing 4-tab read block and property/billType map building (it needs `propertyMap`).

**CRITICAL per R-010**: Cron does NOT call `ensureRentalTabs` or create tabs. If tabs don't exist (user hasn't visited `/rentals` yet), the `sheetsGet` calls return 400 errors, caught here. Cron continues with bills/todos only.

**Before**: Cron reads 4 tabs (Bills, BillTypes, Properties, Todos) in a single Promise.all.
**After**: Cron additionally attempts 3 rental tab reads in a separate try/catch. On failure, defaults to empty arrays.

**Done when**: `npm run build` compiles. If rental tabs don't exist, cron logs error and continues without crashing.

---

### T048: Build tenancy and collection lookup maps in `api/notify.ts`

**File**: `api/notify.ts`
**FR**: FR-018, FR-019

After the rent data read (T047), build lookup maps (inside the outer try block, after Block 1):

```typescript
// Build tenancy map
const tenancyMap = new Map<string, {
  name: string; unitLabel: string; propertyId: string;
  rentAmount: number; rentDueDay: number; leaseStartDate: string;
  leaseEndDate: string; isActive: string; deletedAt: string;
}>();
for (const row of tenancyRows) {
  const id = row[TENANCIES_COL.ID] || '';
  if (id) {
    tenancyMap.set(id, {
      name: row[TENANCIES_COL.NAME] || '',
      unitLabel: row[TENANCIES_COL.UNIT_LABEL] || '',
      propertyId: row[TENANCIES_COL.PROPERTY_ID] || '',
      rentAmount: Number(row[TENANCIES_COL.RENT_AMOUNT]) || 0,
      rentDueDay: Number(row[TENANCIES_COL.RENT_DUE_DAY]) || 1,
      leaseStartDate: row[TENANCIES_COL.LEASE_START_DATE] || '',
      leaseEndDate: row[TENANCIES_COL.LEASE_END_DATE] || '',
      isActive: row[TENANCIES_COL.IS_ACTIVE] || 'false',
      deletedAt: row[TENANCIES_COL.DELETED_AT] || '',
    });
  }
}

// Build existing composite key set (non-deleted collections only)
const existingCompositeKeys = new Set<string>();
for (const row of collectionRows) {
  const deletedAt = row[COLLECTIONS_COL.DELETED_AT] || '';
  if (deletedAt === '') {
    const ck = row[COLLECTIONS_COL.COMPOSITE_KEY] || '';
    if (ck) existingCompositeKeys.add(ck);
  }
}

// Build payment sums by collection ID
const paymentSumByCollection = new Map<string, number>();
for (const row of paymentRows) {
  const deletedAt = row[PAYMENTS_COL.DELETED_AT] || '';
  if (deletedAt !== '') continue;
  const collId = row[PAYMENTS_COL.COLLECTION_ID] || '';
  const amount = Number(row[PAYMENTS_COL.AMOUNT]) || 0;
  paymentSumByCollection.set(collId, (paymentSumByCollection.get(collId) || 0) + amount);
}
```

**Before**: No rental lookup maps.
**After**: `tenancyMap`, `existingCompositeKeys`, `paymentSumByCollection` available for auto-generation and overdue computation.

**Done when**: `npm run build` compiles. Maps correctly built from raw row data.

---

### T049: Implement rent auto-generation logic in `api/notify.ts`

**File**: `api/notify.ts`
**FR**: FR-018, FR-019, FR-020, FR-021 | **R**: R-005

Add Block 2 (auto-generation) after the lookup maps (T048). Wrapped in independent try/catch per R-005:

```typescript
// Block 2: Auto-generate rent collections
try {
  const currentMonth = istToday.slice(0, 7); // YYYY-MM
  const firstDayOfMonth = currentMonth + '-01';

  for (const [tenancyId, tenancy] of tenancyMap) {
    try {
      // Skip checks per FR-018
      if (tenancy.deletedAt !== '') continue;
      if (tenancy.isActive !== 'true') continue;
      const propName = propertyMap.get(tenancy.propertyId);
      if (!propName) continue; // property deleted or unknown
      if (tenancy.leaseStartDate > istToday) continue; // lease not started
      if (tenancy.leaseEndDate && tenancy.leaseEndDate < firstDayOfMonth) continue; // lease expired

      // Idempotency check
      const compositeKey = `${tenancyId}|${currentMonth}`;
      if (existingCompositeKeys.has(compositeKey)) continue;

      // Compute due date with clamping
      const [yearStr, monStr] = currentMonth.split('-');
      const year = Number(yearStr);
      const mon = Number(monStr);
      const lastDay = new Date(year, mon, 0).getDate();
      const clampedDay = Math.min(tenancy.rentDueDay, lastDay);
      const dueDate = `${year}-${String(mon).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;

      // Build new collection row
      const newId = crypto.randomUUID();
      const nowISO = new Date().toISOString();
      const newRow = [
        newId, tenancyId, currentMonth, String(tenancy.rentAmount),
        dueDate, '', compositeKey, nowISO, nowISO, '',
      ];

      // Append to Sheet
      const appendRange = "'RentCollections'!A:J";
      await sheetsUpdate(accessToken, sheetId, `'RentCollections'!A${collectionRows.length + 2}:J${collectionRows.length + 2}`, [newRow]);
      collectionRows.push(newRow); // keep local state in sync
      existingCompositeKeys.add(compositeKey);

      // Activity log (T052)
    } catch (innerErr) {
      console.error(`[notify] Rent auto-gen failed for tenancy ${tenancyId}:`, innerErr);
      // Continue with remaining tenancies (FR-021)
    }
  }
} catch (e) {
  console.error('[notify] Rent auto-generation block failed:', e);
}
```

Note: Uses `crypto.randomUUID()` (available in Node 19+ / Vercel serverless) instead of importing uuid.

**Before**: Cron only reads data and sends pushes — no writes except `last_pushed_at` and soft-delete.
**After**: Cron auto-generates RentCollection rows for eligible tenancies.

**Done when**: `npm run build` compiles. Auto-generation creates records for active, non-deleted, non-expired tenancies with correct amounts and clamped due dates. Idempotency prevents duplicates. Per-tenancy errors don't block others (FR-021).

---

### T050: Implement overdue rent computation in `api/notify.ts`

**File**: `api/notify.ts`
**FR**: FR-037 | **R**: R-005

Add Block 3 (overdue computation) after auto-generation. Wrapped in independent try/catch per R-005:

```typescript
// Block 3: Compute overdue rents
let overdueRents: OverdueItem[] = [];
try {
  const currentMonth = istToday.slice(0, 7);
  for (const row of collectionRows) {
    const deletedAt = row[COLLECTIONS_COL.DELETED_AT] || '';
    if (deletedAt !== '') continue;

    const month = row[COLLECTIONS_COL.MONTH] || '';
    if (!month || month >= currentMonth) continue; // only past months are overdue

    const collId = row[COLLECTIONS_COL.ID] || '';
    const expectedAmount = Number(row[COLLECTIONS_COL.EXPECTED_AMOUNT]) || 0;
    const totalReceived = paymentSumByCollection.get(collId) || 0;
    if (totalReceived >= expectedAmount) continue; // fully received

    // Overdue — build description
    const tenancyId = row[COLLECTIONS_COL.TENANCY_ID] || '';
    const tenancy = tenancyMap.get(tenancyId);
    if (!tenancy) continue;
    const propName = propertyMap.get(tenancy.propertyId) || 'Unknown';
    const desc = tenancy.unitLabel
      ? `${tenancy.name} (${tenancy.unitLabel}) \u2014 ${propName}`
      : `${tenancy.name} \u2014 ${propName}`;

    overdueRents.push({ description: desc });
  }
} catch (e) {
  console.error('[notify] Overdue rent computation failed:', e);
  // overdueRents stays empty — push notification proceeds without rent items
}
```

**Before**: Only overdue bills and todos computed.
**After**: Overdue rents also computed. Array defaults to empty on failure.

**Done when**: `npm run build` compiles. Overdue rents identified for past-month collections with sum < expected.

---

### T051: Extend push notification body format in `api/notify.ts`

**File**: `api/notify.ts`
**FR**: FR-038, FR-039 | **R**: R-002, R-003

Replace the existing notification body builder (lines ~306–332) with the extended format per R-002/R-003:

```typescript
const overdueBillCount = overdueBills.length;
const overdueRentCount = overdueRents.length;
const overdueTodoCount = overdueTodos.length;

const allOverdue = [...overdueBills, ...overdueRents, ...overdueTodos];
const total = allOverdue.length;

if (total === 0) {
  // existing early return (no push sent)
}

// Build prefix per R-002/R-003
let prefix: string;
if (overdueRentCount > 0) {
  const parts: string[] = [];
  if (overdueBillCount > 0) parts.push(`${overdueBillCount} bill${overdueBillCount > 1 ? 's' : ''}`);
  if (overdueRentCount > 0) parts.push(`${overdueRentCount} rent${overdueRentCount > 1 ? 's' : ''}`);
  if (overdueTodoCount > 0) parts.push(`${overdueTodoCount} todo${overdueTodoCount > 1 ? 's' : ''}`);
  prefix = `${parts.join(' + ')} pending`;
} else {
  prefix = `${total} overdue`; // existing format preserved
}

const allDescriptions = allOverdue.map(item => item.description);
const first3 = allDescriptions.slice(0, 3).join(', ');
const more = total > 3 ? `... and ${total - 3} more` : '';
let body = `${prefix}: ${first3}${more}`;

// Truncate (existing logic)
```

**All 7 combinations from R-003 format table** handled:
- Bills + Rents (+ optional Todos): category-count prefix + "pending"
- Rents only (+ optional Todos): category-count prefix + "pending"
- Bills only (+ optional Todos): existing `{N} overdue` format preserved
- Todos only: existing `{N} overdue` format preserved

**Before**: Body is `{N} overdue: {first3}...` for bills + todos only.
**After**: Body uses category-count prefix when rents present; existing format when not.

**Done when**: `npm run build` compiles. All 7 format combinations from R-003 produce correct notification body.

---

### T052: Add error isolation verification in `api/notify.ts`

**File**: `api/notify.ts`
**FR**: FR-021 | **R**: R-005

Verify the 3 independent try/catch blocks from T047, T049, T050 are correctly structured:

1. **Block 1** (T047): Rent data read. On failure → `tenancyRows`, `collectionRows`, `paymentRows` remain `[]`. Subsequent blocks skip gracefully.
2. **Block 2** (T049): Auto-generation. On block-level failure → no records created for any tenancy. On per-tenancy failure → remaining tenancies still processed.
3. **Block 3** (T050): Overdue computation. On failure → `overdueRents` remains `[]`. Push notification proceeds with bills + todos only.

**Critical invariant**: The existing `overdueBills` and `overdueTodos` arrays are computed INDEPENDENTLY from rent data. Even if all 3 rent blocks fail, the push notification proceeds with the existing bill + todo data unchanged.

**Before**: All 3 blocks exist from T047–T050.
**After**: Verified that failure in any rent block does not affect bill/todo processing.

**Done when**: Manual review confirms correct error isolation. No code changes if T047–T050 are implemented correctly.

---

### T053: Add cron activity log entries using `appendActivityLogFromCron` in `api/notify.ts`

**File**: `api/notify.ts`
**FR**: FR-022, FR-035 | **R**: R-007

1. Add a helper function `appendActivityLogFromCron` inside `api/notify.ts`:
   ```typescript
   async function appendActivityLogFromCron(
     token: string,
     sheetId: string,
     entry: { id: string; action: string; entityType: string; entityId: string; summary: string },
   ): Promise<void> {
     const nowISO = new Date().toISOString();
     const row = [entry.id, nowISO, 'cron', entry.action, entry.entityType, entry.entityId, entry.summary];
     // Append to ActivityLog tab
     // Best-effort: wrap in try/catch
     try {
       await sheetsUpdate(token, sheetId, `'ActivityLog'!A:G`, [row]);
     } catch (e) {
       console.error('[notify] Activity log write failed:', e);
     }
   }
   ```
   Note: Uses `'cron'` as `userEmail` per R-007.

2. Inside the auto-generation loop (T049), after successfully appending a new RentCollection row, call:
   ```typescript
   const unitPart = tenancy.unitLabel ? ` (${tenancy.unitLabel})` : '';
   await appendActivityLogFromCron(accessToken, sheetId, {
     id: crypto.randomUUID(),
     action: 'rent_auto_generated',
     entityType: 'rent_collection',
     entityId: newId,
     summary: `Rent auto-generated: ${tenancy.name}${unitPart} \u2014 ${propName} ${formatMonthLabel(currentMonth)}`,
   });
   ```

3. Add a simple `formatMonthLabel` helper (e.g., "Jun 2026" from "2026-06").

**Before**: Cron writes zero activity log entries. `userEmail` for cron entries is undefined.
**After**: Cron writes `rent_auto_generated` activity log entries with `userEmail: 'cron'`. Failures are logged but don't block auto-generation.

**Done when**: `npm run build` compiles. Activity Log page shows auto-generated entries with "cron" as the user.

---

### T054: Extend Dashboard "Money This Month" with rent data in `src/pages/DashboardPage.tsx`

**File**: `src/pages/DashboardPage.tsx`
**FR**: FR-040, FR-041

1. Import rental service functions: `fetchTenancies`, `fetchRentCollections`, `fetchPaymentEvents` + `ensureRentalTabs` from tenancies service + `computeRentStatus` from rentCollections service.
2. Import new types: `Tenancy`, `RentCollection`, `PaymentEvent`, `TenancyWithDisplay`.
3. In `loadAllData`, add rental data fetching (wrapped in try/catch — if tabs don't exist yet, gracefully default to empty):
   ```typescript
   let tenancies: TenancyWithDisplay[] = [];
   let collections: RentCollection[] = [];
   let paymentEvents: PaymentEvent[] = [];
   try {
     [tenancies, collections, paymentEvents] = await Promise.all([
       fetchTenancies(token, ssId, propMap),
       fetchRentCollections(token, ssId),
       fetchPaymentEvents(token, ssId),
     ]);
   } catch { /* tabs may not exist yet */ }
   ```
4. After the existing "Money This Month" computation, add a "Rent Collected This Month" subsection:
   - Filter current-month collections (non-deleted, matching `currentMonth`).
   - Compute totals: `totalExpected`, `totalReceived` (sum of non-deleted payment events), `totalOutstanding` (expected - received).
   - Per-property breakdown: group by tenancy → property, compute per-property expected/received.
5. Render the rent subsection in the Money This Month card, below the existing bills summary.

**Before**: Dashboard "Money This Month" shows only bill data (outstanding + paid).
**After**: Dashboard additionally shows "Rent Collected This Month" with expected/received/outstanding and per-property breakdown.

**Done when**: `npm run build` compiles. Dashboard shows rent totals alongside bill totals. If no rental tabs exist, section is hidden gracefully.

---

### T055: Extend Dashboard "Needs Attention" with overdue rent items in `src/pages/DashboardPage.tsx`

**File**: `src/pages/DashboardPage.tsx`
**FR**: FR-042, FR-043

1. After computing overdue bills and todos (existing code, lines ~152–183), compute overdue rents:
   ```typescript
   const overdueRentItems: AttentionItem[] = [];
   for (const coll of currentMonthCollections) {
     // compute status
     if (displayStatus === 'overdue') {
       overdueRentItems.push({
         kind: 'rent',
         id: coll.id,
         tenancyName, unitLabel, propertyId, propertyName,
         month: coll.month, dueDate: coll.dueDate,
         expectedAmount: coll.expectedAmount,
         totalReceived, displayStatus,
       });
     }
   }
   ```
   Note: Also check past-month collections, not just current month — rent can be overdue from previous months.

2. Merge overdue rents into the existing `merged` attention array, sorted by `dueDate` ascending.

3. In the "Needs Attention" card render, handle the `kind: 'rent'` variant:
   - Icon: `Landmark` (distinct from `Receipt` for bills and `ListTodo` for todos — FR-043).
   - Display: `{tenancyName} ({unitLabel}) — {propertyName}` with "Overdue" badge.
   - Click action: `navigate('/rentals')` (FR-042).

4. Import `Landmark` from lucide-react.

**Before**: "Needs Attention" shows overdue bills and todos only. `AttentionItem` kind `'rent'` exists in types but not used.
**After**: Overdue rent items appear in "Needs Attention" with Landmark icon, sorted by due date, clickable to `/rentals`.

**Done when**: `npm run build` compiles. Overdue rent items appear in Dashboard Needs Attention alongside bills and todos.

---

### T056: Chunk 4 final build verification

**Action**: Run `npm run build`. Verify clean compile with zero errors.

**FR**: All Chunk 4 FRs (FR-017–FR-022, FR-037–FR-043) | **R**: R-002, R-003, R-005, R-007, R-010

**Verification checklist**:
- [ ] `npm run build` passes with zero errors
- [ ] `api/notify.ts` has 3 independent try/catch blocks for rent data (R-005)
- [ ] Cron does NOT call `ensureRentalTabs` — DEGRADE-ON-MISSING (R-010)
- [ ] Cron auto-generation checks: deleted, inactive, property deleted, lease not started, lease expired, idempotency
- [ ] Overdue rent computation uses month-end threshold (DD-008)
- [ ] Push notification body format handles all 7 combinations (R-003)
- [ ] Activity log entries use `userEmail: 'cron'` and `appendActivityLogFromCron` helper (R-007)
- [ ] Dashboard "Money This Month" shows rent subsection
- [ ] Dashboard "Needs Attention" shows overdue rent items with Landmark icon

**Done when**: `npm run build` passes with zero errors. Complete feature: auto-generation, push notifications, dashboard integration.

---

## Optional: Manual E2E Test Checklist (T057)

**Action**: Full manual end-to-end verification after all 4 chunks are complete.

### Scenario 1: Add Tenancy → First Cron Auto-Gen

1. [ ] Navigate to `/rentals` → empty state shows "No tenants yet"
2. [ ] Add a tenancy: Property "Chawl", Unit "Room 1", Name "Ramesh", Rent ₹5,000, Due day 5, Lease start 2026-01-01
3. [ ] Verify tenancy appears under "Chawl" heading
4. [ ] Verify Sheet tabs created: Tenancies, RentCollections, PaymentEvents
5. [ ] Trigger cron (`curl -X POST -H "Authorization: Bearer $CRON_SECRET" $URL`)
6. [ ] Verify RentCollection row created for current month with expected ₹5,000
7. [ ] Refresh `/rentals` → collection card shows "Pending" status
8. [ ] Trigger cron again → verify NO duplicate created (idempotency)

### Scenario 2: Mark Received Full

9. [ ] Tap "Mark Received Full" on the pending ₹5,000 record
10. [ ] Select payment method "GPay", confirm
11. [ ] Verify PaymentEvent of ₹5,000 created
12. [ ] Verify status changes to green "Received"
13. [ ] Verify Mark Received buttons are HIDDEN (R-004)
14. [ ] Verify summary header updates

### Scenario 3: Mark Received Partial

15. [ ] Add a second tenancy: "Chawl", "Room 2", "Suresh", ₹10,000, Due day 1
16. [ ] Trigger cron → collection created
17. [ ] Tap "Mark Received Partial" → enter ₹4,000, method "Cash"
18. [ ] Verify status "Partial" (blue badge), remaining ₹6,000 shown
19. [ ] Tap "Mark Received Partial" again → ₹6,000, method "GPay"
20. [ ] Verify status "Received", both payments in history

### Scenario 4: Push Notification

21. [ ] Let a collection go overdue (past month with sum < expected)
22. [ ] Trigger cron
23. [ ] Verify push notification includes overdue rent with format per R-002/R-003
24. [ ] If overdue bills also exist, verify combined format: "{N} bills + {M} rents pending: ..."

### Scenario 5: Dashboard Display

25. [ ] Open Dashboard
26. [ ] Verify "Rent Collected This Month" subsection shows expected/received/outstanding
27. [ ] Verify overdue rent items in "Needs Attention" with Landmark icon
28. [ ] Click overdue rent item → navigates to `/rentals`

### Scenario 6: Edge Cases

29. [ ] Toggle tenancy inactive → trigger cron → verify NO new record created
30. [ ] Soft-delete tenancy → verify collections remain in DB but hidden in UI (R-001)
31. [ ] Undo delete → verify collections re-appear
32. [ ] Tenancy with due day 31 in February → verify due date clamped to Feb 28
33. [ ] Delete a payment event → verify status recomputes

**Done when**: All 33 scenario steps pass. Complete rentals feature working end-to-end.
