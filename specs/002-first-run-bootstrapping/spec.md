# Feature Specification: First-Run Bootstrapping

**Feature Branch**: `002-first-run-bootstrapping`

**Created**: 2026-05-28

**Status**: Draft

**Input**: User description: "First-Run Bootstrapping — Google Sheet, Drive Folder, Calendar, and Seed Data (Phase 2 of the Build Order). On first sign-in, detect whether this user already has a NoDues setup. If not, create the Drive folder, Google Sheet with all tabs, Google Calendar, and seed starter data. If already set up, load existing Config and do nothing destructive."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First-time owner sign-in creates all resources (Priority: P1)

The owner signs in with Google for the very first time. The app detects that no NoDues setup exists for this user and automatically creates the Drive folder, Google Sheet with all required tabs, Google Calendar, and seeds all starter data (properties, bill types, to-do categories, and config). The owner sees clear progress feedback during setup and a confirmation when everything is ready.

**Why this priority**: This is the core purpose of the feature. Without bootstrapping, no other functionality in the app can operate — there is no Sheet to write bills to, no folder to upload files to, and no calendar to create reminders in.

**Independent Test**: Can be fully tested by signing in with a Google account that has never used NoDues. After sign-in completes, verify the Drive folder, Sheet (with all 9 tabs and header rows), Calendar, and seeded data rows all exist in the user's Google account.

**Acceptance Scenarios**:

1. **Given** a user who has never used NoDues before, **When** they sign in with Google, **Then** the app creates a Drive folder named "NoDues" in the user's Drive root.
2. **Given** a first-time sign-in, **When** bootstrapping runs, **Then** a Google Sheet named "NoDues - Database" is created inside the "NoDues" Drive folder with exactly 9 tabs: Properties, BillTypes, Bills, TodoCategories, RecurrencePatterns, Todos, PostponeLog, ActivityLog, Config.
3. **Given** a first-time sign-in, **When** bootstrapping runs, **Then** each tab has a header row matching the column definitions from the data model (e.g., Properties has: id, name, address, notes, active, created_at, deleted_at).
4. **Given** a first-time sign-in, **When** bootstrapping runs, **Then** a Google Calendar named "NoDues Reminders" is created.
5. **Given** a first-time sign-in, **When** bootstrapping runs, **Then** the Properties tab is seeded with three rows: "Mira Shop", "Mira Flat", and "Chawl" — each with a UUID, active = true, and a created_at timestamp.
6. **Given** a first-time sign-in, **When** bootstrapping runs, **Then** the BillTypes tab is seeded with five rows: Maintenance (Mira Shop, monthly, due day 5, offsets "3,1"), Property Tax (Mira Shop, annual, due day 1, offsets "30,7,1"), Maintenance (Mira Flat, monthly, due day 5, offsets "3,1"), Property Tax (Mira Flat, annual, due day 1, offsets "30,7,1"), and Electricity (Chawl, monthly, due day 15, offsets "5,1").
7. **Given** a first-time sign-in, **When** bootstrapping runs, **Then** the TodoCategories tab is seeded with four rows: Insurance, Tax, Society, Maintenance — each with a UUID and active = true.
8. **Given** a first-time sign-in, **When** bootstrapping runs, **Then** the Config tab contains a single row with: drive_root_folder_id (the created folder's ID), calendar_id (the created calendar's ID), timezone = "Asia/Kolkata", currency = "INR", and the Sheet ID is retrievable from the stored config.

---

### User Story 2 - Returning owner sign-in detects existing setup (Priority: P1)

An owner who has already completed first-run setup signs in again (possibly in a fresh browser with no cached state). The app discovers the existing setup via a Drive-first detection flow: search Drive for the "NoDues" folder, find the "NoDues - Database" Sheet inside it, read the Config tab to load stored IDs, and confirm setup is complete. The user proceeds directly to the dashboard without any delay or duplicate resource creation.

**Why this priority**: Equally critical to P1 — without idempotent detection, every sign-in would create duplicate folders, sheets, and calendars, corrupting the user's data.

**Independent Test**: Can be tested by signing in with an account that already has a completed NoDues setup. Verify no new Drive folders, Sheets, or Calendars are created, and the existing Config IDs remain unchanged.

**Acceptance Scenarios**:

1. **Given** a returning user with a completed setup (fresh browser, no cached state), **When** they sign in, **Then** the app searches Drive for a folder named "NoDues" owned by the app, finds it, then searches inside it for the "NoDues - Database" Sheet, finds it, reads its Config tab, confirms valid drive_root_folder_id and calendar_id are present, and loads those IDs without creating any new resources.
2. **Given** a returning user whose Config tab already contains valid IDs, **When** they sign in, **Then** the seeded data (Properties, BillTypes, TodoCategories) is not duplicated or overwritten.
3. **Given** a returning user whose Config tab confirms setup is complete, **When** they sign in, **Then** they are directed to the dashboard without seeing the bootstrapping progress UI.
4. **Given** a returning user whose Drive contains the "NoDues" folder but the Sheet inside it is missing or has no Config tab, **When** they sign in, **Then** the app treats this as a partial setup and resumes bootstrapping from the missing step.

---

### User Story 3 - Progress feedback during first-run setup (Priority: P2)

During the first-run bootstrapping process (which involves multiple sequential API calls and may take several seconds), the user sees a progress indicator showing what step is currently executing. If all steps succeed, the user sees a success confirmation. If any step fails, the user sees a clear error message identifying what went wrong.

**Why this priority**: The bootstrapping involves multiple network calls that may take 5-10 seconds total. Without feedback, the user would stare at a blank screen and might navigate away or retry, causing partial setups.

**Independent Test**: Can be tested by observing the UI during a first-time sign-in. Verify that progress steps are displayed and that the UI transitions to a success state upon completion.

**Acceptance Scenarios**:

1. **Given** a first-time sign-in has begun bootstrapping, **When** each major step executes (creating folder, creating sheet, creating calendar, seeding data), **Then** the user sees a progress indicator showing the current step.
2. **Given** bootstrapping is in progress, **When** all steps complete successfully, **Then** the user sees a success confirmation message and is directed to the dashboard.
3. **Given** bootstrapping is in progress, **When** any step fails (e.g., network error, API quota exceeded, permission denied), **Then** the user sees an error message identifying the failed step, and a "Retry" option is available.
4. **Given** a bootstrapping failure occurred, **When** the user taps "Retry", **Then** the process resumes from the failed step (does not re-create resources that already succeeded).

---

### User Story 4 - Partial setup recovery (Priority: P3)

If the bootstrapping process fails partway through (e.g., Drive folder was created but Sheet creation failed due to a network error), the next sign-in detects the partial state and completes only the missing steps rather than starting over or creating duplicates.

**Why this priority**: Network failures during a multi-step process are realistic. Without partial recovery, the user could end up with orphaned Drive folders or duplicate resources that require manual cleanup in their Google account.

**Independent Test**: Can be tested by simulating a failure after the Drive folder is created but before the Sheet is created. On the next sign-in, verify that only the Sheet, Calendar, and seeding steps run, and the existing Drive folder is reused.

**Acceptance Scenarios**:

1. **Given** a previous bootstrapping attempt created the Drive folder but failed before creating the Sheet, **When** the user signs in again, **Then** the app detects the existing Drive folder (via a Drive search or stored partial config), reuses it, and creates only the missing resources (Sheet, Calendar, seed data).
2. **Given** a previous bootstrapping attempt created the folder and Sheet but failed before creating the Calendar, **When** the user signs in again, **Then** the app reuses the existing folder and Sheet and creates only the Calendar and seeds any missing data.
3. **Given** a previous bootstrapping attempt created all resources but failed during seeding, **When** the user signs in again, **Then** the app detects the existing resources, checks whether seed data is present, and only inserts missing seed rows.

---

### Edge Cases

- What happens if the user's Google Drive already contains a folder named "NoDues" that was not created by this app? The app searches for a folder named "NoDues" that it owns (created by the app's OAuth client). If found, it reuses it. If a folder with the same name exists but was created by another app or manually, the bootstrapper creates its own separate folder (Drive allows multiple folders with the same name) and stores the specific folder ID in Config.
- What happens if the user revokes Drive/Sheets/Calendar permissions between sessions? The app catches the 403/401 error during detection, shows a message explaining that permissions are required, and redirects to re-authorize with the necessary scopes.
- What happens if the Google Sheets API or Drive API is temporarily unavailable? The app shows an error message ("Could not reach Google services. Please try again.") and offers a Retry button. No partial resources are left in an inconsistent state because each step checks for existing resources before creating.
- What happens if the user signs in on two devices simultaneously for the first time? The first bootstrapping to complete writes the Config row. The second detects the existing Config and skips creation. If both race and create separate folders/sheets, the Config tab that gets written last wins — but this is an extremely unlikely edge case for a 1-4 person family app.
- What happens if seeding partially completes (e.g., 2 of 3 properties are written)? The retry logic checks which seed rows already exist (by name or ID) before inserting, so only missing rows are added.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On every sign-in, system MUST detect existing setup using the following Drive-first detection flow (resolves the chicken-and-egg problem of needing the Sheet ID to read Config, while the Sheet ID is stored in Config):
  1. Search the user's Google Drive for a folder named "NoDues" that was created by this app (the `drive.file` scope limits visibility to files the app itself created).
  2. If the folder is found, search inside it for a Google Sheet named "NoDues - Database".
  3. If the Sheet is found, read its Config tab to load the stored IDs (drive_root_folder_id, calendar_id) and confirm setup is complete.
  4. If the folder is missing, or the Sheet is missing inside it, or the Config tab lacks valid IDs — treat this as "not set up" or "partial setup" and run/resume bootstrapping from the first missing step.
