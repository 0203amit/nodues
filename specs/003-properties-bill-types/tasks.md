# Tasks: Properties & Bill Types Management

**Feature**: 003-properties-bill-types | **Generated**: 2026-05-28

**Legend**: `[P]` = parallelizable with other `[P]` tasks in the same group. Tasks without `[P]` must complete before the next group begins.

---

## Group 1: Shared Types

### T001 — Create shared types file `src/types/index.ts`

**File**: `src/types/index.ts` (NEW)

Create the shared TypeScript types used by all services and components.

**What to implement**:
- `Frequency` type: `'monthly' | 'quarterly' | 'annual' | 'one-time'`
- `FREQUENCY_OPTIONS` constant array with `{ value, label }` pairs
- `Property` interface with `_rowIndex`, `id`, `name`, `address`, `notes`, `active`, `createdAt`, `deletedAt`
- `PropertyFormData` interface with `name`, `address`, `notes`
- `BillType` interface with `_rowIndex`, `id`, `propertyId`, `name`, `defaultAmount` (`number | null`), `defaultDueDay` (`number | null`), `frequency`, `reminderOffsetsDays` (`number[]`), `active`, `createdAt`, `deletedAt`
- `BillTypeWithProperty` extending `BillType` with `propertyName`, `propertyDeleted`, `propertyActive`
- `BillTypeFormData` interface with `propertyId`, `name`, `defaultAmount` (string), `defaultDueDay` (string), `frequency`, `reminderOffsetsDays` (string)
- `RowWithIndex` interface with `rowIndex` (number) and `values` (string[])

**Contract**: `specs/003-properties-bill-types/contracts/types.ts`

**Verify**: Import compiles. Run `npx tsc --noEmit`.

---

## Group 2: sheetsService Extensions

### T002 — Add `readAllRows`, `updateRow`, `updateCell` to `sheetsService.ts`

**File**: `src/services/sheetsService.ts` (MODIFIED)

Add three generic Sheet helper functions. These extend the existing service — do NOT duplicate existing functions.

**What to implement**:

1. **`readAllRows(accessToken, spreadsheetId, tabName): Promise<RowWithIndex[]>`**
   - Import `HEADER_DEFINITIONS` from `schema.ts` and `RowWithIndex` from `types/index.ts`.
   - Look up the header definition for `tabName` to determine last column letter.
   - Read range `'TabName'!A2:{lastCol}` using existing `readValues`.
   - Map each returned row to `{ rowIndex: i + 2, values: row }` (0-based array index → 1-based row, +1 for header).
   - Return empty array if `readValues` returns null or no rows.

2. **`updateRow(accessToken, spreadsheetId, tabName, rowIndex, values): Promise<void>`**
   - Look up header definition to determine last column letter.
   - Construct range `'TabName'!A{rowIndex}:{lastCol}{rowIndex}`.
   - Call existing `writeValues(accessToken, spreadsheetId, range, [values])`.

3. **`updateCell(accessToken, spreadsheetId, tabName, rowIndex, columnIndex, value): Promise<void>`**
   - Convert 0-based `columnIndex` to column letter via `columnLetter(columnIndex + 1)`.
   - Construct range `'TabName'!{letter}{rowIndex}`.
   - Call `writeValues(accessToken, spreadsheetId, range, [[value]])`.

**Contract**: `specs/003-properties-bill-types/contracts/services.ts` (ReadAllRows, UpdateRow, UpdateCell types)

**Verify**: Import compiles. Run `npx tsc --noEmit`.

---

## Group 3: Domain Services

### T003 — Create `propertiesService.ts` with parseRow, serializeRow, fetchProperties, addProperty [P]

**File**: `src/services/propertiesService.ts` (NEW)

Implement the core read/create functions for properties.

**What to implement**:

1. **Column index map**: Derive `COL` from `HEADER_DEFINITIONS` for `'Properties'` tab:
   ```
   const PROPERTY_HEADERS = HEADER_DEFINITIONS.find(d => d.tabName === 'Properties')!.headers;
   const COL = Object.fromEntries(PROPERTY_HEADERS.map((h, i) => [h, i]));
   ```

