# Tasks: Bills Core Loop

**Input**: Design documents from `/specs/004-bills-core-loop/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md, quickstart.md

**Tests**: Manual only (per quickstart.md). No automated test tasks.

**Organization**: Tasks ordered bottom-up: types → billsService (pure helpers first, then CRUD) → BillStatusBadge + bill components → BillsPage + wiring → validation. Parallelizable tasks marked [P].

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US7 from spec.md)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Types)

**Purpose**: Add all Bill-related type definitions so every downstream file compiles.

- [ ] T001 Add Bill, BillWithDisplay, BillDisplayStatus, BillStatus, BillFormData, MarkPaidFormData, BILL_STATUS_OPTIONS, and PAYMENT_METHOD_OPTIONS types to `src/types/index.ts`

  Copy type definitions from `specs/004-bills-core-loop/contracts/types.ts`. Append after existing Property/BillType types:
  - `BillStatus` union: `'not_yet_generated' | 'pending' | 'paid' | 'skipped'`
  - `BillDisplayStatus` union: `'paid' | 'overdue' | 'pending' | 'not_yet_generated' | 'skipped'`
  - `BILL_STATUS_OPTIONS` array constant
  - `PAYMENT_METHOD_OPTIONS` array constant (GPay, PhonePe, NEFT, Net Banking, Cash, Other)
  - `Bill` interface (18 Sheet columns in camelCase + `_rowIndex`; see contracts/types.ts and data-model.md)
  - `BillWithDisplay` extends Bill adding `billTypeName`, `propertyName`, `propertyId`, `displayStatus`
  - `BillFormData` interface (`billTypeId`, `month`, `amount` as string, `dueDate`, `notes`)
  - `MarkPaidFormData` interface (`paidDate`, `paymentMethod`, `transactionRef`)

  **Verify**: `npx tsc --noEmit` passes.

---

## Phase 2: Foundational — billsService Pure Helpers

**Purpose**: Build all pure helper functions in `src/services/billsService.ts` before any CRUD or UI. These have zero side effects and are independently testable.

**CRITICAL**: No CRUD or UI work begins until these helpers exist.

- [ ] T002 [P] Implement `computeDisplayStatus` in `src/services/billsService.ts`

  Pure function. Signature: `(status: BillStatus, dueDate: string, today?: string) => BillDisplayStatus`.
  - If `status === 'paid'` → `'paid'`
  - If `status === 'skipped'` → `'skipped'`
  - If `status === 'not_yet_generated'` → `'not_yet_generated'`
  - For `status === 'pending'`: derive "today" in the **user's timezone** (Asia/Kolkata), NOT raw UTC:
    ```ts
    const todayStr = today ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    ```
    This produces YYYY-MM-DD in IST so a bill due today never briefly shows as overdue during late-night UTC hours (e.g., 22:00 UTC = 03:30 IST next day).
  - **Date-only comparison**: `dueDate < todayStr` as YYYY-MM-DD string comparison → `'overdue'`; otherwise `'pending'`. A bill due exactly today is "Pending", NOT "Overdue" (strict less-than).
  - Accept optional `today` param for testability; default to IST-aware local date in production.
  - Export the function.

- [ ] T003 [P] Implement `computeDueDate` in `src/services/billsService.ts`

  Pure function. Signature: `(month: string, defaultDueDay: number | null) => string`.
  - If `!month || defaultDueDay === null` → return `''`.
  - Parse month `YYYY-MM`, split to year/mon numbers.
  - **Last-day clamping** via `new Date(year, mon, 0).getDate()` (day 0 of next month = last day of current month). Never produce invalid dates like Feb 31.
  - `const clampedDay = Math.min(defaultDueDay, lastDay);`
  - Return `YYYY-MM-DD` with zero-padded month and day.
  - Export the function.

- [ ] T004 [P] Implement `computeCompositeKey` in `src/services/billsService.ts`

  Pure function. Signature: `(propertyId: string, billTypeId: string, month: string) => string`.
  - Returns `propertyId + '|' + billTypeId + '|' + month`.
  - Export the function.

- [ ] T005 [P] Implement `sortBills` in `src/services/billsService.ts`

  Pure function. Signature: `(bills: BillWithDisplay[]) => BillWithDisplay[]`.
  - Returns a new sorted array (no mutation).
  - Priority map: `{ overdue: 0, pending: 1, not_yet_generated: 2, paid: 3, skipped: 4 }`
  - Primary sort by `displayStatus` priority ascending.
  - Secondary sort within same status:
    - `overdue`: oldest `dueDate` first (ascending string compare)
    - `pending`: soonest `dueDate` first (ascending)
    - `not_yet_generated`: by `month` ascending
    - `paid`: most recent `paidDate` first (descending)
    - `skipped`: most recent `month` first (descending)
  - Export the function.

- [ ] T006 [P] Implement `formatMonth` and `formatCurrency` in `src/services/billsService.ts`

  Two pure functions:
  - `formatMonth(month: string) => string`: Format `"2026-06"` → `"Jun 2026"`. Parse year/mon, use array of month abbreviations or `Intl.DateTimeFormat`.
  - `formatCurrency(amount: number) => string`: Use `new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)`.
  - Export both.

- [ ] T007 [P] Implement `parseRow` and `serializeRow` in `src/services/billsService.ts`

  Set up the module boilerplate:
  ```ts
  const TAB_NAME = 'Bills';
  const BILL_HEADERS = HEADER_DEFINITIONS.find(d => d.tabName === TAB_NAME)!.headers;
  const COL = Object.fromEntries(BILL_HEADERS.map((h, i) => [h, i])) as Record<string, number>;
  ```

  `parseRow(row: RowWithIndex): Bill | null`:
  - **Malformed-row tolerance**: return `null` if `!v` or `v.length === 0` or `!v[COL.id]`.
  - Parse `amount`: empty string → `null`, otherwise `Number(amountStr)`.
  - **Invalid status defaults to 'pending'**: validate against `['pending', 'paid', 'not_yet_generated', 'skipped']`; if not in list, default to `'pending'`.
  - Map all 18 columns to camelCase Bill fields. Include `_rowIndex: row.rowIndex`.

  `serializeRow(bill: Bill): string[]`:
  - Convert all 18 fields back to string array in column order.
  - `amount === null` → `''`, otherwise `String(amount)`.

  Follow exact pattern from `billTypesService.ts`. Export both.

- [ ] T008 Implement `checkDuplicate` in `src/services/billsService.ts`

  Pure function (no API calls). Signature: `(compositeKey: string, bills: BillWithDisplay[], excludeBillId?: string) => BillWithDisplay | null`.
  - Search `bills` for a bill where `bill.compositeKey === compositeKey`.
  - **Exclude the bill being edited**: skip any bill with `bill.id === excludeBillId` so a bill never flags itself.
  - **Only non-deleted bills**: safety check `bill.deletedAt !== ''` → skip (the array from fetchBills is already filtered, but be defensive).
  - Return matching `BillWithDisplay` or `null`.
  - Export the function.

**Checkpoint**: All pure helpers complete. Each verifiable in isolation via console/DevTools.

---

## Phase 3: billsService CRUD Functions

**Purpose**: Implement all Sheet read/write operations. Depends on Phase 2 helpers.

- [ ] T009 Implement `fetchBills` in `src/services/billsService.ts`

  Async function. Signature per contracts/services.ts `FetchBills` type:
  `(accessToken, spreadsheetId, billTypeMap: Map<string, { name, propertyId, propertyName }>) => Promise<BillWithDisplay[]>`.
  - Call `readAllRows(accessToken, spreadsheetId, TAB_NAME)`.
  - For each row: `parseRow()` → skip nulls → skip `deletedAt !== ''`.
  - Enrich each Bill → BillWithDisplay using `billTypeMap`:
    - `billTypeName`, `propertyName`, `propertyId` from map (fallback `'Unknown'` / `''`).
    - `displayStatus` via `computeDisplayStatus(bill.status, bill.dueDate)` (IST-aware today by default).
  - Return `sortBills(result)`.
  - Import `readAllRows` from `sheetsService.ts`. Export function.

- [ ] T010 [P] Implement `addBill` in `src/services/billsService.ts`

  Async function. Signature per contracts/services.ts `AddBill` type.
  - Generate `id` via `uuidv4()`.
  - Parse `data.amount`: `trim() === '' ? null : Number(data.amount)`.
  - Status: amount not null AND `data.dueDate` non-empty → `'pending'`; else `'not_yet_generated'`.
  - `originalDueDate = data.dueDate` (equal on creation).
  - `createdAt = updatedAt = new Date().toISOString()`.
  - Empty strings for: `paidDate`, `paymentMethod`, `transactionRef`, `billFileIds`, `receiptFileIds`, `calendarEventIds`, `deletedAt`.
  - `compositeKey` via `computeCompositeKey(propertyId, data.billTypeId, data.month)`.
  - Build Bill, `serializeRow()`, call `appendRows(...)`.
  - Return Bill with `_rowIndex: -1` (page will refetch). Export.

- [ ] T011 [P] Implement `updateBill` in `src/services/billsService.ts`

  Async function. Signature per contracts/services.ts `UpdateBill` type.
  - **Full-row-safety**: spread `...existingBill`, then override only:
    - `month`, `amount` (parsed), `dueDate`, `notes`, `compositeKey` (recomputed), `updatedAt`
  - **Preserve** via spread: `id`, `billTypeId`, `createdAt`, `originalDueDate` (except below), `billFileIds`, `receiptFileIds`, `calendarEventIds`, `paidDate`, `paymentMethod`, `transactionRef`, `deletedAt`.
  - **Auto-flip** `not_yet_generated → pending`: if `existingBill.status === 'not_yet_generated'` AND parsed amount not null AND `data.dueDate` non-empty → `status: 'pending'`.
  - **Auto-set `originalDueDate`**: if `existingBill.originalDueDate === ''` AND `data.dueDate !== ''` → set it.
  - Call `updateRow(...)` with `serializeRow(updatedBill)`. Return updated Bill. Export.

- [ ] T012 [P] Implement `markBillPaid` in `src/services/billsService.ts`

  Async function. Signature per contracts/services.ts `MarkBillPaid` type.
  - **Full-row-safety**: spread `...existingBill`, override only:
    - `status: 'paid'`, `paidDate`, `paymentMethod`, `transactionRef`, `updatedAt`
  - **Preserve** all other fields via spread (id, billTypeId, month, amount, dueDate, originalDueDate, createdAt, billFileIds, receiptFileIds, calendarEventIds, notes, compositeKey, deletedAt).
  - Call `updateRow(...)`. Return updated Bill. Export.

- [ ] T013 [P] Implement `softDeleteBill` and `undoDeleteBill` in `src/services/billsService.ts`

  Two async functions per contracts/services.ts.
  - `softDeleteBill`: `updateCell(..., COL.deleted_at, new Date().toISOString())`.
  - `undoDeleteBill`: `updateCell(..., COL.deleted_at, '')`.
  - Follow pattern from `billTypesService.ts`. Export both.

**Checkpoint**: Full service layer complete. Verify by importing in BillsPage and calling with console logging.

---

## Phase 4: US2 — Bills List with Status Badges (Priority: P1)

**Goal**: Display all non-deleted bills with computed status badges, sorted by urgency, with property and month filters.

**Independent Test**: Add rows directly in the Google Sheet (or via add flow). Navigate to `/bills`. Verify each bill shows correct badge. Verify sort order. Verify filters.

- [X] T014 [P] [US2] Create `BillStatusBadge` component in `src/components/shared/BillStatusBadge.tsx`

  Props: `{ displayStatus: BillDisplayStatus }`.
  - Status config map:
    - `paid`: `bg-emerald-50 text-emerald-700`, icon `CheckCircle2`, label `"Paid"`
    - `overdue`: `bg-red-50 text-red-700`, icon `AlertCircle`, label `"Overdue"`
    - `pending`: `bg-amber-50 text-amber-700`, icon `Clock`, label `"Pending"`
    - `not_yet_generated`: `bg-cyan-50 text-cyan-700`, icon `FileQuestion`, label `"Not received yet"`
    - `skipped`: `bg-slate-100 text-slate-600`, icon `MinusCircle`, label `"Skipped"`
  - Badge markup: `<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ...">`.
  - `aria-label={`Status: ${label}`}` for accessibility.
  - Icon size: `w-3 h-3`. Import icons from `lucide-react`.
  - Reference: MASTER.md sections 5.2, 11.

