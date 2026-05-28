# Implementation Plan: First-Run Bootstrapping

**Branch**: `002-first-run-bootstrapping` | **Date**: 2026-05-28 | **Spec**: [spec.md](specs/002-first-run-bootstrapping/spec.md)

**Input**: Feature specification from `/specs/002-first-run-bootstrapping/spec.md`

## Summary

On every sign-in, detect whether this user already has a NoDues setup in Google Drive. If not, create the Drive folder, Google Sheet with all 9 tabs and headers, Google Calendar, and seed starter data (3 properties, 5 bill types, 4 to-do categories, config keys). If already set up, load existing Config and proceed to the dashboard. The detection flow is Drive-first: search for the "NoDues" folder via `files.list`, then find the Sheet inside it, then read its Config tab. All operations are idempotent and support partial-setup recovery. Progress feedback is shown during bootstrapping with step-by-step indicators.

## Technical Context

**Language/Version**: TypeScript ~6.0.2 / React 19.2.6

**Primary Dependencies**: React 19, React Router 6.30.3, Tailwind CSS 3.4.19, Lucide React 1.16.0, Vite 8.0.12, `@react-oauth/google` 0.13.x, `uuid` (to be added)

**Storage**: Google Drive (folder), Google Sheets (database), Google Calendar (reminders). No local persistence — all state in React context.

**Testing**: Manual testing via acceptance scenarios (no test framework configured).

**Target Platform**: Web browser (mobile-first SPA, 375px primary breakpoint)

**Project Type**: Single-page web application (client-only, no backend)

**Performance Goals**: First-run bootstrapping < 15 seconds (SC-001). Returning user bypasses bootstrapping < 3 seconds (SC-005). No UI gap > 3 seconds without status update (SC-007).

**Constraints**: Memory-only state, WCAG 2.1 AA compliance, no backend server, `drive.file` scope (not `drive.readonly`)

**Scale/Scope**: Single-user per browser tab, household app (1-4 users)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution is not yet ratified (template placeholders only). No gates to enforce. Proceeding with standard engineering best practices.

**Post-Phase 1 re-check**: No constitution violations — constitution remains unratified.

## Project Structure

### Documentation (this feature)

```text
specs/002-first-run-bootstrapping/
├── plan.md              # This file
├── research.md          # Phase 0 output — Google API patterns
├── data-model.md        # Phase 1 output — entity definitions
├── quickstart.md        # Phase 1 output — developer setup guide
├── contracts/           # Phase 1 output — interface contracts
│   ├── bootstrap-context.ts  # BootstrapContext TypeScript interface
│   └── services.ts           # Service module interfaces
├── checklists/
│   └── requirements.md       # Requirements checklist
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
src/
├── App.tsx                              # MODIFIED — wrap authenticated content with BootstrapGuard
├── main.tsx                             # UNCHANGED
├── index.css                            # UNCHANGED
├── config/
│   ├── branding.ts                      # UNCHANGED (already has DRIVE_FOLDER_NAME, SHEET_NAME, CALENDAR_NAME)
│   └── schema.ts                        # NEW — tab names, header defs, seed data constants
├── services/
│   ├── googleApi.ts                     # NEW — base fetch wrapper, GoogleApiRequestError, retry logic
│   ├── driveService.ts                  # NEW — findFolder, createFolder, findSheetInFolder, moveFileToFolder
│   ├── sheetsService.ts                 # NEW — createSpreadsheet, writeHeaders, readValues, appendRows, writeValues
│   ├── calendarService.ts              # NEW — findCalendar, createCalendar
│   └── bootstrapService.ts             # NEW — detectExistingSetup, bootstrap orchestrator
├── contexts/
│   ├── AuthContext.tsx                  # UNCHANGED
│   └── BootstrapContext.tsx             # NEW — BootstrapProvider, useBootstrap hook
├── components/
│   ├── shared/
│   │   └── Navbar.tsx                   # UNCHANGED
│   ├── auth/
│   │   ├── ProtectedRoute.tsx           # UNCHANGED
│   │   └── ErrorBanner.tsx              # UNCHANGED
│   └── bootstrap/
│       └── BootstrapGuard.tsx           # NEW — progress/error UI + guard for authenticated content
└── pages/
    ├── LandingPage.tsx                  # UNCHANGED
    ├── DashboardPage.tsx                # MODIFIED — remove placeholder, reference setup result
    ├── BillsPage.tsx                    # UNCHANGED
    ├── TodosPage.tsx                    # UNCHANGED
    └── SettingsPage.tsx                 # UNCHANGED
```

