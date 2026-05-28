# Implementation Plan: Properties & Bill Types Management

**Branch**: `003-properties-bill-types` | **Date**: 2026-05-28 | **Spec**: [spec.md](specs/003-properties-bill-types/spec.md)

**Input**: Feature specification from `/specs/003-properties-bill-types/spec.md`

## Summary

Add Settings pages for managing Properties and Bill Types via CRUD operations against the user's bootstrapped Google Sheet. Properties are top-level entities; Bill Types are scoped to a property. Both support list, add, edit, toggle active/inactive, and soft-delete with a 10-second undo snackbar. The service layer extends the existing `sheetsService.ts` with row-index-tracked reads and targeted row/cell writes. A new toast/snackbar notification system provides user feedback. All UI follows MASTER.md. Routes are nested under `/settings` inside the existing BootstrapGuard-protected area.

## Technical Context

**Language/Version**: TypeScript ~6.0.2 / React 19.2.6

**Primary Dependencies**: React 19, React Router 6.30.3, Tailwind CSS 3.4.19, Lucide React 1.16.0, Vite 8.0.12, `@react-oauth/google` 0.13.x, `uuid` 11.1.0

**Storage**: Google Sheets (all data in the bootstrapped spreadsheet). No local persistence — all state in React context + component state.

**Testing**: Manual testing via acceptance scenarios (no test framework configured).

**Target Platform**: Web browser (mobile-first SPA, 375px primary breakpoint)

**Project Type**: Single-page web application (client-only, no backend)

**Performance Goals**: Properties/Bill Types list loads within 3 seconds of navigation (SC-001, SC-006). Form submissions complete within 3 seconds. Optimistic delete provides instant visual feedback.

**Constraints**: Memory-only state, WCAG 2.1 AA compliance, no backend server, `drive.file` scope. All reads/writes go through Google Sheets API v4.

**Scale/Scope**: Single-user per browser tab, household app (1-4 users). 3-10 properties, 5-30 bill types typical.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution is not yet ratified (template placeholders only). No gates to enforce. Proceeding with standard engineering best practices.

**Post-Phase 1 re-check**: No constitution violations — constitution remains unratified.

## Project Structure

### Documentation (this feature)

```text
specs/003-properties-bill-types/
├── plan.md              # This file
├── research.md          # Phase 0 output — implementation pattern decisions
├── data-model.md        # Phase 1 output — entity definitions
├── quickstart.md        # Phase 1 output — developer setup guide
├── contracts/           # Phase 1 output — interface contracts
│   ├── types.ts         # Property, BillType, Frequency, form data interfaces
│   ├── services.ts      # Service function signatures
│   └── components.ts    # Component prop interfaces, toast system
├── checklists/
│   └── requirements.md  # Requirements checklist (via /speckit-checklist)
└── tasks.md             # Phase 2 output (via /speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── App.tsx                              # MODIFIED — nested /settings routes
├── types/
│   └── index.ts                         # NEW — Property, BillType, Frequency, form data types
├── services/
│   ├── googleApi.ts                     # UNCHANGED — reuse columnLetter, withRetry
│   ├── sheetsService.ts                 # MODIFIED — add readAllRows, updateRow, updateCell
│   ├── propertiesService.ts             # NEW — Property CRUD (fetch, add, update, toggle, delete, undo)
│   └── billTypesService.ts              # NEW — BillType CRUD (fetch, add, update, toggle, delete, undo)
├── contexts/
│   ├── AuthContext.tsx                   # UNCHANGED
│   ├── BootstrapContext.tsx              # UNCHANGED
│   └── ToastContext.tsx                  # NEW — Toast + undo snackbar notification system
├── components/
│   ├── shared/
│   │   ├── Navbar.tsx                   # UNCHANGED
│   │   ├── ConfirmDialog.tsx            # NEW — reusable confirmation modal
│   │   ├── StatusBadge.tsx              # NEW — active/inactive badge component
│   │   └── ToastContainer.tsx           # NEW — renders toast queue + undo snackbar
│   ├── settings/
│   │   ├── PropertyCard.tsx             # NEW — single property list item
│   │   ├── PropertyFormModal.tsx        # NEW — add/edit property form modal
│   │   ├── BillTypeCard.tsx             # NEW — single bill type list item
│   │   └── BillTypeFormModal.tsx        # NEW — add/edit bill type form modal
│   ├── auth/
│   │   ├── ProtectedRoute.tsx           # UNCHANGED
│   │   └── ErrorBanner.tsx              # UNCHANGED
│   └── bootstrap/
│       └── BootstrapGuard.tsx           # UNCHANGED
└── pages/
    ├── SettingsPage.tsx                 # MODIFIED — rewritten as settings hub with nav cards
    ├── PropertiesPage.tsx               # NEW — properties list + CRUD operations
    └── BillTypesPage.tsx                # NEW — bill types list + CRUD operations
```