- [X] T015 [P] [US2] Create `BillCard` component in `src/components/bills/BillCard.tsx`

  Props per contracts/components.ts `BillRowProps`: `bill`, `onMarkPaid`, `onEdit`, `onDelete`, `isLoading`.
  - **Layout based on MASTER.md section 11 BillRow** (adapted as `<div>` with action buttons, not a navigation `<button>`):
    - Top section: Left = `Receipt` icon (w-5 h-5 text-slate-400) + bill type name (font-semibold text-slate-900 truncate) + property name · formatted month (text-sm text-slate-600). Right = formatted amount (font-semibold text-slate-900 tabular-nums) + `<BillStatusBadge>`.
    - Amount via `formatCurrency()` from billsService. If `bill.amount === null`, omit amount display.
    - Month via `formatMonth()` from billsService.
  - **Action buttons** row at bottom (ghost buttons, `text-sm font-medium`):
    - "Edit" (always, `Pencil` icon, `text-indigo-700`) → `onEdit(bill)`
    - "Mark Paid" (only if `displayStatus === 'pending' || displayStatus === 'overdue'`, `text-emerald-700`) → `onMarkPaid(bill)`
    - "Delete" (`Trash2` icon, `text-red-600`) → `onDelete(bill)`
    - All buttons: `min-h-11`, `cursor-pointer`, `disabled:opacity-50` when `isLoading`.
  - Card wrapper: `bg-white border border-slate-200 rounded-lg p-4` per MASTER.md section 5.4.
  - Accept a `cardRef` callback or use `React.forwardRef` to register DOM node in parent's billRefs Map for scroll-to-existing.
  - Disable all actions when `isLoading`.

