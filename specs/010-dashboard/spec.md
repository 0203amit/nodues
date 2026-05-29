# Feature Specification: Dashboard

**Feature Branch**: `010-dashboard`

**Created**: 2026-05-29

**Status**: Draft

**Input**: User description: "Dashboard — landing page with Money This Month, Needs Attention, and Recent Activity sections (Phase 10 of the Build Order)"

---

## Clarifications

### CL-001: Current Month Determination (IST)

"Current month" is determined by today's date in IST (`Asia/Kolkata` timezone), formatted as `YYYY-MM`. This matches the existing `computeDisplayStatus` pattern in `billsService.ts` and `todosService.ts` which both use `new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })` for today's date. The dashboard derives the current month from this IST-aware today string: `todayIST.slice(0, 7)` → e.g. `"2026-05"`.

### CL-002: Outstanding Bills Definition

"Outstanding" bills for Money This Month are bills where ALL of the following are true:
- `month` matches the current month (YYYY-MM).
- `displayStatus` is `'pending'` or `'overdue'` (i.e., not `'paid'`, not `'skipped'`, not `'not_yet_generated'`).
- `amount` is not null (bills with no amount are excluded from the sum).

### CL-003: Paid Bills Definition

"Paid" bills for Money This Month are bills where:
- `month` matches the current month (YYYY-MM).
- `status` is `'paid'`.
- `amount` is not null.

### CL-004: Overdue-Only for Needs Attention

The Needs Attention section shows ONLY overdue items — NO "due soon", upcoming, or pending items. "Overdue" is determined by the existing `computeDisplayStatus` functions: bills with `displayStatus === 'overdue'` and todos with `displayStatus === 'overdue'`.

### CL-005: Root Route Change

Currently (`App.tsx` lines 36–44) the `/` route redirects authenticated users to `/dashboard`. This spec changes the routing so that `/` directly renders `DashboardPage` (no redirect), and the `/dashboard` route is removed. The Navbar Dashboard link updates from `to="/dashboard"` to `to="/"`. This avoids two URLs for one page.

### CL-006: ACTION_LABELS and ENTITY_ICONS Extraction

`ACTION_LABELS` and `ENTITY_ICONS` are currently defined as module-level constants in `ActivityLogPage.tsx`. This spec extracts them to a shared module `src/utils/activityLabels.ts` so both `ActivityLogPage` and `DashboardPage` can import them without duplication or drift risk.

### CL-007: TodoCard forwardRef Addition

`TodoCard` currently does NOT use `forwardRef` (it's a plain function component). The clickthrough navigation from the dashboard requires a ref mechanism on TodosPage to scroll a specific todo into view. This spec adds `forwardRef` to `TodoCard` (mirroring `BillCard`'s existing pattern) and a `registerTodoRef` mechanism to `TodosPage`.

---

## User Scenarios & Testing

### User Story 1 — Money This Month Overview (Priority: P1)

The user signs in and sees a financial summary for the current month: total outstanding amount, total paid amount, and a per-property breakdown. This gives an at-a-glance answer to "how much do I still owe this month?"

**Why this priority**: The primary value of a dashboard — instant financial awareness without navigating to Bills and mentally adding up numbers.

**Independent Test**: Create bills for the current month across multiple properties with varying statuses (pending, overdue, paid, skipped, not_yet_generated). Navigate to `/`. Verify the Outstanding and Paid totals match the expected sums, and the per-property table is correct.

**Acceptance Scenarios**:

1. **Given** 3 current-month bills: Maintenance ₹1,100 (pending), Water ₹500 (overdue), Electricity ₹2,000 (paid), **When** the dashboard loads, **Then** Outstanding shows ₹1,600, Paid shows ₹2,000.

2. **Given** a current-month bill with `status='not_yet_generated'` and amount ₹800, **When** the dashboard loads, **Then** this bill is excluded from both Outstanding and Paid sums.

3. **Given** a current-month bill with `status='skipped'`, **When** the dashboard loads, **Then** this bill is excluded from both Outstanding and Paid sums.

4. **Given** a current-month bill with `status='pending'` and `amount=null`, **When** the dashboard loads, **Then** this bill is excluded from the Outstanding sum (null amounts are not counted).

