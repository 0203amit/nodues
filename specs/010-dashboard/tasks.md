# Tasks: Dashboard

**Feature**: Dashboard (Phase 10)
**Branch**: `010-dashboard`
**Generated**: 2026-05-29

---

## Chunk 1: Foundation (Types + Extractions + Routing)

**Goal**: Establish all foundational types, extract shared code, update routing. No visible UI changes except Navbar links and route behavior. Compile-only verification at end.

### T001: Add new types to `src/types/index.ts` [P]

**File**: `src/types/index.ts`
**FR**: FR-001, FR-002, FR-003

Append three new type definitions after the existing Activity Log types section (after line 326):

1. `PropertyMoneySummary` interface with fields: `propertyId: string`, `propertyName: string`, `outstanding: number`, `paid: number`.
2. `MoneyThisMonth` interface with fields: `outstanding: number`, `paid: number`, `byProperty: PropertyMoneySummary[]`.
3. `AttentionItem` discriminated union type with `kind: 'bill' | 'todo'`:
   - Bill variant: `kind: 'bill'`, `id`, `billTypeName`, `propertyName`, `propertyId`, `month`, `dueDate`, `displayStatus: BillDisplayStatus`, `amount: number | null`.
   - Todo variant: `kind: 'todo'`, `id`, `title`, `categoryId`, `categoryName`, `categoryColor`, `dueDate`, `displayStatus: TodoDisplayStatus`.

Use the exact type definitions from `data-model.md`.

**Verify**: `npm run build` compiles (no consumers yet).

---

### T002: Create `src/utils/activityLabels.ts` [P]

**File**: `src/utils/activityLabels.ts` (NEW)
**FR**: FR-004

Create a new file exporting two constants:

1. `ACTION_LABELS: Record<ActionType, string>` — the exact 25-entry map currently at `ActivityLogPage.tsx` lines 13–39.
2. `ENTITY_ICONS: Record<ActivityEntityType, LucideIcon>` — the exact 5-entry map currently at `ActivityLogPage.tsx` lines 41–47.

Imports:
- `ActionType`, `ActivityEntityType` from `../types`
- `Receipt`, `ListTodo`, `Home`, `FileText`, `Tags` from `lucide-react`
- `LucideIcon` type from `lucide-react`

Content is a copy-paste extraction — do not modify any labels or icon mappings.

**Verify**: `npm run build` compiles (no consumers yet).

---

### T003: Create `src/components/shared/ActivityRow.tsx` [P]

**File**: `src/components/shared/ActivityRow.tsx` (NEW)
**FR**: FR-028 (preparation)

Extract the activity entry row JSX from `ActivityLogPage.tsx` lines 119–139 into a standalone component.

Props interface: `{ entry: ActivityLogEntry }`.

Imports:
- `ActivityLogEntry` from `../../types`
- `ACTION_LABELS`, `ENTITY_ICONS` from `../../utils/activityLabels`
- `formatRelativeTime` from `../../utils/relativeTime`
- `History` from `lucide-react` (fallback icon)

Render the exact JSX structure:
- Outer `<div className="bg-white border border-slate-200 rounded-lg p-4">`
- Inner flex layout with entity icon (`ENTITY_ICONS[entry.entityType] ?? History`), action label, relative time, and summary text
- Matches the current inline JSX in ActivityLogPage identically

Do NOT include the `key` prop on the component itself (callers provide it).

**Verify**: `npm run build` compiles (no consumers yet).

---

### T004: Update `ActivityLogPage.tsx` to use shared modules

**File**: `src/pages/ActivityLogPage.tsx`
**FR**: FR-005
**Depends on**: T002, T003

1. Remove the inline `ACTION_LABELS` constant (lines 13–39).
2. Remove the inline `ENTITY_ICONS` constant (lines 41–47).
3. Remove now-unused icon imports: `Receipt`, `ListTodo`, `Home`, `FileText`, `Tags` from `lucide-react`. Also remove `LucideIcon` type import.
4. Remove now-unused type imports: `ActionType`, `ActivityEntityType` from `../types`.
5. Add import: `import ActivityRow from '../components/shared/ActivityRow';`
6. Replace the entry mapping JSX (lines 117–140, the `entries.map(...)` block) with:
   ```tsx
   {entries.map((entry) => (
     <ActivityRow key={entry.id} entry={entry} />
   ))}
   ```

