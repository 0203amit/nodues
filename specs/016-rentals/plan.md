# Implementation Plan: Rentals

**Branch**: `016-rentals` | **Date**: 2026-06-04 | **Spec**: `specs/016-rentals/spec.md`

**Input**: Feature specification from `specs/016-rentals/spec.md`

## Summary

Add a Rentals module for tracking tenant rent collection across multiple properties. Introduces 3 new entities (Tenancy, RentCollection, PaymentEvent) stored in 3 new Google Sheets tabs with lazy bootstrap. A new `/rentals` page provides tenancy CRUD, monthly rent collection views with status badges (received/partial/pending/overdue), partial payment tracking via PaymentEvent rows, and expandable collection history. The existing `api/notify.ts` cron is extended to auto-generate monthly rent collection records and include overdue rents in push notifications. The Dashboard gains a "Rent Collected" subsection and overdue rent items in "Needs Attention".

## Technical Context

**Language/Version**: TypeScript 5.x (React 19 + Vite SPA)

**Primary Dependencies**: React Router v6, Tailwind CSS v3, Lucide React, uuid (all existing)

**Storage**: Google Sheets via existing `sheetsService.ts` (OAuth token, client-side) + Vercel cron (service account)

**Testing**: Manual testing; `npm run build` for type checking

**Target Platform**: Web PWA (mobile-first)

**Project Type**: SPA with serverless cron function

**Scale/Scope**: 3 new service files, 1 new page file, 9 new component files, modifications to 6 existing files, ~55 functional requirements

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution is not configured (template only). No gates to evaluate. Proceeding.

## Project Structure

### Documentation (this feature)

```text
specs/016-rentals/
├── plan.md              # This file
├── research.md          # 10 research decisions (R-001 through R-010)
├── data-model.md        # 3 new entities with field-by-field schema
├── quickstart.md        # Dev setup + testing checklist
└── spec.md              # Feature specification (55 FRs, 10 DDs)
```

### Source Code (changes)

```text
src/
├── config/
│   └── schema.ts                           # MODIFY — add 3 new HEADER_DEFINITIONS
├── types/
│   └── index.ts                            # MODIFY — add Tenancy, RentCollection, PaymentEvent types + ActionType extensions
├── services/
│   ├── tenanciesService.ts                 # NEW — Tenancy CRUD + ensureTab
│   ├── rentCollectionsService.ts           # NEW — RentCollection CRUD + status computation + ensureTab
│   └── paymentEventsService.ts             # NEW — PaymentEvent CRUD + ensureTab
├── pages/
│   ├── RentalsPage.tsx                     # NEW — main page component
│   └── DashboardPage.tsx                   # MODIFY — add rent data to Money + Attention
├── components/
│   ├── shared/
│   │   └── Navbar.tsx                      # MODIFY — add Rentals nav item
│   └── rentals/
│       ├── TenancyCard.tsx                 # NEW — tenancy row display
│       ├── CollectionCard.tsx              # NEW — rent collection record display
│       ├── AddTenancyModal.tsx             # NEW — add/edit tenancy form
│       ├── MarkReceivedFullModal.tsx       # NEW — mark received full form
│       ├── MarkReceivedPartialModal.tsx    # NEW — mark received partial form
│       ├── MonthNavigator.tsx              # NEW — month selector
│       ├── RentSummaryHeader.tsx           # NEW — totals bar
│       ├── PaymentHistorySection.tsx       # NEW — expandable payment events list
│       └── CollectionHistorySection.tsx    # NEW — past months mini-view
└── App.tsx                                 # MODIFY — add /rentals route

api/
└── notify.ts                               # MODIFY — rent auto-gen + overdue + push body
```

### Files Modified vs Created

| Action | Count | Files |
|--------|-------|-------|
| NEW | 12 | 3 services + 1 page + 8 components |
| MODIFY | 6 | schema.ts, types/index.ts, App.tsx, Navbar.tsx, DashboardPage.tsx, api/notify.ts |

---

## Key Design Decisions (from Research)

