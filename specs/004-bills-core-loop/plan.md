# Implementation Plan: Bills Core Loop

**Branch**: `004-bills-core-loop` | **Date**: 2026-05-28 | **Spec**: [spec.md](specs/004-bills-core-loop/spec.md)

**Input**: Feature specification from `/specs/004-bills-core-loop/spec.md`

## Summary

Implement the core bill-tracking loop: add a bill (picking a bill type, pre-filling defaults, selecting month), list bills with computed status badges (paid/overdue/pending/not yet generated/skipped), mark bills paid, edit, soft-delete with undo, and duplicate detection before save. A new `billsService.ts` handles all Sheet operations with full-row-safety writes. A new `BillStatusBadge` component handles the five display statuses. The page replaces the existing placeholder `BillsPage.tsx` with a full card list, filters, and three modals (add/edit form, mark-paid form, duplicate warning).

## Technical Context

**Language/Version**: TypeScript ~6.0.2 / React 19.2.6

**Primary Dependencies**: React 19, React Router 6.30.3, Tailwind CSS 3.4.19, Lucide React 1.16.0, Vite 8.0.12, `@react-oauth/google` 0.13.x, `uuid` 11.1.0

**Storage**: Google Sheets (all data in the bootstrapped spreadsheet). No local persistence — all state in React context + component state.

**Testing**: Manual testing via acceptance scenarios (no test framework configured).

**Target Platform**: Web browser (mobile-first SPA, 375px primary breakpoint)

**Project Type**: Single-page web application (client-only, no backend)

**Performance Goals**: Bills list loads within 3 seconds of navigation. Form submissions complete within 3 seconds. Optimistic delete provides instant visual feedback.

**Constraints**: Memory-only state, WCAG 2.1 AA compliance, no backend server, `drive.file` scope. All reads/writes go through Google Sheets API v4.

**Scale/Scope**: Single-user per browser tab, household app (1-4 users). 3-10 properties, 5-30 bill types, 20-200 bills typical.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution is not yet ratified (template placeholders only). No gates to enforce. Proceeding with standard engineering best practices.

**Post-Phase 1 re-check**: No constitution violations — constitution remains unratified.

## Project Structure

### Documentation (this feature)

```text
specs/004-bills-core-loop/
├── plan.md              # This file
├── research.md          # Phase 0 output — implementation pattern decisions
├── data-model.md        # Phase 1 output — entity definitions
├── quickstart.md        # Phase 1 output — developer setup guide
├── contracts/           # Phase 1 output — interface contracts
│   ├── types.ts         # Bill, BillWithDisplay, BillFormData, MarkPaidFormData, DisplayStatus
│   ├── services.ts      # billsService function signatures
│   └── components.ts    # Component prop interfaces, BillStatusBadge
└── tasks.md             # Phase 2 output (via /speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── App.tsx                              # UNCHANGED — /bills route already exists
├── types/
│   └── index.ts                         # MODIFIED — add Bill, BillWithDisplay, DisplayStatus, BillStatus,
│                                        #   BillFormData, MarkPaidFormData, PaymentMethod types
├── services/
│   ├── googleApi.ts                     # UNCHANGED — reuse columnLetter, withRetry
│   ├── sheetsService.ts                 # UNCHANGED — reuse readAllRows, updateRow, updateCell, appendRows
│   ├── propertiesService.ts             # UNCHANGED — reuse fetchProperties for filter data + name resolution
│   ├── billTypesService.ts              # UNCHANGED — reuse fetchBillTypes for dropdown + name resolution
│   └── billsService.ts                  # NEW — Bills CRUD (fetch+enrich, add, checkDuplicate, update,
│                                        #   markPaid, softDelete, undoDelete) + helper functions
├── contexts/
│   ├── AuthContext.tsx                   # UNCHANGED
│   ├── BootstrapContext.tsx              # UNCHANGED
│   └── ToastContext.tsx                  # UNCHANGED
├── components/
│   ├── shared/
│   │   ├── Navbar.tsx                   # UNCHANGED
│   │   ├── ConfirmDialog.tsx            # UNCHANGED — reuse for delete confirmation
│   │   ├── StatusBadge.tsx              # UNCHANGED — active/inactive only, not reused for bill status
│   │   ├── BillStatusBadge.tsx          # NEW — five-state status badge (paid/overdue/pending/not_yet_generated/skipped)
│   │   └── ToastContainer.tsx           # UNCHANGED
│   ├── bills/
│   │   ├── BillCard.tsx                 # NEW — single bill list item (based on MASTER.md section 11 BillRow)
│   │   ├── BillFormModal.tsx            # NEW — add/edit bill form modal
│   │   ├── MarkPaidModal.tsx            # NEW — mark-paid form modal
│   │   └── DuplicateWarningModal.tsx    # NEW — duplicate detection warning with 3 options
│   ├── settings/                        # UNCHANGED — all existing components
│   ├── auth/                            # UNCHANGED
│   └── bootstrap/                       # UNCHANGED
├── config/
│   ├── schema.ts                        # UNCHANGED — Bills tab HEADER_DEFINITIONS already exists (18 columns)
│   └── branding.ts                      # UNCHANGED
└── pages/
    └── BillsPage.tsx                    # MODIFIED — replace placeholder with full bills page
```

