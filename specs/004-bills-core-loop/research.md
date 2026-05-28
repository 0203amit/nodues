# Research: Bills Core Loop

**Feature**: 004-bills-core-loop | **Date**: 2026-05-28

## R1: Duplicate Detection Strategy — Client-side vs Sheet Query

**Decision**: Check duplicates against the already-loaded bills list in memory (client-side O(n) scan on `compositeKey`) rather than issuing a separate Sheet read.

**Rationale**: The Bills page already fetches all non-deleted bills on mount. The composite_key is stored on each row. A simple `Array.find()` on the in-memory list is instant and avoids a redundant API call. The `checkDuplicate` function is a pure function that takes the current bills array and the candidate composite_key, returning the matching bill or null.

**Alternatives considered**:
- Separate Sheet read on every add: adds latency (1-2s per check), wastes quota, and the data is already in memory.
- Server-side uniqueness constraint: Google Sheets has no unique constraint mechanism.

**Trade-off**: If another family member adds a bill between the page load and the save attempt, the client won't detect it. This is acceptable for a 1-4 person household app where simultaneous bill entry for the exact same property/type/month is extremely unlikely. The composite_key stored in the Sheet is the source of truth — even if a duplicate slips through, it can be identified later.

## R2: Status Computation — Stored vs Computed

**Decision**: Store a status enum (`not_yet_generated`, `pending`, `paid`, `skipped`) in the Sheet. Compute the display status (`overdue` = pending + past due) at render time. "Overdue" is never stored — it's derived from `status === 'pending' && due_date < today`.

**Rationale**: Storing "overdue" would require daily batch updates to flip pending → overdue as due dates pass, which is impossible without a backend. Computing it at render time is trivial (one date comparison) and always reflects the current state.

**Implementation**: A `computeDisplayStatus(status, dueDate, today?)` pure function returns the display status. It accepts an optional `today` parameter for testability.

## R3: Composite Key Computation — Including property_id

**Decision**: The composite_key format is `property_id|bill_type_id|month`. The property_id is resolved from the selected bill type's `property_id` field, not entered by the user.

**Rationale**: The spec defines uniqueness as one bill per (property_id, bill_type_id, month). Including property_id in the key (rather than just bill_type_id + month) handles the theoretical case where two different properties have bill types with the same name. The `|` separator is safe because UUIDs and YYYY-MM strings never contain `|`.

**Implementation**: When adding or editing a bill, the service resolves the bill type's `property_id` and constructs the composite_key before writing the row.

## R4: Due Date Auto-Computation and Month Clamping

**Decision**: When the user selects both a bill type and a month, the due date is auto-computed as `YYYY-MM-DD` using the bill type's `default_due_day`, clamped to the last day of the selected month.

**Rationale**: The user should not need to manually calculate due dates. Pre-filling saves time and reduces errors. Clamping is necessary because months have different lengths (e.g., February has 28-29 days, but a bill type might have `default_due_day = 31`).

**Implementation**: Use `new Date(year, month, 0).getDate()` to get the last day of the month (where month is 1-based). If `default_due_day > lastDay`, use `lastDay`. Construct `YYYY-MM-DD` string. This computation runs in the form component whenever bill type or month changes, but only if the user hasn't manually edited the due date (tracked via a `userEditedDueDate` flag).

## R5: Full-Row Safety Pattern for Bill Updates

**Decision**: All bill updates (edit, mark paid) use the same full-row-safety pattern from Phase 3: read the existing bill's full row, modify only the target fields, write the complete row back.

**Rationale**: The Bills tab has 18 columns, many of which are out of scope for this phase (bill_file_ids, receipt_file_ids, calendar_event_ids). If we only wrote the editable columns, the other columns would be blanked out. The full-row write preserves all values — including future-phase columns that may have been populated by then.

**Implementation**: `serializeRow(bill: Bill)` converts the full Bill object to a string array. Update functions start with the existing bill object (which holds all current values), modify specific fields, then serialize and write the full row. This mirrors the pattern in `propertiesService.ts` and `billTypesService.ts`.

## R6: Sort Order for Bills List

**Decision**: Sort bills by urgency: overdue first (oldest due date first), then pending (soonest due date first), then not_yet_generated (by month ascending), then paid (most recently paid first), then skipped.

**Rationale**: The owner's primary concern is "what needs attention now?" Overdue bills are the most urgent (missed payments). Pending bills with approaching due dates are next. Paid bills are resolved and less important. This sort order surfaces actionable items at the top of the list.

**Implementation**: A sort comparator assigns a priority number to each display status (overdue=0, pending=1, not_yet_generated=2, paid=3, skipped=4), then sorts by priority, then by the relevant date within each group.

## R7: Filtering — Property and Month