---

## Phase 5: US1 — Add a Bill (Priority: P1) — MVP

**Goal**: Owner adds a bill by selecting bill type, picking month, saving. Amount/due date pre-fill from defaults.

**Independent Test**: Navigate to `/bills`. Tap "Add Bill". Select bill type, pick month, verify defaults pre-fill. Save. Confirm new row in Sheet with correct UUID, composite_key, status, timestamps.

- [X] T016 [US1] Create `BillFormModal` component in `src/components/bills/BillFormModal.tsx`

  Props per contracts/components.ts `BillFormModalProps`: `bill` (null=add), `availableBillTypes`, `isSaving`, `onSubmit`, `onClose`.
  - Modal shell per MASTER.md section 5.6 (follow BillTypeFormModal pattern).
  - Title: "Add Bill" / "Edit Bill".
  - Fields:
    1. **Bill Type** (required `*`): `<select>` dropdown. Options: `availableBillTypes` filtered to `active && deletedAt === ''`. Display: `"{name} — {propertyName}"`. Read-only in edit mode (disabled select or plain text).
    2. **Month** (required `*`): `<input type="month">`.
    3. **Amount**: `<input type="number" min="0" step="any">`. Pre-fill from `defaultAmount` on bill type selection.
    4. **Due Date**: `<input type="date">`. Auto-computed via `computeDueDate(month, selectedBillType.defaultDueDay)` when bill type AND month both selected. Track `userEditedDueDate` flag — only auto-compute if user hasn't manually changed it.
    5. **Notes**: `<textarea>`.
  - **Pre-fill (Add mode)**: On bill type change → set amount from `defaultAmount`. On bill type or month change (if `!userEditedDueDate`) → recompute due date via `computeDueDate`.
  - **Pre-fill (Edit mode)**: Initialize fields from `bill` prop. Bill type read-only.
  - On submit: build `BillFormData`, call `onSubmit(data)`. Validation in this component (see T020).
  - Buttons: "Cancel" (secondary) left, "Save" / "Add Bill" (primary, disabled+spinner when `isSaving`) right.
  - Close on Escape. Input font 16px+ (`text-base`) per MASTER.md.
  - Empty billTypes: Show "No active bill types. Configure bill types in Settings first." and disable submit.

