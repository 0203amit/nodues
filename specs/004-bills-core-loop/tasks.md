# Tasks: Bills Core Loop

**Feature**: 004-bills-core-loop | **Generated**: 2026-05-28

**Legend**: `[P]` = parallelizable with other `[P]` tasks in the same group. Tasks without `[P]` must complete before the next group begins.

---

## Group 1: Types

### T001 — Add Bill types to `src/types/index.ts`

**File**: `src/types/index.ts` (MODIFIED — append to existing file)

Add the following types after the existing BillType/Property types:

**What to implement**:

- `BillStatus` type: `'not_yet_generated' | 'pending' | 'paid' | 'skipped'`
- `BillDisplayStatus` type: `'paid' | 'overdue' | 'pending' | 'not_yet_generated' | 'skipped'`
- `PAYMENT_METHOD_OPTIONS` constant array: `[{ value: 'GPay', label: 'GPay' }, { value: 'PhonePe', label: 'PhonePe' }, { value: 'NEFT', label: 'NEFT' }, { value: 'Net Banking', label: 'Net Banking' }, { value: 'Cash', label: 'Cash' }, { value: 'Other', label: 'Other' }]`
- `Bill` interface with `_rowIndex`, `id`, `billTypeId`, `month`, `amount` (number|null), `dueDate`, `originalDueDate`, `status` (BillStatus), `paidDate`, `paymentMethod`, `transactionRef`, `billFileIds`, `receiptFileIds`, `calendarEventIds`, `notes`, `createdAt`, `updatedAt`, `deletedAt`, `compositeKey`
- `BillWithDisplay` extending `Bill` with `billTypeName`, `propertyName`, `propertyId`, `displayStatus` (BillDisplayStatus)
- `BillFormData` interface with `billTypeId`, `month`, `amount` (string), `dueDate` (string), `notes`
- `MarkPaidFormData` interface with `paidDate`, `paymentMethod`, `transactionRef`

**Contract**: `specs/004-bills-core-loop/contracts/types.ts`

**Verify**: `npx tsc --noEmit`

---

## Group 2: Bills Service

### T002 — Create `billsService.ts` with parseRow, serializeRow, computeDisplayStatus, fetchBills

**File**: `src/services/billsService.ts` (NEW)

**What to implement**:

1. **Column index map**: Derive `COL` from `HEADER_DEFINITIONS` for `'Bills'` tab:
   ```
   const BILL_HEADERS = HEADER_DEFINITIONS.find(d => d.tabName === 'Bills')!.headers;
   const COL = Object.fromEntries(BILL_HEADERS.map((h, i) => [h, i]));
   ```

2. **`parseRow(row: RowWithIndex): Bill | null`**
   - Map `row.values[COL.fieldName]` to typed Bill fields.
   - Convert `amount`: `'' → null`, otherwise `Number(value)`.
   - Convert `status`: cast to `BillStatus`, fallback to `'pending'` for invalid values.
   - **Malformed-row tolerance**: Return `null` if `row.values` is too short, or if `id` is missing/empty.

3. **`serializeRow(bill: Bill): string[]`**
   - Convert typed Bill back to string array in column order.
   - Order: `[id, billTypeId, month, amount ?? '', dueDate, originalDueDate, status, paidDate, paymentMethod, transactionRef, billFileIds, receiptFileIds, calendarEventIds, notes, createdAt, updatedAt, deletedAt, compositeKey]` (18 values).

4. **`computeDisplayStatus(bill: Bill): BillDisplayStatus`**
   - If `status === 'paid'` → return `'paid'`.
   - If `status === 'pending'` and `dueDate < today` → return `'overdue'`.
   - If `status === 'pending'` and `dueDate >= today` (or dueDate is empty) → return `'pending'`.
   - If `status === 'not_yet_generated'` → return `'not_yet_generated'`.
   - If `status === 'skipped'` → return `'skipped'`.
   - Default: `'pending'`.

   Date comparison: Parse `dueDate` as `YYYY-MM-DD`, compare against `new Date()` set to midnight local time.

