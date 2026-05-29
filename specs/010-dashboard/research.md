# Research: Dashboard

**Feature**: Dashboard (Phase 10)
**Date**: 2026-05-29

---

## R-001: Root Route Restructuring

**Decision**: Change `/` from `<Navigate to="/dashboard" replace />` to rendering `DashboardPage` directly inside `BootstrapLayout`, wrapped in `<ProtectedRoute>`. Remove the `/dashboard` route.

**Rationale**: Current `App.tsx` (lines 36–44) redirects authenticated users from `/` to `/dashboard`. This creates two URLs for one page and breaks `NavLink` `isActive` matching. The spec (DD-002, CL-005) mandates consolidation to `/`. The unauthenticated case continues to render `LandingPage` at `/` — determined by the existing `isAuthenticated` ternary, which now wraps the `DashboardPage` branch with `BootstrapLayout` + `ProtectedRoute`.

**Alternatives considered**: Keep `/dashboard` as alias with redirect — rejected because NavLink matching for two paths adds complexity for no benefit.

---

## R-002: Parallel Data Loading Strategy (Two-Phase)

**Decision**: Use a two-phase `Promise.allSettled` approach:
- **Phase 1**: Fetch `properties`, `billTypes`, `allCategories`, `recurrencePatterns`, `activityLog` in parallel.
- **Phase 2**: Using results from Phase 1, fetch `bills` (needs `billTypeMap`) and `todos` (needs `categoryMap` + `patternMap`) in parallel.

**Rationale**: `fetchBills` requires a pre-built `billTypeMap` from bill types data. `fetchTodos` requires `categoryMap` and `patternMap`. These are genuine data dependencies, not artificial serialization. A single `Promise.allSettled` with inline awaits would work but creates confusing nested dependency chains. The two-phase approach (spec recommendation) is cleaner: Phase 1 resolves all independent lookups, Phase 2 uses them.

**Alternatives considered**: Single `Promise.allSettled` with `async () => { await deps; return fetchBills(...) }` closures — works but harder to read and error-handle per-source. Sequential loading — too slow for 7 data sources.

---

## R-003: Clickthrough URL Search Params Pattern

**Decision**: Dashboard links use URL search params for clickthrough navigation:
- Bills: `/bills?property={propertyId}&month={YYYY-MM}&focus={billId}`
- Todos with category: `/todos?category={categoryId}&focus={todoId}`
- Todos without category: `/todos?focus={todoId}`

Target pages read params via `useSearchParams` on mount, apply filters, scroll to focused item, highlight briefly, then clear the `focus` param.

**Rationale**: No shared state, no context providers, no event bus needed. URL params are bookmarkable and survive refresh. BillsPage already has `registerBillRef` + scroll pattern for duplicate detection — this extends it.

**Alternatives considered**: React context/global store for "focused item" — over-engineered for simple navigation. Session storage — doesn't survive direct navigation, adds hidden state.

---

## R-004: Highlight Effect Implementation

**Decision**: Use a `focusedId` state in BillsPage/TodosPage. Pass `isFocused` prop to the card component. Card renders `ring-2 ring-indigo-300 ring-offset-2` when `isFocused` is true. After 1.5s, clear `focusedId` state and remove `focus` URL param via `setSearchParams`.

**Rationale**: Declarative React approach (state → prop → class) is cleaner than imperative DOM manipulation (`el.classList.add/remove`). The existing duplicate-detection highlight in BillsPage uses `ring-indigo-500` via DOM manipulation — the clickthrough highlight uses `ring-indigo-300` (lighter) via React state to differentiate the two.

**Alternatives considered**: DOM manipulation approach (like existing duplicate highlight) — works but less React-idiomatic and harder to coordinate with unmount cleanup.

---

## R-005: TodoCard forwardRef Pattern

**Decision**: Convert `TodoCard` from plain function component to `forwardRef<HTMLDivElement, TodoCardProps>`, mirroring `BillCard`'s exact pattern. The outer `<div>` receives the forwarded ref. Add `registerTodoRef` to TodosPage using the same `Map<string, HTMLDivElement>` ref + callback pattern as `registerBillRef` in BillsPage (line 692–700).

**Rationale**: BillCard already uses `forwardRef` (line 17) with the outer div receiving `ref`. TodoCard must match for the clickthrough scroll-into-view mechanism. The `registerTodoRef` callback pattern is proven in BillsPage.

**Alternatives considered**: Using `id` attributes and `document.getElementById` — fragile, not React-idiomatic.

---

## R-006: Auto-Refresh Strategy