The page must render identically — same layout, same icons, same labels, same timestamps.

**Verify**: `npm run build` compiles. Visual inspection: ActivityLogPage renders identically.

---

### T005: Update `App.tsx` routing

**File**: `src/App.tsx`
**FR**: FR-034, FR-035, FR-036

Restructure routes so `/` renders `DashboardPage` for authenticated users:

1. Remove the standalone conditional route at lines 35–44:
   ```tsx
   <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
   ```
2. Add a conditional route BEFORE the `BootstrapLayout` group:
   ```tsx
   {!isAuthenticated && <Route path="/" element={<LandingPage />} />}
   ```
3. Inside `<Route element={<BootstrapLayout />}>`, add as the FIRST child:
   ```tsx
   <Route index element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
   ```
4. Remove the `/dashboard` route (line 46):
   ```tsx
   <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
   ```
5. Remove the `Navigate` import from `react-router-dom` if no longer used.

Result: authenticated users see `DashboardPage` at `/` (inside `BootstrapLayout` + `ProtectedRoute`). Unauthenticated users see `LandingPage` at `/`.

**Verify**: `npm run build` compiles.

---

### T006: Update `Navbar.tsx` links

**File**: `src/components/shared/Navbar.tsx`
**FR**: FR-037, FR-038

1. In the `navItems` array (line 16), change the Dashboard entry from `to: "/dashboard"` to `to: "/"`.
2. Change the brand `NavLink` `to` prop (line 69) from `to="/dashboard"` to `to="/"`.
3. Handle `NavLink` active state for `/`: React Router's `NavLink` with `to="/"` would match as active on all routes. Add `end` prop support:
   - Add an optional `end?: boolean` field to the nav item type, or handle in the render by checking `item.to === "/"`.
   - In both the desktop and mobile `NavLink` renders, pass the `end` prop when the nav item requires it (Dashboard only).
   - This ensures the Dashboard link only shows active on exact `/` match, not on `/bills`, `/todos`, etc.

**Verify**: `npm run build` compiles.

---

### T007: Chunk 1 build verification

**Action**: Run `npm run build`.

**Expected**: Clean compile with zero errors. All existing pages remain functional. ActivityLogPage renders identically with shared imports. Routes restructured: `/` renders DashboardPage placeholder for authenticated users.

---

## Chunk 2: Clickthrough Support (BillsPage + TodosPage)

**Goal**: Enable URL-param-driven navigation from Dashboard to specific bills/todos with filter application, scroll-into-view, and temporary highlight.

### T008: Convert `TodoCard.tsx` to `forwardRef` and add `isFocused` prop

**File**: `src/components/todos/TodoCard.tsx`
**FR**: FR-042, FR-040 (todo side)

Mirror the `BillCard.tsx` pattern (lines 17–155) exactly:

1. Import `forwardRef` from React.
2. Add `isFocused?: boolean` to `TodoCardProps`.
3. Change from `export default function TodoCard(...)` to:
   ```tsx
   const TodoCard = forwardRef<HTMLDivElement, TodoCardProps>(function TodoCard(
     { todo, onEdit, onMarkDone, onPostpone, onDelete, isLoading, isFocused },
     ref,
   ) {
   ```
4. Add `ref={ref}` to the outer `<div>` (currently line 30).
5. When `isFocused` is true, append `ring-2 ring-indigo-300 ring-offset-2` to the outer div's className. Use template literal:
   ```tsx
   className={`bg-white border border-slate-200 rounded-lg p-4${isFocused ? ' ring-2 ring-indigo-300 ring-offset-2' : ''}`}
   ```
6. Add `export default TodoCard;` at the end of the file (remove `export default` from function declaration).

**Verify**: `npm run build` compiles. TodosPage still renders correctly (no prop changes needed yet).

---

### T009: Add `isFocused` prop to `BillCard.tsx` [P]

**File**: `src/components/bills/BillCard.tsx`
**FR**: FR-040