5. **`fetchBills(accessToken, spreadsheetId): Promise<BillWithDisplay[]>`**
   - Read Bills, BillTypes, and Properties tabs in parallel using `Promise.all([readAllRows('Bills'), readAllRows('BillTypes'), readAllRows('Properties')])`.
   - Parse each BillType row using `billTypesService.parseRow`, build lookup: `Map<billTypeId, { name, propertyId }>`.
   - Parse each Property row using `propertiesService.parseRow`, build lookup: `Map<propertyId, { name }>`.
   - Parse each Bill row via `parseRow`, skip nulls, filter out `deletedAt !== ''`.
   - Enrich each Bill with `billTypeName`, `propertyName`, `propertyId` (resolved via lookups), and `displayStatus` (computed via `computeDisplayStatus`).
   - If a bill's `bill_type_id` doesn't match any bill type, use `billTypeName: 'Unknown'`, `propertyName: 'Unknown'`, `propertyId: ''`.
   - Sort result: overdue (asc by dueDate), pending (asc by dueDate), not_yet_generated (asc by month), paid (desc by paidDate), skipped.
   - Return sorted array.

**Contract**: `specs/004-bills-core-loop/contracts/services.ts` (FetchBills)

**Verify**: Import compiles. `npx tsc --noEmit`.

### T003 — Add checkDuplicate, addBill, updateBill, markBillPaid, softDeleteBill, undoDeleteBill

**File**: `src/services/billsService.ts` (continued)

**What to implement**:

1. **`checkDuplicate(compositeKey, bills, excludeBillId?): BillWithDisplay | null`**
   - Pure function (no API call). Scans the `bills` array.
   - Return the first bill where `bill.compositeKey === compositeKey` and `bill.id !== excludeBillId`.
   - Return `null` if no match.

2. **`addBill(accessToken, spreadsheetId, data: BillFormData, propertyId: string): Promise<Bill>`**
   - Generate UUID via `uuidv4()`.
   - Parse amount: `data.amount.trim() === '' ? null : Number(data.amount)`.
   - Determine status: if amount is not null AND dueDate is not empty → `'pending'`, else `'not_yet_generated'`.
   - Set `originalDueDate = data.dueDate` (same as dueDate on creation).
   - Compute `compositeKey = propertyId + '|' + data.billTypeId + '|' + data.month`.
   - Set `createdAt = updatedAt = new Date().toISOString()`.
   - Set `paidDate = ''`, `paymentMethod = ''`, `transactionRef = ''`.
   - Set `billFileIds = ''`, `receiptFileIds = ''`, `calendarEventIds = ''`.
   - Set `deletedAt = ''`.
   - Construct Bill object, serialize via `serializeRow`, call `appendRows('Bills', [serialized])`.
   - Return the constructed Bill (with `_rowIndex: -1` placeholder — caller should refetch if index is needed).

3. **`updateBill(accessToken, spreadsheetId, bill: Bill, data: BillFormData, propertyId: string): Promise<Bill>`**
   - **Full-row-safety**: Start from the existing `bill` object. Update ONLY:
     - `month` ← `data.month`
     - `amount` ← parsed from `data.amount`
     - `dueDate` ← `data.dueDate`
     - `notes` ← `data.notes`
     - `updatedAt` ← `new Date().toISOString()`
     - `compositeKey` ← recompute from `propertyId + '|' + bill.billTypeId + '|' + data.month`
   - **Status auto-flip**: If `bill.status === 'not_yet_generated'` and new amount is not null AND new dueDate is not empty → set `status = 'pending'`.
   - **original_due_date**: If `bill.originalDueDate === ''` and new `dueDate !== ''` → set `originalDueDate = data.dueDate`.
   - Preserve: `id`, `billTypeId`, `originalDueDate` (unless setting for first time), `status` (unless auto-flip), `paidDate`, `paymentMethod`, `transactionRef`, `billFileIds`, `receiptFileIds`, `calendarEventIds`, `createdAt`, `deletedAt`.
   - Serialize via `serializeRow`, call `updateRow('Bills', bill._rowIndex, serialized)`.
   - Return updated Bill.