- **FR-002**: The detection flow in FR-001 doubles as the partial-setup recovery mechanism. Each resource is checked independently: folder exists? Sheet exists inside it? Config has valid IDs? Only missing resources are created, in order.
- **FR-003**: System MUST create a Google Drive folder named "NoDues" in the user's Drive root if no existing app-owned folder is found. Only the root folder is created; sub-folders are created on demand in later phases.
- **FR-004**: System MUST create a Google Sheet named "NoDues - Database" inside the "NoDues" Drive folder, containing exactly 9 tabs with their corresponding header rows:
  - Properties: id, name, address, notes, active, created_at, deleted_at
  - BillTypes: id, property_id, name, default_amount, default_due_day, frequency, reminder_offsets_days, active, created_at, deleted_at
  - Bills: id, bill_type_id, month, amount, due_date, original_due_date, status, paid_date, payment_method, transaction_ref, bill_file_ids, receipt_file_ids, calendar_event_ids, notes, created_at, updated_at, deleted_at, composite_key
  - TodoCategories: id, name, color, active, deleted_at
  - RecurrencePatterns: id, name, interval_value, interval_unit, anchor_day, end_condition, end_value, active
  - Todos: id, title, description, category_id, due_date, original_due_date, status, done_date, recurrence_pattern_id, parent_todo_id, reminder_offsets_days, attachment_file_ids, calendar_event_ids, notes, created_at, updated_at, deleted_at
  - PostponeLog: id, item_type, item_id, from_date, to_date, reason, postponed_by, postponed_at
  - ActivityLog: id, timestamp, user_email, action, entity_type, entity_id, summary
  - Config: key, value (key-value pairs stored as rows)
- **FR-005**: System MUST create a Google Calendar named "NoDues Reminders" for the signed-in user.
- **FR-006**: System MUST seed the Properties tab with exactly three rows:
  - "Mira Shop" (active, with UUID and created_at timestamp)
  - "Mira Flat" (active, with UUID and created_at timestamp)
  - "Chawl" (active, with UUID and created_at timestamp)
- **FR-007**: System MUST seed the BillTypes tab with exactly five rows, each linked to the correct property via property_id:
  - Mira Shop → Maintenance (monthly, default_due_day = 5, reminder_offsets_days = "3,1")
  - Mira Shop → Property Tax (annual, default_due_day = 1, reminder_offsets_days = "30,7,1")
  - Mira Flat → Maintenance (monthly, default_due_day = 5, reminder_offsets_days = "3,1")
  - Mira Flat → Property Tax (annual, default_due_day = 1, reminder_offsets_days = "30,7,1")
  - Chawl → Electricity (monthly, default_due_day = 15, reminder_offsets_days = "5,1")