**Structure Decision**: Single-project SPA structure continues from Phase 2. New directories: `src/types/` for shared TypeScript interfaces, `src/components/settings/` for feature-specific components. Domain services (`propertiesService.ts`, `billTypesService.ts`) sit alongside existing services. A `ToastContext` is added to the context layer following the established pattern.

### New Files (11)

| File | Purpose |
|------|---------|
| `src/types/index.ts` | Property, BillType, Frequency types; form data interfaces |
| `src/services/propertiesService.ts` | Property CRUD: fetch, add, update, toggle active, soft-delete, undo |
| `src/services/billTypesService.ts` | BillType CRUD: fetch, add, update, toggle active, soft-delete, undo |
| `src/contexts/ToastContext.tsx` | Toast notifications + undo snackbar provider |
| `src/components/shared/ConfirmDialog.tsx` | Reusable confirmation modal (delete actions) |
| `src/components/shared/StatusBadge.tsx` | Active/Inactive badge following MASTER.md |
| `src/components/shared/ToastContainer.tsx` | Renders toast queue and undo snackbar |
| `src/components/settings/PropertyCard.tsx` | Property list item with actions |
| `src/components/settings/PropertyFormModal.tsx` | Add/Edit property form modal |
| `src/components/settings/BillTypeCard.tsx` | Bill type list item with actions |
| `src/components/settings/BillTypeFormModal.tsx` | Add/Edit bill type form modal |
| `src/pages/PropertiesPage.tsx` | Properties management page |
| `src/pages/BillTypesPage.tsx` | Bill Types management page |

### Modified Files (3)

| File | Changes |
|------|---------|
| `src/App.tsx` | Add nested routes: `/settings` (hub), `/settings/properties`, `/settings/bill-types`. Add ToastProvider wrapping. Import new pages. |
| `src/services/sheetsService.ts` | Add `readAllRows`, `updateRow`, `updateCell` functions |
| `src/pages/SettingsPage.tsx` | Rewrite from placeholder to Settings hub with navigation cards |

### New Dependencies

None. All existing dependencies are sufficient.

## Component Architecture

```text
<StrictMode>
  <BrowserRouter>
    <GoogleOAuthProvider clientId={VITE_GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <ToastProvider>                        ← NEW: wraps entire app for global notifications
          <App>
            ├── "/" → isAuthenticated ? <Navigate to="/dashboard"> : <LandingPage />
            └── <BootstrapProvider>
                  <BootstrapGuard>
                    ├── "/dashboard"            → <ProtectedRoute><DashboardPage /></ProtectedRoute>
                    ├── "/bills"                → <ProtectedRoute><BillsPage /></ProtectedRoute>
                    ├── "/todos"                → <ProtectedRoute><TodosPage /></ProtectedRoute>
                    ├── "/settings"             → <ProtectedRoute><SettingsPage /></ProtectedRoute>  ← hub (index)
                    ├── "/settings/properties"  → <ProtectedRoute><PropertiesPage /></ProtectedRoute> ← NEW
                    └── "/settings/bill-types"  → <ProtectedRoute><BillTypesPage /></ProtectedRoute>  ← NEW
                  </BootstrapGuard>
                </BootstrapProvider>
            └── <Navbar /> (when authenticated)
          </App>
          <ToastContainer />                   ← NEW: renders toasts/snackbars above everything
        </ToastProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  </BrowserRouter>
</StrictMode>
```

**Key design decisions**:

1. **ToastProvider wraps the app** so any component (including pages and service-triggered callbacks) can show notifications. `ToastContainer` renders as a fixed overlay.

2. **Flat routes, not nested layout route** for settings sub-pages. The hub at `/settings` is a standalone page. `/settings/properties` and `/settings/bill-types` are sibling routes. This is simpler than a nested `<Outlet />` layout since the sub-pages don't share a common chrome beyond the Navbar (which is already at the App level).

3. **Each page manages its own data** via `useAuth()` + `useBootstrap()` hooks. No additional context for properties/bill types — component-level state is sufficient since these pages are independent.

## Service Layer Design

### Generic Sheet Helpers (added to `sheetsService.ts`)