4. **`markBillPaid(accessToken, spreadsheetId, bill: Bill, data: MarkPaidFormData): Promise<Bill>`**
   - **Full-row write**: Start from existing `bill`. Update:
     - `status = 'paid'`
     - `paidDate = data.paidDate`
     - `paymentMethod = data.paymentMethod`
     - `transactionRef = data.transactionRef`
     - `updatedAt = new Date().toISOString()`
   - Preserve all other fields (including `billFileIds`, `receiptFileIds`, `calendarEventIds`).
   - Serialize, call `updateRow('Bills', bill._rowIndex, serialized)`.
   - Return updated Bill.

5. **`softDeleteBill(accessToken, spreadsheetId, bill: Bill): Promise<void>`**
   - Call `updateCell('Bills', bill._rowIndex, COL.deleted_at, new Date().toISOString())`.

6. **`undoDeleteBill(accessToken, spreadsheetId, bill: Bill): Promise<void>`**
   - Call `updateCell('Bills', bill._rowIndex, COL.deleted_at, '')`.

**Contract**: `specs/004-bills-core-loop/contracts/services.ts` (CheckDuplicate, AddBill, UpdateBill, MarkBillPaid, SoftDeleteBill, UndoDeleteBill)

**Verify**: Import compiles. `npx tsc --noEmit`.

---

## Group 3: Bill UI Components

### T004 — Create `BillStatusBadge.tsx` [P]

**File**: `src/components/bills/BillStatusBadge.tsx` (NEW)

**What to implement**:

- Props: `{ displayStatus: BillDisplayStatus }`.
- Status-to-style mapping:
  - `paid`: `bg-emerald-50 text-emerald-700`, icon `CheckCircle2`, label "Paid"
  - `overdue`: `bg-red-50 text-red-700`, icon `AlertCircle`, label "Overdue"
  - `pending`: `bg-amber-50 text-amber-700`, icon `Clock`, label "Pending"
  - `not_yet_generated`: `bg-cyan-50 text-cyan-700`, icon `FileQuestion`, label "Not received yet"
  - `skipped`: `bg-slate-100 text-slate-600`, icon `MinusCircle`, label "Skipped"
- Badge markup: `<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ...">`.
- Include `aria-label="Status: {label}"` for screen readers.
- Render icon at `w-3 h-3` inside the badge (per MASTER.md BillRow reference).

**Reference**: MASTER.md sections 5.2, 11 (BillRow reference).

**Contract**: `specs/004-bills-core-loop/contracts/components.ts` (BillStatusBadgeProps)

**Verify**: Renders with each display status value.

### T005 — Create `BillRow.tsx` list item component [P]

**File**: `src/components/bills/BillRow.tsx` (NEW)

**What to implement**:

- Props: `BillRowProps` — `bill` (BillWithDisplay), `onMarkPaid`, `onEdit`, `onDelete`, `isLoading`.
- Based on MASTER.md section 11 BillRow reference, adapted with action buttons.
- Layout (card, not a navigation button since there's no detail page yet):
  - `bg-white border border-slate-200 rounded-lg p-4`.
  - Top section: left side = `Receipt` icon (w-5 h-5 text-slate-400) + bill type name (font-semibold) + property name · month (text-sm text-slate-600). Right side = formatted amount (font-semibold tabular-nums) + `<BillStatusBadge>`.
  - Format amount using `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })`. If amount is null, show "—" or "Amount TBD".
  - Format month for display: convert "2026-06" to "Jun 2026" using `Intl.DateTimeFormat` or manual mapping.
  - Show due date below amount if set (text-xs text-slate-500, e.g., "Due: 15 Jun 2026").
- Action row:
  - "Mark Paid" button: shown only when `displayStatus === 'pending' || displayStatus === 'overdue'`. Text: "Mark Paid", `text-emerald-700` ghost button.
  - "Edit" button: always shown. `text-indigo-700` ghost button with `Pencil` icon.
  - "Delete" button: always shown. `text-red-600` ghost button with `Trash2` icon.
  - All buttons: `min-h-11 min-w-11`, `cursor-pointer`, `disabled:opacity-50` when `isLoading`.
- When `isLoading`, disable all action buttons.

**Reference**: MASTER.md sections 5.1, 5.4, 6, 8, 11.

**Contract**: `specs/004-bills-core-loop/contracts/components.ts` (BillRowProps)

**Verify**: Renders with mock BillWithDisplay data in each status.

### T006 — Create `BillFormModal.tsx` for add/edit bill [P]

**File**: `src/components/bills/BillFormModal.tsx` (NEW)

**What to implement**:

- Props: `BillFormModalProps` — `bill` (null=add), `availableBillTypes`, `isSaving`, `onSubmit`, `onClose`.
- Modal layout per MASTER.md 5.6 (same shell as PropertyFormModal).
- Title: "Add Bill" / "Edit Bill".
- Fields:
  - **Bill Type** (required on add, read-only on edit):
    - Add mode: `<select>` dropdown of `availableBillTypes`. Each option: `"{billType.name} — {billType.propertyName}"`.
    - Edit mode: Read-only display showing bill type name — property name (disabled input or plain text).
    - If `availableBillTypes` is empty: show "No active bill types. Configure bill types in Settings first." and disable form.
  - **Month** (required): `<input type="month">`. Pre-fill with current month (`YYYY-MM`) on add. Show current value on edit.
  - **Amount** (optional): `<input type="number" min="0" step="any">`. Pre-fill from selected bill type's `defaultAmount` on add when bill type changes.
  - **Due Date** (optional): `<input type="date">`. Auto-compute from month + bill type's `defaultDueDay` (clamped to month's last day) when both are selected on add. Editable.
  - **Notes** (optional): `<textarea>`.
- **Pre-fill behavior** (add mode only):
  - When bill type selection changes: look up `defaultAmount` and `defaultDueDay` from `availableBillTypes`. If `defaultAmount` is set, update amount field. If `defaultDueDay` is set AND month is already selected, compute and update due date.
  - When month changes: if a bill type is selected and has `defaultDueDay`, recompute due date.
  - Due date clamping: `const lastDay = new Date(year, monthNum, 0).getDate(); const day = Math.min(defaultDueDay, lastDay);`
- Pre-fill on edit: populate all fields from `bill`.
- Client-side validation:
  - Bill type: required (add mode). Error: "Please select a bill type."
  - Month: required. Error: "Please select a billing month."
  - Amount: if provided, must be >= 0. Error: "Amount must be a non-negative number."
  - Due date: if provided, must be valid YYYY-MM-DD.
- Submit button: Primary, disabled + spinner when `isSaving`. Text: "Add Bill" / "Save Changes".
- Cancel: Secondary, calls `onClose`. Close on Escape.

**Reference**: MASTER.md sections 5.1, 5.3, 5.6, 8.

**Contract**: `specs/004-bills-core-loop/contracts/components.ts` (BillFormModalProps)

**Verify**: Renders in add and edit mode. Pre-fill works on bill type/month change.

### T007 — Create `MarkPaidModal.tsx` [P]

**File**: `src/components/bills/MarkPaidModal.tsx` (NEW)

**What to implement**:

- Props: `MarkPaidModalProps` — `bill`, `isSaving`, `onSubmit`, `onClose`.
- Modal layout per MASTER.md 5.6.
- Title: "Mark as Paid".
- Show bill context at top: `"{billTypeName} — {propertyName} · {month}"` and `"₹{amount}"`.
- Fields:
  - **Paid Date** (required): `<input type="date">`, pre-filled with today's date (`new Date().toISOString().slice(0, 10)`).
  - **Payment Method** (required): `<select>` with `PAYMENT_METHOD_OPTIONS`.
  - **Transaction Reference** (optional): `<input type="text">`, placeholder "UTR or reference number".