2. **`parseRow(row: RowWithIndex): Property | null`**
   - Map `row.values[COL.fieldName]` to typed Property fields.
   - Convert `active` from `'true'`/`'false'` string to boolean.
   - **Malformed-row tolerance**: Return `null` if `row.values` is too short, or if `id` is missing/empty. Callers skip nulls gracefully — the list never crashes on a bad row.

3. **`serializeRow(property: Property): string[]`**
   - Convert typed Property back to string array in column order for full-row writes.
   - Order: `[id, name, address, notes, String(active), createdAt, deletedAt]`.

4. **`fetchProperties(accessToken, spreadsheetId): Promise<Property[]>`**
   - Call `readAllRows('Properties')`.
   - Parse each row via `parseRow`, skip nulls.
   - Filter out rows where `deletedAt !== ''`.

5. **`addProperty(accessToken, spreadsheetId, data: PropertyFormData): Promise<Property>`**
   - Generate UUID via `uuidv4()`, set `active = true`, `createdAt = new Date().toISOString()`, `deletedAt = ''`.
   - Call `appendRows('Properties', [[id, name, address, notes, 'true', createdAt, '']])`.
   - Return the constructed `Property` object (with a placeholder `_rowIndex` — caller should refetch if index is needed, but for list append the index is not immediately required).

**Contract**: `specs/003-properties-bill-types/contracts/services.ts` (FetchProperties, AddProperty)

**Verify**: Import compiles. `npx tsc --noEmit`.

### T004 — Add updateProperty, togglePropertyActive, softDeleteProperty, undoDeleteProperty [P]

**File**: `src/services/propertiesService.ts` (continued)

Add the remaining mutation functions to propertiesService.

**What to implement**:

1. **`updateProperty(accessToken, spreadsheetId, property: Property, data: PropertyFormData): Promise<Property>`**
   - **Full-row update safety**: Reconstruct the full row from the EXISTING `property` entity. Start with `serializeRow(property)`, then swap ONLY the user-edited fields (`name`, `address`, `notes`) from `data`. This ensures `id`, `active`, `created_at`, `deleted_at` are never dropped or overwritten by form data.
   - Call `updateRow('Properties', property._rowIndex, reconstructedRow)`.
   - Return updated Property with new field values applied.

2. **`togglePropertyActive(accessToken, spreadsheetId, property: Property): Promise<Property>`**
   - Compute `newActive = !property.active`.
   - Call `updateCell('Properties', property._rowIndex, COL.active, String(newActive))`.
   - Return property with toggled `active`.

3. **`softDeleteProperty(accessToken, spreadsheetId, property: Property): Promise<void>`**
   - Set `deleted_at` to `new Date().toISOString()`.
   - Call `updateCell('Properties', property._rowIndex, COL.deleted_at, isoNow)`.
   - **Non-cascading soft-delete**: This function ONLY writes the property's own `deleted_at` cell. It must NOT touch any BillType rows. Bill types under this property remain unchanged.

4. **`undoDeleteProperty(accessToken, spreadsheetId, property: Property): Promise<void>`**
   - Call `updateCell('Properties', property._rowIndex, COL.deleted_at, '')`.

**Contract**: `specs/003-properties-bill-types/contracts/services.ts` (UpdateProperty, TogglePropertyActive, SoftDeleteProperty, UndoDeleteProperty)

**Verify**: Import compiles. `npx tsc --noEmit`.

### T005 — Create `billTypesService.ts` with parseRow, serializeRow, fetchBillTypes, addBillType [P]

**File**: `src/services/billTypesService.ts` (NEW)

Implement the core read/create functions for bill types.

**What to implement**:

1. **Column index map**: Derive `COL` from `HEADER_DEFINITIONS` for `'BillTypes'` tab.

2. **`parseRow(row: RowWithIndex): BillType | null`**
   - Map `row.values[COL.fieldName]` to typed BillType fields.
   - Convert `active` from string to boolean.
   - Convert `default_amount`: `'' → null`, otherwise `Number(value)`.
   - Convert `default_due_day`: `'' → null`, otherwise `Number(value)`.
   - Convert `reminder_offsets_days`: `'' → []`, otherwise `value.split(',').map(s => parseInt(s.trim(), 10))`.
   - **Malformed-row tolerance**: Return `null` if `row.values` is too short, or if `id` is missing/empty. Callers skip nulls — the list never crashes on a bad row.