---

## Phase 6: US3 — Mark Paid (Priority: P1)

**Goal**: Owner marks a pending/overdue bill as paid with date, payment method, and optional reference.

**Independent Test**: Find a pending bill. Tap "Mark Paid". Fill form. Save. Verify badge → green "Paid", Sheet columns updated.

- [X] T017 [P] [US3] Create `MarkPaidModal` component in `src/components/bills/MarkPaidModal.tsx`

  Props per contracts/components.ts `MarkPaidModalProps`: `bill`, `isSaving`, `onSubmit`, `onClose`.
  - Modal shell per MASTER.md section 5.6.
  - Title: "Mark as Paid".
  - Context line (read-only): `"{billTypeName} — {propertyName}"` + `"{formattedMonth} · {formattedAmount}"`.
  - Fields:
    1. **Paid Date** (required `*`): `<input type="date">`. Pre-fill with today (IST-aware: `new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })`).
    2. **Payment Method** (required `*`): `<select>` with `PAYMENT_METHOD_OPTIONS`.
    3. **Transaction Reference**: `<input type="text">` (optional).
  - Validate on submit: paidDate required, paymentMethod required (see T021).
  - Buttons: "Cancel" (secondary), "Mark Paid" (primary, disabled+spinner when `isSaving`).
  - Close on Escape.

