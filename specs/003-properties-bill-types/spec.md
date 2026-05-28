# Feature Specification: Properties & Bill Types Management

**Feature Branch**: `003-properties-bill-types`

**Created**: 2026-05-28

**Status**: Draft

**Input**: User description: "Properties and Bill Types Management (CRUD) — Phase 3 of the Build Order. Settings pages for managing properties (list, add, edit, toggle active, soft-delete with undo) and bill types (list grouped by property, add, edit, toggle active, soft-delete with undo). All reads/writes go to the user's bootstrapped Google Sheet. Follows MASTER.md design system."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Owner views and manages properties (Priority: P1)

The owner navigates to Settings → Properties and sees all non-deleted properties in a list. They can add a new property, edit an existing one, toggle a property between active and inactive, and soft-delete a property (which hides it from the list with a brief undo option).

**Why this priority**: Properties are the top-level entity. Bill types are scoped to properties, and bills are scoped to bill types. Without property management, the owner cannot configure the system beyond the initial seed data.

**Independent Test**: Navigate to `/settings/properties` after bootstrapping. Verify seed properties are listed. Add a new property, edit it, toggle its active status, and soft-delete it. Confirm each action persists to the Google Sheet by reading the Properties tab.

**Acceptance Scenarios**:

1. **Given** the owner has completed bootstrapping (3 seed properties exist), **When** they navigate to Settings → Properties, **Then** they see a list of all properties where `deleted_at` is empty: "Mira Shop", "Mira Flat", "Chawl" — each showing name, address (if any), and an active/inactive badge.
2. **Given** the owner is on the Properties page, **When** they tap "Add Property", **Then** a form appears with fields: name (required), address (optional), notes (optional). Submitting creates a new row in the Properties tab with a UUID, `active = true`, `created_at = now`, and empty `deleted_at`.
3. **Given** the owner is on the Properties page, **When** they tap edit on an existing property, **Then** a form appears pre-filled with the property's current name, address, and notes. Saving overwrites those columns in the Sheet for that row.
4. **Given** a property is currently active, **When** the owner taps the active/inactive toggle, **Then** the `active` field in the Sheet is updated to `false` and the property shows an "Inactive" badge. The reverse (inactive → active) also works.
5. **Given** the owner taps delete on a property, **When** a confirmation is shown and confirmed, **Then** the `deleted_at` column is set to the current ISO timestamp. The property disappears from the list immediately. An undo snackbar appears for 10 seconds. If the owner taps "Undo", the `deleted_at` is cleared and the property reappears.
6. **Given** a property has been soft-deleted (deleted_at is set), **When** the owner reloads the Properties page, **Then** the deleted property does not appear in the list.
7. **Given** the owner attempts to add a property with an empty name, **When** they submit the form, **Then** validation prevents submission and an error message is shown below the name field.

---

### User Story 2 - Owner views and manages bill types (Priority: P1)

The owner navigates to Settings → Bill Types and sees all non-deleted bill types, showing which property each belongs to. They can add a new bill type linked to an active property, edit an existing one, toggle active/inactive, and soft-delete with undo.

**Why this priority**: Bill types define the categories of bills per property. Without bill type management, the owner cannot add new kinds of bills (e.g., "Water" or "Gas") or modify the defaults that pre-fill the Add Bill form in Phase 4.

**Independent Test**: Navigate to `/settings/bill-types` after bootstrapping. Verify seed bill types are listed with their property names. Add a new bill type for an existing property, edit it, toggle its active status, and soft-delete it. Confirm each action persists to the Google Sheet by reading the BillTypes tab.

**Acceptance Scenarios**:

1. **Given** bootstrapping seeded 5 bill types across 3 properties, **When** the owner navigates to Settings → Bill Types, **Then** they see all bill types where `deleted_at` is empty, each displaying: name, property name (resolved from property_id), frequency, default amount (if set), default due day (if set), and an active/inactive badge.
2. **Given** the owner is on the Bill Types page, **When** they tap "Add Bill Type", **Then** a form appears with fields: property (dropdown of active, non-deleted properties — required), name (required), default amount (optional, numeric), default due day (1–31, optional), frequency (dropdown: monthly/quarterly/annual/one-time, required), reminder offsets (comma-separated integers, optional, defaults to empty). Submitting creates a new row in BillTypes with a UUID, `active = true`, `created_at = now`, and empty `deleted_at`.
3. **Given** the owner is on the Bill Types page, **When** they tap edit on a bill type, **Then** a form appears pre-filled with all current values including the property (shown but not editable — property_id is immutable after creation). Saving overwrites the editable columns in the Sheet for that row.
4. **Given** a bill type is currently active, **When** the owner taps the active/inactive toggle, **Then** the `active` field updates in the Sheet. An "Inactive" badge is shown. Toggling back to active also works.
5. **Given** the owner soft-deletes a bill type, **Then** `deleted_at` is set, the item disappears from the list, an undo snackbar appears for 10 seconds, and undo clears the `deleted_at`.
6. **Given** only one property is active, **When** the owner adds a bill type, **Then** the property dropdown only shows that one active property (inactive and deleted properties are excluded).
7. **Given** the owner enters a `default_due_day` of 0 or 32, **When** they submit, **Then** validation prevents submission with a message "Day must be between 1 and 31."
8. **Given** the owner enters `reminder_offsets_days` as "7,abc,1", **When** they submit, **Then** validation prevents submission with a message indicating offsets must be comma-separated integers.