**Structure Decision**: Single-project SPA structure continues from Phase 3. New directory `src/components/bills/` for bill-specific components. A new `billsService.ts` sits alongside existing services. No new contexts needed — `ToastContext`, `AuthContext`, and `BootstrapContext` are reused as-is. The existing `StatusBadge` component handles active/inactive only; a new `BillStatusBadge` handles the five bill display statuses.

### New Files (6)

| File | Purpose |
|------|---------|
| `src/services/billsService.ts` | Bills CRUD: fetch+enrich, add, checkDuplicate, update, markPaid, softDelete, undoDelete, plus helper functions (computeDisplayStatus, computeDueDate, computeCompositeKey, sortBills) |
| `src/components/shared/BillStatusBadge.tsx` | Five-state status badge: paid (emerald), overdue (red), pending (amber), not_yet_generated (cyan), skipped (slate) |
| `src/components/bills/BillCard.tsx` | Bill list item card based on MASTER.md section 11 BillRow reference |
| `src/components/bills/BillFormModal.tsx` | Add/edit bill form: bill type dropdown, month picker, amount, due date, notes |
| `src/components/bills/MarkPaidModal.tsx` | Mark-paid form: paid date, payment method dropdown, transaction reference |
| `src/components/bills/DuplicateWarningModal.tsx` | Duplicate warning: shows existing bill details + "Open existing" / "Add anyway" / "Cancel" |

### Modified Files (2)

| File | Changes |
|------|---------|
| `src/types/index.ts` | Add Bill, BillWithDisplay, DisplayStatus, BillStatus, BillFormData, MarkPaidFormData, PaymentMethod types |
| `src/pages/BillsPage.tsx` | Replace placeholder with full bills page: fetch+display, filters, add/edit/mark-paid/delete actions |

### New Dependencies

None. All existing dependencies are sufficient.

## Component Architecture

```text
BillsPage
├── State: bills[], billTypes[], properties[], filters, modals, loading
├── Data: useAuth() + useBootstrap() → billsService.fetchBills()
│         + billTypesService.fetchBillTypes() + propertiesService.fetchProperties()
├── Filters: property dropdown + month dropdown → filtered + sorted bills
│
├── BillCard (per bill)
│   ├── Shows: billTypeName, propertyName, month, amount, dueDate
│   ├── BillStatusBadge (displayStatus)
│   └── Actions: Edit, Mark Paid (if eligible), Delete
│
├── BillFormModal (add / edit)
│   ├── Bill type dropdown (active+non-deleted, shows "Name — Property")
│   ├── Month picker (type="month")
│   ├── Amount (pre-filled from bill type defaults)
│   ├── Due date (auto-computed from month + default_due_day with clamping)
│   ├── Notes
│   └── On submit → checkDuplicate → save or show DuplicateWarningModal
│
├── MarkPaidModal
│   ├── Paid date (pre-filled with today)
│   ├── Payment method dropdown (GPay, PhonePe, NEFT, Net Banking, Cash, Other)
│   ├── Transaction reference (optional)
│   └── On submit → billsService.markPaid()
│
├── DuplicateWarningModal
│   ├── Shows existing bill details
│   └── Actions: "Open existing" / "Add anyway" / "Cancel"
│
└── ConfirmDialog (reused for delete)
```

