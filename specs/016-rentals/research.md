# Research: Rentals

**Feature**: Rentals (Phase 16)
**Date**: 2026-06-04

---

## R-001: Cascade Behavior on Tenancy Soft-Delete

**Question**: When the user soft-deletes a tenancy, what happens to its linked RentCollections and PaymentEvents? Options: (a) cascade soft-delete all linked records, (b) orphan — leave them in DB but hidden because the parent is gone, (c) block deletion if non-deleted records exist.

**Decision**: **(b) Orphan** — leave linked records in the database with their own `deleted_at` unmodified. They become invisible in the UI because the parent tenancy is filtered out, but they are not explicitly soft-deleted.

**Evidence — existing property deletion pattern (propertiesService.ts)**:
`softDeleteProperty` (line 108) only sets `deleted_at` on the Property row itself. It does NOT cascade to BillTypes or Bills linked to that property. Bills remain in the database with their own `deleted_at` values unchanged. The UI filters bills independently via their own `deletedAt` field.

The Rentals page displays rent collections grouped under their parent tenancy. When a tenancy is soft-deleted:
- The tenancy disappears from the UI (filtered by `deletedAt === ''`)
- Its RentCollections and PaymentEvents remain in the DB untouched
- They are not rendered because the parent grouping entity is gone
- The cron skips auto-generation for deleted tenancies (FR-018: "active, non-deleted")

**Why not (a) cascade**: Cascade complicates the undo operation. If we cascade soft-delete tenancy + N collections + M payment events, undo must restore all of them — requiring the UI to track every cascaded row. With orphan, undo simply restores the tenancy row, and all its collections naturally re-appear because they were never touched.

**Why not (c) block**: Too restrictive. A tenancy with years of collection history could never be deleted without first deleting every historical record. This contradicts the quick soft-delete-with-undo pattern used throughout the app.

**Undo behavior**: When the user taps "Undo" during the 10-second window, only the tenancy's `deleted_at` is cleared. All orphaned collections and payment events immediately become visible again because the parent tenancy is back in the non-deleted set.

**Cron behavior**: The cron checks `tenancy.deleted_at` independently. While a tenancy is deleted, no new records are auto-generated. After undo, the next cron run resumes auto-generation.

---

## R-002: Push Notification Truncation Strategy

**Question**: The 200-char limit with bills + rents + todos can overflow fast. What is the exact truncation strategy?

**Decision**: Extend the existing pattern from `api/notify.ts` (lines 323–333). Show category counts in prefix, list first 3 descriptions, truncate at 200 chars at word boundary.

**Evidence — existing pattern (api/notify.ts lines 322–333)**:
```typescript
const first3 = overdueDescriptions.slice(0, 3).join(', ');
const more = total > 3 ? `... and ${total - 3} more` : '';
let body = `${total} overdue: ${first3}${more}`;

if (body.length > PUSH_PAYLOAD_MAX_BODY_CHARS) {
  const truncated = body.slice(0, PUSH_PAYLOAD_MAX_BODY_CHARS - 1);
  const lastSpace = truncated.lastIndexOf(' ');
  body = (lastSpace > 100 ? truncated.slice(0, lastSpace) : truncated) + '…';
}
```

**Extended strategy**:
1. Build a prefix with explicit category counts when rents are present
2. Combine all descriptions into a single array: `[...billDescs, ...rentDescs, ...todoDescs]`
3. Take first 3 descriptions, join with `, `
4. If total > 3, append `... and {N} more`
5. Truncate at 200 chars at word boundary using the existing `lastSpace > 100` guard + ellipsis

**Prefix logic**:
```typescript
const parts: string[] = [];
if (overdueBillCount > 0) parts.push(`${overdueBillCount} bill${overdueBillCount > 1 ? 's' : ''}`);
if (overdueRentCount > 0) parts.push(`${overdueRentCount} rent${overdueRentCount > 1 ? 's' : ''}`);
if (overdueTodoCount > 0) parts.push(`${overdueTodoCount} todo${overdueTodoCount > 1 ? 's' : ''}`);

let prefix: string;
if (overdueRentCount > 0) {
  prefix = `${parts.join(' + ')} pending`;
} else {
  prefix = `${total} overdue`;  // existing format preserved
}
```

