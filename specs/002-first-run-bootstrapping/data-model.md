# Data Model: First-Run Bootstrapping

**Branch**: `002-first-run-bootstrapping` | **Date**: 2026-05-28

## Entities

### BootstrapState

Application-level state tracking the progress and result of the bootstrapping process. Managed by `BootstrapContext`.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | `BootstrapStatus` | `'idle'` | Current phase of the bootstrap lifecycle |
| `currentStep` | `BootstrapStep \| null` | `null` | Which step is currently executing |
| `completedSteps` | `BootstrapStep[]` | `[]` | Steps that have finished successfully |
| `error` | `BootstrapError \| null` | `null` | Error details if a step failed |
| `setupResult` | `SetupResult \| null` | `null` | Final IDs after successful bootstrapping |

**State Enum — `BootstrapStatus`**:

| Value | Meaning |
|-------|---------|
| `'idle'` | Bootstrap has not started |
| `'detecting'` | Running the detection flow (FR-001) |
| `'bootstrapping'` | Creating missing resources |
| `'complete'` | All resources exist, setup is done |
| `'error'` | A step failed; retry is available |

**Step Enum — `BootstrapStep`**:

| Value | UI Label |
|-------|----------|
| `'detect'` | `"Checking existing setup..."` |
| `'folder'` | `"Creating Drive folder..."` |
| `'spreadsheet'` | `"Setting up database..."` |
| `'headers'` | `"Configuring database tables..."` |
| `'calendar'` | `"Creating calendar..."` |
| `'seed'` | `"Seeding starter data..."` |
| `'config'` | `"Saving configuration..."` |

**State Transitions**:

```text
                    ┌──────────┐
                    │   IDLE   │
                    └────┬─────┘
                         │ run()
                    ┌────▼──────┐
              ┌─────┤ DETECTING │
              │     └────┬──────┘
              │          │
              │     ┌────▼───────────┐
              │     │ setup exists?  │
              │     └────┬─────┬─────┘
              │          │     │
              │        yes     no / partial
              │          │     │
              │    ┌─────▼──┐  │
              │    │COMPLETE │  │
              │    └────────┘  │
              │          ┌─────▼────────┐
              │          │BOOTSTRAPPING │
              │          │ step by step │
              │          └────┬────┬────┘
              │               │    │
              │           success  fail
              │               │    │
              │         ┌─────▼──┐ │
              │         │COMPLETE│ │
              │         └────────┘ │
              │              ┌─────▼──┐
              └──────────────┤ ERROR  │
                             └────┬───┘
                                  │ retry()
                                  │ (resumes from failed step)
                                  └──→ DETECTING
```

---

### SetupResult

The IDs and configuration obtained after a successful bootstrap or detection. Held in application state for the session duration.

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `folderId` | `string` | Drive `files.create` or `files.list` | Google Drive folder ID for "NoDues" |
| `spreadsheetId` | `string` | Sheets `spreadsheets.create` or Drive `files.list` | Google Sheet ID for "NoDues - Database" |
| `calendarId` | `string` | Calendar `calendars.insert` or Config tab | Calendar ID for "NoDues Reminders" |
| `timezone` | `string` | Config tab | User timezone (default `"Asia/Kolkata"`) |
| `currency` | `string` | Config tab | Currency code (default `"INR"`) |

**Validation Rules**:
- All three IDs (`folderId`, `spreadsheetId`, `calendarId`) must be non-empty strings
- `timezone` must be a valid IANA timezone identifier
- `currency` must be a valid ISO 4217 currency code
- Held in React state only — not persisted to localStorage

---

### BootstrapError

Error details when a bootstrap step fails.

| Field | Type | Description |
|-------|------|-------------|
| `step` | `BootstrapStep` | Which step failed |
| `message` | `string` | Human-readable error message for UI display |
| `isRetryable` | `boolean` | Whether retry is available (false for auth/permission errors) |
| `httpStatus` | `number \| null` | HTTP status code if available |

**Error Classification**:

| HTTP Status | `isRetryable` | UI Message |
|-------------|---------------|------------|
| `401` | `false` | "Your session has expired. Please sign in again." |
| `403` | `false` | "Permission denied. Please sign in again and grant all required permissions." |
| `429` | `true` | "Too many requests. Retrying..." (auto-retried internally) |
| `500`, `502`, `503` | `true` | "Google services are temporarily unavailable. Please try again." |
| Network error | `true` | "Could not reach Google services. Please check your connection and try again." |

---

### DetectedState

Internal state used during the detection flow to track which resources already exist. Not exposed to UI.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `folderId` | `string \| null` | `null` | Found Drive folder ID |
| `spreadsheetId` | `string \| null` | `null` | Found Sheet ID |
| `calendarId` | `string \| null` | `null` | Calendar ID from Config tab |
| `headersWritten` | `boolean` | `false` | Whether header rows exist on the Properties tab |
| `seedDataWritten` | `boolean` | `false` | Whether seed data rows exist |
| `configWritten` | `boolean` | `false` | Whether Config tab has all required keys |

---

### Config (Google Sheet — key-value rows)

Stored in the "Config" tab of the "NoDues - Database" Sheet. Each row is a key-value pair.

| Key | Value (example) | Description |
|-----|-----------------|-------------|
| `drive_root_folder_id` | `"1aBcDeFg..."` | Google Drive folder ID |
| `sheet_id` | `"abc123def..."` | Spreadsheet ID (for debugging; not used in detection) |
| `calendar_id` | `"abc@group.calendar..."` | Google Calendar ID |
| `timezone` | `"Asia/Kolkata"` | Default timezone |
| `currency` | `"INR"` | Default currency |

