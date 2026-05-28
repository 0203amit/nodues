# Tasks: First-Run Bootstrapping

**Input**: Design documents from `/specs/002-first-run-bootstrapping/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: No automated tests — manual testing via quickstart.md

**Organization**: Tasks are organized by service layer in dependency order (base API → service modules → orchestrator → context → UI → wiring), mapped to user stories.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and create the schema constants that all service modules depend on

- [ ] T001 Install `uuid` and `@types/uuid` packages via `npm install uuid && npm install -D @types/uuid`
- [ ] T002 Create tab names, header definitions, and seed data generators in `src/config/schema.ts`
  - Export `TAB_NAMES` array (all 9 tab names as a `const` tuple)
  - Export `HEADER_DEFINITIONS: HeaderDefinition[]` mapping each tab name to its column headers (match data-model.md exactly)
  - Export `generateSeedProperties(): string[][]` — returns 3 rows (Mira Shop, Mira Flat, Chawl) with UUID, name, empty address/notes, active="true", ISO 8601 `created_at`, empty `deleted_at`
  - Export `generateSeedBillTypes(propertyIds: Record<string, string>): string[][]` — returns 5 rows linked to property UUIDs (Maintenance×2, Property Tax×2, Electricity×1) per FR-007
  - Export `generateSeedTodoCategories(): string[][]` — returns 4 rows (Insurance, Tax, Society, Maintenance) per FR-008
  - Import `HeaderDefinition` type from contracts or define locally
  - Import branding constants (`DRIVE_FOLDER_NAME`, `SHEET_NAME`, `CALENDAR_NAME`) from `src/config/branding.ts` — do not hardcode names

---

## Phase 2: Foundational — Base API Layer (Blocking Prerequisites)

**Purpose**: The `googleApi.ts` module is a dependency for every service module. Must be complete before any service task begins.

**⚠️ CRITICAL**: No service module (Phase 3) can begin until this phase is complete

- [ ] T003 Implement base Google API fetch wrapper in `src/services/googleApi.ts`
  - Export `googleApiFetch<T>(accessToken, url, options?)` — typed fetch wrapper with Bearer auth, JSON body handling, 204 support
  - Export `GoogleApiRequestError` class extending `Error` with `status: number`, `body: GoogleApiErrorBody` fields
  - Export `isRetryableError(error)` — returns true for 429, 500, 502, 503, and network `TypeError`
  - Export `isAuthError(error)` — returns true for 401
  - Export `isPermissionError(error)` — returns true for 403
  - Export `withRetry<T>(fn, options?)` — exponential backoff with jitter, max 3 retries, skips auth/permission errors
  - Export `columnLetter(n)` — converts 1-based column number to letter (1→A, 26→Z, 27→AA)
  - Match types from `contracts/services.ts` (`GoogleApiErrorBody`, `FetchOptions`)

**Checkpoint**: Base API layer ready — service modules can now proceed in parallel

---

## Phase 3: User Story 1 — First-time owner sign-in creates all resources (Priority: P1) 🎯 MVP

**Goal**: A first-time user signs in and the app creates the Drive folder, Sheet (9 tabs + headers), Calendar, and seeds all starter data. Config is written last as the completion marker.

**Independent Test**: Sign in with a Google account that has never used NoDues. After bootstrapping, verify: Drive folder "NoDues" exists, Sheet "NoDues - Database" inside it with 9 tabs and correct headers, 3 property rows, 5 bill-type rows, 4 category rows, Config tab with 5 key-value pairs, and "NoDues Reminders" calendar exists.

### Service Modules (parallelizable — different files, no cross-dependencies)

- [ ] T004 [P] [US1] Implement Drive service in `src/services/driveService.ts`
  - Export `findFolder(accessToken, folderName)` → `DriveFile | null` — uses `files.list` with query: `name='...' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  - Export `createFolder(accessToken, folderName)` → `DriveFile` — uses `files.create` with folder MIME type
  - Export `findSheetInFolder(accessToken, sheetName, folderId)` → `DriveFile | null` — uses `files.list` with `'folderId' in parents` filter
  - Export `moveFileToFolder(accessToken, fileId, folderId)` → `void` — uses `files.update` (PATCH) with `addParents` / `removeParents=root`
  - All functions use `googleApiFetch` from `googleApi.ts` with `withRetry`
  - Match contract interface from `contracts/services.ts`