This approach:
- Preserves the existing format when no rents are involved (backwards compatible)
- Shows explicit per-category counts when rents are present
- Handles all combinations naturally (see R-003 for edge cases)

---

## R-003: Todos + Rents (No Bills) Edge Case

**Question**: FR-038 covers (bills+rents), (rents only), and (existing format for bills/todos no rents). What about (todos+rents, no bills)?

**Decision**: Use the same category-count prefix pattern from R-002. When rents are present, ALL present categories get explicit counts.

**Exact format strings for all combinations**:

| Bills | Rents | Todos | Format |
|-------|-------|-------|--------|
| 3 | 2 | 0 | `3 bills + 2 rents pending: Maintenance — Chawl, Bob (Room 1) — Chawl, ...` |
| 3 | 2 | 1 | `3 bills + 2 rents + 1 todo pending: Maintenance — Chawl, Bob (Room 1) — Chawl, ...` |
| 0 | 2 | 0 | `2 rents pending: Bob (Room 1) — Chawl, Alice (Room 2) — Chawl` |
| 0 | 2 | 1 | `2 rents + 1 todo pending: Bob (Room 1) — Chawl, Insurance renewal, ...` |
| 3 | 0 | 0 | `3 overdue: Maintenance — Chawl, Electricity — Mira Shop, ...` (existing) |
| 0 | 0 | 2 | `2 overdue: Insurance renewal, Tax filing` (existing) |
| 3 | 0 | 1 | `4 overdue: Maintenance — Chawl, Insurance renewal, ...` (existing) |

**Key rule**: The word "pending" is used when rents are present (because rent overdue is defined differently — month-end, not due-date-based). The word "overdue" is used when only bills/todos are present (preserving the existing format exactly).

**Rent description format**: `"{tenantName} ({unitLabel}) — {propertyName}"` when unit label exists, otherwise `"{tenantName} — {propertyName}"`. Matches FR-038.

---

## R-004: Overpayment Handling

**Question**: FR-026/FR-030 say "received" hides both Mark Received buttons. But what if a tenant later overpays (advance for next month)?

**Decision**: **Hide buttons when received.** Keep v1 simple. Overpayment correction is handled by editing or deleting the latest PaymentEvent.

**Evidence — spec edge case section**:
> "Payment events exceed expected amount: If the sum of payment events exceeds the expected rent amount (e.g., advance payment), the record status is still 'received'. The overpayment is visible in the payment history but no special handling is applied."

**Rationale**:
- The computed status formula is: sum ≥ expected → "received". Once received, FR-026 and FR-030 explicitly prohibit showing the Mark Received actions.
- In the real world, if a tenant pays ₹12,000 against a ₹10,000 rent (advance for next month), the owner would:
  1. See the payment in the history section
  2. If it was a mistake: soft-delete the payment event and re-record the correct amount
  3. If intentional advance: acknowledge it and handle next month manually
- Building an overpayment credit system is out of scope for v1.

**No code impact**: The computed status formula (`sum >= expected → received`) naturally handles overpayment. The UI hides action buttons when status is "received". No special overpayment flag or field needed.

---

## R-005: Cron Failure Isolation

**Question**: If the new cron extension code (rent auto-gen, overdue computation) throws, does the existing push notification logic still run?

**Decision**: **Wrap all rent-specific blocks in independent try/catch with console.error logging.** The existing bill/todo notification logic MUST NOT regress.

**Evidence — current api/notify.ts structure (lines 114–393)**:
The entire handler is one big try/catch. Steps 8 (read overdue items) and 9 (skip if zero) and 10 (build body) are sequential within this block. An error in any step aborts all subsequent steps.

**Implementation — three isolated blocks**:

```typescript
// Block 1: Read rent data (parallel with existing reads)
let tenancyRows: string[][] = [];
let collectionRows: string[][] = [];
let paymentRows: string[][] = [];
try {
  // Added to existing Promise.all — see R-010
  // If any rent tab doesn't exist yet, sheetsGet returns 400
  // which is caught here, not in the outer handler
} catch (e) {
  console.error('[notify] Failed to read rent data:', e);
  // Continue — rent features degraded but bills/todos unaffected
}

// Block 2: Auto-generate rent collections
try {
  // Iterate tenancies, check eligibility, append missing records
  // Each individual tenancy write is in its own try/catch per FR-021
} catch (e) {
  console.error('[notify] Rent auto-generation failed:', e);
}

// Block 3: Compute overdue rents
let overdueRents: OverdueItem[] = [];
try {
  // Iterate collections, sum payments, check month-end
} catch (e) {
  console.error('[notify] Overdue rent computation failed:', e);
  // overdueRents stays empty — push notification proceeds without rent items
}
```