## Service Layer Design

### Reused Generic Sheet Helpers (from `sheetsService.ts`)

All existing helpers are sufficient — **no changes to sheetsService.ts**:
- `readAllRows(accessToken, spreadsheetId, tabName)` → read bill rows
- `updateRow(accessToken, spreadsheetId, tabName, rowIndex, values)` → full-row-safety writes
- `updateCell(accessToken, spreadsheetId, tabName, rowIndex, colIndex, value)` → soft-delete/undo
- `appendRows(accessToken, spreadsheetId, tabName, rows)` → add new bill

### Reused Domain Services

- `propertiesService.fetchProperties()` — resolve property names, populate property filter
- `billTypesService.fetchBillTypes()` — resolve bill type names and defaults, populate dropdown

### New Domain Service: `billsService.ts`

#### Column Index Map

```typescript
const TAB_NAME = 'Bills';
const BILL_HEADERS = HEADER_DEFINITIONS.find(d => d.tabName === TAB_NAME)!.headers;
const COL = Object.fromEntries(BILL_HEADERS.map((h, i) => [h, i])) as Record<string, number>;
// COL.id=0, COL.bill_type_id=1, COL.month=2, COL.amount=3, COL.due_date=4,
// COL.original_due_date=5, COL.status=6, COL.paid_date=7, COL.payment_method=8,
// COL.transaction_ref=9, COL.bill_file_ids=10, COL.receipt_file_ids=11,
// COL.calendar_event_ids=12, COL.notes=13, COL.created_at=14, COL.updated_at=15,
// COL.deleted_at=16, COL.composite_key=17
```

#### Pure Helper Functions (exported, testable)