### 1. Tenancy Soft-Delete — Orphan Pattern (R-001)

Soft-deleting a tenancy only sets `deleted_at` on the tenancy row. Linked RentCollections and PaymentEvents remain in the database untouched — they're invisible because the parent tenancy is filtered out. This matches the existing Property → Bills pattern where property deletion doesn't cascade to bills.

Undo is simple: clear the tenancy's `deleted_at`, and all linked records re-appear immediately.

### 2. Push Notification — Category Count Prefix (R-002, R-003)

When overdue rents exist, the notification prefix switches from `{N} overdue:` to category-specific counts: `{N} bills + {M} rents pending:`. When no rents exist, the existing format is preserved exactly. All combinations including the edge case of todos + rents with no bills are handled by a unified prefix builder (see R-003 format table).

### 3. Overpayment — Hide Buttons, Keep Simple (R-004)

Once a rent collection reaches "received" status (sum >= expected), Mark Received buttons are hidden. Overpayment is visible in payment history but no special handling is applied. Correction is done by deleting/editing the latest PaymentEvent.

### 4. Cron Error Isolation (R-005)

All rent-specific blocks in `api/notify.ts` are wrapped in independent try/catch blocks with `console.error` logging. If rent auto-generation or overdue computation fails, the existing bill/todo notification logic continues unaffected. The `overdueRents` array defaults to empty on failure.

### 5. Lazy Tab Bootstrap (R-006)

The 3 new sheet tabs (Tenancies, RentCollections, PaymentEvents) are NOT created during initial app bootstrap. Instead, they are lazy-created on first access using the `ensurePushSubscriptionsTab` pattern: attempt to read → if 400 error (tab missing) → `addSheet` + `writeHeaders`. This avoids forcing tab creation on all users immediately.

### 6. Computed Status — Not Stored (DD-003)

RentCollection status is computed at read time from PaymentEvent sums, never stored in the sheet. The computation: `sum >= expected → received`, `month ended && not received → overdue`, `sum > 0 → partial`, else `pending`.

### 7. Component Architecture (R-009)

One page file (`RentalsPage.tsx`) with page-level `useState` and 9 presentational components in `src/components/rentals/`. Props drilled through at most 2 levels. Matches the existing `BillsPage.tsx` pattern.

### 8. Cron Parallel Reads (R-010)

All 7 sheet tab reads (4 existing + 3 new) use `Promise.all` for parallel execution. The 3 additional reads add negligible wall-clock time since they run concurrently. Total cron execution stays well under 15 seconds.

---

## Implementation Details

### New Service Files

#### tenanciesService.ts

Follows the exact pattern of `propertiesService.ts`:
- `parseRow(row: RowWithIndex): Tenancy | null` — parse sheet row to typed object
- `serializeRow(tenancy: Tenancy): string[]` — serialize to sheet row
- `ensureTenanciesTab(accessToken, spreadsheetId)` — lazy bootstrap
- `fetchTenancies(accessToken, spreadsheetId, propertyMap)` → `TenancyWithDisplay[]`
- `addTenancy(accessToken, spreadsheetId, data: TenancyFormData)` → `Tenancy`
- `updateTenancy(accessToken, spreadsheetId, existing, data)` → `Tenancy`
- `toggleTenancyActive(accessToken, spreadsheetId, tenancy)` → `Tenancy`
- `softDeleteTenancy(accessToken, spreadsheetId, tenancy)` → `void`
- `undoDeleteTenancy(accessToken, spreadsheetId, tenancy)` → `void`

#### rentCollectionsService.ts

Follows `billsService.ts` pattern but simpler (no calendar events, no file attachments):
- `parseRow`, `serializeRow`, `ensureRentCollectionsTab`
- `fetchRentCollections(accessToken, spreadsheetId)` → `RentCollection[]`
- `addRentCollection(accessToken, spreadsheetId, data)` → `RentCollection`
- `updateRentCollection(accessToken, spreadsheetId, existing, data)` → `RentCollection`
- `softDeleteRentCollection`, `undoDeleteRentCollection`
- `computeCompositeKey(tenancyId, month)` → `string`
- `checkDuplicate(compositeKey, collections, excludeId?)` → `RentCollection | null`
- `computeRentStatus(expectedAmount, totalReceived, month, today?)` → `RentDisplayStatus`

