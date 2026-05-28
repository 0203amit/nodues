# Quickstart: First-Run Bootstrapping

**Branch**: `002-first-run-bootstrapping` | **Date**: 2026-05-28

## Prerequisites

1. Phase 1 (Google sign-in) is complete and working
2. Google Cloud Console project has these APIs enabled:
   - Google Drive API
   - Google Sheets API
   - Google Calendar API
3. `.env` file contains `VITE_GOOGLE_CLIENT_ID`
4. Node.js and npm are installed

## Setup

```bash
# Switch to the feature branch
git checkout 002-first-run-bootstrapping

# Install dependencies (no new packages for this feature)
npm install

# Start dev server
npm run dev
```

## New Dependency

```bash
# UUID generation for seed data
npm install uuid
npm install -D @types/uuid
```

## Manual Testing

### Test 1: First-Time User (Fresh Account)

1. Sign in with a Google account that has **never** used NoDues
2. Observe the bootstrapping progress UI (step-by-step indicators)
3. After completion, verify in Google Drive:
   - A folder named "NoDues" exists at the root
   - Inside it, a Sheet named "NoDues - Database" exists
   - The Sheet has 9 tabs with correct headers
   - Properties tab has 3 rows (Mira Shop, Mira Flat, Chawl)
   - BillTypes tab has 5 rows
   - TodoCategories tab has 4 rows
   - Config tab has 5 key-value rows
4. Verify in Google Calendar:
   - A calendar named "NoDues Reminders" exists

### Test 2: Returning User (Existing Setup)

1. Sign out and sign back in with the same account
2. Observe that bootstrapping is skipped (no progress UI)
3. You should land on the dashboard directly
4. Verify no duplicate resources were created in Drive or Calendar

### Test 3: Partial Setup Recovery

1. Sign in with a fresh account
2. During bootstrapping, disconnect the network after the folder is created but before the Sheet is created (use browser DevTools > Network > Offline)
3. Observe the error UI with a Retry button
4. Reconnect the network and click Retry
5. Verify that only the missing resources are created (folder is reused)

### Test 4: Error and Retry

1. During bootstrapping, if any step fails (simulate with DevTools throttling or network interruption)
2. Verify the error message identifies the failed step
3. Click Retry and verify the process resumes from the failed step

## File Structure (New/Modified)

```
src/
├── services/
│   ├── googleApi.ts              # NEW — Base fetch wrapper, error types, retry logic
│   ├── driveService.ts           # NEW — Drive folder/file operations
│   ├── sheetsService.ts          # NEW — Sheet creation, read/write operations
│   ├── calendarService.ts        # NEW — Calendar creation/discovery
│   └── bootstrapService.ts       # NEW — Orchestrates detection + bootstrap flow
├── contexts/
│   ├── AuthContext.tsx            # UNCHANGED
│   └── BootstrapContext.tsx       # NEW — Bootstrap state provider + useBootstrap hook
├── components/
│   └── bootstrap/
│       └── BootstrapGuard.tsx     # NEW — Wraps authenticated content, shows progress/error UI
├── config/
│   ├── branding.ts               # UNCHANGED (already has DRIVE_FOLDER_NAME, SHEET_NAME, CALENDAR_NAME)
│   └── schema.ts                 # NEW — Tab names, header definitions, seed data constants
├── App.tsx                        # MODIFIED — Add BootstrapGuard wrapper
└── pages/
    └── DashboardPage.tsx          # MODIFIED — Remove placeholder text, use setup result
```

## Key Architecture Decisions

- **No new npm packages** except `uuid` for seed data generation
- **All Google API calls use native `fetch()`** — no Google client libraries
- **Service modules are pure functions** — no React dependencies, easily testable
- **BootstrapContext wraps only authenticated routes** — sits between AuthProvider and page content
- **Detection flow is Drive-first** — avoids chicken-and-egg problem with Sheet ID
- **Config is written last** — acts as the "setup complete" marker