| Function | Signature | Purpose |
|----------|-----------|---------|
| `readAllRows` | `(accessToken, spreadsheetId, tabName) → Promise<RowWithIndex[]>` | Read all data rows (skip header), return with 1-based row indices |
| `updateRow` | `(accessToken, spreadsheetId, tabName, rowIndex, values) → Promise<void>` | Overwrite a full row at a given index |
| `updateCell` | `(accessToken, spreadsheetId, tabName, rowIndex, colIndex, value) → Promise<void>` | Write a single cell value |

**`readAllRows` implementation**:
1. Determine last column letter from `HEADER_DEFINITIONS` for the tab.
2. Read range `'TabName'!A2:{lastCol}` (all data rows).
3. Map each returned row to `{ rowIndex: i + 2, values: row }` (i is 0-based array index, +2 accounts for header row and 1-based indexing).
4. Return array (empty if no data rows).

**`updateRow` implementation**:
1. Determine last column letter from `HEADER_DEFINITIONS`.
2. Construct range `'TabName'!A{rowIndex}:{lastCol}{rowIndex}`.
3. Call existing `writeValues(accessToken, spreadsheetId, range, [values])`.

**`updateCell` implementation**:
1. Convert `colIndex` (0-based) to column letter via `columnLetter(colIndex + 1)`.
2. Construct range `'TabName'!{letter}{rowIndex}`.
3. Call `writeValues(accessToken, spreadsheetId, range, [[value]])`.

### Domain Services

#### `propertiesService.ts`

| Function | API Calls | Notes |
|----------|-----------|-------|
| `fetchProperties` | `readAllRows('Properties')` | Parse rows, filter `deleted_at === ''`, return `Property[]` |
| `addProperty` | `appendRows('Properties', [[...]])` | Generate UUID, set `active='true'`, `created_at=now`, `deleted_at=''` |
| `updateProperty` | `updateRow('Properties', rowIndex, [...])` | Reconstruct full row with updated name/address/notes |
| `togglePropertyActive` | `updateCell('Properties', rowIndex, activeColIdx, newValue)` | Write only the `active` column |
| `softDeleteProperty` | `updateCell('Properties', rowIndex, deletedAtColIdx, isoNow)` | Write only `deleted_at` |
| `undoDeleteProperty` | `updateCell('Properties', rowIndex, deletedAtColIdx, '')` | Clear `deleted_at` |

Column indices derived at import time from `HEADER_DEFINITIONS`:
```typescript
const PROPERTY_HEADERS = HEADER_DEFINITIONS.find(d => d.tabName === 'Properties')!.headers;
const COL = Object.fromEntries(PROPERTY_HEADERS.map((h, i) => [h, i]));
// COL.id = 0, COL.name = 1, COL.address = 2, COL.notes = 3, COL.active = 4, ...
```

#### `billTypesService.ts`

| Function | API Calls | Notes |
|----------|-----------|-------|
| `fetchBillTypes` | `readAllRows('BillTypes')` + `readAllRows('Properties')` | Parse rows, filter deleted, resolve property names |
| `addBillType` | `appendRows('BillTypes', [[...]])` | All BillType fields serialized to strings |
| `updateBillType` | `updateRow('BillTypes', rowIndex, [...])` | Full row rewrite; `property_id` preserved (not from form data) |
| `toggleBillTypeActive` | `updateCell('BillTypes', rowIndex, activeColIdx, newValue)` | Write only `active` column |
| `softDeleteBillType` | `updateCell('BillTypes', rowIndex, deletedAtColIdx, isoNow)` | Write only `deleted_at` |
| `undoDeleteBillType` | `updateCell('BillTypes', rowIndex, deletedAtColIdx, '')` | Clear `deleted_at` |

### Parsing and Serialization

Each domain service has `parseRow(rowWithIndex: RowWithIndex): Property | BillType | null` that:
1. Maps `values[COL.fieldName]` to typed fields.
2. Converts `'true'`/`'false'` strings to booleans.
3. Converts numeric strings to `number | null`.
4. Converts comma-separated strings to `number[]`.
5. Returns `null` for rows that are malformed (missing ID, etc.) — gracefully skipped.

Each service has `serializeRow(entity): string[]` that converts a typed object back to a string array in column order for writes.

## Toast / Notification System Design

### ToastContext

```text
ToastProvider
├── state: { toasts: Toast[], undoSnackbar: UndoSnackbar | null }
├── showToast(message, variant) → adds to toasts[], auto-removes after 4s
├── showUndo(message, onUndo, durationMs?) → sets undoSnackbar, auto-removes after durationMs
└── dismiss(id) → removes by ID
```

### ToastContainer