3. **`serializeRow(billType: BillType): string[]`**
   - Convert typed BillType back to string array in column order.
   - Order: `[id, propertyId, name, defaultAmount ?? '', defaultDueDay ?? '', frequency, reminderOffsetsDays.join(','), String(active), createdAt, deletedAt]`.

4. **`fetchBillTypes(accessToken, spreadsheetId): Promise<BillTypeWithProperty[]>`**
   - Call `readAllRows('BillTypes')` and `readAllRows('Properties')`.
   - Parse BillType rows via `parseRow`, skip nulls, filter `deletedAt !== ''`.
   - Parse Property rows to build a lookup map: `id → { name, active, deletedAt }`.
   - Enrich each BillType with `propertyName`, `propertyDeleted`, `propertyActive` from the lookup.
   - If a bill type's `property_id` doesn't match any property, use `propertyName: 'Unknown'`, `propertyDeleted: false`, `propertyActive: false`.

5. **`addBillType(accessToken, spreadsheetId, data: BillTypeFormData): Promise<BillType>`**
   - Generate UUID, set `active = true`, `createdAt = now`, `deletedAt = ''`.
   - Parse `defaultAmount` from string: `data.defaultAmount.trim() === '' ? '' : data.defaultAmount`.
   - Parse `defaultDueDay` from string similarly.
   - Parse `reminderOffsetsDays` from comma-separated string.
   - Call `appendRows('BillTypes', [[...]])`.
   - Return constructed BillType.

**Contract**: `specs/003-properties-bill-types/contracts/services.ts` (FetchBillTypes, AddBillType)

**Verify**: Import compiles. `npx tsc --noEmit`.

### T006 — Add updateBillType, toggleBillTypeActive, softDeleteBillType, undoDeleteBillType [P]

**File**: `src/services/billTypesService.ts` (continued)

Add the remaining mutation functions.

**What to implement**:

1. **`updateBillType(accessToken, spreadsheetId, billType: BillType, data: BillTypeFormData): Promise<BillType>`**
   - **Full-row update safety**: Reconstruct the full row from the EXISTING `billType` entity via `serializeRow(billType)`, then swap ONLY the user-edited fields (`name`, `default_amount`, `default_due_day`, `frequency`, `reminder_offsets_days`) from `data`. This ensures `id`, `property_id`, `active`, `created_at`, `deleted_at` are never dropped or overwritten.
   - **Immutable property_id**: The `property_id` in the reconstructed row MUST come from the existing `billType.propertyId`, NOT from `data.propertyId`. The form data's `propertyId` is ignored on update.
   - Call `updateRow('BillTypes', billType._rowIndex, reconstructedRow)`.
   - Return updated BillType.

2. **`toggleBillTypeActive(accessToken, spreadsheetId, billType: BillType): Promise<BillType>`**
   - Compute `newActive = !billType.active`.
   - Call `updateCell('BillTypes', billType._rowIndex, COL.active, String(newActive))`.
   - Return billType with toggled active.

3. **`softDeleteBillType(accessToken, spreadsheetId, billType: BillType): Promise<void>`**
   - Call `updateCell('BillTypes', billType._rowIndex, COL.deleted_at, new Date().toISOString())`.

4. **`undoDeleteBillType(accessToken, spreadsheetId, billType: BillType): Promise<void>`**
   - Call `updateCell('BillTypes', billType._rowIndex, COL.deleted_at, '')`.

**Contract**: `specs/003-properties-bill-types/contracts/services.ts` (UpdateBillType, ToggleBillTypeActive, SoftDeleteBillType, UndoDeleteBillType)

**Verify**: Import compiles. `npx tsc --noEmit`.

---

## Group 4: ToastContext + Shared Components

### T007 — Create `ToastContext.tsx` with showToast, showUndo, dismiss [P]

**File**: `src/contexts/ToastContext.tsx` (NEW)

**What to implement**:

