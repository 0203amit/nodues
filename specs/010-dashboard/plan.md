# Implementation Plan: Dashboard

**Branch**: `010-dashboard` | **Date**: 2026-05-29 | **Spec**: `specs/010-dashboard/spec.md`

**Input**: Feature specification from `specs/010-dashboard/spec.md`

## Summary

Replace the placeholder DashboardPage with a full implementation containing three sections — Money This Month, Needs Attention, and Recent Activity. Add clickthrough navigation support to BillsPage and TodosPage (URL search params → filter + scroll + highlight). Consolidate routing so `/` renders the Dashboard directly. Extract shared activity log constants and row component for DRY reuse.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, Vite

**Primary Dependencies**: React Router v6 (useSearchParams, NavLink), Lucide React (icons), Tailwind CSS v3

**Storage**: Google Sheets via existing service layer (no changes to services)

**Testing**: Manual testing (no test framework configured); `npm run build` for type checking

**Target Platform**: Web (mobile-first PWA), primary viewport 375px

**Project Type**: Single-page web application (frontend only, no backend)

**Performance Goals**: Dashboard data loads in parallel via Promise.allSettled; auto-refresh gated at 30s staleness

**Constraints**: Must reuse all existing service functions. No new API calls. No new dependencies.

**Scale/Scope**: 2 new files, 8 modified files, ~48 functional requirements

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution is not configured (template only). No gates to evaluate. Proceeding.

## Project Structure

### Documentation (this feature)

```text
specs/010-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0 output — 10 research decisions
├── data-model.md        # Phase 1 output — 3 new types, shared constants, data flow
├── quickstart.md        # Phase 1 output — dev setup, implementation order, testing
└── spec.md              # Feature specification (9 DDs, 48 FRs, 7 CLs)
```

### Source Code (repository root)

```text
src/
├── types/
│   └── index.ts                          # +PropertyMoneySummary, +MoneyThisMonth, +AttentionItem
├── utils/
│   ├── activityLabels.ts                 # NEW — ACTION_LABELS, ENTITY_ICONS
│   └── relativeTime.ts                   # existing (reused)
├── components/
│   ├── shared/
│   │   ├── ActivityRow.tsx               # NEW — shared activity entry row
│   │   └── Navbar.tsx                    # MODIFY — links to "/"
│   ├── bills/
│   │   └── BillCard.tsx                  # MODIFY — add isFocused prop
│   └── todos/
│       └── TodoCard.tsx                  # MODIFY — convert to forwardRef, add isFocused prop
├── pages/
│   ├── DashboardPage.tsx                 # REWRITE — full dashboard
│   ├── BillsPage.tsx                     # MODIFY — URL params, focusedId, highlight
│   ├── TodosPage.tsx                     # MODIFY — registerTodoRef, URL params, focusedId
│   └── ActivityLogPage.tsx               # MODIFY — import from activityLabels, use ActivityRow
├── services/                             # NO CHANGES (all reused as-is)
└── App.tsx                               # MODIFY — route restructure
```

**Structure Decision**: Single frontend SPA. No backend. No new directories needed.

---

## Implementation Chunks

### Chunk 1: Foundation (Types + Extractions + Routing)

**Goal**: Establish all foundational types, extract shared code, update routing. No visible UI changes except Navbar links and route behavior. Compile-only verification at end.

**Tasks**:

#### T001: Add new types to `src/types/index.ts`
- **FR**: FR-001, FR-002, FR-003
- **Action**: Append `PropertyMoneySummary`, `MoneyThisMonth`, and `AttentionItem` type definitions after the existing Activity Log types section (after line 326).
- **Details**: `AttentionItem` is a discriminated union with `kind: 'bill' | 'todo'`. The bill variant includes `propertyId`, `month`, `amount`. The todo variant includes `categoryId`, `categoryName`, `categoryColor`. Both include `id`, `dueDate`, `displayStatus`.