**Critical invariant**: The existing `overdueBills` and `overdueTodos` arrays are computed INDEPENDENTLY from rent data. Even if all three rent blocks fail, the push notification proceeds with the existing bill + todo data. The only change to the existing notification body logic is the prefix formatting (R-002), which gracefully handles `overdueRentCount === 0`.

---

## R-006: Sheet Schema Additions

**Question**: What are the exact column headers for the 3 new sheet tabs, and how do they map to TypeScript interfaces?

**Decision**: 3 new tabs added to `HEADER_DEFINITIONS` in `src/config/schema.ts`. Bootstrap uses lazy tab creation (mirror PushSubscriptions pattern from Phase 11).

### Tab: Tenancies (16 columns, A–P)

| Col | Header | Index | TypeScript Field | Type/Validation |
|-----|--------|-------|-----------------|-----------------|
| A | id | 0 | id | UUID |
| B | property_id | 1 | propertyId | FK → Properties.id |
| C | unit_label | 2 | unitLabel | string, optional |
| D | name | 3 | name | string, required |
| E | phone | 4 | phone | string, optional |
| F | email | 5 | email | string, optional |
| G | rent_amount | 6 | rentAmount | number > 0, required |
| H | security_deposit | 7 | securityDeposit | number >= 0, optional |
| I | rent_due_day | 8 | rentDueDay | integer 1–31, required |
| J | lease_start_date | 9 | leaseStartDate | YYYY-MM-DD, required |
| K | lease_end_date | 10 | leaseEndDate | YYYY-MM-DD, optional |
| L | is_active | 11 | isActive | "true"/"false" |
| M | notes | 12 | notes | string, optional |
| N | created_at | 13 | createdAt | ISO 8601 |
| O | updated_at | 14 | updatedAt | ISO 8601 |
| P | deleted_at | 15 | deletedAt | ISO 8601 or '' |

### Tab: RentCollections (10 columns, A–J)

| Col | Header | Index | TypeScript Field | Type/Validation |
|-----|--------|-------|-----------------|-----------------|
| A | id | 0 | id | UUID |
| B | tenancy_id | 1 | tenancyId | FK → Tenancies.id |
| C | month | 2 | month | YYYY-MM |
| D | expected_amount | 3 | expectedAmount | number > 0 |
| E | due_date | 4 | dueDate | YYYY-MM-DD |
| F | notes | 5 | notes | string, optional |
| G | composite_key | 6 | compositeKey | tenancyId\|YYYY-MM |
| H | created_at | 7 | createdAt | ISO 8601 |
| I | updated_at | 8 | updatedAt | ISO 8601 |
| J | deleted_at | 9 | deletedAt | ISO 8601 or '' |

### Tab: PaymentEvents (9 columns, A–I)

| Col | Header | Index | TypeScript Field | Type/Validation |
|-----|--------|-------|-----------------|-----------------|
| A | id | 0 | id | UUID |
| B | collection_id | 1 | collectionId | FK → RentCollections.id |
| C | amount | 2 | amount | number > 0 |
| D | payment_date | 3 | paymentDate | YYYY-MM-DD |
| E | payment_method | 4 | paymentMethod | GPay\|PhonePe\|NEFT\|Net Banking\|Cash\|Other |
| F | notes | 5 | notes | string, optional |
| G | created_at | 6 | createdAt | ISO 8601 |
| H | updated_at | 7 | updatedAt | ISO 8601 |
| I | deleted_at | 8 | deletedAt | ISO 8601 or '' |

### Bootstrap Strategy

Mirror the PushSubscriptions lazy-bootstrap pattern (`pushSubscriptionsService.ts` lines 40–64):