- [ ] T005 [P] [US1] Implement Sheets service in `src/services/sheetsService.ts`
  - Export `createSpreadsheet(accessToken, title, tabNames)` → `SpreadsheetResponse` — uses Sheets API `spreadsheets.create` with all tabs defined in a single call (no default "Sheet1" created)
  - Export `writeHeaders(accessToken, spreadsheetId, headerDefs)` → `void` — uses `values:batchUpdate` with `valueInputOption: 'RAW'`, writes all 9 header rows in one batch
  - Export `readValues(accessToken, spreadsheetId, range)` → `ValueRange | null` — uses `values.get`, returns null on 404
  - Export `appendRows(accessToken, spreadsheetId, tabName, rows)` → `void` — uses `values/{range}:append` with `valueInputOption: 'RAW'` and `insertDataOption: 'INSERT_ROWS'`
  - Export `writeValues(accessToken, spreadsheetId, range, values)` → `void` — uses `values.update` (PUT) with `valueInputOption: 'RAW'`
  - Use `columnLetter()` from `googleApi.ts` for range construction
  - All functions use `googleApiFetch` with `withRetry`
  - Match contract interface from `contracts/services.ts`

- [ ] T006 [P] [US1] Implement Calendar service in `src/services/calendarService.ts`
  - Export `findCalendar(accessToken, summary)` → `GoogleCalendar | null` — uses `calendarList.list`, paginates with `nextPageToken`, filters client-side by `summary` match (exact string equality) and `!deleted`
  - **Calendar name collision behavior**: If a user already has a calendar named "NoDues Reminders" (whether created by this app previously or manually), `findCalendar` returns the first match. The app reuses it. This is acceptable for a personal/household app — document this in a code comment.
  - Export `createCalendar(accessToken, summary, timeZone)` → `GoogleCalendar` — uses `calendars.insert` (POST to `/calendar/v3/calendars`)
  - All functions use `googleApiFetch` with `withRetry`
  - Match contract interface from `contracts/services.ts`

### Orchestrator (depends on T004, T005, T006)

- [ ] T007 [US1] Implement bootstrap orchestrator in `src/services/bootstrapService.ts`
  - Export `detectExistingSetup(accessToken)` → `DetectedState` — runs detection flow in order:
    1. `findFolder(DRIVE_FOLDER_NAME)` → set `folderId`
    2. If folder found: `findSheetInFolder(SHEET_NAME, folderId)` → set `spreadsheetId`
    3. If sheet found: `readValues(spreadsheetId, "'Config'!A:B")` → parse key-value pairs, set `calendarId`, `configWritten`
    4. If sheet found: `readValues(spreadsheetId, "'Properties'!A1:A1")` → check header exists (`headersWritten`)
    5. If sheet found: `readValues(spreadsheetId, "'Properties'!A2:A10")` → check seed data exists (`seedDataWritten`)
  - Export `bootstrap(accessToken, onProgress)` → `SetupResult` — runs detection then conditional creation:
    1. Call `detectExistingSetup()` → get `DetectedState`
    2. If all fields populated → return `SetupResult` immediately
    3. Otherwise, iterate through steps in order (folder → spreadsheet+move → headers → calendar → seed → config), skipping completed ones
    4. Call `onProgress(step)` before each step so UI updates
    5. On failure, throw `BootstrapError` with step info, `isRetryable` flag, and `httpStatus`
    6. Config is written **last** as the completion marker (FR-009)
    7. Seed data uses check-then-append: read existing rows, filter to only missing, append
  - Import all service functions from `driveService`, `sheetsService`, `calendarService`
  - Import constants from `schema.ts` and branding from `branding.ts`
  - Match `DetectedState`, `SetupResult`, `BootstrapStep` types from contracts

