# Quickstart: Properties & Bill Types Management

**Feature**: 003-properties-bill-types | **Date**: 2026-05-28

## Prerequisites

- Phase 1 (Auth) and Phase 2 (Bootstrapping) are complete and working.
- `npm install` has been run (no new dependencies needed for this phase).
- The app can sign in, bootstrap, and reach the Dashboard page.
- A Google Sheet exists with seed data (3 properties, 5 bill types).

## Development Setup

```bash
# Start the dev server
npm run dev

# The app runs at http://localhost:5173
# Sign in with Google to trigger bootstrapping
# Navigate to /settings after reaching the dashboard
```

## Key Files to Understand Before Coding

| File | Why |
|------|-----|
| `src/services/sheetsService.ts` | Extend with `readAllRows`, `updateRow`, `updateCell` |
| `src/services/googleApi.ts` | `columnLetter()` and `withRetry` are reused |
| `src/config/schema.ts` | `HEADER_DEFINITIONS` and `TAB_NAMES` define column order |
| `src/contexts/BootstrapContext.tsx` | `useBootstrap().setupResult.spreadsheetId` is the Sheet ID |
| `src/contexts/AuthContext.tsx` | `useAuth().accessToken` is the OAuth token |
| `src/App.tsx` | Routing setup — nested routes to be added under `/settings` |
| `design-system/nodues/MASTER.md` | All UI patterns: buttons, cards, forms, modals, toasts |

## Implementation Order

1. **Types** (`src/types/`) — Define `Property`, `BillType`, `Frequency`, form data interfaces.
2. **Sheet helpers** (`src/services/sheetsService.ts`) — Add `readAllRows`, `updateRow`, `updateCell`.
3. **Domain services** (`src/services/propertiesService.ts`, `src/services/billTypesService.ts`) — CRUD for each entity.
4. **Toast context** (`src/contexts/ToastContext.tsx`) — Notification system with undo snackbar.
5. **Shared UI** — `ConfirmDialog`, `StatusBadge` components.
6. **Settings hub** (`src/pages/SettingsPage.tsx`) — Rewrite as navigation hub.
7. **Properties page** (`src/pages/PropertiesPage.tsx`) — List, add, edit, toggle, delete.
8. **Bill Types page** (`src/pages/BillTypesPage.tsx`) — List, add, edit, toggle, delete.
9. **Routing** (`src/App.tsx`) — Wire nested routes under `/settings`.

## Manual Testing

After implementation, verify each acceptance scenario from the spec:

### Properties
1. Navigate to `/settings/properties` → see 3 seed properties.
2. Add a property → verify row appears in Sheet.
3. Edit a property → verify changes persist on reload.
4. Toggle active → verify badge change and Sheet update.
5. Delete → verify undo snackbar, verify Sheet `deleted_at` set.
6. Undo delete → verify property reappears.
7. Submit empty name → verify validation error.

### Bill Types
1. Navigate to `/settings/bill-types` → see 5 seed bill types with property names.
2. Add a bill type → verify property dropdown only shows active properties.
3. Edit → verify property field is read-only.
4. Toggle active → verify Sheet update.
5. Delete with undo → same pattern as properties.
6. Invalid due day (0 or 32) → verify validation error.
7. Invalid reminder offsets ("7,abc,1") → verify validation error.

### Settings Hub
1. Navigate to `/settings` → see Properties and Bill Types cards.
2. Click each card → verify navigation works.
3. Navigate directly to `/settings/properties` via URL → verify it loads.

## Column Index Reference

Derived from `HEADER_DEFINITIONS` in `schema.ts`:

### Properties Tab (7 columns)
| Index | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|-------|---|---|---|---|---|---|---|
| Column | A | B | C | D | E | F | G |
| Header | id | name | address | notes | active | created_at | deleted_at |

### BillTypes Tab (10 columns)
| Index | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|-------|---|---|---|---|---|---|---|---|---|---|
| Column | A | B | C | D | E | F | G | H | I | J |
| Header | id | property_id | name | default_amount | default_due_day | frequency | reminder_offsets_days | active | created_at | deleted_at |