1. Add `isFocused?: boolean` to `BillCardProps`.
2. Destructure `isFocused` in the component params (line 18).
3. When `isFocused` is true, append `ring-2 ring-indigo-300 ring-offset-2` to the outer div's className (line 31):
   ```tsx
   className={`bg-white border border-slate-200 rounded-lg p-4${isFocused ? ' ring-2 ring-indigo-300 ring-offset-2' : ''}`}
   ```

**Verify**: `npm run build` compiles. BillsPage still renders correctly (no prop changes needed yet).

---

### T010: Add `registerTodoRef` to `TodosPage.tsx`

**File**: `src/pages/TodosPage.tsx`
**FR**: FR-041
**Depends on**: T008

Mirror `BillsPage.tsx` `registerBillRef` pattern (lines 86, 692–700):

1. Verify `useRef` is already imported (it is not — add it to the import from React on line 1: `useCallback, useEffect, useMemo, useRef, useState`).
2. Add ref map in the state section:
   ```tsx
   const todoRefs = useRef<Map<string, HTMLDivElement>>(new Map());
   ```
3. Add the `registerTodoRef` function (near the render section):
   ```tsx
   function registerTodoRef(todoId: string) {
     return (el: HTMLDivElement | null) => {
       if (el) {
         todoRefs.current.set(todoId, el);
       } else {
         todoRefs.current.delete(todoId);
       }
     };
   }
   ```
4. Pass `ref={registerTodoRef(todo.id)}` to each `<TodoCard>` in the render loop (currently line 744).

**Verify**: `npm run build` compiles.

---

### T011: Add URL search param reading + clickthrough to `BillsPage.tsx`

**File**: `src/pages/BillsPage.tsx`
**FR**: FR-039, FR-040
**Depends on**: T009

1. Import `useSearchParams` from `react-router-dom`.
2. Add state and refs:
   ```tsx
   const [searchParams, setSearchParams] = useSearchParams();
   const [focusedId, setFocusedId] = useState<string | null>(null);
   const pendingFocusRef = useRef<string | null>(null);
   const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
   ```
3. Add a `useEffect` (runs once on mount) to read URL params:
   - Extract `property`, `month`, `focus` from `searchParams`.
   - If `property` present and not `'all'`, call `setFilterProperty(property)`.
   - If `month` present and not `'all'`, call `setFilterMonth(month)`.
   - If `focus` present, store in `pendingFocusRef.current`.
4. Add a `useEffect` with `isLoading` in deps: after `isLoading` becomes false AND `pendingFocusRef.current` has a value:
   - Set `focusedId` to the pending value.
   - Use `requestAnimationFrame` → scroll into view via `billRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })`.
   - Handle case where focus id doesn't exist in loaded data (bill was deleted) — silently skip, no crash.
   - After 1500ms: `setFocusedId(null)`, clear `focus` param via `setSearchParams` with `{ replace: true }`, clear `pendingFocusRef.current`.
   - Store the timer in `focusTimerRef` for cleanup.
5. Cleanup the highlight timer on unmount (existing `highlightTimerRef` cleanup pattern already exists — also cleanup `focusTimerRef`).
6. Pass `isFocused={focusedId === bill.id}` to each `<BillCard>` in the render loop.

**Verify**: `npm run build` compiles.

---

### T012: Add URL search param reading + clickthrough to `TodosPage.tsx`

**File**: `src/pages/TodosPage.tsx`
**FR**: FR-043
**Depends on**: T008, T010

Same pattern as T011 but for TodosPage:

1. Import `useSearchParams` from `react-router-dom`.
2. Add state and refs:
   ```tsx
   const [searchParams, setSearchParams] = useSearchParams();
   const [focusedId, setFocusedId] = useState<string | null>(null);
   const pendingFocusRef = useRef<string | null>(null);
   const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
   ```
3. Add a `useEffect` (runs once on mount) to read URL params:
   - Extract `category` and `focus` from `searchParams`.
   - If `category` present and not `'all'`, call `setFilterCategory(category)`.
   - If `focus` present, store in `pendingFocusRef.current`.
4. Add a `useEffect` with `isLoading` in deps: after `isLoading` becomes false AND `pendingFocusRef.current` has a value:
   - Set `focusedId`.
   - `requestAnimationFrame` → `todoRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })`.
   - Handle missing focus id silently.
   - After 1500ms: `setFocusedId(null)`, clear `focus` param via `setSearchParams({ replace: true })`, clear `pendingFocusRef.current`.