```typescript
export async function ensureRentalTabs(
  accessToken: string,
  spreadsheetId: string,
): Promise<void> {
  // For each tab: try readValues on A1 row
  // If 400 error → tab doesn't exist → addSheet + writeHeaders
  // If empty headers → writeHeaders
  // If headers present → no-op
}
```

This function is called from:
1. `api/notify.ts` — before reading rental data (cron must work even on first run)
2. `RentalsPage.tsx` — on mount, before fetching data (UI must work before first cron run)

The 3 tabs are NOT added to the core `TAB_NAMES` const or bootstrap flow (which would force tab creation on all new users immediately). Instead, they are lazy-created on first access, matching how PushSubscriptions works.

---

## R-007: Activity Log New ActionTypes

**Question**: What new action types and entity types are needed for the activity log?

**Decision**: Add 8 new ActionType values and 3 new ActivityEntityType values.

### New ActionType Values

| Action | When Logged | Summary Format |
|--------|-------------|----------------|
| `tenancy_added` | Owner adds a tenancy | `Tenant added: {name} ({unitLabel}) — {propertyName}` |
| `tenancy_updated` | Owner edits a tenancy | `Tenant updated: {name} ({unitLabel}) — {propertyName}` |
| `tenancy_toggled` | Owner toggles active/inactive | `Tenant {active/inactive}: {name} ({unitLabel}) — {propertyName}` |
| `tenancy_deleted` | Owner soft-deletes a tenancy | `Tenant deleted: {name} ({unitLabel}) — {propertyName}` |
| `tenancy_restored` | Owner undoes tenancy deletion | `Tenant restored: {name} ({unitLabel}) — {propertyName}` |
| `rent_auto_generated` | Cron creates a collection record | `Rent auto-generated: {name} ({unitLabel}) — {propertyName} {Mon YYYY}` |
| `payment_received` | Owner records full or partial payment | `Rent received: {name} ({unitLabel}) — {propertyName} ₹{amount} {Mon YYYY}` |
| `payment_deleted` | Owner soft-deletes a payment event | `Payment deleted: {name} ({unitLabel}) — {propertyName} ₹{amount} {Mon YYYY}` |

Note: `{unitLabel}` parenthetical is omitted when empty (e.g., single-unit property).

### New ActivityEntityType Values

| Entity Type | Used With Actions |
|-------------|-------------------|
| `tenancy` | tenancy_added, tenancy_updated, tenancy_toggled, tenancy_deleted, tenancy_restored |
| `rent_collection` | rent_auto_generated |
| `payment_event` | payment_received, payment_deleted |

### Updated TypeScript Union (src/types/index.ts)

```typescript
export type ActionType =
  | 'bill_added' | 'bill_updated' | 'bill_paid' | 'bill_postponed'
  | 'bill_deleted' | 'bill_restored'
  | 'todo_added' | 'todo_updated' | 'todo_done' | 'todo_recurrence_created'
  | 'todo_postponed' | 'todo_deleted' | 'todo_restored'
  | 'property_added' | 'property_updated' | 'property_deleted' | 'property_restored'
  | 'billtype_added' | 'billtype_updated' | 'billtype_deleted' | 'billtype_restored'
  | 'category_added' | 'category_updated' | 'category_deleted' | 'category_restored'
  | 'push_enabled' | 'push_disabled'
  // Phase 16: Rentals
  | 'tenancy_added' | 'tenancy_updated' | 'tenancy_toggled'
  | 'tenancy_deleted' | 'tenancy_restored'
  | 'rent_auto_generated'
  | 'payment_received' | 'payment_deleted';

export type ActivityEntityType =
  | 'bill' | 'todo' | 'property' | 'billtype' | 'category' | 'push_subscription'
  // Phase 16: Rentals
  | 'tenancy' | 'rent_collection' | 'payment_event';
```

### Cron Activity Logging

The cron (`api/notify.ts`) writes `rent_auto_generated` entries using the same `sheetsGet`/`sheetsUpdate` direct-append pattern already used in the cron for sheet updates (no access to `appendActivityLogSafe` which is a client-side import). The cron builds the activity log row as a raw string array and appends via `sheetsUpdate` to the ActivityLog tab.

### Cron-side activity log writes — NEW pattern (R-007 addendum)

The existing api/notify.ts cron contains ZERO activity log writes. Phase 16 introduces this as a new pattern. Implementation notes:

1. Cron has no user context — the user_email field for cron-written entries MUST be set to 'cron' or 'system' (consistent with however Phase 11 might have handled this, if relevant). This distinguishes auto-generated entries from user-initiated ones in the Activity Log page.

2. Cron cannot import the client-side appendActivityLogSafe function (it lives in src/services and uses OAuth token). The cron must build the activity log row as a raw string array and append via sheetsUpdate to the 'ActivityLog' tab directly.

3. Helper function to add: appendActivityLogFromCron(accessToken, spreadsheetId, entry) — server-side equivalent that bypasses client-only dependencies.

4. Failure handling: activity log writes from cron are best-effort. Wrap each write in try/catch with console.error. Cron's primary job (push notification) must not fail because activity log write fails.

---

## R-008: Chunk Boundaries

**Question**: Confirm or refine the 4 proposed chunks with specific task counts.

**Decision**: Confirmed 4 chunks. Refined with concrete task counts based on codebase patterns.

### Chunk 1: Schema + Types + Services (~14 tasks)

| # | Task | File(s) | What |
|---|------|---------|------|
| 1 | Add Tenancies header definition | `schema.ts` | New entry in HEADER_DEFINITIONS |
| 2 | Add RentCollections header definition | `schema.ts` | New entry in HEADER_DEFINITIONS |
| 3 | Add PaymentEvents header definition | `schema.ts` | New entry in HEADER_DEFINITIONS |
| 4 | Add Tenancy interface + form data types | `types/index.ts` | Tenancy, TenancyFormData, TenancyWithDisplay |
| 5 | Add RentCollection interface + types | `types/index.ts` | RentCollection, RentCollectionWithDisplay, RentDisplayStatus |
| 6 | Add PaymentEvent interface + types | `types/index.ts` | PaymentEvent, PaymentEventFormData |
| 7 | Add new ActionType + ActivityEntityType values | `types/index.ts` | Union extensions |
| 8 | Add AttentionItem rent variant | `types/index.ts` | New `kind: 'rent'` variant |
| 9 | Create tenanciesService.ts | New file | parseRow, serializeRow, fetchTenancies, addTenancy, updateTenancy, toggleActive, softDelete, undoDelete, ensureTenanciesTab |
| 10 | Create rentCollectionsService.ts | New file | parseRow, serializeRow, fetchCollections, addCollection, updateCollection, softDelete, undoDelete, computeRentStatus, computeCompositeKey, ensureRentCollectionsTab |
| 11 | Create paymentEventsService.ts | New file | parseRow, serializeRow, fetchPaymentEvents, addPaymentEvent, softDelete, undoDelete, ensurePaymentEventsTab |
| 12 | Create ensureRentalTabs utility | One of the new services | Lazy bootstrap for all 3 tabs (mirrors PushSubscriptions) |
| 13 | Add formatCurrency / formatMonth re-exports | Shared utility | Reuse from billsService or extract to shared |
| 14 | Build check | `npm run build` | Verify no type errors |

**Deliverable**: All 3 service files compile. No UI yet.

### Chunk 2: Tenancy Management UI (~12 tasks)

| # | Task | File(s) | What |
|---|------|---------|------|
| 1 | Add /rentals route | `App.tsx` | New route within BootstrapLayout |
| 2 | Add Rentals nav item | `Navbar.tsx` | New entry in navItems array |
| 3 | Create RentalsPage.tsx shell | New file | Data loading, state, empty state |
| 4 | Create AddTenancyModal.tsx | New file | Form with validation |
| 5 | Implement tenancy display with property grouping | `RentalsPage.tsx` | Group tenancies under property headings |
| 6 | Implement tenancy toggle active/inactive | `RentalsPage.tsx` | Inline toggle with immediate persistence |
| 7 | Implement tenancy soft-delete with undo | `RentalsPage.tsx` | Optimistic UI, undo snackbar |
| 8 | Implement tenancy edit | `RentalsPage.tsx` + modal | Reuse AddTenancyModal with edit mode |
| 9 | Implement property filter | `RentalsPage.tsx` | Filter dropdown |
| 10 | Implement first-run empty state | `RentalsPage.tsx` | No tenancies message + CTA |
| 11 | Activity log for tenancy actions | `RentalsPage.tsx` | appendActivityLogSafe calls |
| 12 | Build check | `npm run build` | Verify no type errors |

