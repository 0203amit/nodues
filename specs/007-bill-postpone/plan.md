# Implementation Plan: Bill Postpone

**Branch**: `007-bill-postpone` | **Date**: 2026-05-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-bill-postpone/spec.md`

## Summary

Add a "Postpone" action to bills, allowing users to shift a bill's due date with a logged audit trail. The feature comprises: a new PostponeLog service (mirroring the propertiesService pattern), a `postponeBill` function in billsService for the critical path (bill update + log append), a PostponeModal component, a Postpone button on BillCard (gated to pending/overdue), and BillsPage handler orchestration with best-effort calendar reminder replacement. Types are extended with `PostponeLogEntry` and `PostponeFormData`.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, ES2022+

**Primary Dependencies**: React 19, React Router, Tailwind CSS, Lucide React, Google Calendar API v3, Google Sheets API v4

**Storage**: Google Sheets (primary data via Sheets API), Google Calendar (reminder events via Calendar API). No local database.

**Testing**: Manual testing against live Google APIs (no test framework in the project)

**Target Platform**: Mobile-first web app (PWA-capable), primary viewport 375px (iPhone). Runs in any modern browser.

**Project Type**: Single-page web application (React + Vite). No backend server.

**Performance Goals**: Sheet writes + PostponeLog append should complete within 2-3 seconds. Calendar operations are best-effort and additive.

**Constraints**: Critical path = bill update + PostponeLog append. Calendar operations are always best-effort. Single-user app — no concurrent-write protection needed.

**Scale/Scope**: Single household user. Typically 10-30 active bills. PostponeLog rows are infrequent (manual user action).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`constitution.md`) contains only template placeholders — no real principles or gates have been defined. No gates to evaluate. Proceeding with standard engineering practices.

**Post-design re-check**: No violations. The design follows the existing codebase patterns (full-row-safety, propertiesService template for new services, BillsPage handler orchestration, MarkPaidModal template for new modals).

## Project Structure

### Documentation (this feature)

```text
specs/007-bill-postpone/
├── plan.md              # This file
└── spec.md              # Feature specification
```

### Source Code (files to create and modify)

```text
src/
├── types/
│   └── index.ts               # MODIFY: add PostponeLogEntry, PostponeFormData
├── services/
│   ├── postponeLogService.ts   # CREATE: new service (mirror propertiesService pattern)
│   └── billsService.ts         # MODIFY: add postponeBill function
├── components/
│   └── bills/
│       ├── PostponeModal.tsx    # CREATE: new modal component
│       └── BillCard.tsx         # MODIFY: add Postpone action button
└── pages/
    └── BillsPage.tsx            # MODIFY: add postpone state + handler + wiring
```

**Structure Decision**: One new service file (`postponeLogService.ts`) and one new component file (`PostponeModal.tsx`). All other changes extend existing files, following the established project architecture.

## Implementation Design

### Layer 1: Types (src/types/index.ts)

Add two new types at the end of the file:

#### `PostponeLogEntry`

```typescript
export interface PostponeLogEntry {
  _rowIndex: number;
  id: string;
  itemType: string;
  itemId: string;
  fromDate: string;
  toDate: string;
  reason: string;
  postponedBy: string;
  postponedAt: string;
}
```

Fields map to the PostponeLog HEADER_DEFINITIONS columns: `id`, `item_type`, `item_id`, `from_date`, `to_date`, `reason`, `postponed_by`, `postponed_at`. CamelCase in TypeScript, snake_case in the sheet.

#### `PostponeFormData`

```typescript
export interface PostponeFormData {
  newDueDate: string;
  reason: string;
}
```

Collected from the PostponeModal form. `newDueDate` is required YYYY-MM-DD. `reason` is optional (may be empty string).

### Layer 2: PostponeLog Service (src/services/postponeLogService.ts)

New file mirroring the `propertiesService.ts` pattern exactly:

1. **Tab/column setup**: Derive `COL` from `HEADER_DEFINITIONS` for `'PostponeLog'` tab, same as every other service.

2. **`parseRow(row: RowWithIndex): PostponeLogEntry | null`**: Parse a sheet row into a `PostponeLogEntry`. Return `null` if `id` is missing (empty row guard).

3. **`serializeRow(entry: PostponeLogEntry): string[]`**: Convert a `PostponeLogEntry` back into a flat string array matching the column order: `[id, itemType, itemId, fromDate, toDate, reason, postponedBy, postponedAt]`.

4. **`fetchPostponeLog(accessToken, spreadsheetId): Promise<PostponeLogEntry[]>`**: Read all rows via `readAllRows`, parse each with `parseRow`, skip nulls, sort by `postponedAt` descending (most recent first). For future use — not called in Phase 7 but included for completeness per FR-017.

5. **`appendPostponeLog(accessToken, spreadsheetId, entry: Omit<PostponeLogEntry, '_rowIndex'>): Promise<void>`**: Build the row via `serializeRow` (with `_rowIndex: -1` for the call to `serializeRow`) and call `appendRows` to the `'PostponeLog'` tab.

### Layer 3: billsService.ts Extension

Add one new exported function:

#### `postponeBill(accessToken, spreadsheetId, bill: Bill, newDueDate: string, reason: string): Promise<Bill>`

This is the **critical path** function — performs the bill row update + PostponeLog append. Does NOT touch calendar (that's BillsPage's job).

Implementation:

```
1. Compute originalDueDate:
   - If bill.originalDueDate is empty string → set to bill.dueDate (the PREVIOUS due date, capturing on first postpone)
   - If bill.originalDueDate is already populated → preserve it unchanged