---

## Phase 7: US5 — Duplicate Detection (Priority: P1)

**Goal**: Before saving, check if bill with same property+type+month exists. Show warning with Open existing / Add anyway / Cancel.

**Independent Test**: Add a bill. Try adding another with same type+month. Verify warning modal. Test all 3 options.

- [X] T018 [P] [US5] Create `DuplicateWarningModal` component in `src/components/bills/DuplicateWarningModal.tsx`

  Props per contracts/components.ts `DuplicateWarningModalProps`: `existingBill`, `onOpenExisting`, `onAddAnyway`, `onCancel`.
  - Modal shell per MASTER.md section 5.6.
  - Title: "Duplicate Bill Found".
  - Body: "A bill for {propertyName} {billTypeName} for {formattedMonth} already exists ({formattedAmount}, {displayStatus})."
    - Use `formatMonth` and `formatCurrency` from billsService.
  - Three buttons (stacked vertically on mobile for 44px touch targets):
    1. "Open existing" (secondary) → `onOpenExisting()`
    2. "Add anyway" (amber/warning: `bg-amber-600 hover:bg-amber-700 text-white`) → `onAddAnyway()`
    3. "Cancel" (ghost) → `onCancel()`
  - Close on Escape → `onCancel()`.

---

## Phase 8: US4 — Edit + US6 — Soft-Delete with Undo (Priority: P2) + US7 — Loading/Error States (Priority: P2)

**Goal**: Edit bill fields with full-row-safety. Delete with optimistic removal + undo. Loading spinners and error toasts for all operations.

**Independent Test (Edit)**: Edit a bill's amount. Verify Sheet updates. Verify immutable fields preserved. Change month → duplicate detection.

**Independent Test (Delete)**: Delete → disappears, undo snackbar. Tap Undo → reappears. Delete again, let timer expire → reload, bill gone.

*(No new components needed — Edit reuses BillFormModal (T016), Delete reuses existing ConfirmDialog. All wiring in BillsPage.)*

---

## Phase 9: BillsPage Full Wiring

**Purpose**: Wire all components, modals, service calls, filters, and state management into BillsPage. This is the orchestrator.