5. Cleanup `focusTimerRef` on unmount.
6. Pass `isFocused={focusedId === todo.id}` to each `<TodoCard>` in the render loop.

**Verify**: `npm run build` compiles.

---

### T013: Chunk 2 build + manual clickthrough test

**Action**: Run `npm run build`.

**Manual test**: Navigate to `/bills?focus=<billId>` with a known bill ID in the browser.

**Expected**:
- Build compiles cleanly.
- Filters apply from URL params (property, month for bills; category for todos).
- Card scrolls into view.
- `ring-indigo-300` highlight shows for ~1.5s then fades.
- `focus` URL param is cleared after highlight (check URL bar).
- If focus ID doesn't exist, no crash, no highlight.

---

## Chunk 3: DashboardPage Full Implementation

**Goal**: Complete DashboardPage with all three sections, data loading, refresh, and auto-refresh.

### T014: DashboardPage — page shell and data loading

**File**: `src/pages/DashboardPage.tsx`
**FR**: FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012

Full rewrite of `DashboardPage.tsx`. Replace entire placeholder content.

**Imports**:
- React: `useCallback`, `useEffect`, `useRef`, `useState`
- Contexts: `useAuth`, `useBootstrap`, `useToast`
- Services: `fetchProperties` (propertiesService), `fetchBillTypes` (billTypesService), `fetchBills`, `formatCurrency`, `formatMonth` (billsService), `fetchTodos` (todosService), `fetchAllCategories` (todoCategoriesService), `fetchRecurrencePatterns` (recurrencePatternsService), `fetchActivityLog` (activityLogService)
- Utils: `formatRelativeTime` (relativeTime), `formatDueDate` (calendarReminders)
- Components: `ActivityRow` (shared)
- Types: `MoneyThisMonth`, `AttentionItem`, `ActivityLogEntry`, `BillWithDisplay`, `TodoWithDisplay`, `Property`
- Icons: `Loader2`, `RotateCw`, `Receipt`, `ListTodo`, `CheckCircle2`, `History` (lucide-react)
- Branding: `APP_TITLE_SUFFIX`
- Router: `useNavigate`, `Link`

**Document title**: `useEffect(() => { document.title = "NoDues · Dashboard"; }, [])` — note: use hardcoded string, not `APP_TITLE_SUFFIX` template (unless existing pattern uses it — check DashboardPage placeholder: it uses `${APP_TITLE_SUFFIX} · Dashboard`, follow that pattern).

**Page container**: `px-4 py-6 sm:px-6 lg:px-8 max-w-3xl mx-auto pb-24`.

**State**:
- `isLoading: boolean` (initially true)
- `isRefreshing: boolean` (initially false)
- `moneyThisMonth: MoneyThisMonth | null` (initially null)
- `attentionItems: AttentionItem[]` (initially [])
- `recentActivity: ActivityLogEntry[]` (initially [])
- Ref: `lastFetchAt = useRef<number>(0)`

**`loadAllData` function** (wrapped in `useCallback`):

Two-phase `Promise.allSettled` structure:

- **Phase 1**: `Promise.allSettled([fetchProperties(token, ssId), fetchBillTypes(token, ssId), fetchAllCategories(token, ssId), fetchRecurrencePatterns(token, ssId), fetchActivityLog(token, ssId)])`.
  - Extract fulfilled values. For each rejected result, `showToast('Failed to load {source}.', 'error')` where source is properties/bill types/categories/patterns/activity log.
  - Build `billTypeMap`, `categoryMap`, `patternMap` from fulfilled results (same patterns as BillsPage/TodosPage).

- **Phase 2**: `Promise.allSettled([fetchBills(token, ssId, billTypeMap), fetchTodos(token, ssId, categoryMap, patternMap)])`.
  - Each rejected result toasts its source.
  - Partial degradation is acceptable (e.g. categories fail → todos load with empty category names).

- Compute `MoneyThisMonth`, `AttentionItem[]`, `ActivityLogEntry[]` (sliced to 5) from fulfilled results. Details in T015, T016, T017.
- Set state. Set `lastFetchAt.current = Date.now()`.