- **FR-008**: System MUST seed the TodoCategories tab with exactly four rows: Insurance, Tax, Society, Maintenance — each with a UUID and active = true.
- **FR-009**: System MUST write Config key-value rows containing: drive_root_folder_id (the created folder's ID), sheet_id (the created Sheet's ID), calendar_id (the created calendar's ID), timezone = "Asia/Kolkata", currency = "INR". Note: the detection flow (FR-001) discovers the Sheet via Drive search and does not depend on reading sheet_id from Config — this avoids the chicken-and-egg problem. The sheet_id Config entry exists for documentation, debugging, and potential future use.
- **FR-010**: System MUST show a progress indicator to the user during bootstrapping that communicates the current step being executed (e.g., "Creating Drive folder...", "Setting up database...", "Creating calendar...", "Seeding starter data...").
- **FR-011**: System MUST show a clear error message if any bootstrapping step fails, identifying which step failed and offering a "Retry" option.
- **FR-012**: System MUST be idempotent — if bootstrapping is run multiple times (due to retry or re-sign-in), it MUST NOT create duplicate resources or duplicate seed data rows.
- **FR-013**: System MUST handle partial-setup recovery: if a previous bootstrapping attempt created some resources but not all, the next attempt detects what already exists and creates only the missing pieces.
- **FR-014**: When an existing setup is detected (Config has valid IDs), system MUST skip bootstrapping entirely and proceed directly to the dashboard.
- **FR-015**: The Sheet ID is obtained as a byproduct of the detection flow (FR-001 step 2 returns the Sheet's file ID from Drive search) or from the creation step (FR-004 returns the new Sheet's ID). System MUST hold this ID in application state for the duration of the session so all subsequent read/write operations can target the correct Sheet. The Sheet ID MUST also be stored as a Config key (`sheet_id`) for documentation/debugging purposes, though the detection flow does not depend on it (avoiding the chicken-and-egg problem).

### Key Entities

- **Config**: Single-row or key-value settings that store the IDs of the created Drive folder, Sheet, and Calendar, plus user preferences (currency, timezone). Acts as the "setup detection" mechanism — if Config has valid IDs, setup is complete.
- **Properties**: Real-world properties owned by the user (Mira Shop, Mira Flat, Chawl). Each has a name, optional address/notes, and an active flag.
- **BillTypes**: Categories of bills scoped to a specific property. Each has a name, frequency, default due day, and configurable reminder offsets.
- **TodoCategories**: Labels for organizing to-dos (Insurance, Tax, Society, Maintenance). Each has a name, optional color, and an active flag.
- **Google Drive Folder ("NoDues")**: Root folder in the user's Drive that will contain all uploaded bill images and receipts in later phases.
- **Google Sheet ("NoDues - Database")**: The single spreadsheet that serves as the app's database, containing all 9 tabs.
- **Google Calendar ("NoDues Reminders")**: A dedicated calendar for bill and to-do reminder events, created in later phases.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user completes the full bootstrapping process (folder + sheet + calendar + seed data) within 15 seconds of signing in, under normal network conditions.
- **SC-002**: After bootstrapping, the user's Google Drive contains exactly one "NoDues" folder (created by the app) with the "NoDues - Database" Sheet inside it.
- **SC-003**: After bootstrapping, the "NoDues - Database" Sheet contains all 9 tabs, each with the correct header row, and the seeded data rows match the specification exactly (3 properties, 5 bill types, 4 to-do categories, 1 config entry set).
- **SC-004**: After bootstrapping, a "NoDues Reminders" calendar exists in the user's Google Calendar account.
- **SC-005**: A returning user (with existing setup) bypasses bootstrapping and reaches the dashboard within 3 seconds of sign-in, with no new resources created.
- **SC-006**: If bootstrapping fails midway, the user can retry and the process completes without creating duplicate resources — 100% idempotent on retry.
- **SC-007**: The user sees meaningful progress feedback throughout the bootstrapping process — no period longer than 3 seconds without a visible status update.
- **SC-008**: If a bootstrapping step fails, the user sees an error message that identifies the specific issue and can take corrective action (retry or report).

## Assumptions

- The user has already completed Phase 1 (Google sign-in) and has granted OAuth scopes for `drive.file`, `spreadsheets`, and `calendar`. The bootstrapping code does not handle scope negotiation.
- **Scope assumption — `drive.file` and file discovery**: The `drive.file` scope is documented as granting access to "files and folders that you have opened or created with this app." The detection flow (FR-001) relies on `files.list` being able to find the "NoDues" folder and Sheet that the app previously created, even in a new browser session with no cached file IDs. Google's documentation confirms that files *created* by the app remain accessible under `drive.file`, and this is sufficient for a single-owner app. **Risk**: Google's documentation is ambiguous on edge cases (e.g., cross-user shared folders). If `drive.file` cannot discover previously-created files via `files.list` in practice, the smallest alternative scope is `drive.readonly` (allows listing all files but only reading, not modifying, non-app files). This should be validated during implementation with a real Google account before committing to a scope.
- The user has a stable internet connection during first-run setup. Offline bootstrapping is not supported (the app requires connectivity to call Google APIs).
- Google API free-tier quotas are sufficient for bootstrapping (creating 1 folder, 1 sheet with 9 tabs, 1 calendar, and writing ~13 seed rows is well within limits).
- The branding constants (folder name "NoDues", sheet name "NoDues - Database", calendar name "NoDues Reminders") are sourced from the app's branding configuration file, not hardcoded in the bootstrapping logic.
- UUIDs for seed data are generated client-side using a standard UUID v4 generator.
- Timestamps for created_at fields use ISO 8601 format in the user's configured timezone (Asia/Kolkata by default).
- The Config tab uses a key-value structure (one row per setting) rather than a single row with many columns, to allow easy addition of new settings in future phases without altering the tab schema.
- Token refresh is handled by the existing auth layer from Phase 1 and is not part of this feature's scope.
- Family-member sign-in detection (checking allowed_user_emails) is out of scope — that is a later phase. This feature only handles the owner's first sign-in bootstrapping.