2. Build updatedBill: Bill = {
     ...bill,
     dueDate: newDueDate,
     originalDueDate: <computed above>,
     updatedAt: new Date().toISOString(),
   }
   NOTE: status is NOT changed. It stays as-is (will be 'pending'). displayStatus
   recalculates from the new dueDate vs today at render time.

3. await updateRow(accessToken, spreadsheetId, 'Bills', bill._rowIndex, serializeRow(updatedBill))
   Full-row-safety: spreads all existing fields, only overwrites dueDate + originalDueDate + updatedAt.

4. Build PostponeLogEntry:
   - id: uuidv4()
   - itemType: 'bill'
   - itemId: bill.id
   - fromDate: bill.dueDate (the PREVIOUS dueDate, before this postpone)
   - toDate: newDueDate
   - reason: reason.trim() (empty string if not provided)
   - postponedBy: 'user'
   - postponedAt: new Date().toISOString()

5. await appendPostponeLog(accessToken, spreadsheetId, entry)
   If this throws AFTER step 3 succeeded, the bill row already has the new dueDate
   but no log row exists. The function rethrows — BillsPage shows error toast.
   Accepted trade-off per spec (FR-011).

6. Return updatedBill
```

Imports needed: `uuidv4` from `uuid`, `appendPostponeLog` from `./postponeLogService`.

### Layer 4: PostponeModal Component (src/components/bills/PostponeModal.tsx)

New file following the `MarkPaidModal.tsx` pattern:

**Props**:
```typescript
interface PostponeModalProps {
  bill: BillWithDisplay;
  isSaving: boolean;
  onSubmit: (data: PostponeFormData) => void;
  onClose: () => void;
}
```

**Layout** (matches existing modal pattern from MASTER.md section 5.6):

1. **Backdrop**: `fixed inset-0 bg-slate-900/50`, click-to-close (calls `onClose`).
2. **Dialog container**: `bg-white rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto`, stops propagation.
3. **Title**: `<h2>` "Postpone bill"
4. **Context line**: Bill type name, property name, month, amount (same pattern as MarkPaidModal).
5. **Current due date** (read-only): Displayed as formatted text via `formatDueDate(bill.dueDate)`. Not an input.
6. **New due date field**: `<input type="date">`, required. Validation: must be non-empty (inline error "Please enter a new due date.") and valid YYYY-MM-DD format.
7. **Reason field**: `<textarea>`, optional. Placeholder "Optional". Trim before submit.
8. **Action buttons**: Cancel (secondary, left) + Submit "Postpone" (primary, right). Both disabled when `isSaving`. Submit shows `Loader2` spinner when saving.
9. **Escape key**: `useEffect` listener calls `onClose`.

**Validation logic** (local, in the modal):
- `newDueDate` empty → error "Please enter a new due date." → block submit.
- Same-date check is NOT done in the modal — it's handled at BillsPage level (shows info toast, keeps modal open with data preserved).

**Form state**: `useState` for `newDueDate` (initially empty string), `reason` (initially empty string), `errors` (record).

### Layer 5: BillCard Modification

Add a "Postpone" action button to the existing action buttons row.

**New prop**: `onPostpone: (bill: BillWithDisplay) => void` added to `BillCardProps`.

**Button placement**: After the "Mark Paid" button (when visible), before the Paperclip attachments button. This groups the two primary actions (Mark Paid, Postpone) together, followed by informational/secondary actions (Attachments, Bell, Delete).

**Visibility**: Only when `bill.displayStatus === 'pending' || bill.displayStatus === 'overdue'` — same condition as `showMarkPaid`. Use the same `showMarkPaid` variable (or rename to `showActions` if clearer, but reusing is simpler).

**Implementation**:
```tsx
import { CalendarClock } from 'lucide-react';