- `ToastProvider` component wrapping children with context.
- State: `{ toasts: Toast[], undoSnackbar: UndoSnackbar | null }`.
- `showToast(message, variant)`: Add a toast with a unique ID. Auto-remove after 4 seconds via `setTimeout`.
- `showUndo(message, onUndo, durationMs = 10000)`: Set `undoSnackbar`. Auto-dismiss after `durationMs`. If user taps Undo, call `onUndo()` and dismiss immediately. Only one undo snackbar at a time (new one replaces old).
- `dismiss(id)`: Remove a toast or snackbar by ID.
- `useToast()` hook: Returns `ToastContextValue` from context.
- Clean up timers on unmount.

**Contract**: `specs/003-properties-bill-types/contracts/components.ts` (ToastContextValue, Toast, UndoSnackbar)

**Reference**: MASTER.md section 5.7 for toast styling specs.

**Verify**: Import compiles. `npx tsc --noEmit`.

### T008 — Create `ToastContainer.tsx` that renders toasts and undo snackbar [P]

**File**: `src/components/shared/ToastContainer.tsx` (NEW)

**What to implement**:

- Reads `toasts` and `undoSnackbar` from `useToast()`.
- Renders as a `fixed` overlay at bottom of viewport.
- Mobile: `fixed bottom-4 left-4 right-4` (full width).
- Desktop: `fixed bottom-4 right-4 w-80` via `md:left-auto md:right-4 md:w-80`.
- Success toast: `bg-emerald-50 border border-emerald-200 text-emerald-900`, dismiss X button.
- Error toast: `bg-red-50 border border-red-200 text-red-900`, dismiss X button.
- Undo snackbar: `bg-slate-800 text-white` with "Undo" button styled as a ghost/text button in white. Shows message text.
- Stack multiple toasts vertically with `gap-2`.
- `z-50` to float above modals.
- Use `transition-all duration-200` per MASTER.md section 7.

**Reference**: MASTER.md sections 5.7, 7.

**Verify**: Renders without errors when imported.

### T009 — Create `ConfirmDialog.tsx` reusable modal [P]

**File**: `src/components/shared/ConfirmDialog.tsx` (NEW)

**What to implement**:

- Props: `ConfirmDialogProps` — `title`, `message`, `confirmLabel`, `confirmVariant` (`'primary' | 'destructive'`), `isLoading`, `onConfirm`, `onCancel`.
- Render: Fixed fullscreen backdrop (`fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50`).
- Modal panel: `bg-white rounded-xl max-w-md w-full p-6 shadow-xl`.
- Title: `text-lg font-semibold text-slate-900 mb-2`.
- Message: `text-sm text-slate-600 mb-4`.
- Buttons: Cancel (secondary) on left, Confirm (primary or destructive) on right.
  - Destructive: `bg-red-600 hover:bg-red-700 text-white`.
  - Primary: `bg-indigo-700 hover:bg-indigo-800 text-white`.
  - Both: `disabled:opacity-50 disabled:cursor-not-allowed` when `isLoading`.
- Cancel button calls `onCancel`. Confirm button calls `onConfirm`.
- Keyboard: Close on Escape key.
- All buttons min 44px touch target.

**Reference**: MASTER.md sections 5.1 (buttons), 5.6 (modals), 8 (accessibility).

**Contract**: `specs/003-properties-bill-types/contracts/components.ts` (ConfirmDialogProps)

**Verify**: Renders without errors when imported with mock props.

### T010 — Create `StatusBadge.tsx` component [P]

**File**: `src/components/shared/StatusBadge.tsx` (NEW)

**What to implement**:

- Props: `{ active: boolean }`.
- When `active === true`: Render badge with text "Active", styled `bg-emerald-50 text-emerald-700`.
- When `active === false`: Render badge with text "Inactive", styled `bg-slate-100 text-slate-600`.
- Badge markup: `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ...">`.
- Include `aria-label="Status: Active"` / `aria-label="Status: Inactive"` for screen readers.

**Reference**: MASTER.md section 5.2 (status badges), 8 (accessibility).

**Verify**: Renders with `active={true}` and `active={false}`.

---

## Group 5: Settings Feature Components