**Mount**: `useEffect(() => { loadAllData(); }, [loadAllData])`. Set `isLoading = true` before, `isLoading = false` after (in finally).

**Loading state**: Show `Loader2 animate-spin` centered when `isLoading && !isRefreshing`.

**Page header**: Title "Dashboard" (`text-2xl font-semibold text-slate-900`) and a Refresh button (RotateCw icon, `w-4 h-4`). Refresh button: on click → `setIsRefreshing(true)`, call `loadAllData()`, then `setIsRefreshing(false)` in finally. Button disabled + `animate-spin` while refreshing. The sections (T015, T016, T017) render below.

**Verify**: `npm run build` compiles. Dashboard shows loading spinner then header with empty sections.

---

### T015: DashboardPage — Money This Month section

**File**: `src/pages/DashboardPage.tsx`
**FR**: FR-013, FR-014, FR-015, FR-016, FR-017, FR-018, FR-019, FR-046

Computed inside `loadAllData` after Phase 2 resolves with bills data:

1. **Current month**: `const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); const currentMonth = todayIST.slice(0, 7);`
2. **Filter**: `const currentMonthBills = bills.filter(b => b.month === currentMonth);`
3. **Outstanding**: `currentMonthBills.filter(b => (b.displayStatus === 'pending' || b.displayStatus === 'overdue') && b.amount !== null).reduce((sum, b) => sum + b.amount!, 0)` — uses `displayStatus` (not `status`) per R-009.
4. **Paid**: `currentMonthBills.filter(b => b.status === 'paid' && b.amount !== null).reduce((sum, b) => sum + b.amount!, 0)` — uses `status` (not `displayStatus`) per R-009.
5. **Per-property breakdown**: Group `currentMonthBills` by `propertyId`. For each group, compute outstanding + paid. Look up `propertyName` from `properties` array (Phase 1 result). Filter rows where both outstanding AND paid are zero. Build `PropertyMoneySummary[]`.

**UI rendering** (in JSX):
- Section card with "Money This Month" heading (`text-lg font-semibold text-slate-900`) + `formatMonth(currentMonth)` subtitle (`text-sm text-slate-500`).
- Two big-number cards in a `flex flex-col md:flex-row gap-4` container:
  - Outstanding: label "Outstanding", value `formatCurrency(outstanding)` in `text-2xl font-bold text-slate-900 tabular-nums`.
  - Paid: label "Paid", value `formatCurrency(paid)` in `text-2xl font-bold text-emerald-700 tabular-nums`.
- Below: per-property mini-table (div grid) if `byProperty.length > 0`. Each row shows property name, outstanding amount, paid amount. If zero rows qualify, hide the entire table (FR-018).

**Verify**: `npm run build` compiles. Dashboard shows Money This Month section with correct sums.

---

### T016: DashboardPage — Needs Attention section

**File**: `src/pages/DashboardPage.tsx`
**FR**: FR-020, FR-021, FR-022, FR-023, FR-024, FR-025, FR-026

Computed inside `loadAllData` after Phase 2 resolves:

1. Map overdue bills (`displayStatus === 'overdue'`) to `AttentionItem` bill variant: `{ kind: 'bill', id, billTypeName, propertyName, propertyId, month, dueDate, displayStatus, amount }`.
2. Map overdue todos (`displayStatus === 'overdue'`) to `AttentionItem` todo variant: `{ kind: 'todo', id, title, categoryId, categoryName, categoryColor, dueDate, displayStatus }`.
3. Merge both arrays. Sort by `dueDate` ascending (oldest first). Tiebreak: when dueDates are equal, bills before todos (`kind === 'bill' ? 0 : 1`).