**Deliverable**: /rentals page shows tenancies grouped by property. Full CRUD for tenancies. No rent collection data yet.

### Chunk 3: RentCollection + PaymentEvent UI (~14 tasks)

| # | Task | File(s) | What |
|---|------|---------|------|
| 1 | Create MonthNavigator.tsx | New file | Prev/next month + month picker |
| 2 | Create RentSummaryHeader.tsx | New file | Totals bar: expected, received, outstanding, count |
| 3 | Create CollectionCard.tsx | New file | Status badge, amounts, action buttons |
| 4 | Integrate collection display into RentalsPage | `RentalsPage.tsx` | Fetch collections for selected month, group under tenancies |
| 5 | Implement status badge computation | `rentCollectionsService.ts` | received/partial/pending/overdue logic |
| 6 | Create MarkReceivedFullModal.tsx | New file | Payment method, date, notes |
| 7 | Create MarkReceivedPartialModal.tsx | New file | Amount, payment method, date, notes |
| 8 | Implement Mark Received Full handler | `RentalsPage.tsx` | Create PaymentEvent, recompute status |
| 9 | Implement Mark Received Partial handler | `RentalsPage.tsx` | Create PaymentEvent, recompute status |
| 10 | Create PaymentHistorySection.tsx | New file | Expandable list of payment events |
| 11 | Implement payment event soft-delete | `RentalsPage.tsx` | With status recomputation |
| 12 | Implement rent collection edit (expected amount, due date, notes) | `RentalsPage.tsx` | Edit modal or inline |
| 13 | Implement rent collection soft-delete | `RentalsPage.tsx` | Optimistic UI with undo |
| 14 | Implement collection history (past 3–6 months) | `RentalsPage.tsx` | Expandable per-tenancy |
| 15 | Activity log for payment actions | `RentalsPage.tsx` | appendActivityLogSafe calls |
| 16 | Build check | `npm run build` | Verify no type errors |

**Deliverable**: Full rent collection + payment event UI. Summary header, status badges, Mark Received flows, payment history.

### Chunk 4: Cron Extension + Dashboard + Push (~10 tasks)

| # | Task | File(s) | What |
|---|------|---------|------|
| 1 | Add rent tab reads to api/notify.ts | `api/notify.ts` | Read Tenancies + RentCollections + PaymentEvents |
| 2 | Add lazy tab bootstrap to cron | `api/notify.ts` | Ensure tabs exist before reading |
| 3 | Implement rent auto-generation logic | `api/notify.ts` | Iterate tenancies, check eligibility, create missing records |
| 4 | Implement overdue rent computation | `api/notify.ts` | Month-end threshold, sum payments vs expected |
| 5 | Extend push notification body | `api/notify.ts` | New prefix format per R-002, combined descriptions |
| 6 | Add error isolation (try/catch) | `api/notify.ts` | Per R-005 |
| 7 | Add cron activity log entries | `api/notify.ts` | rent_auto_generated entries |
| 8 | Extend Dashboard "Money This Month" | `DashboardPage.tsx` | Rent Collected subsection |
| 9 | Extend Dashboard "Needs Attention" | `DashboardPage.tsx` | Overdue rent items with navigation |
| 10 | Build check | `npm run build` | Verify no type errors |

**Deliverable**: Complete feature: auto-generation, push notifications, dashboard integration.

---

## R-009: The /rentals Page Component Decomposition

**Question**: What is the component breakdown and state management strategy for the complex Rentals page?

**Decision**: Follow the BillsPage.tsx pattern — page-level state with props drilled to presentational components.

### File Structure

```text
src/
├── pages/
│   └── RentalsPage.tsx                    # Main page (state, handlers, data loading)
└── components/
    └── rentals/
        ├── TenancyCard.tsx                # Tenancy row: name, unit, rent, status, actions
        ├── CollectionCard.tsx             # Rent collection row: amount, status badge, buttons
        ├── AddTenancyModal.tsx            # Add/Edit tenancy form modal (mode prop)
        ├── MarkReceivedFullModal.tsx       # Quick form: payment method, date, notes
        ├── MarkReceivedPartialModal.tsx    # Full form: amount, method, date, notes
        ├── MonthNavigator.tsx             # < Jun 2026 > month picker
        ├── RentSummaryHeader.tsx           # Total expected / received / outstanding / count
        ├── PaymentHistorySection.tsx       # Expandable list of PaymentEvents for one collection
        └── CollectionHistorySection.tsx    # Past 3–6 months mini-view for one tenancy
```

