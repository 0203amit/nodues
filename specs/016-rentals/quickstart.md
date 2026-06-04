# Quickstart: Rentals

**Feature**: Rentals (Phase 16)
**Date**: 2026-06-04

---

## Prerequisites

- Node.js 18+, npm
- Phases 1–15 complete (properties, bill types, bills CRUD, calendar reminders, activity log, dashboard, push notifications, bills recurrence)
- Branch: `016-rentals`
- At least one active property in the spreadsheet (for tenancy creation)
- Google Service Account configured with Sheets API access (for cron testing)

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

### Chunk 1: Schema + Types + Services

1. **schema.ts** — Add 3 new HEADER_DEFINITIONS (Tenancies, RentCollections, PaymentEvents)
2. **types/index.ts** — Add Tenancy, RentCollection, PaymentEvent interfaces + ActionType/EntityType extensions
3. **tenanciesService.ts** — New file: CRUD + ensureTab
4. **rentCollectionsService.ts** — New file: CRUD + status computation + ensureTab
5. **paymentEventsService.ts** — New file: CRUD + ensureTab
6. **Build check** — `npm run build`

### Chunk 2: Tenancy Management UI

1. **App.tsx** — Add /rentals route
2. **Navbar.tsx** — Add Rentals nav entry
3. **RentalsPage.tsx** — New file: page shell with data loading + tenancy CRUD
4. **AddTenancyModal.tsx** — New file: tenancy form
5. **TenancyCard.tsx** — New file: tenancy row display
6. **Build check** — `npm run build`

### Chunk 3: RentCollection + PaymentEvent UI

1. **MonthNavigator.tsx** — New file: month selector
2. **RentSummaryHeader.tsx** — New file: totals bar
3. **CollectionCard.tsx** — New file: rent collection row
4. **RentalsPage.tsx** — Integrate collections, mark received flows, payment history
5. **MarkReceivedFullModal.tsx** — New file
6. **MarkReceivedPartialModal.tsx** — New file
7. **PaymentHistorySection.tsx** — New file
8. **CollectionHistorySection.tsx** — New file
9. **Build check** — `npm run build`

### Chunk 4: Cron + Dashboard + Push

1. **api/notify.ts** — Read rental data, auto-generation, overdue computation, push body extension
2. **DashboardPage.tsx** — Rent Collected subsection + overdue rents in Needs Attention
3. **Build check** — `npm run build`

---

## Testing Checklist

### Chunk 1: Services (no UI testing — build check only)

| # | Test | Expected |
|---|------|----------|
| T001 | `npm run build` passes | All new types and service files compile cleanly |

### Chunk 2: Tenancy Management

| # | Test | Steps | Expected |
|---|------|-------|----------|
| T002 | Navigation | Click "Rentals" in nav | /rentals page loads |
| T003 | Empty state | Visit /rentals with no tenancies | "No tenants yet" message + "Add Tenancy" CTA |
| T004 | Add tenancy | Tap Add Tenancy, fill form, submit | Tenancy appears under property heading |
| T005 | Add multiple tenancies same property | Add "Room 1" and "Room 2" to same property | Both appear under property heading |
| T006 | Edit tenancy | Edit → change rent to 5,500 → save | Updated rent shown. Property field read-only |
| T007 | Toggle inactive | Toggle tenancy inactive | "Inactive" badge appears |
| T008 | Toggle active | Toggle back to active | Badge removed |
| T009 | Soft-delete + undo | Delete → undo within 10s | Tenancy reappears |
| T010 | Soft-delete permanent | Delete → wait 10s | Tenancy gone |
| T011 | Validation: empty name | Submit with empty name | Error prevents submission |
| T012 | Validation: rent <= 0 | Enter 0 for rent | Error prevents submission |
| T013 | Activity log | Add + edit + delete | 3 entries in Activity Log |
| T014 | `npm run build` | | Clean |

### Chunk 3: Rent Collection + Payments

| # | Test | Steps | Expected |
|---|------|-------|----------|
| T015 | Month navigator | Click prev/next | Month changes |
| T016 | Summary header | 3 tenancies, various statuses | Correct totals |
| T017 | Pending badge | No payments, month not ended | Amber "Pending" badge |
| T018 | Partial badge | Expect 10k, pay 4k | Blue "Partial", 6k remaining |
| T019 | Received badge | Expect 10k, pay 10k | Green "Received" |
| T020 | Overdue badge | Past month, not fully paid | Red "Overdue" |
| T021 | Mark Received Full | Pending 10k → Mark Full | PaymentEvent 10k, status → Received |
| T022 | Mark Received Full on Partial | 10k, already 4k paid → Mark Full | PaymentEvent 6k, status → Received |
| T023 | Mark Received Partial | 10k → Partial 4k | PaymentEvent 4k, status → Partial |
| T024 | Sequential partial payments | 4k + 6k on 10k | Both events in history, status → Received |
| T025 | Received hides buttons | Record at Received | No Mark Received buttons |
| T026 | Payment history expand | 2 payments on a record | Both listed reverse-chronological |
| T027 | Delete payment event | Delete one of two payments → undo | Status recomputes, undo works |
| T028 | Edit collection | Change expected 10k → 12k | Amount updated, status recomputes |
| T029 | Delete collection | Soft-delete → undo | Collection disappears/reappears |
| T030 | Property filter | Select one property | Only that property's tenancies |
| T031 | Sort order | Mix of statuses | Overdue first, then pending/partial/received (FR-015) |
| T032 | `npm run build` | | Clean |