- [X] T019 Rewrite `src/pages/BillsPage.tsx` — full page with data loading, filters, list rendering, and all CRUD wiring

  Replace the placeholder. Import all services and components.

  **State** (all `useState`):
  - `bills: BillWithDisplay[]`, `billTypes: BillTypeWithProperty[]`, `properties: Property[]`
  - `isLoading: boolean` (initial fetch), `isSaving: boolean` (any write)
  - `filterProperty: string` (`'all'`), `filterMonth: string` (`'all'`)
  - `formModal: { mode: 'add' | 'edit'; bill?: BillWithDisplay } | null`
  - `markPaidTarget: BillWithDisplay | null`
  - `duplicateWarning: { existingBill: BillWithDisplay; pendingFormData: BillFormData; pendingMode: 'add' | 'edit'; editBill?: BillWithDisplay } | null`
  - `deleteTarget: BillWithDisplay | null`
  - `billRefs: useRef<Map<string, HTMLDivElement>>(new Map())` for scroll-to-existing

  **Data loading** (`useEffect` on mount):
  - Parallel fetch: `fetchBillTypes(accessToken, spreadsheetId)` + `fetchProperties(accessToken, spreadsheetId)`.
  - Build `billTypeMap: Map<string, { name, propertyId, propertyName }>` from billTypes joined with properties.
  - Then `fetchBills(accessToken, spreadsheetId, billTypeMap)`.
  - Set `isLoading = false`. Error → error toast.
  - `accessToken` from `useAuth()`, `spreadsheetId` from `useBootstrap().setupResult`.

  **Derived state** (`useMemo`):
  - `filteredBills`: filter by `filterProperty` and `filterMonth`, then `sortBills()`.
  - `propertyOptions`: distinct `{ id, name }` from bills for property filter.
  - `monthOptions`: distinct months from bills, sorted descending, formatted via `formatMonth`.
  - `availableBillTypes`: billTypes filtered to `active === true && deletedAt === ''`.

  **Page title**: `document.title = "NoDues · Bills"` (FR-037).

  **Layout**:
  - Header: `<h1>Bills</h1>` + "Add Bill" primary button.
  - Filters: Two `<select>` — property + month.
  - List: `filteredBills.map(b => <BillCard ... />)`. Register each in `billRefs`.
  - Empty state per MASTER.md section 5.8: "No bills yet" / "Add your first bill" CTA (or "No bills match your filters" if filters active).
  - Loading spinner while `isLoading`.

  **Add Bill flow** (US1 + US5):
  1. "Add Bill" → `setFormModal({ mode: 'add' })`.
  2. BillFormModal `onSubmit(data)`:
     a. Resolve `propertyId` from selected bill type.
     b. `compositeKey = computeCompositeKey(propertyId, data.billTypeId, data.month)`.
     c. `checkDuplicate(compositeKey, bills)` — if match → `setDuplicateWarning(...)`.
     d. No duplicate → `setIsSaving(true)`, `addBill(...)`, refetch all bills, close modal, success toast.
  3. DuplicateWarningModal:
     - "Open existing" → close all modals, `billRefs.current.get(existingBill.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })`, brief highlight.
     - "Add anyway" → save (addBill), refetch, close, toast.
     - "Cancel" → close duplicate modal only (form data preserved).

  **Edit flow** (US4 + US5):
  1. BillCard "Edit" → `setFormModal({ mode: 'edit', bill })`.
  2. BillFormModal `onSubmit(data)`:
     a. If month changed: new compositeKey, `checkDuplicate(newKey, bills, bill.id)` (**excludeId** so bill doesn't flag itself).
     b. Duplicate → `setDuplicateWarning(...)`.
     c. No duplicate → `updateBill(...)`, update/refetch bills, close, toast.

  **Mark Paid flow** (US3):
  1. BillCard "Mark Paid" → `setMarkPaidTarget(bill)`.
  2. MarkPaidModal `onSubmit(data)` → `markBillPaid(...)`, update bill in local state (recompute displayStatus), close, success toast.

  **Delete flow** (US6):
  1. BillCard "Delete" → `setDeleteTarget(bill)`.
  2. ConfirmDialog confirm → optimistic removal from `bills[]`, `softDeleteBill(...)`.
     - Success: `showUndo("Bill deleted", async () => { await undoDeleteBill(...); reinsert/refetch })` with 10s timer.
     - Failure: rollback (reinsert) + error toast.

  **Error handling** (US7): All service calls wrapped in try/catch. Error → `showToast(message, 'error')`. Loading spinner during initial fetch. `isSaving` disables form buttons with spinner. UI never crashes.

---

## Phase 10: Validation

**Purpose**: Add client-side validation to form modals.

- [X] T020 [P] Add client-side validation to `BillFormModal` in `src/components/bills/BillFormModal.tsx`

  Validate on submit, block if errors:
  - `billTypeId`: Required. Error: "Please select a bill type."
  - `month`: Required. Error: "Please select a billing month."
  - `amount`: If provided, must be >= 0 (check `isNaN` or `< 0`). Error: "Amount must be a non-negative number."
  - `dueDate`: If provided, must be valid YYYY-MM-DD. Error: "Please enter a valid date."
  - Display errors as `<span className="text-red-600 text-xs mt-1">` below inputs (MASTER.md section 5.3).
  - Clear field error on user modification.

- [ ] T021 [P] Add client-side validation to `MarkPaidModal` in `src/components/bills/MarkPaidModal.tsx`

  Validate on submit:
  - `paidDate`: Required, valid date. Error: "Please enter the paid date."
  - `paymentMethod`: Required. Error: "Please select a payment method."
  - Same error display pattern.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Final adjustments ensuring spec compliance across all new files.

- [X] T022 [P] Wire BillCard `ref` registration for scroll-to-existing in `src/components/bills/BillCard.tsx` and `src/pages/BillsPage.tsx`

  Ensure "Open existing" scrolls correctly:
  - Each BillCard registers its DOM node in `billRefs` map via a ref callback.
  - On "Open existing": `billRefs.current.get(existingBill.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })`.
  - Add a brief highlight flash (e.g., `ring-2 ring-indigo-500` for 2 seconds via setTimeout) so the user spots the card.

- [X] T023 [P] Verify MASTER.md compliance across all new components

  Walk MASTER.md Pre-Delivery Checklist (section 10) for each new file:
  `BillStatusBadge.tsx`, `BillCard.tsx`, `BillFormModal.tsx`, `MarkPaidModal.tsx`, `DuplicateWarningModal.tsx`, `BillsPage.tsx`.
  - Responsive at 375px, 768px, 1024px, 1440px
  - Contrast ≥ 4.5:1
  - Touch targets ≥ 44px (`min-h-11`)
  - Visible focus rings (`focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`)
  - `cursor-pointer` on clickables
  - Icons are Lucide SVG (no emoji)
  - Amounts use `tabular-nums` + `Intl.NumberFormat('en-IN', ...)`
  - No `console.log` left in code
  - 16px+ font on inputs
  - Fix any violations found.

- [ ] T024 Run full manual test pass per `specs/004-bills-core-loop/quickstart.md`

  Execute every scenario:
  - Add Bill (6 sub-scenarios including pre-fill, clamping, empty amount/due date)
  - List & Status (5 sub-scenarios: badges, sort, filters)
  - Mark Paid (4 sub-scenarios)
  - Edit (4 sub-scenarios including read-only bill type, status auto-flip)
  - Delete (4 sub-scenarios including undo, rollback)
  - Edge Cases (5 sub-scenarios)
  - Fix any bugs found.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Types)**: No dependencies — start immediately