**Checkpoint**: Service layer complete — all Google API operations and orchestration are functional

---

## Phase 4: User Story 2 — Returning owner sign-in detects existing setup (Priority: P1)

**Goal**: A returning user signs in and the app detects the existing setup via Drive-first detection, loads Config IDs, and skips bootstrapping entirely. No duplicate resources created.

**Independent Test**: Sign in with an account that already has a completed NoDues setup. Verify: no progress UI shown, dashboard loads directly, no new Drive folders/Sheets/Calendars created.

**Note**: The detection logic is already implemented in T007 (`detectExistingSetup` + conditional skip in `bootstrap`). This phase implements the React layer that triggers it and reacts to the "already complete" result.

### Context (depends on T007)

- [X] T008 [US2] Implement BootstrapContext provider in `src/contexts/BootstrapContext.tsx`
  - Create `BootstrapContext` with `React.createContext<BootstrapContextValue | null>(null)`
  - Export `BootstrapProvider` component that:
    - Gets `accessToken` from `useAuth()` (existing AuthContext)
    - Manages `BootstrapState` via `useState` (status, currentStep, completedSteps, error, setupResult)
    - Exposes `run()` and `retry()` functions
    - `run()` calls `bootstrap(accessToken, onProgress)` from `bootstrapService.ts`, updates state on each progress callback, sets `setupResult` on success
    - `retry()` resets error state and calls `run()` again (detection flow re-runs, picking up where it left off)
    - **StrictMode double-invocation guard**: Use a `useRef<boolean>` flag (`hasStarted.current`) that is set to `true` before the first `run()` call. The triggering `useEffect` checks this ref and skips if already `true`. This prevents React 19 StrictMode from invoking the bootstrap effect twice in development, which would otherwise create duplicate Google resources. The ref persists across StrictMode's double-mount cycle because React reuses the same fiber.
    - Triggers `run()` automatically via `useEffect` when `accessToken` is available and `status === 'idle'`
    - Handles errors from `bootstrapService.ts`: maps `GoogleApiRequestError` to `BootstrapError` with correct `isRetryable`, `message`, `httpStatus` per error classification table in data-model.md
    - For 401 errors: set `isRetryable = false`, message = "Your session has expired. Please sign in again."
    - For 403 errors: set `isRetryable = false`, message = "Permission denied. Please sign in again and grant all required permissions."
  - Export `useBootstrap()` hook that reads from context (throws if used outside provider)
  - Match `BootstrapContextValue` interface from `contracts/bootstrap-context.ts`

**Checkpoint**: React context layer is complete — bootstrap runs automatically on sign-in, returning users skip to 'complete' state

---

## Phase 5: User Story 3 — Progress feedback during first-run setup (Priority: P2)

**Goal**: During bootstrapping, the user sees a full-screen card with step-by-step progress indicators. On error, a clear message with retry option. On completion, children render immediately (no success screen).

**Independent Test**: Sign in as a first-time user and observe the progress UI: step icons change from pending (circle) → current (spinning loader) → completed (check). On completion, the dashboard renders. Simulate a network error and verify the error UI shows the failed step with a Retry button.

### UI Component (depends on T008)