#### T002: Create `src/utils/activityLabels.ts`
- **FR**: FR-004
- **Action**: Create new file exporting `ACTION_LABELS: Record<ActionType, string>` and `ENTITY_ICONS: Record<ActivityEntityType, LucideIcon>`.
- **Details**: Content is the exact data from `ActivityLogPage.tsx` lines 13–47. Import `ActionType` and `ActivityEntityType` from `../types`. Import icon components (`Receipt`, `ListTodo`, `Home`, `FileText`, `Tags`) and `LucideIcon` type from `lucide-react`.

#### T003: Create `src/components/shared/ActivityRow.tsx`
- **FR**: FR-028 (preparation)
- **Action**: Extract the activity entry row JSX from `ActivityLogPage.tsx` lines 119–139 into a standalone component.
- **Props**: `entry: ActivityLogEntry`.
- **Details**: Renders entity icon from `ENTITY_ICONS` (via `activityLabels`), action label from `ACTION_LABELS`, relative time via `formatRelativeTime`, and summary text. Layout: `bg-white border border-slate-200 rounded-lg p-4` with the same flex structure as the current inline JSX.

#### T004: Update `ActivityLogPage.tsx` to use shared modules
- **FR**: FR-005
- **Action**:
  1. Remove inline `ACTION_LABELS` (lines 13–39) and `ENTITY_ICONS` (lines 41–47).
  2. Remove now-unused icon imports (`Receipt`, `ListTodo`, `Home`, `FileText`, `Tags`) and `LucideIcon` type import.
  3. Remove now-unused type imports (`ActionType`, `ActivityEntityType`).
  4. Import `ActivityRow` from `../components/shared/ActivityRow`.
  5. Replace entry mapping JSX (lines 117–141) with `<ActivityRow key={entry.id} entry={entry} />`.

#### T005: Update `App.tsx` routing
- **FR**: FR-034, FR-035, FR-036
- **Action**: Restructure routes so `/` renders `DashboardPage` for authenticated users:
  1. Remove the standalone `<Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />} />` (lines 35–44).
  2. Add a conditional route: `{!isAuthenticated && <Route path="/" element={<LandingPage />} />}` before the `BootstrapLayout` group.
  3. Inside the `<Route element={<BootstrapLayout />}>` group, add `<Route index element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />` as the first child.
  4. Remove the `/dashboard` route (line 46).
- **Rationale**: When `isAuthenticated` is true, the conditional LandingPage route is not rendered. The `index` route inside `BootstrapLayout` matches `/` and renders `DashboardPage` wrapped in `ProtectedRoute` and `BootstrapLayout`. When `isAuthenticated` is false, `LandingPage` renders at `/`. `ProtectedRoute` on the inner route provides a second guard.

#### T006: Update `Navbar.tsx` links
- **FR**: FR-037, FR-038
- **Action**:
  1. In `navItems` array, change Dashboard entry: `to: "/dashboard"` → `to: "/"`.
  2. Change brand `NavLink` `to` prop: `to="/dashboard"` → `to="/"`.
  3. Handle `NavLink` active state for `/`: React Router v6's `NavLink` with `to="/"` would potentially match as active on all routes. Add `end` prop to the Dashboard `NavLink` so it only activates on exact `/` match. Since `navItems` is used in a `.map()`, add an optional `end?: boolean` field to the nav item (or handle in the render by checking `item.to === "/"`).

#### T007: Build verification
- **Action**: Run `npm run build`.
- **Expected**: Clean compile. ActivityLogPage renders identically with shared imports.

---

### Chunk 2: Clickthrough Support (BillsPage + TodosPage)

**Goal**: Enable URL-param-driven navigation from Dashboard to specific bills/todos with filter application, scroll-into-view, and temporary highlight.

**Tasks**:

#### T008: Convert `TodoCard.tsx` to `forwardRef` and add `isFocused` prop
- **FR**: FR-042, FR-040 (todo side)
- **Action**:
  1. Import `forwardRef` from React.
  2. Add `isFocused?: boolean` to `TodoCardProps`.
  3. Change from `export default function TodoCard(...)` to `const TodoCard = forwardRef<HTMLDivElement, TodoCardProps>(function TodoCard({ ..., isFocused }, ref) { ... })`.
  4. Add `ref={ref}` to the outer `<div>` (currently line 30).
  5. When `isFocused` is true, append `ring-2 ring-indigo-300 ring-offset-2` to the outer div's className.
  6. Add `export default TodoCard;` at the end.
- **Pattern reference**: `BillCard.tsx` lines 17–155.

#### T009: Add `isFocused` prop to `BillCard.tsx`
- **FR**: FR-040
- **Action**:
  1. Add `isFocused?: boolean` to `BillCardProps`.
  2. Destructure `isFocused` in the component params.
  3. When `isFocused` is true, append `ring-2 ring-indigo-300 ring-offset-2` to the outer div's className (line 31).

#### T010: Add `registerTodoRef` to `TodosPage.tsx`
- **FR**: FR-041
- **Action**: Mirror BillsPage's `registerBillRef` pattern (lines 86, 692–700):
  1. Add `import { useRef } from 'react'` (already imported, just verify `useRef` is included).
  2. Add `const todoRefs = useRef<Map<string, HTMLDivElement>>(new Map());`.
  3. Add `function registerTodoRef(todoId: string)` returning `(el: HTMLDivElement | null) => { if (el) todoRefs.current.set(todoId, el); else todoRefs.current.delete(todoId); }`.
  4. Pass `ref={registerTodoRef(todo.id)}` to each `<TodoCard>` in the render loop (currently line 744).

#### T011: Add URL search param reading + clickthrough to `BillsPage.tsx`
- **FR**: FR-039, FR-040
- **Action**:
  1. Import `useSearchParams` from `react-router-dom`.
  2. Add `const [searchParams, setSearchParams] = useSearchParams();`.
  3. Add `const [focusedId, setFocusedId] = useState<string | null>(null);`.
  4. Add a `useRef<string | null>(null)` to store the focus target until data loads.
  5. Add a `useEffect` (runs once) to read URL params: extract `property`, `month`, `focus`. If `property` present, `setFilterProperty(property)`. If `month` present, `setFilterMonth(month)`. If `focus` present, store in the pending-focus ref.
  6. Add a `useEffect` that triggers after `isLoading` becomes false: if pending-focus ref has a value, set `focusedId`, `requestAnimationFrame` → scroll into view via `billRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })`. After 1500ms: `setFocusedId(null)`, clear `focus` param via `setSearchParams(prev => { prev.delete('focus'); return prev; }, { replace: true })`, clear pending-focus ref.
  7. Pass `isFocused={focusedId === bill.id}` to each `<BillCard>`.
  8. Cleanup highlight timer on unmount.

#### T012: Add URL search param reading + clickthrough to `TodosPage.tsx`
- **FR**: FR-043
- **Action**: Same pattern as T011:
  1. Import `useSearchParams`.
  2. Add `searchParams`, `setSearchParams`, `focusedId` state, pending-focus ref.
  3. Read `category` and `focus` from URL params on mount. If `category` present, `setFilterCategory(category)`.
  4. After `isLoading` becomes false and pending-focus exists: set `focusedId`, scroll via `todoRefs`, highlight 1.5s, clear.
  5. Pass `isFocused={focusedId === todo.id}` to each `<TodoCard>`.
  6. Add `highlightTimerRef` for cleanup on unmount.

#### T013: Build + manual clickthrough test
- **Action**: Run `npm run build`. Manually navigate to `/bills?focus=<billId>` with a known bill ID.
- **Expected**: Filters apply, card scrolls into view, ring-indigo-300 highlight for 1.5s, URL param cleared.

---

### Chunk 3: DashboardPage Full Implementation

**Goal**: Complete DashboardPage with all three sections, data loading, refresh, and auto-refresh.

**Tasks**:

#### T014: DashboardPage — page shell and data loading
- **FR**: FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012
- **Action**: Full rewrite of `DashboardPage.tsx`:
  1. **Imports**: `useAuth`, `useBootstrap`, `useToast`, `useCallback`, `useEffect`, `useRef`, `useState` from React. All 7 fetch services. `formatCurrency`, `formatMonth` from `billsService`. `formatDueDate` from `calendarReminders`. `formatRelativeTime` from `utils/relativeTime`. `ActivityRow` component. Types: `MoneyThisMonth`, `AttentionItem`, `ActivityLogEntry`, `BillWithDisplay`, `TodoWithDisplay`. Icons: `Loader2`, `RotateCw`, `Receipt`, `ListTodo`, `CheckCircle2`, `History` from `lucide-react`. `APP_TITLE_SUFFIX` from branding. `useNavigate` from `react-router-dom`.
  2. **Document title**: `useEffect(() => { document.title = "NoDues · Dashboard"; }, [])`.
  3. **State**: `isLoading: boolean`, `isRefreshing: boolean`, `moneyThisMonth: MoneyThisMonth | null`, `attentionItems: AttentionItem[]`, `recentActivity: ActivityLogEntry[]`. Ref: `lastFetchAt = useRef<number>(0)`.
  4. **`loadAllData` function** (useCallback):
     - **Phase 1**: `Promise.allSettled([fetchProperties(...), fetchBillTypes(...), fetchAllCategories(...), fetchRecurrencePatterns(...), fetchActivityLog(...)])`.
     - Extract fulfilled values. For each rejected result, `showToast('Failed to load {source}.', 'error')`.
     - Build `billTypeMap`, `categoryMap`, `patternMap` from fulfilled results (same patterns as BillsPage/TodosPage).
     - **Phase 2**: `Promise.allSettled([fetchBills(token, ssId, billTypeMap), fetchTodos(token, ssId, categoryMap, patternMap)])`.
     - Compute `MoneyThisMonth`, `AttentionItem[]`, `ActivityLogEntry[]` (sliced to 5).
     - Set state. Set `lastFetchAt.current = Date.now()`.
  5. **Mount**: `useEffect(() => { loadAllData(); }, [loadAllData])`. Set `isLoading` before, clear after.
  6. **Loading**: Show `Loader2 animate-spin` centered when `isLoading`.
  7. **Refresh button**: Header row has "Dashboard" title and a button with `RotateCw` icon. On click: `setIsRefreshing(true)`, `loadAllData()`, then `setIsRefreshing(false)`. Button disabled + `animate-spin` while refreshing.

#### T015: DashboardPage — Money This Month section
- **FR**: FR-013, FR-014, FR-015, FR-016, FR-017, FR-018, FR-019, FR-046
- **Action** (computed inside `loadAllData`):
  1. **Current month**: `const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); const currentMonth = todayIST.slice(0, 7);`.
  2. **Filter**: `const currentMonthBills = bills.filter(b => b.month === currentMonth);`.
  3. **Outstanding**: `currentMonthBills.filter(b => (b.displayStatus === 'pending' || b.displayStatus === 'overdue') && b.amount !== null).reduce((sum, b) => sum + b.amount!, 0)`.
  4. **Paid**: `currentMonthBills.filter(b => b.status === 'paid' && b.amount !== null).reduce((sum, b) => sum + b.amount!, 0)`.
  5. **Per-property**: Group `currentMonthBills` by `propertyId`. For each group, compute outstanding + paid per group. Filter rows where both are zero. Build `PropertyMoneySummary[]`.
  6. **UI**: Section card with "Money This Month" heading + `formatMonth(currentMonth)` subtitle. Two big-number cards (`flex-col md:flex-row gap-4`). Outstanding in `text-slate-900`, Paid in `text-emerald-700`. Both use `formatCurrency` + `tabular-nums`. Below: per-property mini-table (div grid) if any rows qualify.