- Validation:
  - Paid date: required. Error: "Please enter the paid date."
  - Payment method: required. Error: "Please select a payment method."
- Submit button: Primary (`bg-emerald-600 hover:bg-emerald-700` for a "paid" action feel, or stick with indigo-700 for consistency — use indigo-700 per MASTER.md primary), text "Confirm Payment".
- Cancel: Secondary, calls `onClose`. Close on Escape.

**Reference**: MASTER.md sections 5.1, 5.3, 5.6, 8.

**Contract**: `specs/004-bills-core-loop/contracts/components.ts` (MarkPaidModalProps)

**Verify**: Renders with mock bill data. Paid date defaults to today.

### T008 — Create `DuplicateWarningModal.tsx` [P]

**File**: `src/components/bills/DuplicateWarningModal.tsx` (NEW)

**What to implement**:

- Props: `DuplicateWarningModalProps` — `existingBill`, `onOpenExisting`, `onAddAnyway`, `onCancel`.
- Modal layout per MASTER.md 5.6 (same shell as ConfirmDialog but with 3 buttons).
- Title: "Duplicate Bill Detected".
- Message: Format as per spec.md:
  ```
  "A bill for {propertyName} {billTypeName} for {monthFormatted} already exists
   (₹{amount}, {displayStatus})."
  ```
  Use `Intl.NumberFormat('en-IN')` for amount. Format month as "Jun 2026".
- Three action buttons:
  - **"Open existing"** (secondary/ghost): calls `onOpenExisting`. Style: `text-indigo-700` ghost button.
  - **"Add anyway"** (primary but cautious): calls `onAddAnyway`. Style: `bg-amber-600 hover:bg-amber-700 text-white` (amber to signal caution, not destructive red).
  - **"Cancel"** (secondary): calls `onCancel`. Style: standard secondary button.
- Button layout: Stack vertically on mobile (`flex flex-col gap-2`), or arrange horizontally if space allows.
- Close on Escape → calls `onCancel`.

**Reference**: MASTER.md sections 5.1, 5.6. Spec.md duplicate detection section.

**Contract**: `specs/004-bills-core-loop/contracts/components.ts` (DuplicateWarningModalProps)

**Verify**: Renders with mock existing bill data.

### T009 — Create `BillsFilterBar.tsx` [P]

**File**: `src/components/bills/BillsFilterBar.tsx` (NEW)

**What to implement**:

- Props: `BillsFilterBarProps` — `properties`, `months`, `selectedPropertyId`, `selectedMonth`, `onPropertyChange`, `onMonthChange`.
- Layout: horizontal bar above the bill list. `flex flex-wrap gap-3 mb-4`.
- **Property filter**: `<select>` with options:
  - `<option value="">All properties</option>`
  - One `<option>` per property: `{ id, name }`.
- **Month filter**: `<select>` with options:
  - `<option value="">All months</option>`
  - One `<option>` per distinct month, formatted for display (e.g., "Jun 2026"). Value is YYYY-MM.
  - Sort months in descending order (most recent first).
- Style: per MASTER.md form inputs. `rounded-lg border border-slate-300 px-3 py-2 text-sm`.

**Contract**: `specs/004-bills-core-loop/contracts/components.ts` (BillsFilterBarProps)

**Verify**: Renders with mock property and month data.

---

## Group 4: Bills Page

### T010 — Build `BillsPage.tsx` with full CRUD, duplicate detection, and filters

**File**: `src/pages/BillsPage.tsx` (MODIFIED — rewrite from placeholder)

**What to implement**:

- Set `document.title` to `"NoDues · Bills"` on mount.
- Get `accessToken` from `useAuth()`, `spreadsheetId` from `useBootstrap().setupResult`.
- **State**:
  - `bills: BillWithDisplay[]` — the full list of non-deleted bills.
  - `billTypes: BillTypeWithProperty[]` — for the add form dropdown.
  - `isLoading: boolean` — initial fetch loading.
  - `loadingItemId: string | null` — per-bill action loading.
  - `modalMode: 'add' | 'edit' | null` — which form modal is open.
  - `editTarget: BillWithDisplay | null` — bill being edited.
  - `markPaidTarget: BillWithDisplay | null` — bill being marked paid.
  - `isSaving: boolean` — form save in progress.
  - `deleteTarget: BillWithDisplay | null` — bill pending delete confirmation.
  - `duplicateInfo: { existing: BillWithDisplay; pendingData: BillFormData; isEdit: boolean } | null` — duplicate detection state.
  - `filterPropertyId: string` — selected property filter ('' = all).
  - `filterMonth: string` — selected month filter ('' = all).

- **Initial fetch**: `useEffect` → `Promise.all([fetchBills(), fetchBillTypes()])` → set state → `setIsLoading(false)`. Error → error toast.

- **Derived state** (computed from bills + filters):
  - `filteredBills`: Apply property and month filters.
  - `availableProperties`: Distinct `{ id, name }` from `bills` (for filter dropdown).
  - `availableMonths`: Distinct months from `bills` (for filter dropdown).
  - `availableBillTypes`: Filter `billTypes` to active + non-deleted only.

- **Page header**: "Bills" heading + "Add Bill" primary button (indigo-700).
- **Filter bar**: `<BillsFilterBar>` with derived properties/months and filter state.
- **Loading state**: Spinner while `isLoading`.
- **Empty state**: If no bills after load, show empty state with `Receipt` icon and "No bills yet" message + "Add Bill" CTA.
- **Bill list**: `<div className="flex flex-col gap-3">` with `<BillRow>` for each `filteredBills` item.

- **Add flow**:
  1. "Add Bill" → `setModalMode('add')`.
  2. Form submit → compute `compositeKey` from form data + resolved `propertyId`.
  3. Call `checkDuplicate(compositeKey, bills)`.
  4. If duplicate found → set `duplicateInfo` (saves pendingData), show `DuplicateWarningModal`.
  5. If no duplicate → call `addBill(data, propertyId)` → refetch bills → success toast → close modal.
  6. Duplicate modal "Add anyway" → call `addBill` → refetch → toast → close both modals.
  7. Duplicate modal "Open existing" → close form modal, scroll to the existing bill using `Element.scrollIntoView()` and/or briefly highlight it.
  8. Duplicate modal "Cancel" → close duplicate modal, keep form open with data preserved.

- **Edit flow**:
  1. Card edit → `setEditTarget(bill)`, `setModalMode('edit')`.
  2. Form submit → if month changed, compute new compositeKey, run `checkDuplicate(newKey, bills, bill.id)`.
  3. If duplicate → show `DuplicateWarningModal`.
  4. If no duplicate → call `updateBill(bill, data, propertyId)` → update in list → success toast → close.

- **Mark Paid flow**:
  1. Card "Mark Paid" → `setMarkPaidTarget(bill)`.
  2. Form submit → call `markBillPaid(bill, data)` → update in list (recompute displayStatus) → success toast → close.
  3. Error → error toast.

- **Delete flow**: Same optimistic-delete-with-undo pattern as Phase 3:
  1. Card delete → `setDeleteTarget(bill)`, show `ConfirmDialog`.
  2. Confirm → optimistically remove from list → `softDeleteBill` → `showUndo`.
  3. Undo → `undoDeleteBill` → reinsert.
  4. Write failure → rollback (reinsert) + error toast.

- **Error handling**: All service call failures → error toast. UI remains usable.

**Dependencies**: T001, T002, T003, T004, T005, T006, T007, T008, T009.