### Chunk 4: Cron + Dashboard + Push

| # | Test | Steps | Expected |
|---|------|-------|----------|
| T033 | Auto-generation | 3 tenancies → trigger cron | 3 RentCollection records created |
| T034 | Idempotency | Trigger cron again | No duplicates |
| T035 | Skips inactive | Set tenancy inactive → cron | No record for inactive |
| T036 | Skips deleted | Delete tenancy → cron | No record for deleted |
| T037 | Skips expired lease | leaseEndDate in past → cron | No record |
| T038 | Skips future lease | leaseStartDate in future → cron | No record |
| T039 | Due date clamping | dueDay=31, February | Due date = Feb 28 |
| T040 | Error isolation | Simulate rent read failure | Push still sends with bill data |
| T041 | Push: bills + rents | Overdue bills and rents | Body: "{N} bills + {M} rents pending: ..." |
| T042 | Push: rents only | Only overdue rents | Body: "{N} rents pending: ..." |
| T043 | Push: no rents | Only overdue bills | Body: "{N} overdue: ..." (existing format) |
| T044 | Dashboard Rent Collected | Current month with tenancies | Expected/received/outstanding shown |
| T045 | Dashboard Needs Attention | Overdue rents exist | Overdue rent items, clickable |
| T046 | Dashboard All Clear | No overdue items | "All clear" preserved |
| T047 | `npm run build` | | Clean |

---

## Files Modified / Created

| File | Action | What |
|------|--------|------|
| `src/config/schema.ts` | Modify | +3 HEADER_DEFINITIONS |
| `src/types/index.ts` | Modify | +9 interfaces/types, +8 ActionType, +3 EntityType |
| `src/services/tenanciesService.ts` | Create | Tenancy CRUD service |
| `src/services/rentCollectionsService.ts` | Create | RentCollection CRUD + status |
| `src/services/paymentEventsService.ts` | Create | PaymentEvent CRUD service |
| `src/App.tsx` | Modify | +1 route |
| `src/components/shared/Navbar.tsx` | Modify | +1 nav item |
| `src/pages/RentalsPage.tsx` | Create | Main page |
| `src/components/rentals/TenancyCard.tsx` | Create | Tenancy row |
| `src/components/rentals/CollectionCard.tsx` | Create | Collection row |
| `src/components/rentals/AddTenancyModal.tsx` | Create | Tenancy form |
| `src/components/rentals/MarkReceivedFullModal.tsx` | Create | Full payment form |
| `src/components/rentals/MarkReceivedPartialModal.tsx` | Create | Partial payment form |
| `src/components/rentals/MonthNavigator.tsx` | Create | Month selector |
| `src/components/rentals/RentSummaryHeader.tsx` | Create | Totals bar |
| `src/components/rentals/PaymentHistorySection.tsx` | Create | Payment events list |
| `src/components/rentals/CollectionHistorySection.tsx` | Create | Past months view |
| `api/notify.ts` | Modify | Rent auto-gen + overdue + push body |
| `src/pages/DashboardPage.tsx` | Modify | Rent data in Money + Attention |

---

## Key Code Paths

- **Entry point (UI)**: `RentalsPage.tsx` — data loading → display → CRUD handlers
- **Tenancy CRUD**: `tenanciesService.ts` — mirrors `propertiesService.ts`
- **Rent collection CRUD**: `rentCollectionsService.ts` — mirrors `billsService.ts` (simpler)
- **Payment tracking**: `paymentEventsService.ts` — append-only + soft-delete
- **Status computation**: `computeRentStatus` in `rentCollectionsService.ts` — pure function
- **Due date clamping**: `computeDueDate` from `billsService.ts` — reused directly
- **Cron auto-gen**: `api/notify.ts` — after auth, before notification body
- **Activity log**: `appendActivityLogSafe` in `activityLogService.ts` — reused
- **Dashboard integration**: `DashboardPage.tsx` — new subsection + new AttentionItem variant
- **Navigation**: `Navbar.tsx` + `App.tsx` — new route + nav item