#### paymentEventsService.ts

Simplest service — no edit (payments are immutable once created):
- `parseRow`, `serializeRow`, `ensurePaymentEventsTab`
- `fetchPaymentEvents(accessToken, spreadsheetId)` → `PaymentEvent[]`
- `addPaymentEvent(accessToken, spreadsheetId, data)` → `PaymentEvent`
- `softDeletePaymentEvent`, `undoDeletePaymentEvent`

### Cron Extension (api/notify.ts)

The cron gains 3 new responsibilities:

**1. Read rental data** (added to existing Promise.all):
3 additional parallel reads — Tenancies, RentCollections, PaymentEvents. Wrapped in try/catch (Block A in R-005).

**2. Auto-generate rent collections** (new block, before overdue computation):
For each tenancy: skip if deleted/inactive/property-deleted/lease-not-started/lease-expired → compute composite key → check idempotency → append new RentCollection row → write activity log. Each tenancy wrapped in individual try/catch (FR-021).

**3. Compute overdue rents** (new block, before notification body):
For each non-deleted RentCollection where month < currentMonth: sum non-deleted PaymentEvents → if sum < expectedAmount → add to overdueRents array. Build description per R-003 format.

All 3 blocks wrapped in independent try/catch per R-005.

### Dashboard Extension (DashboardPage.tsx)

**"Money This Month"** — new subsection below existing bills summary:
- Read current-month rent collections + payment events
- Compute: total expected, total received, total outstanding
- Per-property breakdown (only properties with active tenancies)

**"Needs Attention"** — overdue rents added:
- New `kind: 'rent'` variant in AttentionItem
- Sorted by due date ascending (merged with bills/todos)
- Click navigates to `/rentals`

---

## Chunk Breakdown

### Chunk 1: Schema + Types + Services

**Files**: `schema.ts`, `types/index.ts`, `tenanciesService.ts` (new), `rentCollectionsService.ts` (new), `paymentEventsService.ts` (new)

| # | Task | Details |
|---|------|---------|
| 1 | Add 3 HEADER_DEFINITIONS entries | Tenancies (16 cols), RentCollections (10 cols), PaymentEvents (9 cols) |
| 2 | Add Tenancy types | Interface, FormData, WithDisplay |
| 3 | Add RentCollection types | Interface, WithDisplay, RentDisplayStatus |
| 4 | Add PaymentEvent types | Interface, FormData |
| 5 | Extend ActionType union | +8 new actions |
| 6 | Extend ActivityEntityType union | +3 new types |
| 7 | Add AttentionItem rent variant | New `kind: 'rent'` |
| 8 | Create tenanciesService.ts | Full CRUD with ensureTab |
| 9 | Create rentCollectionsService.ts | Full CRUD with status computation + ensureTab |
| 10 | Create paymentEventsService.ts | Add + softDelete + fetch with ensureTab |
| 11 | `npm run build` | Verify types compile |

**Deliverable**: All 3 entities typed and service-layer CRUD ready. No UI yet.

### Chunk 2: Tenancy Management UI

**Files**: `App.tsx`, `Navbar.tsx`, `RentalsPage.tsx` (new), `AddTenancyModal.tsx` (new), `TenancyCard.tsx` (new)