5. **Given** bills across 2 properties (Mira Shop: ₹1,100 outstanding, ₹2,000 paid; Mira Flat: ₹500 outstanding, ₹0 paid), **When** the dashboard loads, **Then** the per-property mini-table shows two rows with correct Outstanding and Paid columns.

6. **Given** a property has zero outstanding AND zero paid for the current month, **When** the dashboard loads, **Then** that property row is hidden from the mini-table.

7. **Given** no properties qualify for the mini-table (all zeros or no current-month bills), **When** the dashboard loads, **Then** the entire per-property mini-table is hidden.

8. **Given** the viewport is ≥768px, **When** the dashboard loads, **Then** the Outstanding and Paid big numbers sit side-by-side. On mobile (<768px), they stack vertically.

9. **Given** amounts are displayed, **Then** they use `formatCurrency` (en-IN INR, no decimals) — e.g. "₹1,100", "₹2,58,700".

---

### User Story 2 — Needs Attention: Overdue Items (Priority: P1)

The user sees a unified list of overdue bills and overdue to-dos, sorted oldest-first. Each row is clickable and navigates to the relevant page with the item scrolled into view and briefly highlighted.

**Why this priority**: Overdue items are the most actionable information — the user needs to know what they've missed and act on it immediately.

**Independent Test**: Create overdue bills and overdue to-dos with various due dates. Navigate to `/`. Verify the Needs Attention list shows them sorted oldest-first, with correct icons, labels, and badges. Click a row and verify clickthrough navigation works.

**Acceptance Scenarios**:

1. **Given** 2 overdue bills (due Jan 15 and Feb 1) and 1 overdue todo (due Jan 20), **When** the dashboard loads, **Then** the Needs Attention list shows them in order: Jan 15 bill, Jan 20 todo, Feb 1 bill (oldest due date first).

2. **Given** an overdue bill and an overdue todo with the same due date, **When** the dashboard loads, **Then** the bill appears before the todo (stable tiebreak).

3. **Given** an overdue bill "Maintenance — Mira Shop · Jun 2026", **Then** the row shows: Receipt icon (w-5 h-5 text-slate-500), the text "{billTypeName} — {propertyName} · {formatMonth(month)}", an overdue status badge, and the due date formatted via `formatDueDate`.