### Component Responsibilities

**RentalsPage.tsx** (master component):
- State: `tenancies`, `collections`, `paymentEvents`, `properties`, `selectedMonth`, `filterProperty`, `isLoading`, `isSaving`, modal targets (`addTenancyModal`, `markReceivedFullTarget`, `markReceivedPartialTarget`, `editTenancyTarget`, `deleteTarget`)
- Data loading: `loadData()` fetches properties, tenancies, collections, payment events via `Promise.all`
- Derived state: `groupedByProperty` (useMemo), `summaryTotals` (useMemo), `filteredCollections` (useMemo)
- Handlers: `handleAddTenancy`, `handleEditTenancy`, `handleToggleActive`, `handleDeleteTenancy`, `handleMarkReceivedFull`, `handleMarkReceivedPartial`, `handleDeletePaymentEvent`, `handleDeleteCollection`
- Activity log: `appendActivityLogSafe` calls after each mutation

**TenancyCard.tsx**:
- Props: `tenancy`, `property`, `collections` (for this tenancy + month), `paymentEventsByCollection`, `onEdit`, `onToggle`, `onDelete`, `onMarkReceivedFull`, `onMarkReceivedPartial`, `onDeletePaymentEvent`, `onDeleteCollection`, `isLoading`, `expanded`, `onToggleExpand`
- Renders: tenant name, unit label, rent amount, active/inactive badge, action buttons
- Contains: CollectionCard(s) for the selected month, expandable CollectionHistorySection

**CollectionCard.tsx**:
- Props: `collection`, `paymentEvents`, `tenancy`, `onMarkReceivedFull`, `onMarkReceivedPartial`, `onEdit`, `onDelete`, `onDeletePaymentEvent`, `isLoading`
- Renders: expected amount, received total, remaining balance, status badge, action buttons, PaymentHistorySection

**MonthNavigator.tsx**:
- Props: `selectedMonth: string`, `onChange: (month: string) => void`
- Renders: left arrow, month label (e.g., "Jun 2026"), right arrow
- Pure presentational, no internal state

**RentSummaryHeader.tsx**:
- Props: `totalExpected`, `totalReceived`, `totalOutstanding`, `pendingCount`
- Pure presentational

**AddTenancyModal.tsx**:
- Props: `mode: 'add' | 'edit'`, `tenancy?: Tenancy`, `properties: Property[]`, `isSaving`, `onSubmit`, `onClose`
- Internal form state, validation, submit

**MarkReceivedFullModal.tsx**:
- Props: `collection`, `tenancy`, `remainingBalance`, `isSaving`, `onSubmit`, `onClose`
- Fields: payment date (default today), payment method dropdown, notes

**MarkReceivedPartialModal.tsx**:
- Props: `collection`, `tenancy`, `remainingBalance`, `isSaving`, `onSubmit`, `onClose`
- Fields: amount (required), payment date, payment method, notes

**PaymentHistorySection.tsx**:
- Props: `paymentEvents`, `onDelete`, `isLoading`
- Renders: list of events in reverse chronological order, total, delete buttons

**CollectionHistorySection.tsx**:
- Props: `collections` (past months for this tenancy), `paymentEventsByCollection`
- Renders: 3–6 month mini-table: month, expected, received, status

### State Management Strategy

Page-level `useState` in `RentalsPage.tsx`, consistent with `BillsPage.tsx`:
- No Context or state management library
- Props drilled through at most 2 levels (Page → Card → Section)
- `useMemo` for derived data (grouping, filtering, summary computation)
- `useCallback` for stable handler references

This matches the existing BillsPage pattern (987 lines, all state at page level, props drilled to BillCard and modals).

---

## R-010: Reading Multiple Sheet Tabs in api/notify.ts

**Question**: The extension adds reads of Tenancies + RentCollections + PaymentEvents to the existing function. What is the performance impact?