Renders as a fixed overlay at the bottom of the viewport. Follows MASTER.md section 5.7:
- Mobile: `fixed bottom-4 left-4 right-4` (full width)
- Desktop: `fixed bottom-4 right-4 w-80` (right-aligned)
- Success toast: `bg-emerald-50 border-emerald-200 text-emerald-900`
- Error toast: `bg-red-50 border-red-200 text-red-900`
- Undo snackbar: `bg-slate-800 text-white` with "Undo" button and countdown

### Undo Snackbar Lifecycle

```text
1. showUndo(message, onUndoFn, 10000)
2. Timer starts counting down
3. User taps "Undo" → onUndoFn() called → snackbar dismissed
   OR timer expires → snackbar dismissed
   OR dismiss(id) called programmatically (e.g., on navigation)
```

## Page-Level State Management

### PropertiesPage

```typescript
// State
const [properties, setProperties] = useState<Property[]>([]);
const [isLoading, setIsLoading] = useState(true);           // initial fetch
const [loadingItemId, setLoadingItemId] = useState<string | null>(null); // per-item action
const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
const [editTarget, setEditTarget] = useState<Property | null>(null);
const [isSaving, setIsSaving] = useState(false);             // form submit

// Data flow
useEffect → fetchProperties() → setProperties → setIsLoading(false)

// Actions
handleAdd → setModalMode('add')
handleEdit(property) → setEditTarget(property), setModalMode('edit')
handleSubmit(formData) → setIsSaving(true) → addProperty/updateProperty → update list → close modal
handleToggle(property) → setLoadingItemId → togglePropertyActive → update in list
handleDelete(property) → confirm → optimistic remove → softDeleteProperty → showUndo
handleUndo(property) → undoDeleteProperty → reinsert in list
```

### BillTypesPage

Same pattern as PropertiesPage, with the addition of:
- Fetches both bill types and properties (for the property dropdown and name resolution).
- Groups or annotates bill types with their property name.
- `availableProperties` (active + non-deleted) passed to the form modal.

## UI Layout Specifications

### Settings Hub (`/settings`)

```text
┌─────────────────────────────────┐
│ Settings              (heading) │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 🏢 Properties               │ │   ← Card with Building2 icon
│ │ Manage your properties      │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 📄 Bill Types               │ │   ← Card with Receipt icon
│ │ Configure bill categories   │ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 🔔 Notifications            │ │   ← Disabled, "Coming soon"
│ │ Coming soon                 │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

(Icons are Lucide SVG, not emoji — diagram uses emoji for readability.)

### Properties List (`/settings/properties`)

```text
┌─────────────────────────────────┐
│ ← Settings   Properties        │   ← Back link + heading
│                   [Add Property]│   ← Primary button
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Mira Shop          [Active] │ │   ← Property card
│ │ Address if any              │ │
│ │               [Edit] [Delete│ │   ← Ghost buttons
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Mira Flat          [Active] │ │
│ │               [Edit] [Delete│ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Chawl              [Active] │ │
│ │               [Edit] [Delete│ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### Bill Types List (`/settings/bill-types`)

```text
┌─────────────────────────────────┐
│ ← Settings   Bill Types        │
│                 [Add Bill Type] │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Maintenance        [Active] │ │
│ │ Mira Shop · Monthly         │ │   ← Property name + frequency
│ │ Due day: 5                  │ │
│ │               [Edit] [Delete│ │
│ └─────────────────────────────┘ │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ Property Tax       [Active] │ │
│ │ Mira Shop · Annual          │ │
│ │ Due day: 1 · Reminders: 30… │ │
│ │               [Edit] [Delete│ │
│ └─────────────────────────────┘ │
│ ...                             │
└─────────────────────────────────┘
```

## Validation Rules Summary

| Form | Field | Rule | Error Message |
|------|-------|------|---------------|
| Property | name | Non-empty after trim | "Property name is required." |
| BillType | name | Non-empty after trim | "Bill type name is required." |
| BillType | propertyId | Must be selected | "Please select a property." |
| BillType | frequency | Must be selected | "Please select a frequency." |
| BillType | defaultAmount | If provided, >= 0 | "Amount must be a non-negative number." |
| BillType | defaultDueDay | If provided, integer 1-31 | "Day must be between 1 and 31." |
| BillType | reminderOffsetsDays | If provided, comma-separated positive ints | "Offsets must be comma-separated positive integers." |

All validation is client-side, inline, and blocks form submission. Errors appear as `text-red-600 text-xs mt-1` below the respective input (per MASTER.md section 5.3).

## Complexity Tracking

No constitution violations to justify — constitution is unratified.