**Structure Decision**: Single-project SPA structure continues from Phase 1. New directories: `src/services/` for Google API service modules, `src/components/bootstrap/` for bootstrapping UI. The `src/config/` directory is extended with `schema.ts` for the tab/header/seed-data registry.

### New Files (8)

| File | Purpose |
|------|---------|
| `src/config/schema.ts` | Tab names, header definitions, seed data constants for all 9 tabs |
| `src/services/googleApi.ts` | Base `googleApiFetch` wrapper, `GoogleApiRequestError` class, `withRetry`, error classifiers |
| `src/services/driveService.ts` | Google Drive API operations: find/create folder, find Sheet, move file |
| `src/services/sheetsService.ts` | Google Sheets API operations: create spreadsheet, headers, read/write values |
| `src/services/calendarService.ts` | Google Calendar API operations: find/create calendar |
| `src/services/bootstrapService.ts` | Orchestrator: detection flow + conditional bootstrap steps |
| `src/contexts/BootstrapContext.tsx` | React context for bootstrap state, `useBootstrap` hook |
| `src/components/bootstrap/BootstrapGuard.tsx` | UI component: progress indicator, error/retry, guards content |

### Modified Files (2)

| File | Changes |
|------|---------|
| `src/App.tsx` | Wrap authenticated route content with `<BootstrapGuard>` inside `<BootstrapProvider>` |
| `src/pages/DashboardPage.tsx` | Replace placeholder text with real welcome + setup-ready state |

### New Dependency (1)

| Package | Version | Purpose |
|---------|---------|---------|
| `uuid` | latest | UUID v4 generation for seed data IDs |

## Component Architecture

```text
<StrictMode>
  <BrowserRouter>
    <GoogleOAuthProvider clientId={VITE_GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <App>
          ├── "/" → isAuthenticated ? <Navigate to="/dashboard"> : <LandingPage />
          └── <BootstrapProvider>              ← wraps ALL protected routes once
                <BootstrapGuard>               ← shows progress/error until setup complete
                  ├── "/dashboard" → <ProtectedRoute><DashboardPage /></ProtectedRoute>
                  ├── "/bills"     → <ProtectedRoute><BillsPage /></ProtectedRoute>
                  ├── "/todos"     → <ProtectedRoute><TodosPage /></ProtectedRoute>
                  └── "/settings"  → <ProtectedRoute><SettingsPage /></ProtectedRoute>
                </BootstrapGuard>
              </BootstrapProvider>
          └── <Navbar /> (rendered inside App when authenticated)
        </App>
      </AuthProvider>
    </GoogleOAuthProvider>
  </BrowserRouter>
</StrictMode>
```

**Key design**: `BootstrapProvider` wraps all protected routes once (not per-route) so the bootstrap state and `setupResult` are shared across pages. `BootstrapGuard` renders children only when `status === 'complete'`; otherwise it shows the progress or error UI.

## Bootstrap Flow

### Detection Flow (FR-001)

```text
1. Search Drive for folder named "NoDues" (app-created, not trashed)
   └── GET drive/v3/files?q=name='NoDues' and mimeType='application/vnd.google-apps.folder' and trashed=false

2. If folder found → search inside it for "NoDues - Database" Sheet
   └── GET drive/v3/files?q=name='NoDues - Database' and mimeType='...spreadsheet' and 'FOLDER_ID' in parents and trashed=false

3. If Sheet found → read Config tab
   └── GET sheets/v4/spreadsheets/{id}/values/'Config'!A:B

4. If Config has drive_root_folder_id + calendar_id + sheet_id → SETUP COMPLETE
   Otherwise → partial setup, resume from first missing step
```