---

### User Story 3 - Loading and error states for Sheet operations (Priority: P2)

All reads from and writes to the Google Sheet show appropriate loading indicators and handle errors gracefully, so the owner is never left wondering if an action succeeded.

**Why this priority**: Network calls to the Sheets API can take 1-3 seconds. Without loading states the UI would appear frozen. Without error handling a failed write could silently lose data.

**Independent Test**: Observe the UI during page load (data fetch), during form submission (write), and during delete/toggle (write). Verify a loading spinner is shown during each operation. Simulate an API error (e.g., revoke token) and verify an error toast appears.

**Acceptance Scenarios**:

1. **Given** the owner navigates to Settings → Properties, **When** the data is being fetched from the Sheet, **Then** a loading skeleton or spinner is shown in the list area.
2. **Given** the owner submits a form (add or edit), **When** the Sheet write is in progress, **Then** the submit button shows a loading state (disabled, with spinner) and the form cannot be re-submitted.
3. **Given** a Sheet read or write fails (network error, expired token, API error), **Then** an error toast appears with a human-readable message (e.g., "Could not save property. Please try again.") and the UI remains in a usable state (no blank screen, no stuck spinner).
4. **Given** a soft-delete write fails, **Then** the item reappears in the list (optimistic removal is reverted) and an error toast explains the failure.

---

### User Story 4 - Settings hub navigation (Priority: P2)

The Settings page at `/settings` serves as a hub linking to sub-pages. The owner can navigate between Settings → Properties and Settings → Bill Types via the hub or directly via URL.

**Why this priority**: The Settings page needs structure before individual sub-pages can be reached. The hub provides a clear entry point with future expansion slots for Notifications, Preferences, Recycle Bin, etc.

**Independent Test**: Navigate to `/settings` and verify links to Properties and Bill Types are present and functional. Navigate directly to `/settings/properties` via URL and verify the page loads correctly.

**Acceptance Scenarios**:

1. **Given** the owner taps "Settings" in the navbar, **When** the Settings page loads, **Then** they see a list of settings sections as navigable cards/links, including at minimum: "Properties" and "Bill Types". Future items (Notifications, Preferences, Recycle Bin, etc.) may be shown as disabled or "Coming soon".
2. **Given** the owner taps the "Properties" card on the Settings hub, **Then** they navigate to `/settings/properties`.
3. **Given** the owner taps the "Bill Types" card on the Settings hub, **Then** they navigate to `/settings/bill-types`.
4. **Given** the owner navigates directly to `/settings/properties` via the browser URL bar, **Then** the Properties management page loads correctly (no dependency on navigating through the hub first).

---

### Edge Cases