- **Phase 2 (Pure helpers)**: Depends on Phase 1
- **Phase 3 (CRUD)**: Depends on Phase 2
- **Phase 4 (BillStatusBadge + BillCard)**: Depends on Phases 1 + 2 (formatMonth, formatCurrency). **Can run in parallel with Phase 3.**
- **Phase 5 (BillFormModal)**: Depends on Phase 2 (computeDueDate)
- **Phase 6 (MarkPaidModal)**: Depends on Phase 1. **Can run in parallel with Phases 4–5.**
- **Phase 7 (DuplicateWarningModal)**: Depends on Phase 2 (formatMonth, formatCurrency). **Can run in parallel with Phases 5–6.**
- **Phase 8 (Edit + Delete)**: No new components — wired in Phase 9
- **Phase 9 (BillsPage)**: Depends on ALL of Phases 3–7
- **Phase 10 (Validation)**: Depends on Phases 5 + 6
- **Phase 11 (Polish)**: Depends on all prior phases

### Within Each Phase

- Types before helpers
- Helpers before CRUD
- Components before page wiring
- Page wiring before validation

### Parallel Opportunities

**Phase 2** — All 7 tasks (T002–T008) target the same file but different functions; run in parallel:
```
T002 computeDisplayStatus  ║  T003 computeDueDate  ║  T004 computeCompositeKey
T005 sortBills  ║  T006 formatMonth/formatCurrency  ║  T007 parseRow/serializeRow
T008 checkDuplicate
```