**Verify**: Navigate to `/bills`. Full CRUD works. Duplicate detection triggers. Filters narrow the list. Status badges compute correctly. Manual test per `quickstart.md`.

---

## Group 5: Validation & Polish

### T011 — End-to-end validation pass

**What to verify** (manual, per `quickstart.md`):

1. **Add Bill**:
   - Bill type dropdown shows only active, non-deleted bill types with property names.
   - Selecting a bill type pre-fills amount and due date (when month is also selected).
   - Due date clamps to month's last day (e.g., Feb with due day 31 → Feb 28).
   - Amount and due date are overridable.
   - Saving without amount/due date → status = "Not received yet".
   - Saving with amount + due date → status = "Pending".
   - New row in Sheet has correct UUID, composite_key, status, timestamps.

2. **Duplicate Detection**:
   - Adding same property + bill type + month → warning modal with existing bill info.
   - "Open existing" → form closes, existing bill highlighted.
   - "Add anyway" → bill saved despite duplicate.
   - "Cancel" → form stays open, data preserved.
   - Editing a bill's month to match an existing bill → warning triggers.

3. **Bills List**:
   - Status badges: green "Paid", red "Overdue", amber "Pending", cyan "Not received yet".
   - Sort order: overdue → pending → not yet generated → paid → skipped.
   - Property filter works.
   - Month filter works.
   - Amount formatted with ₹ and Indian number formatting.

4. **Mark Paid**:
   - Paid date pre-fills with today.
   - Payment method is required.
   - After save, status badge changes to green "Paid".
   - Sheet columns updated: status, paid_date, payment_method, transaction_ref, updated_at.

5. **Edit Bill**:
   - Bill type shown read-only.
   - Amount, due date, month, notes editable.
   - Immutable fields preserved in Sheet (id, bill_type_id, original_due_date, created_at, file/receipt/calendar IDs).
   - Editing a "not yet generated" bill to add amount + due date → status flips to "Pending".

6. **Soft-Delete**:
   - Confirmation dialog appears.
   - Bill disappears immediately (optimistic).
   - Undo snackbar for 10 seconds.
   - Undo restores the bill.
   - Write failure → bill reappears (rollback) + error toast.
   - After snackbar expires → reload → bill gone.

7. **Validation**:
   - No bill type selected → blocked.
   - No month selected → blocked.
   - Negative amount → error.
   - Empty paid date on mark-paid → blocked.
   - No payment method on mark-paid → blocked.

8. **Cross-cutting**:
   - Loading spinner during initial fetch.
   - Form buttons disabled + spinner during save.
   - Error toasts on Sheet failures.
   - `document.title` set to "NoDues · Bills".
   - Mobile-first: test at 375px width.
   - MASTER.md compliance: indigo-700 primary, Lucide icons, slate neutrals, rounded-lg, 44px touch targets, focus rings, no emoji as icons.
   - No console errors.

**Dependencies**: All previous tasks.

---

## Task Dependency Graph

```
T001 (types)
  │
  ├─► T002 (billsService: read/display)
  │     │
  │     └─► T003 (billsService: mutations)
  │
  ├─► T004 [P] (BillStatusBadge)
  ├─► T005 [P] (BillRow)
  ├─► T006 [P] (BillFormModal)
  ├─► T007 [P] (MarkPaidModal)
  ├─► T008 [P] (DuplicateWarningModal)
  └─► T009 [P] (BillsFilterBar)
        │
        └─► T010 (BillsPage — full wiring)
              │
              └─► T011 (Validation pass)
```

## Summary

| Group | Tasks | Count |
|-------|-------|-------|
| 1. Types | T001 | 1 |
| 2. Bills Service | T002, T003 | 2 |
| 3. Bill UI Components | T004, T005, T006, T007, T008, T009 | 6 (all [P]) |
| 4. Bills Page | T010 | 1 |
| 5. Validation | T011 | 1 |
| **Total** | | **11 tasks** |
