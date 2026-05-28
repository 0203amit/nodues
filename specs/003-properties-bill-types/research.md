# Research: Properties & Bill Types Management

**Feature**: 003-properties-bill-types | **Date**: 2026-05-28

## R1: Row-Index Tracking for Sheet Updates

**Decision**: Read all rows via `readValues`, track each data row's 1-based Sheet index (header = row 1, first data row = row 2), and use `writeValues` with range `'TabName'!A{n}:{lastCol}{n}` to update individual rows.

**Rationale**: The Google Sheets API does not support updating by a "where" clause or row ID — it requires explicit A1-notation ranges. By pairing each parsed row with its Sheet row index at read time, we avoid re-scanning to find the row before every update. The existing `writeValues(accessToken, spreadsheetId, range, values)` function already supports arbitrary range writes, so no new Sheets API surface is needed.

**Implementation**: A new `readAllRows` helper in `sheetsService.ts` reads `'TabName'!A2:{lastCol}` (skipping header), returns `Array<{ rowIndex: number; values: string[] }>` where `rowIndex` is the 1-based Sheet row number (data rows start at index 2). An `updateRow` helper constructs the range `'TabName'!A{rowIndex}:{lastCol}{rowIndex}` and calls `writeValues`.

**Alternatives considered**:
- Re-read + linear scan on every update: wasteful, adds latency, stale-data risk between read and write.
- Store rows in a Map by ID and re-derive index from position: fragile if rows are deleted between reads.

## R2: Toast / Snackbar Notification System

**Decision**: Build a lightweight `ToastProvider` + `useToast()` hook. Toasts render as a fixed-bottom container. Two variants: (1) standard toast (success/error, auto-dismiss 4s), (2) undo snackbar (10s timer, action button, used for soft-delete).

**Rationale**: The codebase currently has no notification system — only `ErrorBanner` for auth errors. The spec requires error toasts (FR-032), success feedback, and undo snackbars (FR-015, FR-022). A context-based provider matches the existing pattern (AuthContext, BootstrapContext). Keeping toasts decoupled from pages lets any component trigger a notification.

**Implementation**: `ToastContext.tsx` manages a toast queue. `useToast()` returns `{ showToast, showUndo }`. The undo snackbar variant includes a countdown timer and an action callback. Toasts stack from the bottom, auto-dismiss, and can be manually dismissed. Follows MASTER.md section 5.7 (colors, positioning, timing).

**Alternatives considered**:
- Third-party library (react-hot-toast, sonner): adds dependency for a simple feature; styling would conflict with MASTER.md.
- Per-page local state for toasts: causes duplication and prevents showing toasts across navigations.

## R3: Optimistic Delete with Rollback

**Decision**: On soft-delete confirmation, immediately remove the item from local state, start the Sheet write, and show an undo snackbar with a 10-second timer. If the write fails, reinsert the item and show an error toast. If undo is tapped, clear `deleted_at` in the Sheet and reinsert the item.

**Rationale**: The spec explicitly requires optimistic UI (FR-033) — the item disappears before the API call completes. This gives instant feedback. Rollback on failure ensures consistency.

**Implementation flow**:
1. User confirms delete → save a snapshot of the item → remove from local list → fire `softDelete()` API call → show undo snackbar.
2. If API succeeds: no further action; snackbar expires naturally.
3. If API fails: reinsert item at original position → show error toast → cancel snackbar.
4. If undo tapped (within 10s): fire `undoSoftDelete()` API call → reinsert item → dismiss snackbar.
5. If undo API fails: show error toast (item remains deleted in UI since the original delete write may have succeeded).

**Alternatives considered**:
- Non-optimistic (wait for API before removing): slower UX, spec explicitly rejects this.
- Two-phase commit: overkill for a single-user household app.

## R4: Extending sheetsService.ts vs. Creating a New Service

**Decision**: Add new functions directly to `sheetsService.ts`: `readAllRows`, `updateRow`, `updateCell`, `softDelete`, `undoSoftDelete`. Also create a domain-specific service layer (`propertiesService.ts`, `billTypesService.ts`) that wraps these with parsing, validation, and type safety.

**Rationale**: The spec (NFR-003) mandates reusing `sheetsService.ts`. The generic Sheet helpers (readAllRows, updateRow, updateCell) belong in the service layer since they're reusable across tabs. Domain services (property/billType specific) handle parsing raw string arrays into typed objects, column index mapping via `HEADER_DEFINITIONS`, UUID generation, and timestamp formatting.

**Alternatives considered**:
- Everything in sheetsService.ts: mixes generic Sheet operations with domain logic.
- Separate CRUD service per entity without shared helpers: duplicates the row-index and range-construction logic.

## R5: Form Modal vs. Inline Form vs. Separate Page

**Decision**: Use modal dialogs for Add and Edit forms. The list page stays visible behind the modal backdrop.

**Rationale**: MASTER.md section 5.6 defines the modal pattern. Modals keep the user in context (they can see the list behind the backdrop), avoid navigation complexity, and match the "calm utility app" design philosophy. The forms are small (3-5 fields for properties, 6-7 for bill types) — they fit comfortably in a `max-w-md` modal.

**Alternatives considered**:
- Separate page per form: heavier navigation, loses list context.
- Inline expansion: complex layout management, risk of pushing content off screen.

## R6: Column Index Derivation from HEADER_DEFINITIONS

**Decision**: Derive column indices at runtime from `HEADER_DEFINITIONS` using `headers.indexOf(fieldName)`. Build a helper `getColumnIndex(tabName, fieldName)` that looks up the position. Use `columnLetter()` from `googleApi.ts` to convert to A1 notation when needed.

**Rationale**: The spec and NFR-003/NFR-004 require using `HEADER_DEFINITIONS` for column ordering. Hardcoding column positions (e.g., "column C is always address") is fragile. Runtime lookup from the schema is the correct approach.

**Implementation**: A `columnMap` utility creates `Record<string, number>` from a header array, mapping field names to 0-based indices. Domain services use this map to parse `string[]` rows into typed objects and to construct row arrays for writes.

## R7: Routing — Nested Routes Under /settings

**Decision**: Convert the current flat `/settings` route into a parent route with nested children: `/settings` (hub), `/settings/properties`, `/settings/bill-types`. The hub becomes a layout route with `<Outlet />` for sub-pages.

**Rationale**: React Router 6 supports nested routes natively. The Settings hub at `/settings` (index route) renders navigation cards. Sub-pages render inside the same layout. This avoids duplicating the page wrapper and keeps all settings routes under the BootstrapGuard.

**Implementation**: In `App.tsx`, replace the single `/settings` route with a nested `<Route path="/settings">` containing an index route (hub) and child routes for `properties` and `bill-types`. The Navbar's Settings link continues to point to `/settings`.