**Validation Rules**:
- `drive_root_folder_id`: Required, non-empty string
- `sheet_id`: Required, non-empty string
- `calendar_id`: Required, non-empty string, should match email-style format
- `timezone`: Required, valid IANA timezone
- `currency`: Required, 3-letter ISO 4217 code

---

### Properties (Google Sheet — seed data)

Stored in the "Properties" tab. Three rows seeded during bootstrapping.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `string` (UUID v4) | Unique identifier, generated client-side |
| `name` | `string` | Property name |
| `address` | `string` | Optional address (empty for seed data) |
| `notes` | `string` | Optional notes (empty for seed data) |
| `active` | `string` (`"true"/"false"`) | Whether the property is active |
| `created_at` | `string` (ISO 8601) | Creation timestamp |
| `deleted_at` | `string` | Soft-delete timestamp (empty for seed data) |

**Seed Data** (FR-006):

| name | active | address | notes |
|------|--------|---------|-------|
| `"Mira Shop"` | `"true"` | `""` | `""` |
| `"Mira Flat"` | `"true"` | `""` | `""` |
| `"Chawl"` | `"true"` | `""` | `""` |

---

### BillTypes (Google Sheet — seed data)

Stored in the "BillTypes" tab. Five rows seeded during bootstrapping.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `string` (UUID v4) | Unique identifier |
| `property_id` | `string` (UUID v4) | References Properties.id |
| `name` | `string` | Bill type name |
| `default_amount` | `string` | Default amount (empty for seed data) |
| `default_due_day` | `string` (number) | Day of month the bill is due |
| `frequency` | `string` | `"monthly"` or `"annual"` |
| `reminder_offsets_days` | `string` | Comma-separated days before due date |
| `active` | `string` | `"true"` |
| `created_at` | `string` (ISO 8601) | Creation timestamp |
| `deleted_at` | `string` | Soft-delete timestamp (empty) |

**Seed Data** (FR-007):

| property (by name) | name | frequency | default_due_day | reminder_offsets_days |
|---------------------|------|-----------|-----------------|----------------------|
| Mira Shop | Maintenance | monthly | 5 | 3,1 |
| Mira Shop | Property Tax | annual | 1 | 30,7,1 |
| Mira Flat | Maintenance | monthly | 5 | 3,1 |
| Mira Flat | Property Tax | annual | 1 | 30,7,1 |
| Chawl | Electricity | monthly | 15 | 5,1 |

---

### TodoCategories (Google Sheet — seed data)

Stored in the "TodoCategories" tab. Four rows seeded during bootstrapping.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `string` (UUID v4) | Unique identifier |
| `name` | `string` | Category name |
| `color` | `string` | Optional color (empty for seed data) |
| `active` | `string` | `"true"` |
| `deleted_at` | `string` | Soft-delete timestamp (empty) |

**Seed Data** (FR-008):

| name | active |
|------|--------|
| `"Insurance"` | `"true"` |
| `"Tax"` | `"true"` |
| `"Society"` | `"true"` |
| `"Maintenance"` | `"true"` |

---

### Tab Schema Registry

Complete header definitions for all 9 tabs (FR-004). Used by the `writeHeaders` function.

| Tab Name | Headers |
|----------|---------|
| Properties | id, name, address, notes, active, created_at, deleted_at |
| BillTypes | id, property_id, name, default_amount, default_due_day, frequency, reminder_offsets_days, active, created_at, deleted_at |
| Bills | id, bill_type_id, month, amount, due_date, original_due_date, status, paid_date, payment_method, transaction_ref, bill_file_ids, receipt_file_ids, calendar_event_ids, notes, created_at, updated_at, deleted_at, composite_key |
| TodoCategories | id, name, color, active, deleted_at |
| RecurrencePatterns | id, name, interval_value, interval_unit, anchor_day, end_condition, end_value, active |
| Todos | id, title, description, category_id, due_date, original_due_date, status, done_date, recurrence_pattern_id, parent_todo_id, reminder_offsets_days, attachment_file_ids, calendar_event_ids, notes, created_at, updated_at, deleted_at |
| PostponeLog | id, item_type, item_id, from_date, to_date, reason, postponed_by, postponed_at |
| ActivityLog | id, timestamp, user_email, action, entity_type, entity_id, summary |
| Config | key, value |

---

## Relationships

```text
AuthContext (1) ──provides──▶ accessToken (used by all services)

BootstrapContext (1) ──orchestrates──▶ BootstrapState (1)
BootstrapState (1) ──produces──▶ SetupResult (0..1)

SetupResult (1) ──contains──▶ folderId  → Google Drive Folder
SetupResult (1) ──contains──▶ spreadsheetId → Google Sheet
SetupResult (1) ──contains──▶ calendarId → Google Calendar

Google Sheet (1) ──contains──▶ Config tab (key-value rows)
Google Sheet (1) ──contains──▶ Properties tab (seed data)
Google Sheet (1) ──contains──▶ BillTypes tab (seed data, references Properties.id)
Google Sheet (1) ──contains──▶ TodoCategories tab (seed data)
Google Sheet (1) ──contains──▶ 5 empty tabs (Bills, RecurrencePatterns, Todos, PostponeLog, ActivityLog)
```