**Decision**: Provide two filter dropdowns at the top of the bills list: one for property and one for month. Both default to "All". Filters are client-side (no additional Sheet reads).

**Rationale**: The owner manages 2-4 properties. Filtering by property quickly narrows to relevant bills. Filtering by month shows a single billing cycle. Both filters operate on the already-loaded data — no additional API calls needed.

**Implementation**: Extract distinct property IDs/names and months from the loaded bills. Render `<select>` dropdowns. Apply filters before rendering the list. Filters are AND-combined (property AND month).

## R8: Form Modal Pattern — Reuse vs New

**Decision**: Create new modal components (`BillFormModal`, `MarkPaidModal`, `DuplicateWarningModal`) following the same structural pattern as `PropertyFormModal` and `BillTypeFormModal` from Phase 3.

**Rationale**: The bill forms have different fields and behaviors (pre-fill from bill type, month picker, read-only bill type on edit) that warrant their own components. However, the modal shell (backdrop, panel, Escape key, button styles) follows the identical MASTER.md pattern. Code reuse is at the pattern level, not the component level.

## R9: BillCard Component — Following MASTER.md Section 11 Reference

**Decision**: Implement the BillCard component based on the BillRow reference in MASTER.md section 11, adapting it to include action buttons (Mark Paid, Edit, Delete) alongside the status badge and amount.

**Rationale**: MASTER.md provides a tested, accessible reference implementation for the bill list item. Adding action buttons follows the same pattern as PropertyCard and BillTypeCard from Phase 3 (inline ghost buttons with Lucide icons).

**Implementation**: The MASTER.md BillRow is a `<button>` navigating to a detail page. Since there's no detail page in Phase 4, the card will be a `<div>` with action buttons in a row at the bottom. The visual layout (Receipt icon + name/property/month on the left, amount + status badge on the right) follows the reference exactly.

## R10: No New sheetsService Extensions Needed

**Decision**: The existing `sheetsService.ts` functions (`readAllRows`, `updateRow`, `updateCell`, `appendRows`) are sufficient for all Bills operations. No new generic Sheet helpers are needed.

**Rationale**: Phase 3 already added all the generic Sheet operations needed. The Bills service layer (`billsService.ts`) will call these existing functions with the `'Bills'` tab name. The only new code is in the domain service (`billsService.ts`) for parsing, serializing, and enriching bill data.

## R11: BillStatusBadge — New Component vs Extending StatusBadge

**Decision**: Create a new `BillStatusBadge` component in `src/components/shared/` rather than extending the existing `StatusBadge`.

**Rationale**: The existing `StatusBadge` handles two states (active/inactive) with a boolean prop. The bill status badge has five states, each with a unique color, icon, and label. Extending `StatusBadge` would make its interface awkward (two entirely different prop shapes). A separate component keeps both clean and focused.

**Alternatives considered**:
- Extend StatusBadge with a `variant` prop: Would mix unrelated concerns (entity active/inactive vs. bill payment status). Rejected.
- Generic Badge component: Over-engineering for the current scope. The two badge components are small (~15 lines each). Rejected.

## R12: Month Input — Native `type="month"` vs Custom

**Decision**: Use native `<input type="month">` which renders as "YYYY-MM" and provides a built-in month picker on supported browsers.

**Rationale**: `type="month"` is supported on Chrome, Edge, and mobile browsers (our primary targets). It returns "YYYY-MM" format directly, matching the `month` column format in the Sheet. No date library needed.

**Alternatives considered**:
- Custom dropdown with month/year selectors: More code, no benefit over native. Rejected.
- Text input with pattern validation: Worse UX. Rejected.

## R13: "Open Existing" Scroll Behavior

**Decision**: Use a `useRef<Map<string, HTMLDivElement>>` in `BillsPage` to store refs for each BillCard. On "Open existing", close the modal and call `scrollIntoView({ behavior: 'smooth', block: 'center' })` on the matching bill's ref.

**Rationale**: React refs are the standard way to imperatively scroll to elements. A Map keyed by bill ID allows O(1) lookup. The ref callback pattern works well with list rendering.

**Alternatives considered**:
- URL hash fragment: Would require full page navigation machinery. Rejected.

## R14: Refetch After Add — Why Not Optimistic Insert

**Decision**: Refetch all bills after add (same pattern as Phase 3's `addBillType`).

**Rationale**: After `appendRows`, the new row's `_rowIndex` is unknown. Since `_rowIndex` is needed for subsequent `updateRow`/`updateCell` calls (edit, mark paid, delete), we must refetch to get the correct row index. This is consistent with the Phase 3 pattern. The extra 1-2 second latency is acceptable for an add operation.

**Alternatives considered**:
- Optimistic insert with estimated rowIndex: Fragile — another tab could have added rows. Rejected.
- Read only the last row after append: Sheets API doesn't return the appended row index reliably. Rejected.