// In the action buttons row, after the Mark Paid button:
{showMarkPaid && (
  <button
    type="button"
    onClick={() => onPostpone(bill)}
    disabled={isLoading}
    className="text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50
               font-medium text-sm px-2 py-1 rounded transition-colors cursor-pointer
               min-h-11 min-w-11 inline-flex items-center justify-center gap-1
               disabled:opacity-50 disabled:cursor-not-allowed
               focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
    aria-label="Postpone bill"
  >
    <CalendarClock className="w-4 h-4" />
    <span className="hidden sm:inline">Postpone</span>
  </button>
)}
```

Styling matches the existing ghost/text button pattern from MASTER.md (indigo-700 text, indigo-50 hover background). Uses `CalendarClock` from Lucide as specified.

### Layer 6: BillsPage Handler Wiring

#### New State

```typescript
const [postponeTarget, setPostponeTarget] = useState<BillWithDisplay | null>(null);
```

Reuse the existing `isSaving` state (already shared across all modal operations).

#### `handlePostpone(bill: BillWithDisplay)`

Simply sets the target: `setPostponeTarget(bill)`.

#### `handlePostponeSubmit(data: PostponeFormData)`

The main orchestration handler. Flow:

```
1. SAME-DATE GUARD:
   if (data.newDueDate === postponeTarget.dueDate) {
     showToast("New date is the same as the current due date.", "info");
     return;  // Do NOT close modal, do NOT set isSaving
   }

2. setIsSaving(true)

3. CRITICAL PATH (try/catch around entire block):
   try {
     const updated = await postponeBill(
       accessToken!, spreadsheetId, postponeTarget, data.newDueDate, data.reason
     );

4.   BEST-EFFORT CALENDAR (nested try/catch — always after critical path):
     let calendarFailed = false;
     try {
       const oldIds = parseEventIds(postponeTarget.calendarEventIds);
       if (oldIds.length > 0) {
         await cleanupReminders(accessToken!, calendarId, oldIds);
       }

       const billType = billTypes.find(bt => bt.id === postponeTarget.billTypeId);
       if (billType && billType.reminderOffsetsDays.length > 0) {
         const result = await createReminders(
           accessToken!, calendarId, data.newDueDate,
           billType.reminderOffsetsDays, postponeTarget.billTypeName,
           postponeTarget.propertyName, updated.amount, updated.month,
         );
         const withEvents = await setCalendarEventIds(
           accessToken!, spreadsheetId, updated, result.eventIds,
         );
         // Update in-memory state with new calendar event IDs + refreshed displayStatus
         setBills(prev => prev.map(b => b.id === updated.id ? {
           ...b, ...updated,
           calendarEventIds: withEvents.calendarEventIds,
           displayStatus: computeDisplayStatus(updated.status, updated.dueDate),
         } : b));
         if (!result.allSucceeded) {
           showToast("Bill postponed, but some reminders couldn't be set.", 'error');
           calendarFailed = true;
         }
       } else if (oldIds.length > 0) {
         // Had reminders before, type has no offsets now → clear the column
         const cleared = await setCalendarEventIds(
           accessToken!, spreadsheetId, updated, [],
         );
         setBills(prev => prev.map(b => b.id === updated.id ? {
           ...b, ...updated,
           calendarEventIds: cleared.calendarEventIds,
           displayStatus: computeDisplayStatus(updated.status, updated.dueDate),
         } : b));
       } else {
         // No old events, no offsets → just update in-memory bill
         setBills(prev => prev.map(b => b.id === updated.id ? {
           ...b, ...updated,
           displayStatus: computeDisplayStatus(updated.status, updated.dueDate),
         } : b));
       }
     } catch {
       showToast("Bill postponed, but calendar reminders couldn't be updated.", 'error');
       calendarFailed = true;
       // Still update in-memory bill (critical path succeeded)
       setBills(prev => prev.map(b => b.id === updated.id ? {
         ...b, ...updated,
         displayStatus: computeDisplayStatus(updated.status, updated.dueDate),
       } : b));
     }

5.   CLOSE MODAL + SUCCESS TOAST:
     setPostponeTarget(null);
     if (!calendarFailed) {
       showToast('Bill postponed.', 'success');
     }

   } catch {
6.   CRITICAL PATH FAILED:
     showToast('Failed to postpone bill.', 'error');
   } finally {
     setIsSaving(false);
   }