### T011 — Create `PropertyCard.tsx` list item component [P]

**File**: `src/components/settings/PropertyCard.tsx` (NEW)

**What to implement**:

- Props: `PropertyCardProps` — `property`, `onEdit`, `onToggleActive`, `onDelete`, `isLoading`.
- Card: `bg-white border border-slate-200 rounded-lg p-4` per MASTER.md 5.4.
- Layout:
  - Top row: Property name (`text-base font-semibold text-slate-900`) + `<StatusBadge active={property.active} />`.
  - Second row (if address exists): Address in `text-sm text-slate-600`.
  - Action row: Edit (ghost button, `text-indigo-700`), Delete (ghost button, `text-red-600`), Toggle active/inactive (ghost button).
  - All action buttons: `min-h-11 min-w-11` touch target, `cursor-pointer`.
- When `isLoading` is true, show a spinner on the currently-loading action button and disable all action buttons.
- Use `<button>` elements (not `<div onClick>`).
- Lucide icons: `Pencil` for edit, `Trash2` for delete, `ToggleLeft`/`ToggleRight` or text for toggle.

**Reference**: MASTER.md sections 5.1, 5.4, 6, 8.

**Contract**: `specs/003-properties-bill-types/contracts/components.ts` (PropertyCardProps)

**Verify**: Renders with mock property data.

### T012 — Create `PropertyFormModal.tsx` for add/edit property [P]

**File**: `src/components/settings/PropertyFormModal.tsx` (NEW)

**What to implement**:

- Props: `PropertyFormModalProps` — `property` (null for add, populated for edit), `isSaving`, `onSubmit`, `onClose`.
- Modal layout per MASTER.md 5.6: backdrop + centered panel.
- Title: "Add Property" or "Edit Property" based on `property` being null or not.
- Fields:
  - **Name** (required): `<input type="text">`, 16px+ font, label above, red asterisk for required.
  - **Address** (optional): `<input type="text">`.
  - **Notes** (optional): `<textarea>`.
- Pre-fill fields from `property` in edit mode.
- Client-side validation: Name must be non-empty after trim. Error shown as `text-red-600 text-xs mt-1` below the field.
- Submit button: Primary style, disabled + spinner when `isSaving`. Text: "Add Property" / "Save Changes".
- Cancel button: Secondary style, calls `onClose`.
- Close on Escape key.
- All inputs have `<label>` elements per MASTER.md 8.

**Reference**: MASTER.md sections 5.1, 5.3, 5.6, 8.

**Contract**: `specs/003-properties-bill-types/contracts/components.ts` (PropertyFormModalProps)

**Verify**: Renders in add mode and edit mode with mock data.

### T013 — Create `BillTypeCard.tsx` list item component [P]

**File**: `src/components/settings/BillTypeCard.tsx` (NEW)

**What to implement**:

- Props: `BillTypeCardProps` — `billType` (BillTypeWithProperty), `onEdit`, `onToggleActive`, `onDelete`, `isLoading`.
- Card: `bg-white border border-slate-200 rounded-lg p-4`.
- Layout:
  - Top row: Bill type name (`text-base font-semibold text-slate-900`) + `<StatusBadge active={billType.active} />`.
  - Second row: Property name + frequency (e.g., "Mira Shop · Monthly") in `text-sm text-slate-600`.
    - If `propertyDeleted`, show property name with `text-slate-400 line-through` or similar visual indication.
  - Third row (if applicable): "Due day: {defaultDueDay}" and/or "Amount: ₹{defaultAmount}" if set.
  - Action row: Edit, Delete, Toggle — same pattern as PropertyCard.