#### T016: DashboardPage — Needs Attention section
- **FR**: FR-020, FR-021, FR-022, FR-023, FR-024, FR-025, FR-026
- **Action** (computed inside `loadAllData`):
  1. Map overdue bills (`displayStatus === 'overdue'`) to `{ kind: 'bill', id, billTypeName, propertyName, propertyId, month, dueDate, displayStatus, amount }`.
  2. Map overdue todos (`displayStatus === 'overdue'`) to `{ kind: 'todo', id, title, categoryId, categoryName, categoryColor, dueDate, displayStatus }`.
  3. Merge arrays. Sort by `dueDate` ascending. Tiebreak: if same date, bills before todos.
  4. **UI**: Section with "Needs Attention" heading. Each item renders as a `<button type="button">` with `w-full text-left` for semantic HTML:
     - Bill: Receipt icon, `"{billTypeName} — {propertyName} · {formatMonth(month)}"`, overdue badge, `formatDueDate(dueDate)`. `onClick` → `navigate("/bills?property=...&month=...&focus=...")`.
     - Todo: ListTodo icon, title, overdue badge, `formatDueDate(dueDate)`, optional category badge. `onClick` → `navigate("/todos?category=...&focus=...")` or `navigate("/todos?focus=...")`.
  5. Row styles: `bg-white border border-slate-200 rounded-lg p-4 cursor-pointer hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 min-h-11`.
  6. **Empty state**: `CheckCircle2` icon (emerald-500), "All clear", "Nothing overdue right now."

#### T017: DashboardPage — Recent Activity section
- **FR**: FR-027, FR-028, FR-029, FR-030
- **Action**:
  1. `recentActivity` = first 5 entries from `fetchActivityLog` result (already desc sorted).
  2. **UI**: "Recent Activity" heading. Map entries to `<ActivityRow entry={entry} />`.
  3. Below entries: `<Link to="/settings/activity-log" className="inline-block mt-3 text-sm text-indigo-700 hover:underline ...">View all</Link>`.
  4. **Empty state**: History icon (slate-400), "No activity yet", "Actions you perform will appear here."

#### T018: DashboardPage — auto-refresh on visibility change
- **FR**: FR-031, FR-032, FR-033
- **Action**:
  1. `useEffect` registers `document.addEventListener('visibilitychange', handler)`.
  2. Handler: `if (document.visibilityState === 'visible' && Date.now() - lastFetchAt.current > 30_000) { setIsRefreshing(true); loadAllData().finally(() => setIsRefreshing(false)); }`.
  3. Cleanup: `return () => document.removeEventListener('visibilitychange', handler);`.
  4. Refresh button re-uses the same `loadAllData` with `isRefreshing` flag.

#### T019: Final build + end-to-end test
- **Action**: Run `npm run build`. Manual end-to-end test covering all success criteria (SC-001 through SC-012).

---

## Key Design Decisions (from research.md)

| ID | Decision | Rationale |
|---|---|---|
| R-001 | Root route renders DashboardPage directly | Avoids two-URL problem, fixes NavLink isActive |
| R-002 | Two-phase Promise.allSettled | Clean separation of independent vs dependent fetches |
| R-003 | URL search params for clickthrough | No shared state needed, bookmarkable, reuses existing ref pattern |
| R-004 | focusedId state + isFocused prop | Declarative React approach, cleaner than DOM classList manipulation |
| R-005 | TodoCard forwardRef mirrors BillCard | Consistent pattern, enables registerTodoRef |
| R-006 | visibilitychange + 30s staleness gate | Reliable on mobile, prevents API hammering |
| R-007 | AttentionItem discriminated union | Type-safe rendering via kind narrowing |
| R-008 | Extract ActivityRow component | DRY — same layout in ActivityLogPage and DashboardPage |
| R-009 | Outstanding uses displayStatus, Paid uses status | displayStatus catches overdue; status is canonical for paid |
| R-010 | NavLink end prop for Dashboard | Prevents "/" from matching as active on all routes |

## Complexity Tracking

No constitution violations to justify. All changes are minimal and follow existing patterns.