**Decision**: Use `visibilitychange` event listener on `document`. When `document.visibilityState === 'visible'`, check `Date.now() - lastFetchAt.current > 30_000`. If stale, trigger full data reload. Track `lastFetchAt` via `useRef<number>(0)`. Cleanup listener on unmount.

**Rationale**: `visibilitychange` is more reliable than `focus` event — it fires on tab switches, app foregrounding on mobile, and PWA resume. The 30-second staleness gate prevents API hammering on rapid tab switches. Using `useRef` for `lastFetchAt` avoids unnecessary re-renders.

**Alternatives considered**: `window.onfocus` — less reliable on mobile. Polling interval — wastes API quota when user is actively viewing.

---

## R-007: AttentionItem Discriminated Union Design

**Decision**: Define `AttentionItem` as a discriminated union with `kind: 'bill' | 'todo'`. Build the unified array by:
1. Mapping overdue bills (`displayStatus === 'overdue'`) to `{ kind: 'bill', id, billTypeName, propertyName, propertyId, month, dueDate, displayStatus, amount }`.
2. Mapping overdue todos (`displayStatus === 'overdue'`) to `{ kind: 'todo', id, title, categoryId, categoryName, categoryColor, dueDate, displayStatus }`.
3. Sorting by `dueDate` ascending. Tiebreak: bills before todos (stable sort with `kind === 'bill' ? 0 : 1`).

**Rationale**: TypeScript discriminated unions allow type-safe narrowing via `item.kind` in the renderer. The `dueDate` ascending sort surfaces the most overdue items first (most urgent). Bills-before-todos tiebreak provides deterministic ordering.

**Alternatives considered**: Optional fields on a single interface — loses type safety. Separate arrays rendered sequentially — loses unified sorting.

---

## R-008: Activity Row Extraction Strategy

**Decision**: Extract the activity entry row rendering into a shared component `src/components/shared/ActivityRow.tsx`. Both `ActivityLogPage` and `DashboardPage` import this component. Also extract `ACTION_LABELS` and `ENTITY_ICONS` maps to `src/utils/activityLabels.ts`.

**Rationale**: DRY principle — the row layout (icon + label + relative time + summary) is identical between the two pages. Extracting prevents drift when new action types are added. The `ACTION_LABELS`/`ENTITY_ICONS` extraction is mandated by the spec (CL-006, FR-004/FR-005).

**Alternatives considered**: Duplicate JSX in DashboardPage — violates DRY, risks drift.

---

## R-009: Money This Month Computation

**Decision**: Compute from current-month bills (where `bill.month === currentMonthIST`):
- **Outstanding**: Sum `bill.amount` where `displayStatus` is `'pending'` or `'overdue'` and `amount !== null`.
- **Paid**: Sum `bill.amount` where `status === 'paid'` and `amount !== null`.
- **Per-property breakdown**: Group by `propertyId`, sum outstanding + paid per group. Look up `propertyName` from the bills data (already enriched). Hide rows where both totals are zero. Hide entire table if no rows qualify.

Note: Outstanding uses `displayStatus` (computed), Paid uses raw `status` (stored). This is intentional — a paid bill's `displayStatus` is `'paid'`, but the canonical source is `status === 'paid'`.

**Rationale**: Matches CL-001/CL-002/CL-003. Using `displayStatus` for outstanding correctly captures both pending and overdue bills. Using `status` for paid is simpler and equivalent (`computeDisplayStatus` maps `paid` → `paid`).

**Alternatives considered**: Using `displayStatus` for both — works but `status === 'paid'` is more direct for the paid case.

---

## R-010: NavLink Active State for Root Route

**Decision**: Change Navbar `navItems` Dashboard entry from `to: "/dashboard"` to `to: "/"`. Change brand logo `NavLink` from `to="/dashboard"` to `to="/"`. React Router's `NavLink` will correctly set `isActive` when on `/`.

**Rationale**: With the route consolidation (R-001), `/dashboard` no longer exists. `NavLink` `isActive` matches exactly on the `to` prop by default. Using `to="/"` ensures the Dashboard link highlights when on the root route.

**Potential issue**: NavLink with `to="/"` would match as active on ALL routes by default (since all routes start with `/`). React Router v6's `NavLink` uses exact matching by default for `isActive`, but we need to verify. The `end` prop on NavLink forces exact matching — add `end` to the Dashboard nav item to prevent it from matching `/bills`, `/todos`, etc.

**Resolution**: Add the `end` prop to the Dashboard NavLink so it only shows active on exactly `/`, not on child routes.