4. **Given** an overdue todo "Renew insurance" with category "Legal" (color #6366F1), **Then** the row shows: ListTodo icon, the title, an overdue badge, the due date, and a category badge (color dot + "Legal").

5. **Given** an overdue todo with no category, **Then** the row shows: ListTodo icon, title, overdue badge, due date — no category badge.

6. **Given** the user clicks an overdue bill row, **Then** the browser navigates to `/bills?property={propertyId}&month={YYYY-MM}&focus={billId}`. BillsPage reads these params on mount, sets `filterProperty` and `filterMonth`, and scrolls the matching bill into view with a brief highlight effect (ring-2 ring-indigo-300, fades after ~1.5s).

7. **Given** the user clicks an overdue todo row with a category, **Then** the browser navigates to `/todos?category={categoryId}&focus={todoId}`. TodosPage reads these params on mount, sets `filterCategory`, and scrolls the matching todo into view with the same highlight effect.

8. **Given** the user clicks an overdue todo row with no category, **Then** the browser navigates to `/todos?focus={todoId}` (no category param).

9. **Given** no overdue bills and no overdue to-dos exist, **When** the dashboard loads, **Then** the Needs Attention section shows an empty state: CheckCircle2 icon (w-12 h-12 text-emerald-500), heading "All clear" (text-base font-semibold text-slate-900), subtext "Nothing overdue right now." (text-sm text-slate-600). Centered.

---

### User Story 3 — Recent Activity Summary (Priority: P1)

The user sees the last 5 activity log entries on the dashboard, reusing the same row layout as the Activity Log viewer page. A "View all" link navigates to the full viewer.

**Why this priority**: Quick context on what happened recently without navigating to Settings > Activity Log.

**Independent Test**: Perform several CRUD actions. Navigate to `/`. Verify the Recent Activity section shows the last 5 entries with correct icons, labels, relative timestamps, and summaries. Click "View all" to verify navigation.

**Acceptance Scenarios**:

1. **Given** 10 activity log entries exist, **When** the dashboard loads, **Then** the Recent Activity section shows only the 5 newest entries.

2. **Given** a `bill_paid` entry from 3 minutes ago, **Then** it shows: Receipt icon, "Bill paid" label, "3 minutes ago", and the summary string.

3. **Given** the user clicks "View all", **Then** the browser navigates to `/settings/activity-log`.

4. **Given** zero activity log entries exist, **When** the dashboard loads, **Then** the Recent Activity section shows: History icon (w-12 h-12 text-slate-400), heading "No activity yet", subtext "Actions you perform will appear here."

---

### User Story 4 — Navigation and Routing (Priority: P1)

The root URL `/` renders the Dashboard. The Dashboard is the landing page after sign-in.

**Why this priority**: The dashboard must be reachable and be the default view.

**Independent Test**: Sign in → verify landing on `/` with Dashboard content. Navigate away → tap Dashboard in navbar → verify return to `/`. Direct URL `/` renders Dashboard.

**Acceptance Scenarios**:

1. **Given** the user signs in, **When** the bootstrap guard passes, **Then** the user lands on `/` which renders `DashboardPage`.

2. **Given** the user is on `/bills`, **When** they tap "Dashboard" in the navbar, **Then** they navigate to `/`.

3. **Given** the user directly navigates to `/`, **When** they are authenticated and bootstrapped, **Then** DashboardPage renders with document title "NoDues · Dashboard".

4. **Given** the user navigates to `/dashboard` (old URL), **Then** no route matches (or optionally redirects to `/`). The old `/dashboard` route is removed.

---

### User Story 5 — Refresh and Auto-Refresh (Priority: P2)

The dashboard provides a manual Refresh button and auto-refreshes stale data when the tab regains focus.

**Why this priority**: Important for usability but not blocking the core dashboard functionality.

**Independent Test**: Load dashboard → act on another page (e.g., mark a bill paid) → return to dashboard tab. Verify auto-refresh fires if >30s since last fetch. Also test the manual Refresh button.

**Acceptance Scenarios**:

1. **Given** the dashboard is loaded, **When** the user clicks the Refresh button (RotateCw icon), **Then** all data is re-fetched and the sections update.

2. **Given** the dashboard was last fetched 45 seconds ago, **When** the tab regains focus (window focus event or visibilityState 'visible'), **Then** data is re-fetched automatically.

3. **Given** the dashboard was last fetched 10 seconds ago, **When** the tab regains focus, **Then** no re-fetch occurs (staleness gate: 30 seconds).

4. **Given** a refresh is in progress (either manual or auto), **Then** the Refresh button shows a spinning state and is disabled until the fetch completes.

---

### Edge Cases

- **No bills exist**: Money This Month shows ₹0 outstanding and ₹0 paid. Per-property table is hidden. This is normal for a new user.
- **All bills are not_yet_generated or skipped**: Outstanding shows ₹0, Paid shows ₹0. Per-property table hidden.
- **Bills with null amounts**: Excluded from sums. A property with only null-amount bills is excluded from the mini-table.
- **Mixed overdue bills and todos with same dueDate**: Bills sort before todos (stable tiebreak).
- **Activity log fetch fails**: Recent Activity section shows empty state. Other sections still render. Error toast displayed.
- **Bills/todos fetch fails**: The failed section shows a fallback or is omitted. Other sections still render. Error toast displayed.
- **All sections fail**: Loading spinner followed by error toasts. Empty states for all sections.
- **Rapid navigation**: User navigates away mid-fetch → no state update on unmounted component (standard React cleanup).
- **Clickthrough to deleted bill/todo**: If the target item was deleted between dashboard load and click, BillsPage/TodosPage filters apply but nothing scrolls into view (no crash, just no highlight).
- **Focus param cleanup**: After the highlight animation completes (~1.5s), the `focus` URL search param is cleared to prevent re-highlighting on page refresh.

---

## Design Decisions

### DD-001: Three-Section Vertical Layout (CHOSEN)

**Decision**: The dashboard has three vertically stacked sections: Money This Month, Needs Attention, Recent Activity. Mobile-first, single-column layout.

**Rationale**: Matches the app's mobile-first philosophy (MASTER.md). The three sections cover the three most valuable pieces of information: financial overview, actionable items, and recent context. No horizontal multi-column dashboard grid — that pattern is for desktop analytics apps, not mobile-first utility apps.

### DD-002: Root Route Consolidation (CHOSEN)

**Decision**: `/` renders DashboardPage directly (for authenticated users). The `/dashboard` route is removed. Navbar Dashboard link points to `/`.

**Rationale**: Two URLs for one page is confusing and breaks NavLink's `isActive` matching. The landing page (`LandingPage`) renders for unauthenticated users at `/`, and the dashboard renders for authenticated users at `/` — determined by the existing `isAuthenticated` check in `App.tsx`.

**Alternative rejected**: Keep `/dashboard` as an alias. This would require `NavLink` matching logic for two paths, and creates ambiguity about canonical URLs.

### DD-003: Parallel Data Loading with Progressive Rendering (CHOSEN)

**Decision**: All data sources (bills, todos, activity log, properties, bill types, categories, recurrence patterns) are fetched in parallel via `Promise.allSettled`. Each section renders independently based on the data available — if one source fails, the other sections still display.

**Rationale**: The dashboard aggregates data from multiple sources. Sequential loading would be slow. `Promise.allSettled` ensures a single source failure doesn't blank the entire page. Each section handles its own error state gracefully.

**Alternative rejected**: `Promise.all` — one failure kills all sections. Not acceptable for a dashboard that should always show something.

### DD-004: Clickthrough Navigation via URL Search Params (CHOSEN)

**Decision**: Dashboard rows link to BillsPage/TodosPage via URL search params: `?property=X&month=YYYY-MM&focus=billId` for bills, `?category=X&focus=todoId` for todos. The target page reads these params on mount, applies filters, scrolls to the item, and applies a brief highlight.

**Rationale**: This approach requires no shared global state, no context providers, no event bus. URL params are bookmarkable, shareable, and survive page refreshes. The BillsPage already has a `registerBillRef` + scroll mechanism for duplicate detection — the clickthrough reuses this pattern.

**Alternative rejected**: React context or global store for "focused item". Over-engineered for a simple navigation use case.

### DD-005: Highlight Effect — ring-2 ring-indigo-300 with Fade (CHOSEN)

**Decision**: The highlighted card receives `ring-2 ring-indigo-300 ring-offset-2` for ~1.5 seconds, then the classes are removed. The `focus` URL param is cleared after highlighting.

**Rationale**: Matches the existing duplicate-detection highlight in BillsPage (`ring-2 ring-indigo-500` for 2 seconds). Using `ring-indigo-300` (lighter) differentiates "navigated here" from "duplicate warning" while keeping the same visual language. 1.5 seconds is long enough to notice, short enough not to be distracting.

### DD-006: Auto-Refresh on Focus with 30s Staleness Gate (CHOSEN)

**Decision**: When the dashboard tab regains focus (`visibilitychange` event where `document.visibilityState === 'visible'`), re-fetch data IF the last fetch was more than 30 seconds ago. Track `lastFetchAt` in a `useRef`.

**Rationale**: Users will frequently switch between dashboard and action pages (Bills, Todos). Auto-refresh ensures the dashboard reflects recent changes. The 30-second gate prevents hammering the Sheets API on rapid tab switches. Using `visibilitychange` instead of `focus` event is more reliable (covers both tab switches and app foregrounding on mobile).

### DD-007: AttentionItem Discriminated Union (CHOSEN)

**Decision**: The Needs Attention list uses a discriminated union type `AttentionItem` with `kind: 'bill' | 'todo'` to represent both overdue bills and overdue todos in a single sorted list.

**Rationale**: TypeScript discriminated unions provide type-safe rendering — each row handler can narrow the type via `item.kind` and access the correct fields. This avoids unsafe casting or optional field explosion.

### DD-008: Extract ACTION_LABELS and ENTITY_ICONS to Shared Module (CHOSEN)

**Decision**: `ACTION_LABELS` and `ENTITY_ICONS` are moved from `ActivityLogPage.tsx` to `src/utils/activityLabels.ts`. Both `ActivityLogPage` and `DashboardPage` import from this shared module.

**Rationale**: Duplicating these maps risks drift (updating one but not the other when adding new action types). A shared module is the standard pattern for constants used across multiple files.

**Alternative rejected**: Duplicate inline in DashboardPage. Violates DRY for no benefit.

### DD-009: No Pagination/Filtering on Dashboard (CHOSEN)

**Decision**: No filters, no pagination, no "show more" on any dashboard section. Money This Month shows the current month only. Needs Attention shows all overdue items. Recent Activity shows the latest 5.

**Rationale**: The dashboard is a glance view. Users who need more detail navigate to the dedicated pages (Bills, Todos, Activity Log). Adding filters to the dashboard would duplicate the filter UI already present on those pages.

---

## Requirements

### Functional Requirements

#### New Types — src/types/index.ts

- **FR-001**: Add `PropertyMoneySummary` interface:
  ```typescript
  export interface PropertyMoneySummary {
    propertyId: string;
    propertyName: string;
    outstanding: number;
    paid: number;
  }
  ```

- **FR-002**: Add `MoneyThisMonth` interface:
  ```typescript
  export interface MoneyThisMonth {
    outstanding: number;
    paid: number;
    byProperty: PropertyMoneySummary[];
  }
  ```

- **FR-003**: Add `AttentionItem` discriminated union type:
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

#### Shared Module — src/utils/activityLabels.ts (NEW)

- **FR-004**: Create `src/utils/activityLabels.ts` exporting:
  - `ACTION_LABELS: Record<ActionType, string>` — the 25-entry map from DD-007 of the activity-log spec.
  - `ENTITY_ICONS: Record<ActivityEntityType, LucideIcon>` — the 5-entry map from DD-008 of the activity-log spec.

- **FR-005**: Update `ActivityLogPage.tsx` to import `ACTION_LABELS` and `ENTITY_ICONS` from `../utils/activityLabels` instead of defining them inline. Remove the inline definitions.

#### Dashboard Page — src/pages/DashboardPage.tsx (Full Rewrite)

##### Page Shell

- **FR-006**: Replace the current placeholder `DashboardPage` with a full implementation.

- **FR-007**: Set document title to `"NoDues · Dashboard"` via `useEffect`.

- **FR-008**: Page container: `px-4 py-6 sm:px-6 lg:px-8 max-w-3xl mx-auto pb-24`.

- **FR-009**: Page header with title "Dashboard" (`text-2xl font-semibold text-slate-900`) and a Refresh button (RotateCw icon, `w-4 h-4`). The Refresh button is a ghost/icon button that triggers a full data reload. Show spinning state while loading.

##### Data Loading

- **FR-010**: On mount, fetch ALL data sources in parallel using `Promise.allSettled`:
  - Properties (via `fetchProperties`)
  - Bill Types (via `fetchBillTypes`)
  - Bills (via `fetchBills`, requires billTypeMap built from the bill types result)
  - Todos (via `fetchTodos`, requires categoryMap and patternMap)
  - Categories (via `fetchAllCategories`)
  - Recurrence Patterns (via `fetchRecurrencePatterns`)
  - Activity Log (via `fetchActivityLog`)

  Note: Bills depend on bill types, and todos depend on categories + patterns. Structure the parallel loading accordingly — first fetch the independent sources (properties, bill types, categories, patterns, activity log), then use their results to fetch bills and todos.

- **FR-011**: If any individual source fails, show an error toast for that source and render the corresponding section with its empty/error state. Other sections MUST still render with their loaded data.

- **FR-012**: While data is loading, show a loading spinner (Loader2, same pattern as other pages).

##### Section 1: Money This Month

- **FR-013**: Derive the current month from today in IST: `new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 7)`.

- **FR-014**: Compute `outstanding`: sum of `amount` for current-month bills where `displayStatus` is `'pending'` or `'overdue'` and `amount !== null`.

- **FR-015**: Compute `paid`: sum of `amount` for current-month bills where `status === 'paid'` and `amount !== null`.

- **FR-016**: Display Outstanding and Paid as big numbers formatted via `formatCurrency`. On mobile (<768px), they stack vertically. On ≥768px, they sit side-by-side (use `md:flex-row`).

- **FR-017**: Below the big numbers, show a per-property mini-table: one row per property that has any current-month bill activity (outstanding > 0 OR paid > 0). Columns: Property name, Outstanding, Paid. Properties with zero in BOTH columns are hidden.

- **FR-018**: If no properties qualify for the mini-table (all zeros), hide the entire mini-table.

- **FR-019**: All amounts use `formatCurrency` (from `billsService.ts`) — `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })`.

##### Section 2: Needs Attention

- **FR-020**: Build a unified list of overdue bills (`displayStatus === 'overdue'`) and overdue todos (`displayStatus === 'overdue'`).

- **FR-021**: Sort the list by `dueDate` ascending (oldest/most overdue first). When a bill and a todo share the same `dueDate`, bills sort before todos.

- **FR-022**: Bill row layout: Receipt icon (`w-5 h-5 text-slate-500`), text `"{billTypeName} — {propertyName} · {formatMonth(month)}"`, overdue status badge (`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700`, label "Overdue"), due date via `formatDueDate`.

- **FR-023**: Todo row layout: ListTodo icon (`w-5 h-5 text-slate-500`), text `"{title}"`, overdue status badge, due date via `formatDueDate`, optional category badge (color dot + name) if `categoryName` is non-empty.

- **FR-024**: Each row MUST be clickable (use `<button>` or `<Link>` for semantic HTML):
  - Bill row navigates to: `/bills?property={propertyId}&month={month}&focus={id}`
  - Todo row with category navigates to: `/todos?category={categoryId}&focus={id}`
  - Todo row without category navigates to: `/todos?focus={id}`

- **FR-025**: Rows MUST have `cursor-pointer`, hover state (`hover:bg-slate-50`), and focus ring (`focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`). Minimum 44px touch target height.

- **FR-026**: Empty state: CheckCircle2 icon (`w-12 h-12 text-emerald-500`), heading "All clear" (`text-base font-semibold text-slate-900`), subtext "Nothing overdue right now." (`text-sm text-slate-600`). Centered.

##### Section 3: Recent Activity

- **FR-027**: Display the last 5 activity log entries (already sorted newest-first by `fetchActivityLog`). Use `.slice(0, 5)`.

- **FR-028**: Reuse the same entry row layout as `ActivityLogPage`: entity icon from `ENTITY_ICONS`, label from `ACTION_LABELS`, relative time from `formatRelativeTime`, summary text.

- **FR-029**: Below the entries, show a "View all" link: `text-sm text-indigo-700 hover:underline`, navigates to `/settings/activity-log`.

- **FR-030**: Empty state: History icon (`w-12 h-12 text-slate-400`), heading "No activity yet", subtext "Actions you perform will appear here."

##### Refresh and Auto-Refresh

- **FR-031**: A Refresh button in the page header triggers a full data reload (same as initial mount load). While refreshing, the button shows a spinning RotateCw icon and is disabled.

- **FR-032**: On `visibilitychange` event where `document.visibilityState === 'visible'`, auto-refresh data IF `Date.now() - lastFetchAt.current > 30_000` (30 seconds). Track `lastFetchAt` via `useRef<number>`.

- **FR-033**: Cleanup the visibility change listener on unmount.

#### Routing Changes — src/App.tsx

- **FR-034**: Change the `/` route for authenticated users: instead of `<Navigate to="/dashboard" replace />`, render `DashboardPage` directly inside `BootstrapLayout`. The unauthenticated case still renders `LandingPage`.

- **FR-035**: Remove the `/dashboard` route from the `BootstrapLayout` routes.

- **FR-036**: The route for `/` MUST be inside the `<Route element={<BootstrapLayout />}>` group, wrapped in `<ProtectedRoute>`, so bootstrap guard and auth guard both apply.

#### Navbar Changes — src/components/shared/Navbar.tsx

- **FR-037**: Update the Dashboard nav item `to` from `"/dashboard"` to `"/"`.

- **FR-038**: Update the brand logo NavLink from `to="/dashboard"` to `to="/"`.

#### BillsPage Changes — Clickthrough Support

- **FR-039**: On mount, BillsPage MUST read URL search params via `useSearchParams`:
  - If `?property=X` is present, call `setFilterProperty(X)`.
  - If `?month=YYYY-MM` is present, call `setFilterMonth(YYYY-MM)`.
  - If `?focus=billId` is present, after bills finish loading, scroll the matching bill into view via the existing `registerBillRef` mechanism and apply a temporary highlight class (`ring-2 ring-indigo-300 ring-offset-2`) for ~1.5 seconds. Clear the `focus` URL param after highlighting.

- **FR-040**: The highlight uses `ring-indigo-300` (lighter than the existing duplicate-warning `ring-indigo-500`) to visually differentiate "navigated here" from "duplicate exists."

#### TodosPage Changes — Clickthrough Support

- **FR-041**: Add a `registerTodoRef` mechanism mirroring BillsPage's `registerBillRef`:
  - `useRef<Map<string, HTMLDivElement>>(new Map())` for todo refs.
  - A `registerTodoRef(todoId: string)` callback function that returns a ref callback.

- **FR-042**: Update `TodoCard` to use `forwardRef` (mirroring `BillCard`'s pattern). The outer container `<div>` receives the forwarded ref.

- **FR-043**: On mount, TodosPage MUST read URL search params via `useSearchParams`:
  - If `?category=X` is present, call `setFilterCategory(X)`.
  - If `?focus=todoId` is present, after todos finish loading, scroll the matching todo into view via `registerTodoRef` and apply the same temporary highlight class (`ring-2 ring-indigo-300 ring-offset-2`) for ~1.5 seconds. Clear the `focus` URL param after highlighting.

### Cross-Cutting Concerns

- **FR-044**: Document title: `"NoDues · Dashboard"`.

- **FR-045**: All UI MUST follow MASTER.md: indigo-700 primary, slate neutrals, Lucide icons, 44px touch targets, visible focus rings, IBM Plex Sans font, responsive at 375px/768px/1024px+.

- **FR-046**: Amounts MUST use `tabular-nums` for numeric alignment and `formatCurrency` for INR formatting.

- **FR-047**: No animations on page load (MASTER.md anti-pattern #6). The only animation is the RotateCw spin on refresh and the highlight fade on clickthrough.

- **FR-048**: Status badges follow MASTER.md section 5.2 patterns (overdue: `bg-red-50 text-red-700`).

---

## Reuse Statements

These are explicit declarations of what is reused from prior phases to prevent reinvention:

| What | Source | How Reused |
|---|---|---|
| Bill data + enrichment | `billsService.ts` → `fetchBills`, `formatCurrency`, `formatMonth`, `computeDisplayStatus` | Called by DashboardPage for Money This Month + Needs Attention |
| Todo data + enrichment | `todosService.ts` → `fetchTodos`, `computeDisplayStatus` | Called by DashboardPage for Needs Attention |
| Activity log data | `activityLogService.ts` → `fetchActivityLog` | Called by DashboardPage for Recent Activity |
| Properties data | `propertiesService.ts` → `fetchProperties` | Used for per-property money breakdown |
| Bill types data | `billTypesService.ts` → `fetchBillTypes` | Required for bill enrichment (billTypeMap) |
| Categories data | `todoCategoriesService.ts` → `fetchAllCategories` | Required for todo enrichment (categoryMap) |
| Recurrence patterns | `recurrencePatternsService.ts` → `fetchRecurrencePatterns` | Required for todo enrichment (patternMap) |
| Relative time | `utils/relativeTime.ts` → `formatRelativeTime` | Used in Recent Activity section |
| Activity labels + icons | `utils/activityLabels.ts` (NEW, extracted from ActivityLogPage) | Shared between DashboardPage and ActivityLogPage |
| Date formatting | `calendarReminders.ts` → `formatDueDate` | Used for due dates in Needs Attention |
| Page shell patterns | `BillsPage.tsx`, `PropertiesPage.tsx` | Layout, loading spinner, empty state patterns |
| BillCard ref pattern | `BillsPage.tsx` → `registerBillRef`, `billRefs` | Reused for clickthrough scroll-to + highlight |
| Status badge styles | MASTER.md section 5.2 | Overdue badge: `bg-red-50 text-red-700` |
| Auth / Bootstrap | `useAuth()`, `useBootstrap().setupResult` | Same access patterns for `accessToken`, `spreadsheetId` |
| Toast system | `useToast()` | Error toasts for failed data fetches |
| Branding | `config/branding.ts` → `APP_TITLE_SUFFIX` | Document title prefix |

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: User signs in → lands on `/` → DashboardPage renders with document title "NoDues · Dashboard".

- **SC-002**: Money This Month shows correct Outstanding and Paid sums for the current IST month, excluding null amounts, skipped bills, and not_yet_generated bills.

- **SC-003**: Per-property mini-table shows correct per-property breakdowns. Properties with zero outstanding AND zero paid are hidden.

- **SC-004**: Needs Attention shows all overdue bills and overdue todos, sorted oldest-first, with correct icons, labels, badges, and due dates.

- **SC-005**: Clicking an overdue bill row navigates to BillsPage with property + month filters applied and the bill scrolled into view + briefly highlighted.

- **SC-006**: Clicking an overdue todo row navigates to TodosPage with category filter (if applicable) and the todo scrolled into view + briefly highlighted.

- **SC-007**: Empty Needs Attention shows "All clear" with green CheckCircle2 icon.

- **SC-008**: Recent Activity shows the last 5 entries with correct icons, labels, relative timestamps, and summaries. "View all" links to `/settings/activity-log`.

- **SC-009**: Refresh button re-fetches all data. Auto-refresh fires on tab focus when data is >30 seconds stale.

- **SC-010**: Navbar Dashboard link points to `/` and shows active state when on `/`.

- **SC-011**: No regressions — all existing pages (Bills, Todos, Settings, Properties, Bill Types, Categories, Activity Log) continue to function identically.

- **SC-012**: Each section handles its own error state independently — one section failing does not blank the others.

---

## Assumptions

- Phases 1 through 9 are complete: sign-in, bootstrapping, Properties, Bill Types, Bills core loop, file attachments, calendar reminders, bill postpone, to-dos, and activity log.
- All service functions (`fetchBills`, `fetchTodos`, `fetchActivityLog`, `fetchProperties`, `fetchBillTypes`, `fetchAllCategories`, `fetchRecurrencePatterns`) are stable and return the expected enriched data.
- `BillCard` already uses `forwardRef` and `registerBillRef` exists in BillsPage.
- `TodoCard` does NOT use `forwardRef` — this spec adds it.
- The `formatCurrency` and `formatMonth` helpers are exported from `billsService.ts`.
- `formatDueDate` is exported from `calendarReminders.ts`.
- `formatRelativeTime` is exported from `utils/relativeTime.ts`.
- `ACTION_LABELS` and `ENTITY_ICONS` are currently inline in `ActivityLogPage.tsx` and will be extracted.
- The `uuid` package is already a dependency (used across all pages for activity log writes).
- `useSearchParams` from `react-router-dom` is available (React Router v6+).

---

## Out of Scope

- **"Due soon" / upcoming section**: Only overdue items in Needs Attention. No preview of upcoming due dates.
- **Inline action buttons on dashboard rows**: No "Mark Paid", "Postpone", etc. on the dashboard. Users click through to the target page.
- **Charts / graphs / historical trends**: No visualizations. Numbers only.
- **Year-to-date or prior-month money view**: Current month only in Money This Month.
- **Widget customization**: No drag-and-drop, no hide/show sections, no user preferences for dashboard layout.
- **Bulk operations from dashboard**: No multi-select, no batch actions.
- **Push notifications for overdue items**: Phase 11 scope.
- **Welcome/greeting message**: No "Good morning, Amit" — the dashboard is functional, not social.
- **Dark mode**: Out of scope per MASTER.md.
- **Dashboard search/filter**: No filter dropdowns on the dashboard. Use dedicated pages for filtered views.