**UI rendering** (in JSX):
- Section with "Needs Attention" heading (`text-lg font-semibold text-slate-900`).
- Each item renders as `<button type="button">` with `w-full text-left` and styles: `bg-white border border-slate-200 rounded-lg p-4 cursor-pointer hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 min-h-11`.
- **Bill row**: Receipt icon (`w-5 h-5 text-slate-500`), text `"{billTypeName} — {propertyName} · {formatMonth(month)}"`, overdue badge (`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700`, label "Overdue"), `formatDueDate(dueDate)`. `onClick` → `navigate(\`/bills?property=${item.propertyId}&month=${item.month}&focus=${item.id}\`)`.
- **Todo row**: ListTodo icon (`w-5 h-5 text-slate-500`), title, overdue badge, `formatDueDate(dueDate)`, optional category badge (color dot + name) if `categoryName` is non-empty. `onClick` → `navigate(\`/todos?category=${item.categoryId}&focus=${item.id}\`)` if category exists, else `navigate(\`/todos?focus=${item.id}\`)`.
- **Empty state**: `CheckCircle2` icon (`w-12 h-12 text-emerald-500`), heading "All clear" (`text-base font-semibold text-slate-900`), subtext "Nothing overdue right now." (`text-sm text-slate-600`). Centered.

**Verify**: `npm run build` compiles. Dashboard shows overdue items or empty state.

---

### T017: DashboardPage — Recent Activity section

**File**: `src/pages/DashboardPage.tsx`
**FR**: FR-027, FR-028, FR-029, FR-030

1. `recentActivity` is the first 5 entries from `fetchActivityLog` result (already sorted newest-first by the service). Set in `loadAllData`: `setRecentActivity(activityEntries.slice(0, 5))`.

**UI rendering** (in JSX):
- "Recent Activity" heading (`text-lg font-semibold text-slate-900`).
- Map entries to `<ActivityRow key={entry.id} entry={entry} />`.
- Below entries: `<Link to="/settings/activity-log" className="inline-block mt-3 text-sm text-indigo-700 hover:underline font-medium">View all</Link>`.
- **Empty state**: History icon (`w-12 h-12 text-slate-400`), heading "No activity yet" (`text-base font-semibold text-slate-900`), subtext "Actions you perform will appear here." (`text-sm text-slate-600`). Centered.

**Verify**: `npm run build` compiles. Dashboard shows recent activity or empty state.

---

### T018: DashboardPage — auto-refresh on visibility change

**File**: `src/pages/DashboardPage.tsx`
**FR**: FR-031, FR-032, FR-033

1. Add a `useEffect` that registers a `visibilitychange` event listener on `document`:
   ```tsx
   useEffect(() => {
     function handleVisibility() {
       if (
         document.visibilityState === 'visible' &&
         Date.now() - lastFetchAt.current > 30_000
       ) {
         setIsRefreshing(true);
         loadAllData().finally(() => setIsRefreshing(false));
       }
     }
     document.addEventListener('visibilitychange', handleVisibility);
     return () => document.removeEventListener('visibilitychange', handleVisibility);
   }, [loadAllData]);
   ```
2. The Refresh button in the header reuses the same `loadAllData` function with `isRefreshing` flag (already implemented in T014).

**Verify**: `npm run build` compiles. Manual test: load dashboard, switch tabs, wait >30s, switch back — data reloads with spinning refresh icon.

---

### T019: Final build + end-to-end validation

**Action**: Run `npm run build`.

**Manual end-to-end test** covering all success criteria:

- **SC-001**: Sign in → land on `/` → DashboardPage renders with title "NoDues · Dashboard".
- **SC-002**: Money This Month shows correct Outstanding and Paid sums for current IST month.
- **SC-003**: Per-property mini-table shows correct breakdowns; zero-zero properties hidden.
- **SC-004**: Needs Attention shows overdue bills + todos sorted oldest-first.
- **SC-005**: Click overdue bill → navigates to BillsPage with filters + scroll + highlight.
- **SC-006**: Click overdue todo → navigates to TodosPage with filters + scroll + highlight.
- **SC-007**: Empty Needs Attention shows "All clear" with green CheckCircle2.
- **SC-008**: Recent Activity shows last 5 entries; "View all" links to `/settings/activity-log`.
- **SC-009**: Refresh button re-fetches; auto-refresh fires on tab focus when >30s stale.
- **SC-010**: Navbar Dashboard link points to `/` and shows active state only on `/`.
- **SC-011**: No regressions — Bills, Todos, Settings, Properties, Bill Types, Categories, Activity Log all work.
- **SC-012**: Each section handles errors independently — one failure doesn't blank others.