### Creation Flow (FR-003 through FR-009)

```text
Step 1: Create folder (if missing)
  └── POST drive/v3/files { name: "NoDues", mimeType: folder }

Step 2: Create spreadsheet with 9 tabs (if missing)
  └── POST sheets/v4/spreadsheets { properties: {title}, sheets: [{...}x9] }
  └── PATCH drive/v3/files/{id}?addParents={folderId}&removeParents=root

Step 3: Write header rows (if missing)
  └── POST sheets/v4/spreadsheets/{id}/values:batchUpdate { data: [{range, values}x9] }

Step 4: Create calendar (if missing)
  └── POST calendar/v3/calendars { summary: "NoDues Reminders", timeZone: "Asia/Kolkata" }

Step 5: Seed data (if missing)
  └── Read existing rows to check for duplicates
  └── POST sheets/v4/spreadsheets/{id}/values/'Properties'!A:A:append (3 rows)
  └── POST sheets/v4/spreadsheets/{id}/values/'BillTypes'!A:A:append (5 rows)
  └── POST sheets/v4/spreadsheets/{id}/values/'TodoCategories'!A:A:append (4 rows)

Step 6: Write Config (if missing — LAST step, acts as completion marker)
  └── PUT sheets/v4/spreadsheets/{id}/values/'Config'!A2:B6
      { values: [[drive_root_folder_id, ...], [sheet_id, ...], [calendar_id, ...], [timezone, ...], [currency, ...]] }
```

### API Call Summary

| Scenario | API Calls | Expected Duration |
|----------|-----------|-------------------|
| First-run (all new) | ~10 calls | 5-15 seconds |
| Returning user (all exists) | 3 calls | 1-3 seconds |
| Partial (folder exists, rest missing) | ~8 calls | 4-12 seconds |

## BootstrapGuard UI Design

### Progress State (during bootstrapping)

Full-screen centered card with step indicators. Follows MASTER.md design system.

```text
┌──────────────────────────────────┐
│                                  │
│         [NoDues logo/name]       │
│                                  │
│     Setting up your workspace    │
│                                  │
│  ✓  Checking existing setup      │  ← completed (emerald)
│  ✓  Creating Drive folder        │  ← completed (emerald)
│  ●  Setting up database...       │  ← current (indigo, animated)
│  ○  Creating calendar            │  ← pending (slate-300)
│  ○  Seeding starter data         │  ← pending
│  ○  Saving configuration         │  ← pending
│                                  │
└──────────────────────────────────┘
```

- Step icons: `CheckCircle2` (completed, emerald-600), `Loader2` (current, indigo-700, animate-spin), `Circle` (pending, slate-300)
- Text: `text-sm text-slate-700` for completed, `text-sm font-medium text-indigo-700` for current, `text-sm text-slate-400` for pending
- Card: `bg-white border border-slate-200 rounded-xl p-8 shadow-sm max-w-md mx-auto`
- Page: centered vertically and horizontally, `bg-slate-50` background

### Error State

```text
┌──────────────────────────────────┐
│                                  │
│         [AlertCircle icon]       │
│                                  │
│     Setup could not complete     │
│                                  │
│  "Could not reach Google         │
│   services. Please check your    │
│   connection and try again."     │
│                                  │
│  Failed step: Creating calendar  │
│                                  │
│        [ Retry Setup ]           │  ← Primary button
│                                  │
└──────────────────────────────────┘
```

- Icon: `AlertCircle` from Lucide, `w-12 h-12 text-red-500`
- Error message: `text-sm text-slate-600`
- Failed step: `text-xs text-slate-500`
- Retry button: primary style from MASTER.md
- For non-retryable errors (401/403): button text changes to "Sign In Again" and calls `signOut()`