- What happens if the owner tries to delete a property that has bill types linked to it? The property is soft-deleted regardless — bill types retain their `property_id` reference. The bill types under the deleted property remain visible and editable on the Bill Types page (they show the deleted property's name grayed out or with a note). This matches the spec's pattern of soft-delete preserving history.
- What happens if the owner deactivates a property? The property is excluded from the "Add Bill Type" property dropdown (only active properties are shown there). Existing bill types under the inactive property remain visible and editable. The property still appears on the Properties list with an "Inactive" badge.
- What happens if all properties are deleted or inactive? The "Add Bill Type" form shows an empty property dropdown with a message like "No active properties. Add a property first." The form cannot be submitted.
- What happens if two browser tabs write to the same property simultaneously? The last write wins (Google Sheets API overwrites the cell range). This is an acceptable trade-off for a 1–4 person household app. No conflict detection or locking is needed.
- What happens if the Sheet has rows with malformed data (e.g., missing UUID, invalid active flag)? The UI gracefully skips or displays the row with a warning indicator. It does not crash or hide all data due to one bad row.
- What happens if the undo timer expires and then the Sheet write fails? The item remains soft-deleted in memory. The next page load re-fetches from the Sheet. If the write actually succeeded before the error response arrived, the item stays deleted. If the write truly failed, the item would still appear (since `deleted_at` was never persisted). Either outcome is consistent.

## Requirements *(mandatory)*

### Functional Requirements

#### Service Layer

- **FR-001**: The service layer MUST provide a function to read all rows from the Properties tab, parse them into typed objects, and filter out rows where `deleted_at` is not empty.
- **FR-002**: The service layer MUST provide a function to read all rows from the BillTypes tab, parse them into typed objects, filter out soft-deleted rows, and resolve each bill type's `property_id` to the property's name for display.
- **FR-003**: The service layer MUST provide a function to append a new row to the Properties tab with fields: id (UUID v4), name, address, notes, active (`true`), created_at (ISO 8601), deleted_at (empty).
- **FR-004**: The service layer MUST provide a function to append a new row to the BillTypes tab with fields: id (UUID v4), property_id, name, default_amount, default_due_day, frequency, reminder_offsets_days, active (`true`), created_at (ISO 8601), deleted_at (empty).
- **FR-005**: The service layer MUST provide a function to update a specific row in the Properties tab, identified by its row index (discovered during the read operation). Editable fields: name, address, notes.
- **FR-006**: The service layer MUST provide a function to update a specific row in the BillTypes tab, identified by its row index. Editable fields: name, default_amount, default_due_day, frequency, reminder_offsets_days.
- **FR-007**: The service layer MUST provide a function to update the `active` field of a row in either tab (toggle active/inactive).
- **FR-008**: The service layer MUST provide a function to soft-delete a row by setting `deleted_at` to the current ISO 8601 timestamp. This works for both Properties and BillTypes.
- **FR-009**: The service layer MUST provide a function to undo a soft-delete by clearing the `deleted_at` field (setting it back to empty).
- **FR-010**: All service functions MUST accept the `accessToken` and `spreadsheetId` from the BootstrapContext (via `useBootstrap().setupResult`).

#### Properties UI

- **FR-011**: The Properties page (`/settings/properties`) MUST display a list of all non-deleted properties fetched from the Sheet. Each list item shows: property name, address (if present), notes (if present), and an active/inactive status badge.
- **FR-012**: The Properties page MUST provide an "Add Property" button that opens a form (modal or inline) with fields: name (required, text), address (optional, text), notes (optional, textarea).
- **FR-013**: The Properties page MUST provide an edit action per property that opens a form pre-filled with the property's current values. The form allows editing name, address, and notes.
- **FR-014**: The Properties page MUST provide an active/inactive toggle per property. Tapping it immediately writes the new active state to the Sheet.
- **FR-015**: The Properties page MUST provide a delete action per property that shows a confirmation step. On confirmation, it writes `deleted_at` to the Sheet, removes the property from the displayed list (optimistically), and shows an undo snackbar for 10 seconds.
- **FR-016**: The undo snackbar MUST restore the property by clearing `deleted_at` in the Sheet and reinserting the property into the displayed list.

#### Bill Types UI

- **FR-017**: The Bill Types page (`/settings/bill-types`) MUST display all non-deleted bill types. Each item shows: bill type name, property name (resolved from `property_id`), frequency, default amount (if set), default due day (if set), reminder offsets (if set), and active/inactive badge.
- **FR-018**: The Bill Types page MUST provide an "Add Bill Type" button that opens a form with fields: property (dropdown of active, non-deleted properties — required), name (required), default amount (optional, numeric ≥ 0), default due day (optional, integer 1–31), frequency (required, select: monthly / quarterly / annual / one-time), reminder offsets (optional, comma-separated positive integers).
- **FR-019**: The property dropdown in the Add Bill Type form MUST only show properties that are both active and non-deleted.
- **FR-020**: The Bill Types page MUST provide an edit action per bill type. The edit form pre-fills all current values. The property field is displayed as read-only (property_id is immutable after creation). Editable fields: name, default amount, default due day, frequency, reminder offsets.
- **FR-021**: The Bill Types page MUST provide an active/inactive toggle per bill type that immediately writes to the Sheet.
- **FR-022**: The Bill Types page MUST provide a soft-delete action per bill type with confirmation, optimistic removal, and a 10-second undo snackbar (same pattern as properties).

#### Settings Hub

- **FR-023**: The Settings page (`/settings`) MUST display navigable links to at minimum: "Properties" (`/settings/properties`) and "Bill Types" (`/settings/bill-types`).
- **FR-024**: The router MUST define routes for `/settings`, `/settings/properties`, and `/settings/bill-types`. All are protected routes within the BootstrapGuard.

#### Validation

- **FR-025**: Property name MUST be non-empty. Form submission is blocked with a validation message if empty.
- **FR-026**: Bill type name MUST be non-empty. Property and frequency MUST be selected. Form submission is blocked if these are missing.
- **FR-027**: Default due day, if provided, MUST be an integer between 1 and 31 inclusive.
- **FR-028**: Reminder offsets, if provided, MUST be a comma-separated list of positive integers (e.g., "7,3,1"). Whitespace around commas is tolerated. Non-integer or negative values are rejected with a validation message.
- **FR-029**: Default amount, if provided, MUST be a non-negative number.

#### Cross-Cutting

- **FR-030**: All list views MUST show a loading skeleton or spinner while the initial Sheet read is in progress.
- **FR-031**: All write operations (add, edit, toggle, delete, undo) MUST show a loading state on the triggering control (e.g., disabled button with spinner) while the Sheet write is in progress.
- **FR-032**: All Sheet operation failures MUST display an error toast with a human-readable message. The UI MUST NOT crash or become unusable.
- **FR-033**: Soft-delete operations MUST use optimistic UI: the item disappears from the list immediately, before the Sheet write completes. If the write fails, the item reappears and an error toast is shown.
- **FR-034**: The bill types list MUST show bill types grouped by property or with the property name displayed alongside each bill type, so the owner can easily see which bill types belong to which property.

### Non-Functional Requirements

- **NFR-001**: All UI MUST follow MASTER.md: indigo-700 primary, IBM Plex Sans, Lucide icons, slate neutrals, rounded-lg corners, 44px touch targets, WCAG AA contrast, visible focus rings, no emoji as icons, no gradients, no heavy shadows.
- **NFR-002**: All pages MUST be responsive and mobile-first, tested at 375px width.
- **NFR-003**: The `sheetsService.ts` from Phase 2 MUST be reused for read/write operations. New helper functions (e.g., `updateRow`, `softDelete`) should extend the service layer, not duplicate it.
- **NFR-004**: Data types (Property, BillType) MUST be defined as TypeScript interfaces in a shared location (e.g., `src/types/` or alongside the service).
- **NFR-005**: The Properties and Bill Types pages MUST set `document.title` appropriately (e.g., "NoDues · Properties", "NoDues · Bill Types").

### Key Entities

- **Property**: A real-world property the owner manages. Columns: id, name, address, notes, active, created_at, deleted_at. Lives in the Properties tab.
- **BillType**: A category of bill scoped to a specific property. Columns: id, property_id, name, default_amount, default_due_day, frequency, reminder_offsets_days, active, created_at, deleted_at. Lives in the BillTypes tab.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After navigating to `/settings/properties`, all 3 seed properties are displayed within 3 seconds (Sheet read + render).
- **SC-002**: Adding a new property via the form results in a new row in the Properties tab with correct UUID, active flag, and timestamp. The new property appears in the list without a page reload.
- **SC-003**: Editing a property's name/address/notes persists the changes to the Sheet. Reloading the page shows the updated values.
- **SC-004**: Toggling a property's active flag persists to the Sheet immediately. The badge updates without a page reload.
- **SC-005**: Soft-deleting a property sets `deleted_at` in the Sheet. The property disappears from the list. Tapping "Undo" within 10 seconds clears `deleted_at` and the property reappears.
- **SC-006**: After navigating to `/settings/bill-types`, all 5 seed bill types are displayed with correct property names resolved from `property_id`.
- **SC-007**: Adding a new bill type results in a new row in BillTypes with the selected property_id, correct frequency, and all optional fields populated (or empty) as entered.
- **SC-008**: The property dropdown in the "Add Bill Type" form only shows active, non-deleted properties.
- **SC-009**: All form validations (empty name, invalid due day, invalid offsets) prevent submission and show clear error messages.
- **SC-010**: All Sheet operation failures produce an error toast and the UI remains functional (no blank screen, no stuck spinner).

## Assumptions

- Phases 1 and 2 are complete: sign-in works, BootstrapContext provides `setupResult` with `spreadsheetId`, and the Sheet has all 9 tabs with headers and seed data.
- The `accessToken` is available via `useAuth()` and the `spreadsheetId` is available via `useBootstrap()`.
- The Properties and BillTypes tabs have exactly the columns defined in `HEADER_DEFINITIONS` from `schema.ts`. The service layer uses column indices derived from these definitions.
- Row indices in the Sheet are 1-based (row 1 is the header). Data rows start at row 2. When the service reads all rows, it tracks each row's Sheet index so updates and deletes can target the correct row.
- Google Sheets API `values.update` (PUT) can overwrite a single row's cells by specifying the range (e.g., `'Properties'!A5:G5` for row 5).
- No concurrent-write protection is needed for a 1–4 person household app.
- The undo snackbar is a client-side timer. If the user navigates away before undo, the soft-delete stands.
- ActivityLog writes are noted as future enhancement points but are NOT implemented in this phase.