- [X] T009 [US3] Implement BootstrapGuard component in `src/components/bootstrap/BootstrapGuard.tsx`
  - Consumes `useBootstrap()` hook to read state
  - **Complete state** (`status === 'complete'`): render `children` — no success screen, user lands on dashboard immediately
  - **Progress state** (`status === 'detecting' | 'bootstrapping'`): render full-screen centered card per plan.md UI design:
    - Page: centered vertically/horizontally, `bg-slate-50` background
    - Card: `bg-white border border-slate-200 rounded-xl p-8 shadow-sm max-w-md mx-auto`
    - Title: "Setting up your workspace" in `text-lg font-semibold text-slate-900`
    - Step list with all 7 steps from `BootstrapStep` enum, each showing:
      - Completed: `CheckCircle2` icon (Lucide), `text-emerald-600`, `text-sm text-slate-700`
      - Current: `Loader2` icon (Lucide), `animate-spin`, `text-indigo-700`, `text-sm font-medium text-indigo-700`
      - Pending: `Circle` icon (Lucide), `text-slate-300`, `text-sm text-slate-400`
    - Step labels from data-model.md BootstrapStep enum UI labels
  - **Error state** (`status === 'error'`): render error card per plan.md error UI design:
    - `AlertCircle` icon (Lucide), `w-12 h-12 text-red-500`
    - Title: "Setup could not complete" in `text-lg font-semibold text-slate-900`
    - Error message from `error.message` in `text-sm text-slate-600`
    - Failed step label in `text-xs text-slate-500`
    - Retry button (primary style from MASTER.md): `bg-indigo-700 hover:bg-indigo-800 text-white font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer`
    - For non-retryable errors (`!error.isRetryable`): button text = "Sign In Again", calls `signOut()` from AuthContext
  - **Idle state**: render nothing (or a minimal loader) — transitional, quickly moves to detecting
  - Follow MASTER.md design system: IBM Plex Sans font, no emoji as icons, `prefers-reduced-motion` support, 44×44px touch targets for Retry button, WCAG AA contrast, semantic `<button>` elements
  - Use Lucide React icons: `CheckCircle2`, `Loader2`, `Circle`, `AlertCircle`

**Checkpoint**: Full bootstrap UI is functional — progress, error/retry, and transparent pass-through on completion

---

## Phase 6: Wiring — App Integration

**Purpose**: Wire BootstrapProvider and BootstrapGuard into the component tree, and update the dashboard

- [X] T010 [P] Modify `src/App.tsx` to wrap authenticated routes with BootstrapProvider and BootstrapGuard
  - Import `BootstrapProvider` from `src/contexts/BootstrapContext.tsx`
  - Import `BootstrapGuard` from `src/components/bootstrap/BootstrapGuard.tsx`
  - Wrap **all** protected routes (dashboard, bills, todos, settings) inside `<BootstrapProvider>` → `<BootstrapGuard>` as shown in plan.md component architecture
  - `BootstrapProvider` sits outside `BootstrapGuard` but inside the authenticated route area
  - `BootstrapGuard` renders its children (the `<Routes>` containing protected pages) only when `status === 'complete'`
  - Do NOT wrap the landing page or unauthenticated routes

- [X] T011 [P] Update `src/pages/DashboardPage.tsx` to reference setup result
  - Import `useBootstrap()` hook
  - Replace placeholder welcome text with real content that references `setupResult` (e.g., display that the workspace is ready)
  - Keep changes minimal — this is about removing the placeholder and confirming the bootstrap result is accessible, not building full dashboard features

**Checkpoint**: App is fully wired — bootstrapping runs on every authenticated sign-in, progress UI guards content

---

## Phase 7: User Story 4 — Partial setup recovery (Priority: P3)

**Goal**: If bootstrapping failed partway through previously, the next sign-in detects partial state and completes only the missing steps without duplicating resources.

**Independent Test**: Sign in as first-time user, disconnect network after folder creation (DevTools > Offline), observe error UI. Reconnect and click Retry. Verify only missing resources are created and the folder is reused. Alternatively, delete only the Sheet from Google Drive (keep folder), sign in again, and verify only the Sheet and subsequent steps are created.

**Note**: This functionality is already implemented across previous tasks:
- Detection logic in T007 (`detectExistingSetup` checks each resource independently)
- Conditional creation in T007 (`bootstrap` skips completed steps)
- Retry mechanism in T008 (`retry()` re-runs detection + creation)
- Error UI with Retry in T009
- Seed data idempotency in T007 (check-then-append pattern)