**Decision**: **Use Promise.all for all reads in parallel.** Estimated impact: +0–2s worst case, keeping total under 15s.

**Evidence — existing parallel read (api/notify.ts lines 231–237)**:
```typescript
const [billsResponse, billTypesResponse, propertiesResponse, todosResponse] =
  await Promise.all([
    sheetsGet(accessToken, sheetId, "'Bills'!A2:R"),
    sheetsGet(accessToken, sheetId, "'BillTypes'!A2:J"),
    sheetsGet(accessToken, sheetId, "'Properties'!A2:G"),
    sheetsGet(accessToken, sheetId, "'Todos'!A2:Q"),
  ]);
```

**Extended read — 7 tabs in parallel**:
```typescript
const [billsResponse, billTypesResponse, propertiesResponse, todosResponse,
       tenanciesResponse, collectionsResponse, paymentsResponse] =
  await Promise.all([
    sheetsGet(accessToken, sheetId, "'Bills'!A2:R"),
    sheetsGet(accessToken, sheetId, "'BillTypes'!A2:J"),
    sheetsGet(accessToken, sheetId, "'Properties'!A2:G"),
    sheetsGet(accessToken, sheetId, "'Todos'!A2:Q"),
    sheetsGet(accessToken, sheetId, "'Tenancies'!A2:P"),
    sheetsGet(accessToken, sheetId, "'RentCollections'!A2:J"),
    sheetsGet(accessToken, sheetId, "'PaymentEvents'!A2:I"),
  ]);
```

**Performance analysis**:
- Each Google Sheets API read: ~500ms–2s depending on row count and network
- With `Promise.all`, all 7 reads execute concurrently. The total time is the slowest read, not the sum
- Existing 4 reads: bottleneck ~2s
- Adding 3 more in parallel: if they all complete within the existing 2s window → +0s
- Worst case (one slow read): +1–2s → total ~4s for reads

**Write operations** (auto-generation):
- Each `sheetsUpdate` (append RentCollection row): ~500ms
- Each activity log append: ~500ms
- These are sequential per tenancy but typically 1–5 tenancies per property, 1–3 properties
- Worst case: 15 tenancies × 1s/write = 15s → but this only happens on first run (subsequent runs are idempotent and skip all writes)
- Typical run (0–2 new records): +0–2s

**Total estimated execution time**:
| Phase | Existing | With Rentals | Notes |
|-------|----------|-------------|-------|
| Auth + setup | ~1s | ~1s | Unchanged |
| Read PushSubscriptions | ~1s | ~1s | Unchanged |
| Read data tabs | ~2s | ~2–3s | 7 parallel reads vs 4 |
| Auto-gen writes | 0s | 0–3s | 0 on typical run (idempotent) |
| Push notification send | ~1–2s | ~1–2s | Unchanged |
| **Total** | **~5–6s** | **~5–10s** | Well under 15s |

**Mitigation for first-run spike**: The first cron run after adding tenancies may need to create records for all tenancies. This is a one-time cost. Subsequent runs are idempotent (skip existing records) and add negligible time.

**Tab missing handling — DEGRADE ON MISSING (decision)**: The existing cron has never lazily-created tabs. Its pattern is to read existing tabs and assume they exist (because the client created them previously). Phase 16 matches this pattern exactly. If the rental tabs don't exist when the cron runs (because no user has visited /rentals yet), the sheetsGet calls in the parallel read block will return 400 errors. These are caught by the outer try/catch from R-005. The cron logs the error to console.error and continues with only bills+todos processing — rental auto-generation and overdue rent computation simply skip until tabs exist.

**Tab creation responsibility**: RentalsPage.tsx calls ensureRentalTabs on mount, mirroring how NotificationsPage created the PushSubscriptions tab on first visit (Phase 11). This means a user must visit /rentals at least once before the cron can process rental data. Acceptable trade-off: removes the need for cron to perform writes during what should be a read-heavy operation, and keeps cron-vs-client responsibility cleanly separated.

**First-run flow**:
1. User adds first tenancy via /rentals → tabs created by client → tenancy row appended
2. Next hourly cron run → reads tabs successfully → auto-generates current month's RentCollection → includes in push if overdue
3. Subsequent runs → idempotent (no duplicate creations)