- When `isLoading`, show spinner and disable actions.
- Use `Intl.NumberFormat('en-IN', ...)` for amount display per MASTER.md 9 (anti-pattern #10).

**Reference**: MASTER.md sections 5.1, 5.4, 6, 8, 9.

**Contract**: `specs/003-properties-bill-types/contracts/components.ts` (BillTypeCardProps)

**Verify**: Renders with mock BillTypeWithProperty data.

### T014 — Create `BillTypeFormModal.tsx` for add/edit bill type [P]

**File**: `src/components/settings/BillTypeFormModal.tsx` (NEW)

**What to implement**:

- Props: `BillTypeFormModalProps` — `billType` (null=add), `availableProperties`, `isSaving`, `onSubmit`, `onClose`.
- Modal layout per MASTER.md 5.6.
- Title: "Add Bill Type" / "Edit Bill Type".
- Fields:
  - **Property** (required): `<select>` dropdown of `availableProperties`. On add: required, selectable. On edit: **read-only display** (shows property name as plain text or disabled input). **Immutable property_id**: The edit form shows property read-only; the user cannot change it. `onSubmit` receives form data but `updateBillType` (T006) ignores `data.propertyId` on update.
  - **Name** (required): `<input type="text">`, red asterisk.
  - **Default Amount** (optional): `<input type="number">`, placeholder "0".
  - **Default Due Day** (optional): `<input type="number">`, placeholder "1–31".
  - **Frequency** (required): `<select>` with `FREQUENCY_OPTIONS`.
  - **Reminder Offsets** (optional): `<input type="text">`, placeholder "e.g. 7,3,1", helper text.
- Pre-fill all fields from `billType` in edit mode.
- If `availableProperties` is empty, show "No active properties. Add a property first." and disable the form.
- Client-side validation (all rules from plan.md Validation Rules Summary):
  - Name: non-empty after trim.
  - Property: must be selected (add mode).
  - Frequency: must be selected.
  - Default amount: if provided, must be >= 0.
  - Default due day: if provided, integer 1–31.
  - Reminder offsets: if provided, comma-separated positive integers. Whitespace tolerated.
- Validation errors: `text-red-600 text-xs mt-1` below respective input.
- Submit button: Primary, disabled + spinner when `isSaving`.
- Cancel: Secondary, calls `onClose`. Close on Escape.

**Reference**: MASTER.md sections 5.1, 5.3, 5.6, 8.

**Contract**: `specs/003-properties-bill-types/contracts/components.ts` (BillTypeFormModalProps)

**Verify**: Renders in add and edit mode with mock data.

---

## Group 6: Page Components

### T015 — Build `PropertiesPage.tsx` with full CRUD operations

**File**: `src/pages/PropertiesPage.tsx` (NEW)

**What to implement**:

- Set `document.title` to `"NoDues · Properties"` on mount.
- Get `accessToken` from `useAuth()`, `spreadsheetId` from `useBootstrap().setupResult`.
- State:
  - `properties: Property[]`, `isLoading: boolean` (initial fetch), `loadingItemId: string | null` (per-item action), `modalMode: 'add' | 'edit' | null`, `editTarget: Property | null`, `isSaving: boolean`.
- **Initial fetch**: `useEffect` → `fetchProperties()` → `setProperties` → `setIsLoading(false)`. Show loading spinner during fetch (MASTER.md 5.8 pattern for empty state if no data).
- **Page header**: Back link ("← Settings" linking to `/settings`) + "Properties" heading + "Add Property" primary button.
- **List**: Render `PropertyCard` for each property. Pass `isLoading={loadingItemId === property.id}`.
- **Empty state**: If no properties after load, show empty state per MASTER.md 5.8.
- **Add flow**: "Add Property" → open `PropertyFormModal` in add mode → `addProperty(data)` → prepend/append to list → close modal → show success toast.
- **Edit flow**: Card edit button → open `PropertyFormModal` in edit mode → `updateProperty(property, data)` → update in list → close modal → success toast.
- **Toggle flow**: Card toggle → `setLoadingItemId` → `togglePropertyActive(property)` → update in list → clear `loadingItemId`. Error → error toast.
- **Delete flow**: Card delete → show `ConfirmDialog` → on confirm:
  - **Optimistic delete with rollback**: Immediately remove property from `properties` state (visual removal). Then call `softDeleteProperty`. Show undo snackbar for 10 seconds (`showUndo`). If the write fails, **reinsert the property back** into the list at its original position and show an error toast.
  - Undo callback: call `undoDeleteProperty` → reinsert property into list.
- **Error handling**: All service call failures → error toast via `useToast().showToast(message, 'error')`. UI remains usable (no blank screen, no stuck spinner).

**Dependencies**: T003, T004, T007, T009, T010, T011, T012.

**Verify**: Navigate to `/settings/properties`. Seed properties display. Add, edit, toggle, delete all work. Manual test per `quickstart.md`.

### T016 — Build `BillTypesPage.tsx` with full CRUD operations

**File**: `src/pages/BillTypesPage.tsx` (NEW)

**What to implement**:

- Set `document.title` to `"NoDues · Bill Types"` on mount.
- Get `accessToken` and `spreadsheetId` from hooks.
- State: Same pattern as PropertiesPage, plus `properties: Property[]` for the dropdown.
- **Initial fetch**: Fetch both `fetchBillTypes()` and `fetchProperties()` (the latter for the form dropdown — only active + non-deleted). Show loading spinner.
- **Page header**: Back link ("← Settings") + "Bill Types" heading + "Add Bill Type" primary button.
- **List**: Render `BillTypeCard` for each bill type.
- **Empty state**: Per MASTER.md 5.8.
- **Add flow**: Open `BillTypeFormModal` with `availableProperties` (active + non-deleted). On submit → `addBillType(data)` → append to list → close modal → success toast.
- **Edit flow**: Open `BillTypeFormModal` in edit mode. The property is shown read-only (per T014). On submit → `updateBillType(billType, data)` → update in list → close modal → success toast.
- **Toggle flow**: Same pattern as properties.
- **Delete flow**:
  - **Optimistic delete with rollback**: Immediately remove bill type from list. Call `softDeleteBillType`. Show undo snackbar. On write failure, reinsert and show error toast.
  - Undo: `undoDeleteBillType` → reinsert.
- **Error handling**: Same pattern as PropertiesPage.

**Dependencies**: T005, T006, T007, T009, T010, T013, T014.

**Verify**: Navigate to `/settings/bill-types`. Seed bill types display with property names. Add, edit, toggle, delete all work.

### T017 — Rewrite `SettingsPage.tsx` as settings hub with navigation cards [P]

**File**: `src/pages/SettingsPage.tsx` (MODIFIED)

**What to implement**:

- Set `document.title` to `"NoDues · Settings"`.
- Page heading: "Settings" (`text-2xl font-semibold text-slate-900`).
- Render navigation cards:
  1. **Properties**: `Building2` icon, "Manage your properties", links to `/settings/properties`.
  2. **Bill Types**: `Receipt` icon, "Configure bill categories", links to `/settings/bill-types`.
  3. **Notifications**: `Bell` icon, "Coming soon", `disabled` (opacity-50, cursor-not-allowed, no link).
- Each card: `bg-white border border-slate-200 rounded-lg p-4 hover:bg-slate-50 transition-colors cursor-pointer` (MASTER.md 5.4). Use `<Link>` from React Router for active cards.
- Lucide icons: `Building2`, `Receipt`, `Bell` — `w-5 h-5` per MASTER.md 6.
- No "Properties" or "Bill Types" text as emoji — Lucide SVG only.

**Reference**: MASTER.md sections 5.4, 6, 9 (anti-pattern #1).

**Verify**: Navigate to `/settings`. Cards render. Click navigates to sub-pages.

---

## Group 7: Routing & Wiring

### T018 — Add routes and ToastProvider to `App.tsx`

**File**: `src/App.tsx` (MODIFIED)

**What to implement**:

1. Import `ToastProvider` from `contexts/ToastContext`.
2. Import `ToastContainer` from `components/shared/ToastContainer`.
3. Import `PropertiesPage` and `BillTypesPage`.
4. Wrap the app's JSX tree with `<ToastProvider>` so any component can call `useToast()`. Place `<ToastContainer />` inside the provider, outside `<main>` (renders as fixed overlay).
5. Add two new routes inside the `<Route element={<BootstrapLayout />}>` group:
   - `<Route path="/settings/properties" element={<ProtectedRoute><PropertiesPage /></ProtectedRoute>} />`
   - `<Route path="/settings/bill-types" element={<ProtectedRoute><BillTypesPage /></ProtectedRoute>} />`

**Component hierarchy after change** (from plan.md):
```
<ToastProvider>
  <App>
    ...routes...
  </App>
  <ToastContainer />
</ToastProvider>
```

Note: `<ToastProvider>` may need to wrap at the `main.tsx` / entry-point level if `App` is not the outermost component. Check where `AuthProvider` is mounted and place `ToastProvider` just inside or alongside it, per the component architecture in plan.md.

**Dependencies**: T007, T008, T015, T016, T017.

**Verify**: All three routes (`/settings`, `/settings/properties`, `/settings/bill-types`) load correctly. Direct URL navigation works. Toast appears when triggered.

---

## Group 8: Validation & Polish

### T019 — End-to-end validation pass

**What to verify** (manual, per `quickstart.md`):

1. **Properties CRUD**:
   - Seed properties display on `/settings/properties`.
   - Add property → new row in Sheet with UUID, `active=true`, `created_at`, empty `deleted_at`.
   - Edit property → name/address/notes updated in Sheet; id/active/created_at/deleted_at preserved.
   - Toggle active → `active` column flips; badge updates.
   - Delete → confirmation → optimistic removal → undo snackbar for 10s → undo works.
   - Delete with no undo → property stays deleted on reload.

2. **Bill Types CRUD**:
   - Seed bill types display with correct property names.
   - Add bill type → new row with property_id, frequency, all fields.
   - Edit bill type → property shown read-only, property_id preserved. Editable fields update.
   - Toggle + Delete same as properties.

3. **Validation**:
   - Empty property name → blocked.
   - Empty bill type name → blocked.
   - No property selected → blocked.
   - No frequency selected → blocked.
   - Due day 0 or 32 → error message.
   - Amount -5 → error message.
   - Offsets "7,abc,1" → error message.

4. **Error states**:
   - Loading spinners show during fetch.
   - Form submit button disabled + spinner during save.
   - If Sheet write fails, error toast appears, UI remains usable.
   - Soft-delete write failure → item reappears (optimistic rollback).

5. **Cross-cutting**:
   - All pages set `document.title`.
   - Settings hub navigates correctly.
   - Direct URL navigation works for all 3 routes.
   - No console errors.
   - Mobile-first: test at 375px width.
   - MASTER.md compliance: indigo-700 primary, IBM Plex Sans, Lucide icons, slate neutrals, rounded-lg, 44px touch targets, focus rings, no emoji as icons.

**Dependencies**: All previous tasks.

---

## Task Dependency Graph

```
T001 (types)
  │
  ├─► T002 (sheetsService)
  │     │
  │     ├─► T003 [P] (propertiesService: read/create)
  │     ├─► T004 [P] (propertiesService: update/delete)
  │     ├─► T005 [P] (billTypesService: read/create)
  │     └─► T006 [P] (billTypesService: update/delete)
  │
  ├─► T007 [P] (ToastContext)
  ├─► T008 [P] (ToastContainer)  ← depends on T007 at runtime
  ├─► T009 [P] (ConfirmDialog)
  └─► T010 [P] (StatusBadge)
        │
        ├─► T011 [P] (PropertyCard)
        ├─► T012 [P] (PropertyFormModal)
        ├─► T013 [P] (BillTypeCard)
        └─► T014 [P] (BillTypeFormModal)
              │
              ├─► T015 (PropertiesPage)
              ├─► T016 (BillTypesPage)
              └─► T017 [P] (SettingsPage hub)
                    │
                    └─► T018 (App.tsx routing)
                          │
                          └─► T019 (Validation pass)
```

## Summary

| Group | Tasks | Count |
|-------|-------|-------|
| 1. Shared Types | T001 | 1 |
| 2. sheetsService | T002 | 1 |
| 3. Domain Services | T003, T004, T005, T006 | 4 (all [P]) |
| 4. Toast + Shared Components | T007, T008, T009, T010 | 4 (all [P]) |
| 5. Feature Components | T011, T012, T013, T014 | 4 (all [P]) |
| 6. Page Components | T015, T016, T017 | 3 (T017 is [P]) |
| 7. Routing & Wiring | T018 | 1 |
| 8. Validation | T019 | 1 |
| **Total** | | **19 tasks** |