No additional implementation tasks are needed for US4 — it is fully covered by the idempotent design of the service and context layers. Validate via manual testing in quickstart.md (Test 3 and Test 4).

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [X] T012 Validate all acceptance scenarios from quickstart.md manually
  - Validated via live manual testing (not a formal task run):
    - ✓ First-run creation verified: Drive folder + 9-tab sheet + seed data + calendar + config all created successfully
    - ✓ Returning-user detection verified: no duplicate folder on re-sign-in, confirming drive.file scope works across sessions
    - ✓ Multi-account isolation verified
    - ✓ StrictMode guard verified: single folder created in dev mode (no duplicates)
    - ○ Error/retry path not explicitly forced, but partial-recovery logic is implemented (idempotent detection + conditional creation in T007, retry mechanism in T008)

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) ─────────────────────────────┐
                                              ▼
Phase 2 (Base API: googleApi.ts) ─────────────┐
                                              ▼
Phase 3 (Services: T004∥T005∥T006 → T007) ───┐
                                              ▼
Phase 4 (Context: T008) ─────────────────────┐
                                              ▼
Phase 5 (UI: T009) ──────────────────────────┐
                                              ▼
Phase 6 (Wiring: T010∥T011) ─────────────────┐
                                              ▼
Phase 7 (Partial Recovery: no new tasks) ────┐
                                              ▼
Phase 8 (Polish: T012)
```

### Task Dependencies (Detail)

- **T001**: No dependencies — can start immediately
- **T002**: No dependencies — can start immediately (parallel with T001)
- **T003**: Depends on T001 (needs project setup)
- **T004, T005, T006**: Depend on T003 — **parallelizable with each other** [P]
- **T007**: Depends on T004 + T005 + T006 (imports all service modules) + T002 (imports schema)
- **T008**: Depends on T007 (calls `bootstrap()`)
- **T009**: Depends on T008 (consumes `useBootstrap()`)
- **T010, T011**: Depend on T008 + T009 — **parallelizable with each other** [P]
- **T012**: Depends on T010 + T011 (full app must be wired)

### User Story Dependencies

- **US1 (P1)**: Core creation flow — implemented in Phase 2 + Phase 3
- **US2 (P1)**: Detection + skip — implemented in Phase 3 (detection in T007) + Phase 4 (context in T008)
- **US3 (P2)**: Progress UI — implemented in Phase 5 (T009)
- **US4 (P3)**: Partial recovery — no additional tasks, covered by idempotent design in T007 + T008

### Parallel Opportunities

```bash
# Phase 1: Both setup tasks in parallel
T001 (npm install) ∥ T002 (schema.ts)

# Phase 3: All three service modules in parallel
T004 (driveService) ∥ T005 (sheetsService) ∥ T006 (calendarService)

# Phase 6: Both wiring tasks in parallel
T010 (App.tsx) ∥ T011 (DashboardPage.tsx)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (T001, T002)
2. Complete Phase 2: Base API (T003) — CRITICAL, blocks all services
3. Complete Phase 3: Services + orchestrator (T004–T007) — delivers US1 + US2 backend
4. Complete Phase 4: Context (T008) — delivers US2 detection/skip
5. **STOP and VALIDATE**: Test detection and creation via console/manual API calls
6. Continue to Phase 5–6 for full UI integration

### Incremental Delivery

1. Setup + Base API → Foundation ready
2. Service modules (parallel) → All Google API operations work
3. Orchestrator → Full bootstrap flow functional (creation + detection + idempotency)
4. Context → React integration, auto-trigger on sign-in
5. UI component → Progress/error feedback visible
6. App wiring → End-to-end flow complete
7. Manual validation → Ship it

---

## Notes

- [P] tasks can run in parallel (different files, no dependencies between them)
- [Story] label maps task to the user story it primarily serves
- US4 (partial recovery) has no dedicated tasks — it is an emergent property of the idempotent detection/creation design in T007 and the retry mechanism in T008
- All branding strings (folder name, sheet name, calendar name) come from `src/config/branding.ts` — never hardcoded
- No automated test tasks — validation is via manual testing per quickstart.md
- StrictMode guard (ref-based lock) is an explicit requirement in T008, not a separate task
- Calendar name collision reuse is an explicit requirement in T006, not a separate task
