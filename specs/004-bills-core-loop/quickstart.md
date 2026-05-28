# Quickstart: Bills Core Loop

**Feature**: 004-bills-core-loop | **Date**: 2026-05-28

## Prerequisites

- Phases 1–3 (Auth, Bootstrapping, Properties & Bill Types) are complete and working.
- `npm install` has been run (no new dependencies needed for this phase).
- The app can sign in, bootstrap, and reach the Dashboard page.
- A Google Sheet exists with seed data (3 properties, 5 bill types). The Bills tab exists with headers but no data rows yet.

## Development Setup

```bash
# Start the dev server
npm run dev

# The app runs at http://localhost:5173
# Sign in with Google → navigate to /bills
```

## Key Files to Understand Before Coding

| File | Why |
|------|-----|
| `src/services/sheetsService.ts` | Reuse `readAllRows`, `updateRow`, `updateCell`, `appendRows` — no changes needed |
| `src/services/billTypesService.ts` | Pattern reference for parseRow/serializeRow, fetchBillTypes for resolving names |
| `src/services/propertiesService.ts` | Pattern reference, fetchProperties for resolving property names |
| `src/config/schema.ts` | `HEADER_DEFINITIONS` — Bills tab has 18 columns (A–R) |
| `src/types/index.ts` | Add Bill, BillWithDisplay, BillFormData, MarkPaidFormData types here |
| `src/pages/BillsPage.tsx` | Currently a placeholder — rewrite to full implementation |
| `src/components/settings/BillTypeCard.tsx` | Pattern for card with action buttons |
| `src/components/settings/BillTypeFormModal.tsx` | Pattern for form modal with dropdown + validation |
| `src/contexts/ToastContext.tsx` | `useToast()` — showToast, showUndo for notifications |
| `src/components/shared/ConfirmDialog.tsx` | Reuse for delete confirmation |
| `design-system/nodues/MASTER.md` | BillRow reference (section 11), status badge colors (section 5.2) |

## Implementation Order

1. **Types** (`src/types/index.ts`) — Add `BillStatus`, `BillDisplayStatus`, `Bill`, `BillWithDisplay`, `BillFormData`, `MarkPaidFormData`, `PAYMENT_METHOD_OPTIONS`.
2. **Bills service** (`src/services/billsService.ts`) — parseRow, serializeRow, computeDisplayStatus, fetchBills, checkDuplicate, addBill, updateBill, markBillPaid, softDeleteBill, undoDeleteBill.
3. **Bill status badge** (`src/components/bills/BillStatusBadge.tsx`) — Paid/Overdue/Pending/Not received/Skipped.
4. **Bill row** (`src/components/bills/BillRow.tsx`) — List item with actions.
5. **Bill form modal** (`src/components/bills/BillFormModal.tsx`) — Add/Edit bill form.
6. **Mark paid modal** (`src/components/bills/MarkPaidModal.tsx`) — Mark paid form.
7. **Duplicate warning modal** (`src/components/bills/DuplicateWarningModal.tsx`) — Warning with 3 options.
8. **Filter bar** (`src/components/bills/BillsFilterBar.tsx`) — Property + month filters.
9. **Bills page** (`src/pages/BillsPage.tsx`) — Full page with list, filters, all CRUD, duplicate detection.

## Manual Testing

After implementation, verify each scenario:

### Add Bill
1. Navigate to `/bills` → see empty state.
2. Tap "Add Bill" → form opens with bill type dropdown.
3. Select a bill type → amount and due date pre-fill from defaults.
4. Pick a month → due date updates (month + default_due_day, clamped).
5. Save → bill appears in list with "Pending" badge. Verify Sheet row.
6. Add another with same bill type + month → duplicate warning appears.

### List & Status
1. Add bills in different states (pending, paid via mark-paid, overdue by using a past due date).
2. Verify status badges: green "Paid", red "Overdue", amber "Pending".
3. Verify sort order: overdue first, then pending, then paid.
4. Filter by property → only that property's bills shown.
5. Filter by month → only that month's bills shown.

### Mark Paid
1. Find a pending or overdue bill → tap "Mark Paid".
2. Verify paid date pre-fills with today.
3. Select payment method, optionally enter transaction ref.
4. Save → badge changes to green "Paid". Verify Sheet columns.

### Edit
1. Tap edit on a bill → form pre-fills with current values.
2. Bill type is read-only.
3. Change amount → save → verify Sheet update, verify immutable fields preserved.
4. Change month to one with existing bill → duplicate warning triggers.

### Delete
1. Tap delete → confirmation dialog appears.
2. Confirm → bill disappears, undo snackbar for 10s.
3. Tap Undo → bill reappears.
4. Delete again, wait for snackbar to expire → reload, bill gone.

### Edge Cases
1. Add bill with no amount/due date → status = "Not received yet" (cyan).
2. Edit a "not received yet" bill to add amount + due date → status flips to "Pending".
3. Select bill type with `default_due_day = 31` and month = February → due date clamps to Feb 28.
4. Submit form with missing bill type → validation error.
5. Submit form with missing month → validation error.

## Column Index Reference

### Bills Tab (18 columns, A–R)

| Index | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 |
|-------|---|---|---|---|---|---|---|---|---|---|----|----|----|----|----|----|----|----|
| Column | A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P | Q | R |
| Header | id | bill_type_id | month | amount | due_date | original_due_date | status | paid_date | payment_method | transaction_ref | bill_file_ids | receipt_file_ids | calendar_event_ids | notes | created_at | updated_at | deleted_at | composite_key |