**Phase 3** — T010, T011, T012, T013 in parallel (T009 first as it validates enrichment):
```
T009 fetchBills (first)
T010 addBill  ║  T011 updateBill  ║  T012 markBillPaid  ║  T013 softDelete/undoDelete
```

**Phase 4–7** — All component tasks in parallel (different files):
```
T014 BillStatusBadge  ║  T015 BillCard  ║  T016 BillFormModal  ║  T017 MarkPaidModal  ║  T018 DuplicateWarningModal
```

**Phase 10** — Validation tasks in parallel:
```
T020 BillFormModal validation  ║  T021 MarkPaidModal validation
```

**Phase 11** — Polish tasks in parallel:
```
T022 ref/scroll wiring  ║  T023 MASTER.md compliance check
```

---

## Parallel Example: Phases 4–7 (Components)

```bash
# After Phase 2 + Phase 3 (or at least T009), launch all components in parallel:
T014: BillStatusBadge in src/components/shared/BillStatusBadge.tsx
T015: BillCard in src/components/bills/BillCard.tsx
T016: BillFormModal in src/components/bills/BillFormModal.tsx
T017: MarkPaidModal in src/components/bills/MarkPaidModal.tsx
T018: DuplicateWarningModal in src/components/bills/DuplicateWarningModal.tsx
```

---

## Implementation Strategy

### MVP First (US1 + US2: Add + List)

1. T001 → Types
2. T002–T008 → All pure helpers (parallel)
3. T009–T010 → fetchBills + addBill
4. T014–T016 → BillStatusBadge + BillCard + BillFormModal
5. T019 (partial) → BillsPage with Add + List only
6. **STOP and VALIDATE**: Can add bills and see them listed with badges

### Incremental Delivery

1. MVP (Add + List) → verify
2. +Mark Paid (T012 + T017 + wire in T019) → verify
3. +Duplicate Detection (T018 + wire in T019) → verify
4. +Edit (T011 + wire in T019) → verify
5. +Delete (T013 + wire in T019) → verify
6. Validation pass (T020–T021) → verify
7. Polish (T022–T024) → final verification

---

## Summary

| Phase | Tasks | Count |
|-------|-------|-------|
| 1. Types | T001 | 1 |
| 2. Pure Helpers | T002–T008 | 7 (all [P]) |
| 3. CRUD | T009–T013 | 5 (4 [P]) |
| 4. US2 List+Badges | T014–T015 | 2 (both [P]) |
| 5. US1 Add Bill | T016 | 1 |
| 6. US3 Mark Paid | T017 | 1 ([P]) |
| 7. US5 Duplicate | T018 | 1 ([P]) |
| 8. US4+US6+US7 | (wired in T019) | 0 |
| 9. BillsPage | T019 | 1 |
| 10. Validation | T020–T021 | 2 (both [P]) |
| 11. Polish | T022–T024 | 3 (2 [P]) |
| **Total** | | **24 tasks** |

## Notes

- [P] tasks can run in parallel with other [P] tasks in the same phase
- `computeDisplayStatus` uses IST-aware "today" (`Asia/Kolkata` timezone) to prevent late-night UTC edge cases
- Date-only comparison: `dueDate < today` as YYYY-MM-DD strings; bill due today = "Pending", not "Overdue"
- `computeDueDate` clamps via `new Date(year, mon, 0).getDate()` — never produces invalid dates
- Full-row-safety on `updateBill` and `markBillPaid`: spread existing, override only editable/payment fields
- `checkDuplicate` accepts `excludeBillId` to prevent self-flagging during edit; only checks non-deleted
- `parseRow` returns null for rows missing id; invalid status defaults to 'pending'
- Manual testing only — follow quickstart.md scenarios