| # | Task | Details |
|---|------|---------|
| 1 | Add /rentals route | New route in App.tsx within BootstrapLayout |
| 2 | Add Rentals nav item | New entry in Navbar navItems |
| 3 | Create RentalsPage.tsx shell | Data loading, state management, empty state |
| 4 | Create AddTenancyModal.tsx | Dual-mode form (add/edit), validation, property dropdown |
| 5 | Create TenancyCard.tsx | Tenancy row display with badges and action buttons |
| 6 | Property grouping display | Group tenancies under property headings |
| 7 | Tenancy toggle active/inactive | Inline toggle with immediate persistence |
| 8 | Tenancy soft-delete with undo | Optimistic UI + showUndo snackbar |
| 9 | Tenancy edit flow | Pre-fill modal, property read-only |
| 10 | Property filter + first-run empty state | Filter dropdown + "No tenants yet" |
| 11 | Activity log entries | All tenancy CRUD actions logged |
| 12 | `npm run build` | Verify clean |

**Deliverable**: `/rentals` page with full tenancy CRUD. No rent collection data yet.

### Chunk 3: RentCollection + PaymentEvent UI

**Files**: `RentalsPage.tsx`, 7 new component files in `src/components/rentals/`

| # | Task | Details |
|---|------|---------|
| 1 | Create MonthNavigator.tsx | Prev/next month + formatted display |
| 2 | Create RentSummaryHeader.tsx | Expected, received, outstanding, pending count |
| 3 | Create CollectionCard.tsx | Status badge, amounts, action buttons |
| 4 | Integrate collections into RentalsPage | Fetch + group under tenancies for selected month |
| 5 | Status badges + sorting | received/partial/pending/overdue, sorted per FR-015 |
| 6 | Create MarkReceivedFullModal.tsx | Method, date, notes; amount = remaining balance |
| 7 | Implement Mark Received Full handler | Create PaymentEvent, recompute status |
| 8 | Create MarkReceivedPartialModal.tsx | Amount input, method, date, notes |
| 9 | Implement Mark Received Partial handler | Create PaymentEvent, recompute status |
| 10 | Create PaymentHistorySection.tsx | Expandable payment list, reverse chronological |
| 11 | Payment event soft-delete | Delete → recompute collection status |
| 12 | Rent collection edit + soft-delete | Edit expected amount/due date/notes, soft-delete with undo |
| 13 | Create CollectionHistorySection.tsx | Past 3–6 months mini-view per tenancy |
| 14 | Activity log entries | Payment received/deleted logged |
| 15 | `npm run build` | Verify clean |

**Deliverable**: Full rent collection + payment event UI.

### Chunk 4: Cron Extension + Dashboard + Push Notifications

**Files**: `api/notify.ts`, `DashboardPage.tsx`

| # | Task | Details |
|---|------|---------|
| 1 | Add column index constants | Tenancy, Collection, Payment column maps in notify.ts |
| 2 | Add parallel sheet reads + lazy tab bootstrap | 3 new reads in Promise.all + ensureTab calls |
| 3 | Implement rent auto-generation | Iterate tenancies, check eligibility, create missing records |
| 4 | Implement overdue rent computation | Month-end threshold, sum payments vs expected |
| 5 | Extend push notification body | New prefix format (R-002) with combined descriptions |
| 6 | Add error isolation | 3 independent try/catch blocks (R-005) |
| 7 | Add cron activity log entries | rent_auto_generated entries |
| 8 | Extend Dashboard Money This Month | Rent Collected subsection with per-property breakdown |
| 9 | Extend Dashboard Needs Attention | Overdue rent items with navigation to /rentals |
| 10 | `npm run build` | Final verification |

**Deliverable**: Complete feature — cron auto-generates rents, dashboard shows rent data, push notifications include overdue rents.

---

## Complexity Tracking

No constitution violations to justify. The feature introduces new entities and a new page but follows all existing patterns (service structure, sheet storage, component architecture, cron extension).

| Metric | Value |
|--------|-------|
| New files | 12 (3 services, 1 page, 8 components) |
| Modified files | 6 (schema, types, App, Navbar, Dashboard, notify) |
| New Sheet tabs | 3 (Tenancies: 16 cols, RentCollections: 10 cols, PaymentEvents: 9 cols) |
| New TypeScript interfaces | 9 |
| New ActionType values | 8 |
| Functional requirements | ~55 |
| Estimated total lines added | ~2500–3000 |