```

#### Render PostponeModal

```tsx
{postponeTarget && (
  <PostponeModal
    bill={postponeTarget}
    isSaving={isSaving}
    onSubmit={handlePostponeSubmit}
    onClose={() => !isSaving && setPostponeTarget(null)}
  />
)}
```

#### Pass onPostpone to BillCard

```tsx
<BillCard
  key={bill.id}
  ref={registerBillRef(bill.id)}
  bill={bill}
  onMarkPaid={handleMarkPaid}
  onPostpone={handlePostpone}      // NEW
  onEdit={handleEdit}
  onViewAttachments={handleViewAttachments}
  onDelete={handleDelete}
  isLoading={isSaving}
/>
```

### Cross-Cutting Concerns

#### Toast Messages

| Scenario | Message | Severity |
|----------|---------|----------|
| Success (no calendar issues) | "Bill postponed." | success |
| Success + calendar failure | "Bill postponed, but calendar reminders couldn't be updated." | error |
| Success + partial calendar failure | "Bill postponed, but some reminders couldn't be set." | error |
| Critical path failure | "Failed to postpone bill." | error |
| Same-date no-op | "New date is the same as the current due date." | info |

#### Full-Row-Safety

`postponeBill` uses the `updateRow` pattern (spread `...bill`, overwrite target fields, write full row). This is identical to `updateBill`, `markBillPaid`, `addFileIdToBill`, and `setCalendarEventIds`.

#### original_due_date Capture Logic

The capture-on-first-postpone rule:
- `if (!bill.originalDueDate)` → set to `bill.dueDate` (the **previous** due date being replaced)
- If already set → preserve unchanged (pinned to the very first due date ever assigned)

This happens inside `postponeBill`, not in the modal or handler.

#### displayStatus Refresh

After the in-memory bill update in `setBills`, `displayStatus` is recomputed via `computeDisplayStatus(updated.status, updated.dueDate)`. This ensures an overdue bill that gets postponed to a future date immediately shows as "pending" without a page reload.

## Implementation Chunks

### Chunk 1: Types + PostponeLog Service

**Files**: `src/types/index.ts`, `src/services/postponeLogService.ts`

**Deliverables**:
- `PostponeLogEntry` and `PostponeFormData` types in `index.ts`
- Complete `postponeLogService.ts`: COL derivation, `parseRow`, `serializeRow`, `fetchPostponeLog`, `appendPostponeLog`

**Dependencies**: None (uses existing schema.ts HEADER_DEFINITIONS, sheetsService, types)

### Chunk 2: billsService.ts Extension

**Files**: `src/services/billsService.ts`

**Deliverables**:
- `postponeBill` function: full-row-safety bill update + PostponeLog append
- Import of `appendPostponeLog` from `postponeLogService`

**Dependencies**: Chunk 1 (PostponeLogEntry type + appendPostponeLog function)

### Chunk 3: PostponeModal Component

**Files**: `src/components/bills/PostponeModal.tsx`

**Deliverables**:
- Complete PostponeModal component following MarkPaidModal pattern
- Props: `{ bill, isSaving, onSubmit, onClose }`
- Local validation (newDueDate required)
- Escape key close, backdrop close, save-in-progress blocking

**Dependencies**: Chunk 1 (PostponeFormData type), billsService.ts (formatDueDate)

### Chunk 4: BillCard + BillsPage Wiring

**Files**: `src/components/bills/BillCard.tsx`, `src/pages/BillsPage.tsx`

**Deliverables**:
- CalendarClock Postpone button on BillCard (gated to pending/overdue)
- `onPostpone` prop added to BillCardProps
- `postponeTarget` state + `handlePostpone` + `handlePostponeSubmit` in BillsPage
- Best-effort calendar replacement logic in handler
- PostponeModal rendered when `postponeTarget` is set
- `onPostpone` passed to every `<BillCard>`

**Dependencies**: Chunks 1-3 (all prior chunks)

## Complexity Tracking

No constitution violations to justify. The implementation extends existing patterns without introducing new abstractions, dependencies, or architectural layers. One new service file follows the exact pattern of existing services. One new modal follows the exact pattern of existing modals.