| Function | Signature | Purpose |
|----------|-----------|---------|
| `computeDisplayStatus` | `(status: BillStatus, dueDate: string, today?: string) → DisplayStatus` | Compute display status from stored status + due date vs today. Pure function, no side effects. Used by sort and badge. |
| `computeDueDate` | `(month: string, defaultDueDay: number \| null) → string` | Compute due date from "YYYY-MM" month + default_due_day with last-day-of-month clamping. Returns "" if defaultDueDay is null. |
| `computeCompositeKey` | `(propertyId: string, billTypeId: string, month: string) → string` | Returns `propertyId\|billTypeId\|month`. |
| `sortBills` | `(bills: BillWithDisplay[]) → BillWithDisplay[]` | Sort: overdue (oldest due first) → pending (soonest due first) → not_yet_generated (by month) → paid (most recent paid_date first) → skipped. |
| `formatMonth` | `(month: string) → string` | Format "2026-06" as "Jun 2026". |
| `formatCurrency` | `(amount: number) → string` | Format amount with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })`. |

#### `computeDisplayStatus` Logic

```typescript
function computeDisplayStatus(status: BillStatus, dueDate: string, today?: string): DisplayStatus {
  if (status === 'paid') return 'paid';
  if (status === 'skipped') return 'skipped';
  if (status === 'not_yet_generated') return 'not_yet_generated';
  // status === 'pending'
  const todayStr = today ?? new Date().toISOString().slice(0, 10);
  if (dueDate && dueDate < todayStr) return 'overdue';
  return 'pending';
}
```

#### `computeDueDate` Logic (with last-day clamping)

```typescript
function computeDueDate(month: string, defaultDueDay: number | null): string {
  if (!month || defaultDueDay === null) return '';
  const [year, mon] = month.split('-').map(Number);
  // Last day of the month: day 0 of next month = last day of current month
  const lastDay = new Date(year, mon, 0).getDate();
  const clampedDay = Math.min(defaultDueDay, lastDay);
  return `${year}-${String(mon).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}
```

#### CRUD Functions

| Function | API Calls | Notes |
|----------|-----------|-------|
| `fetchBills` | `readAllRows('Bills')` + receives billTypes and properties maps | Parse rows, filter `deleted_at === ''`, enrich with billTypeName, propertyName, propertyId, displayStatus. Returns `BillWithDisplay[]`. |
| `addBill` | `appendRows('Bills', [[...]])` | Generate UUID. Set `status = pending` if amount+due_date provided, else `not_yet_generated`. Set `original_due_date = due_date`. Set `created_at = updated_at = now`. Empty `paid_date`, `payment_method`, `transaction_ref`, `bill_file_ids`, `receipt_file_ids`, `calendar_event_ids`, `deleted_at`. Compute `composite_key`. |
| `checkDuplicate` | Pure function on in-memory bills array | Check if any non-deleted bill has the same `composite_key`. Returns matching `BillWithDisplay` or null. |
| `updateBill` | `updateRow('Bills', rowIndex, [...])` | **Full-row-safety**: preserve `id`, `bill_type_id`, `original_due_date`, `created_at`, `bill_file_ids`, `receipt_file_ids`, `calendar_event_ids` from existing row. Update `month`, `amount`, `due_date`, `notes`, `composite_key`, `updated_at`. Auto-flip: if previous `status === 'not_yet_generated'` and new amount+due_date both provided → `status = 'pending'`, and set `original_due_date` if it was empty. |
| `markPaid` | `updateRow('Bills', rowIndex, [...])` | **Full-row-safety**: preserve all fields except: `status = 'paid'`, `paid_date`, `payment_method`, `transaction_ref`, `updated_at`. |
| `softDeleteBill` | `updateCell('Bills', rowIndex, COL.deleted_at, isoNow)` | Write only `deleted_at`. |
| `undoDeleteBill` | `updateCell('Bills', rowIndex, COL.deleted_at, '')` | Clear `deleted_at`. |

#### Parse / Serialize

```typescript
function parseRow(row: RowWithIndex): Bill | null {
  const v = row.values;
  if (!v || v.length === 0) return null;
  const id = v[COL.id];
  if (!id) return null; // Skip malformed rows

  const amountStr = v[COL.amount] ?? '';
  // Validate status, default to 'pending' for invalid values
  const rawStatus = v[COL.status] ?? 'pending';
  const validStatuses = ['pending', 'paid', 'not_yet_generated', 'skipped'];
  const status = validStatuses.includes(rawStatus) ? rawStatus as BillStatus : 'pending';

  return {
    _rowIndex: row.rowIndex,
    id,
    billTypeId: v[COL.bill_type_id] ?? '',
    month: v[COL.month] ?? '',
    amount: amountStr === '' ? null : Number(amountStr),
    dueDate: v[COL.due_date] ?? '',
    originalDueDate: v[COL.original_due_date] ?? '',
    status,
    paidDate: v[COL.paid_date] ?? '',
    paymentMethod: v[COL.payment_method] ?? '',
    transactionRef: v[COL.transaction_ref] ?? '',
    billFileIds: v[COL.bill_file_ids] ?? '',
    receiptFileIds: v[COL.receipt_file_ids] ?? '',
    calendarEventIds: v[COL.calendar_event_ids] ?? '',
    notes: v[COL.notes] ?? '',
    createdAt: v[COL.created_at] ?? '',
    updatedAt: v[COL.updated_at] ?? '',
    deletedAt: v[COL.deleted_at] ?? '',
    compositeKey: v[COL.composite_key] ?? '',
  };
}

function serializeRow(bill: Bill): string[] {
  return [
    bill.id,
    bill.billTypeId,
    bill.month,
    bill.amount === null ? '' : String(bill.amount),
    bill.dueDate,
    bill.originalDueDate,
    bill.status,
    bill.paidDate,
    bill.paymentMethod,
    bill.transactionRef,
    bill.billFileIds,
    bill.receiptFileIds,
    bill.calendarEventIds,
    bill.notes,
    bill.createdAt,
    bill.updatedAt,
    bill.deletedAt,
    bill.compositeKey,
  ];
}
```

#### `fetchBills` Enrichment Flow

```typescript
async function fetchBills(
  accessToken: string,
  spreadsheetId: string,
  billTypeMap: Map<string, { name: string; propertyId: string; propertyName: string }>,
): Promise<BillWithDisplay[]> {
  const rows = await readAllRows(accessToken, spreadsheetId, TAB_NAME);
  const result: BillWithDisplay[] = [];

  for (const row of rows) {
    const parsed = parseRow(row);
    if (!parsed || parsed.deletedAt !== '') continue;

    const btInfo = billTypeMap.get(parsed.billTypeId);
    result.push({
      ...parsed,
      billTypeName: btInfo?.name ?? 'Unknown',
      propertyName: btInfo?.propertyName ?? 'Unknown',
      propertyId: btInfo?.propertyId ?? '',
      displayStatus: computeDisplayStatus(parsed.status, parsed.dueDate),
    });
  }

  return sortBills(result);
}
```

The `billTypeMap` is built at the page level from `fetchBillTypes()` results to avoid redundant Sheet reads.

## Page-Level State Management

### BillsPage

```typescript
// State
const [bills, setBills] = useState<BillWithDisplay[]>([]);
const [billTypes, setBillTypes] = useState<BillTypeWithProperty[]>([]);
const [properties, setProperties] = useState<Property[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [isSaving, setIsSaving] = useState(false);

// Filters
const [filterProperty, setFilterProperty] = useState<string>('all');
const [filterMonth, setFilterMonth] = useState<string>('all');

// Modals
const [formModal, setFormModal] = useState<{ mode: 'add' | 'edit'; bill?: BillWithDisplay } | null>(null);
const [markPaidTarget, setMarkPaidTarget] = useState<BillWithDisplay | null>(null);
const [duplicateWarning, setDuplicateWarning] = useState<{
  existingBill: BillWithDisplay;
  pendingFormData: BillFormData;
  pendingMode: 'add' | 'edit';
} | null>(null);
const [deleteTarget, setDeleteTarget] = useState<BillWithDisplay | null>(null);

// Ref for scrolling to existing bill on "Open existing"
const billRefs = useRef<Map<string, HTMLDivElement>>(new Map());

// Data flow
useEffect → loadData() → parallel fetch [bills, billTypes, properties] → setState

// Derived
const filteredBills = useMemo(() => {
  let result = bills;
  if (filterProperty !== 'all') result = result.filter(b => b.propertyId === filterProperty);
  if (filterMonth !== 'all') result = result.filter(b => b.month === filterMonth);
  return sortBills(result);
}, [bills, filterProperty, filterMonth]);

// Filter options derived from bills data
const propertyOptions = useMemo(() => {
  const seen = new Map<string, string>();
  for (const b of bills) seen.set(b.propertyId, b.propertyName);
  return Array.from(seen.entries()).map(([id, name]) => ({ value: id, label: name }));
}, [bills]);

const monthOptions = useMemo(() => {
  const months = [...new Set(bills.map(b => b.month))].sort().reverse();
  return months.map(m => ({ value: m, label: formatMonth(m) }));
}, [bills]);
```

### Add Bill Flow

```text
1. User taps "Add Bill" → setFormModal({ mode: 'add' })
2. User fills form, selects bill type → amount/due_date pre-fill from defaults
3. User submits → validate → build composite_key
4. checkDuplicate(composite_key, bills) → if match:
   → setDuplicateWarning({ existingBill, pendingFormData, pendingMode: 'add' })
   → User chooses:
     a. "Open existing" → close all modals, scroll to existingBill
     b. "Add anyway" → proceed to save
     c. "Cancel" → close duplicate modal, return to form
5. Save: addBill() → refetch all bills → close modals → success toast
```

### Edit Bill Flow

```text
1. User taps Edit on a bill → setFormModal({ mode: 'edit', bill })
2. Form pre-fills with current values. Bill type shown read-only.
3. User submits → validate → if month changed, build new composite_key
4. If month changed: checkDuplicate(newCompositeKey, bills, excludeId) → if match:
   → same duplicate warning flow as add
5. Save: updateBill() with full-row-safety → update in local state → close modals → success toast
```

### Mark Paid Flow

```text
1. User taps "Mark Paid" on a pending/overdue bill → setMarkPaidTarget(bill)
2. Modal opens with today pre-filled, payment method required
3. User submits → markPaid() → update in local state → close modal → success toast
```

### Delete Flow

```text
1. User taps Delete → setDeleteTarget(bill) → ConfirmDialog appears
2. User confirms → optimistic remove from bills[] → softDeleteBill()
3. showUndo("Bill deleted.", async () => { undoDeleteBill(); reinsert })
4. If softDeleteBill fails → rollback (reinsert) + error toast
```

## UI Layout Specifications

### Bills Page (`/bills`)

```text
┌─────────────────────────────────┐
│ Bills                  [Add Bill]│   ← Page heading + primary button
│                                 │
│ [All properties ▾] [All months ▾]│   ← Filter dropdowns
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 📄 Maintenance       ₹5,000│ │   ← BillCard
│ │ Mira Shop · Jun 2026       │ │
│ │              [Overdue] 🔴   │ │
│ │         [Edit] [Pay] [Del] │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 📄 Property Tax     ₹12,000│ │
│ │ Mira Flat · Jun 2026       │ │
│ │              [Pending] 🟡   │ │
│ │         [Edit] [Pay] [Del] │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 📄 Electricity              │ │
│ │ Chawl · Jun 2026           │ │
│ │       [Not received yet] 🔵│ │
│ │         [Edit]       [Del] │ │   ← No "Pay" for not_yet_generated
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 📄 Maintenance       ₹5,000│ │
│ │ Mira Shop · May 2026       │ │
│ │                [Paid] 🟢   │ │
│ │         [Edit]       [Del] │ │   ← No "Pay" for paid
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

(Icons are Lucide SVG, not emoji — diagram uses emoji for readability.)

### BillCard Layout (following MASTER.md section 11 BillRow)

```text
┌─────────────────────────────────┐
│ [Receipt icon] BillType    ₹Amt│   ← Left: icon + name, Right: amount
│                PropertyName ·   │
│                MonthLabel       │
│                    [StatusBadge]│   ← Right-aligned badge
│                                 │
│ [Edit] [Mark Paid] [Delete]    │   ← Actions row (ghost buttons)
└─────────────────────────────────┘
```

### BillFormModal (Add / Edit)

```text
┌─────────────────────────────────┐
│ Add Bill / Edit Bill            │
│                                 │
│ Bill Type *                     │
│ [Select bill type ▾]           │   ← dropdown: "Name — Property"
│                                 │   ← Read-only in edit mode
│ Month *                         │
│ [YYYY-MM input]                │   ← type="month"
│                                 │
│ Amount                          │
│ [number input]                  │   ← Pre-filled from bill type defaults
│                                 │
│ Due Date                        │
│ [YYYY-MM-DD input]              │   ← Auto-computed, editable
│                                 │
│ Notes                           │
│ [textarea]                      │
│                                 │
│          [Cancel] [Save]        │
└─────────────────────────────────┘
```

### MarkPaidModal

```text
┌─────────────────────────────────┐
│ Mark as Paid                    │
│                                 │
│ {BillType} — {Property}        │   ← Read-only context line
│ {Month} · ₹{Amount}            │
│                                 │
│ Paid Date *                     │
│ [YYYY-MM-DD, pre-filled today] │
│                                 │
│ Payment Method *                │
│ [Select method ▾]              │   ← GPay, PhonePe, NEFT, Net Banking, Cash, Other
│                                 │
│ Transaction Reference           │
│ [text input]                    │
│                                 │
│          [Cancel] [Mark Paid]   │
└─────────────────────────────────┘
```

### DuplicateWarningModal

```text
┌─────────────────────────────────┐
│ Duplicate Bill Found            │
│                                 │
│ A bill for {Property}           │
│ {BillType} for {Month Year}    │
│ already exists (₹{amount},     │
│ {status}).                      │
│                                 │
│ [Open existing]                 │   ← Close form, scroll to existing
│ [Add anyway]                    │   ← Force-save
│ [Cancel]                        │   ← Return to form
└─────────────────────────────────┘
```

## Validation Rules Summary

| Form | Field | Rule | Error Message |
|------|-------|------|---------------|
| Bill Form | billTypeId | Required, must be selected | "Please select a bill type." |
| Bill Form | month | Required, must be selected | "Please select a billing month." |
| Bill Form | amount | If provided, >= 0 | "Amount must be a non-negative number." |
| Bill Form | dueDate | If provided, valid YYYY-MM-DD | "Please enter a valid date." |
| Mark Paid | paidDate | Required, valid date | "Please enter the paid date." |
| Mark Paid | paymentMethod | Required, must be selected | "Please select a payment method." |

All validation is client-side, inline, and blocks form submission. Errors appear as `text-red-600 text-xs mt-1` below the respective input (per MASTER.md section 5.3).

## Display Status Badge Styles

| DisplayStatus | Label | Tailwind bg | Tailwind text | Lucide Icon | Sort Priority |
|---------------|-------|-------------|---------------|-------------|---------------|
| `overdue` | Overdue | `bg-red-50` | `text-red-700` | `AlertCircle` | 0 (first) |
| `pending` | Pending | `bg-amber-50` | `text-amber-700` | `Clock` | 1 |
| `not_yet_generated` | Not received yet | `bg-cyan-50` | `text-cyan-700` | `FileQuestion` | 2 |
| `paid` | Paid | `bg-emerald-50` | `text-emerald-700` | `CheckCircle2` | 3 |
| `skipped` | Skipped | `bg-slate-100` | `text-slate-600` | `MinusCircle` | 4 (last) |

## Sort Order Algorithm

```typescript
const STATUS_PRIORITY: Record<DisplayStatus, number> = {
  overdue: 0,
  pending: 1,
  not_yet_generated: 2,
  paid: 3,
  skipped: 4,
};

function sortBills(bills: BillWithDisplay[]): BillWithDisplay[] {
  return [...bills].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.displayStatus];
    const pb = STATUS_PRIORITY[b.displayStatus];
    if (pa !== pb) return pa - pb;

    // Within same status, secondary sort:
    switch (a.displayStatus) {
      case 'overdue':
        // Oldest due date first
        return (a.dueDate || '').localeCompare(b.dueDate || '');
      case 'pending':
        // Soonest due date first
        return (a.dueDate || '').localeCompare(b.dueDate || '');
      case 'not_yet_generated':
        // By month
        return (a.month || '').localeCompare(b.month || '');
      case 'paid':
        // Most recently paid first
        return (b.paidDate || '').localeCompare(a.paidDate || '');
      case 'skipped':
        return (b.month || '').localeCompare(a.month || '');
      default:
        return 0;
    }
  });
}
```

## Full-Row-Safety on Update and Mark Paid

Both `updateBill` and `markPaid` reconstruct the full 18-column row before writing:

```typescript
// updateBill: preserve immutable fields from existing bill
const updatedBill: Bill = {
  ...existingBill,                    // Start with existing (preserves all fields)
  month: data.month,                  // Editable
  amount: data.amount,                // Editable
  dueDate: data.dueDate,             // Editable
  notes: data.notes,                  // Editable
  compositeKey: newCompositeKey,      // Recomputed
  updatedAt: new Date().toISOString(),
  // Auto-flip not_yet_generated → pending
  status: existingBill.status === 'not_yet_generated' && data.amount !== null && data.dueDate
    ? 'pending' : existingBill.status,
  // Set original_due_date if it was empty and due_date is now provided
  originalDueDate: existingBill.originalDueDate || data.dueDate || '',
};
await updateRow(accessToken, spreadsheetId, TAB_NAME, existingBill._rowIndex, serializeRow(updatedBill));

// markPaid: preserve all fields, only change payment-related ones
const paidBill: Bill = {
  ...existingBill,
  status: 'paid',
  paidDate: data.paidDate,
  paymentMethod: data.paymentMethod,
  transactionRef: data.transactionRef,
  updatedAt: new Date().toISOString(),
};
await updateRow(accessToken, spreadsheetId, TAB_NAME, existingBill._rowIndex, serializeRow(paidBill));
```

Fields preserved (never overwritten): `id`, `bill_type_id`, `original_due_date` (except when auto-setting on first edit), `created_at`, `bill_file_ids`, `receipt_file_ids`, `calendar_event_ids`.

## Complexity Tracking

No constitution violations to justify — constitution remains unratified.