### Complete State

Not shown as a separate screen. On completion, `BootstrapGuard` renders its children (the page content) immediately. No success toast or animation — the user simply arrives at the dashboard.

## Service Module Design

### `src/services/googleApi.ts` — Base Layer

- `googleApiFetch<T>(accessToken, url, options)` — typed fetch wrapper with Bearer auth
- `GoogleApiRequestError` — extends Error with `status`, `body` fields
- `isRetryableError(error)` — returns true for 429, 500, 502, 503, network errors
- `isAuthError(error)` — returns true for 401
- `isPermissionError(error)` — returns true for 403
- `withRetry<T>(fn, options)` — exponential backoff with jitter, max 3 retries
- `columnLetter(n)` — converts column number to letter (1→A, 26→Z, 27→AA)

### `src/services/driveService.ts` — Drive Operations

All functions are standalone, take `accessToken` as first param.

| Function | API | Purpose |
|----------|-----|---------|
| `findFolder(accessToken, name)` | `files.list` | Search for app-created folder by name |
| `createFolder(accessToken, name)` | `files.create` | Create folder at Drive root |
| `findSheetInFolder(accessToken, name, folderId)` | `files.list` | Search for Sheet inside folder |
| `moveFileToFolder(accessToken, fileId, folderId)` | `files.update` | Move file into folder |

### `src/services/sheetsService.ts` — Sheets Operations

| Function | API | Purpose |
|----------|-----|---------|
| `createSpreadsheet(accessToken, title, tabNames)` | `spreadsheets.create` | Create Sheet with named tabs |
| `writeHeaders(accessToken, spreadsheetId, headerDefs)` | `values.batchUpdate` | Write header rows to all tabs |
| `readValues(accessToken, spreadsheetId, range)` | `values.get` | Read cell values |
| `appendRows(accessToken, spreadsheetId, tabName, rows)` | `values.append` | Append rows to a tab |
| `writeValues(accessToken, spreadsheetId, range, values)` | `values.update` | Overwrite values in a range |

### `src/services/calendarService.ts` — Calendar Operations

| Function | API | Purpose |
|----------|-----|---------|
| `findCalendar(accessToken, summary)` | `calendarList.list` | Search for calendar by name |
| `createCalendar(accessToken, summary, timeZone)` | `calendars.insert` | Create secondary calendar |

### `src/services/bootstrapService.ts` — Orchestrator

| Function | Purpose |
|----------|---------|
| `detectExistingSetup(accessToken)` | Run detection flow, return `DetectedState` |
| `bootstrap(accessToken, onProgress)` | Run detection, then create missing resources, return `SetupResult` |

The `bootstrap` function:
1. Calls `detectExistingSetup()` to get current state
2. If all resources exist and config is complete → return `SetupResult` immediately
3. Otherwise, iterate through steps in order, skipping completed ones
4. Call `onProgress(step)` before each step so UI updates
5. On failure, throw with step info so the error UI knows which step failed
6. On retry, `detectExistingSetup()` runs again to pick up where it left off

### `src/config/schema.ts` — Data Constants

Contains all tab names, header definitions, and seed data as typed constants. Referenced by `bootstrapService.ts` and potentially by future CRUD operations.

```typescript
export const TAB_NAMES = [
  'Properties', 'BillTypes', 'Bills', 'TodoCategories',
  'RecurrencePatterns', 'Todos', 'PostponeLog', 'ActivityLog', 'Config',
] as const;

export const HEADER_DEFINITIONS: HeaderDefinition[] = [
  { tabName: 'Properties', headers: ['id', 'name', 'address', 'notes', 'active', 'created_at', 'deleted_at'] },
  // ... all 9 tabs
];

export function generateSeedProperties(): string[][] { /* ... */ }
export function generateSeedBillTypes(propertyIds: Record<string, string>): string[][] { /* ... */ }
export function generateSeedTodoCategories(): string[][] { /* ... */ }
```

## Complexity Tracking

No constitution violations to justify — constitution is unratified.
