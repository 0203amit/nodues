# Tasks: Bill File Attachments

**Feature Branch**: `005-bill-file-attachments` | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

**Ordering**: bottom-up (types → services → UI components → page wiring → polish).
Tasks marked **[P]** are parallelizable with other [P] tasks in the same group.

---

## Task 1 — Verify `folderId` field on `SetupResult`

**Why**: `uploadFile` passes `parents: [folderId]` to the Drive API. If the field
name is wrong, files land in Drive root instead of the NoDues folder. Must confirm
before writing any service code.

**Verified**: `SetupResult.folderId` is the correct field
(`specs/002-first-run-bootstrapping/contracts/bootstrap-context.ts:41`).
`BillsPage` accesses it via `useBootstrap().setupResult` (already destructured at
`src/pages/BillsPage.tsx:37`). No rename needed.

**Status**: Done (verification only — no code change).

---

## Task 2 — Add attachment types to `src/types/index.ts`  [P]

**File**: `src/types/index.ts`
**Contract**: `specs/005-bill-file-attachments/contracts/types.ts`
**Refs**: FR-012, FR-013, FR-014

Add the following types/interfaces at the end of the file, after the existing
`MarkPaidFormData` interface:

1. `DriveFileMetadata` — `{ id, name, mimeType, size?, thumbnailLink?, webViewLink? }`
2. `FileAttachment` — `{ fileId, metadata: DriveFileMetadata | null, isLoading, error: string | null, thumbnailUrl: string | null }`
3. `AttachmentCategory` — `'bill' | 'receipt'`
4. `UploadFileStatus` — `'pending' | 'uploading' | 'done' | 'failed'`
5. `UploadingFile` — `{ file: File, status: UploadFileStatus, error: string | null, driveFileId: string | null }`

**Test**: TypeScript compiles. Imported types resolve in later tasks.

---

## Task 3 — Add `uploadFile` to `driveService.ts`  [P]

**File**: `src/services/driveService.ts`
**Contract**: `specs/005-bill-file-attachments/contracts/services.ts` → `UploadFile`
**Refs**: FR-001, FR-006, FR-037, requirement #2

Implementation details:
- Endpoint: `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size`
- **Raw `fetch`** (NOT `googleApiFetch`) because the body is a `Blob`, not JSON.
- Boundary: `'nodues_upload_' + crypto.randomUUID().replace(/-/g, '')`.
- Build body via `new Blob([ boundary+metadata, metadata JSON, boundary+content-type, file, closing boundary ])`.
  The `File` object is embedded directly in the Blob array for binary safety.
- Content-Type header: `multipart/related; boundary=${boundary}`.
- Wrapped in `withRetry`.
- On `!response.ok`: parse JSON error body (with fallback), throw `GoogleApiRequestError`.
- Import `GoogleApiRequestError`, `GoogleApiErrorBody` from `./googleApi`. Import `DriveFileMetadata` from `../types`.

**Test**: Upload an image file via the browser; verify it appears in the NoDues
Drive folder with correct name and MIME type.

---

## Task 4 — Add `getFileMetadata` to `driveService.ts`  [P]

**File**: `src/services/driveService.ts`
**Contract**: `GetFileMetadata`
**Refs**: FR-002, FR-006

- URL: `${DRIVE_API}/files/${fileId}?fields=${encodeURIComponent(METADATA_FIELDS)}`.
- `METADATA_FIELDS = 'id,name,mimeType,size,thumbnailLink,webViewLink'`.
- Uses `googleApiFetch<DriveFileMetadata>` wrapped in `withRetry`.

**Test**: Call with a known Drive file ID; verify returned metadata has all fields.

---

## Task 5 — Add `getFileMetadataBatch` to `driveService.ts`  [P]

**File**: `src/services/driveService.ts`
**Contract**: `GetFileMetadataBatch`
**Refs**: FR-003

- Calls `getFileMetadata` per ID via `Promise.allSettled`.
- Maps results to `{ fileId, metadata?, error? }` array.
- Returns type: `Array<{ fileId: string; metadata?: DriveFileMetadata; error?: string }>`.

Depends on Task 4 (`getFileMetadata`) existing, but they're in the same file so
implement Task 4 first, then this.

**Test**: Pass 3 file IDs (2 valid, 1 fake). Verify 2 return metadata, 1 returns
error string. No rejection.

---

## Task 6 — Add `deleteFile` to `driveService.ts`  [P]

**File**: `src/services/driveService.ts`
**Contract**: `DeleteFile`
**Refs**: FR-004, FR-006, requirement #6

- `googleApiFetch<undefined>(accessToken, url, { method: 'DELETE' })` wrapped in `withRetry`.
- Catch block: if `error instanceof GoogleApiRequestError && error.status === 404`, return silently.
- Rethrow all non-404 errors.

**Test**: Delete a known file → succeeds. Delete same file again → no error (404
swallowed). Delete non-existent ID → no error.

---

## Task 7 — Add `getFileThumbnail` to `driveService.ts`  [P]

**File**: `src/services/driveService.ts`
**Contract**: `GetFileThumbnail`
**Refs**: FR-005, FR-038, requirement #3

- Endpoint: `${DRIVE_API}/files/${fileId}?alt=media`.
- **Raw `fetch`** with `Authorization: Bearer ${accessToken}` header.
  Token is NEVER in the query string.
- On success: `response.blob()` → `URL.createObjectURL(blob)`.
- On failure: parse error body, throw `GoogleApiRequestError`.
- Wrapped in `withRetry`.
- **Caller must revoke** the returned object URL.
- Only called for image MIME types; PDFs get a `FileText` icon (caller decides).

**Test**: Call with a known image file ID. Verify returned string starts with
`blob:`. Render in an `<img>` tag to confirm it displays.

---

## Task 8 — Add `parseFileIds` and `serializeFileIds` to `billsService.ts`  [P]

**File**: `src/services/billsService.ts`
**Contract**: `ParseFileIds`, `SerializeFileIds`
**Refs**: FR-010, FR-011, requirement #7

```ts
export function parseFileIds(csv: string): string[] {
  if (!csv || !csv.trim()) return [];
  return csv.split(',').map(s => s.trim()).filter(Boolean);
}

export function serializeFileIds(ids: string[]): string {
  return ids.filter(Boolean).join(',');
}
```

Edge cases:
- `''` → `[]`
- `'  '` → `[]`
- `',,'` → `[]` (no empty segments)
- `'a,,b,'` → `['a','b']` (no leading/trailing commas in output)
- `serializeFileIds([])` → `''`

**Test**: Pure functions — verify edge cases in the browser console or a quick
inline test.

---

## Task 9 — Add `addFileIdToBill` to `billsService.ts`

**File**: `src/services/billsService.ts`
**Contract**: `AddFileIdToBill`
**Refs**: FR-007, FR-009, requirement #7

- Reads existing IDs via `parseFileIds(bill[fieldKey])`, pushes new `fileId`,
  serializes back.
- `fieldKey = column === 'bill_file_ids' ? 'billFileIds' : 'receiptFileIds'`.
- Spreads `bill`, sets `[fieldKey]` and `updatedAt: new Date().toISOString()`.
- Writes full row via `updateRow(accessToken, spreadsheetId, TAB_NAME, bill._rowIndex, serializeRow(updatedBill))`.
- Returns the updated `Bill`.

Depends on Task 8 (`parseFileIds`/`serializeFileIds`).

**Test**: Upload a file, call `addFileIdToBill`. Verify the Sheet's
`bill_file_ids` cell contains the ID. Add a second file — verify comma-separated
with no double commas or leading commas.

---

## Task 10 — Add `removeFileIdFromBill` to `billsService.ts`

**File**: `src/services/billsService.ts`
**Contract**: `RemoveFileIdFromBill`
**Refs**: FR-008, FR-009, requirement #7

- Reads existing IDs, filters out the target `fileId`, serializes back.
- Same full-row-safety pattern as Task 9.
- Returns the updated `Bill`.

Depends on Task 8.

**Test**: Start with `bill_file_ids = 'abc,def,ghi'`. Remove `'def'`. Verify cell
is `'abc,ghi'`. Remove last ID — verify cell is `''` (no trailing comma).

---

## Task 11 — Create `AttachmentsModal` component

**File**: `src/components/bills/AttachmentsModal.tsx` (NEW)
**Contract**: `specs/005-bill-file-attachments/contracts/components.ts` → `AttachmentsModalProps`
**Refs**: FR-015 – FR-031, NFR-001, NFR-002, NFR-007, requirements #4, #5, #8
**Design ref**: `design-system/nodues/MASTER.md` §5.6 (Modals), §8 (Accessibility)

This is the largest task. Sub-steps:

### 11a — Modal shell + layout

- Props: `{ bill, folderId, onBillUpdated, onClose }`.
- Modal pattern per MASTER.md: `fixed inset-0 bg-slate-900/50`, `bg-white rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto`.
- `role="dialog"` with `aria-labelledby="attachments-modal-title"`.
- Title: "Attachments". Subtitle: `{billTypeName} · {propertyName} · {formatMonth(bill.month)}`.
- Close button (X) with `aria-label="Close attachments"`.
- Escape and backdrop click close the modal (unless `isUploading` is true).
- Two sections: "Bill Documents" and "Receipts", separated by `<hr>` or section headings.

### 11b — Metadata loading + state management

- On open: parse `bill.billFileIds` and `bill.receiptFileIds` via `parseFileIds`.
- Fetch metadata for all IDs via `getFileMetadataBatch`.
- For IDs where metadata is image MIME type, call `getFileThumbnail` to get
  object URL thumbnails.
- State: `billDocs: FileAttachment[]`, `receipts: FileAttachment[]`,
  `isLoadingMetadata: boolean`.
- Track a `currentBill` ref that threads the latest bill through upload loops.

### 11c — Object URL lifecycle (requirement #4)

- `objectUrlsRef = useRef<Map<string, string>>(new Map())`.
- When a thumbnail is created, store `fileId → objectUrl` in the map.
- On unmount/close: `revokeAllObjectUrls()` — iterate the map and revoke each.
- On individual file removal: revoke that file's URL and delete from map.
- Prevents memory leaks.

### 11d — File display

- Each file entry: if image MIME → `<img src={thumbnailUrl} className="w-16 h-16 object-cover rounded">`.
  If PDF → Lucide `FileText` icon (same dimensions).
- Show filename (truncated), file size (formatted from metadata.size bytes).
- "View" button → `window.open(\`https://drive.google.com/file/d/${fileId}/view\`, '_blank')`.
  `aria-label="View {filename} in Google Drive"`.
- "Remove" button → triggers confirm dialog. `aria-label="Remove {filename}"`.
- Empty states: "No bill documents attached" / "No receipts attached".
- Loading state: spinner while metadata is loading.

### 11e — File validation (requirement #8)

- `validateFile(file: File): string | null`.
- Checks: `file.size === 0` → "File is empty: {name}".
  `file.size > 10 * 1024 * 1024` → "File exceeds 10 MB limit: {name}".
  `!ALLOWED_MIME_TYPES.has(file.type)` → "Unsupported file type: {name}".
- `ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'])`.
- Validation runs before any network request.

### 11f — Upload flow (requirement #5)

- "Add Bill Document" / "Add Receipt" buttons → hidden `<input type="file" accept="image/*,.pdf" multiple capture="environment">`.
- File naming: `bill-{billId}-{category}-{timestamp}.{ext}`.
- On file select:
  1. Validate each file (11e). Invalid → status `'failed'` with error message.
  2. Set `uploadingFiles` state array with per-file status.
  3. Sequential loop over valid files:
     - Set file status → `'uploading'`, update state.
     - `await uploadFile(accessToken, file, folderId, fileName)`.
     - **Immediately** call `addFileIdToBill` after success, BEFORE the next file.
     - Thread `latestBill` through the loop: `latestBill = await addFileIdToBill(...)`.
     - Call `onBillUpdated(latestBill)` each time.
     - Set file status → `'done'`.
     - On error: set file status → `'failed'` with error message.
  4. After loop: refresh metadata list, clear `uploadingFiles`.
- During upload: disable close button, disable backdrop click, disable Escape.
- Upload progress section: show each file with status icon
  (checkmark/spinner/error).

### 11g — Remove flow (requirement #6)

- On "Remove" click: show `ConfirmDialog` with title "Remove attachment",
  message "This file will be permanently deleted from Google Drive. This cannot be undone."
- On confirm:
  1. Call `deleteFile(accessToken, fileId)`.
     - `deleteFile` swallows 404 (already gone) internally.
     - Non-404 errors throw → catch block keeps ID + shows error toast.
  2. On success: call `removeFileIdFromBill` → `onBillUpdated(updatedBill)`.
  3. Revoke object URL for this file if it exists.
  4. Refresh attachments list.
  5. Toast: "Attachment removed." on success, "Failed to remove attachment." on error.
- During remove: `isRemoving = true`, disable other remove buttons.

### 11h — Accessibility & MASTER.md compliance

- All interactive elements: 44px min touch targets (`min-h-11 min-w-11`).
- Focus rings: `focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`.
- `aria-label` on all buttons (remove, view, close, add).
- Lucide icons only (Paperclip, FileText, X, Upload, Loader2, Check, AlertCircle).
- No emoji. No gradients. `shadow-sm` max on internal elements.
- Responsive at 375px.

**Test**: Open modal for a bill with 0 files → empty states shown. Upload 2 images
and 1 PDF → sequential upload, per-file progress, all appear in list. Images show
thumbnails, PDF shows icon. View opens Drive tab. Remove with confirmation deletes
from Drive and updates sheet. Close revokes object URLs.

---

## Task 12 — Add Paperclip indicator + Files action to `BillCard`

**File**: `src/components/bills/BillCard.tsx`
**Contract**: `BillCardPropsExtension`
**Refs**: FR-032, FR-033, FR-034, requirement #9
**Design ref**: MASTER.md §6 (Icons), §8 (Accessibility)

Changes:
1. Import `Paperclip` from `lucide-react`.
2. Import `parseFileIds` from `../../services/billsService`.
3. Add `onViewAttachments: (bill: BillWithDisplay) => void` to `BillCardProps`.
4. Compute `attachmentCount`:
   ```ts
   const attachmentCount = parseFileIds(bill.billFileIds).length + parseFileIds(bill.receiptFileIds).length;
   ```
5. In the actions row (`flex items-center gap-1 mt-3`), add a Files button
   between Mark Paid and Delete (or after Edit if Mark Paid is hidden):
   ```tsx
   {attachmentCount > 0 && (
     <button
       type="button"
       onClick={() => onViewAttachments(bill)}
       disabled={isLoading}
       className="text-slate-600 hover:text-slate-800 hover:bg-slate-100
                  font-medium text-sm px-2 py-1 rounded transition-colors cursor-pointer
                  min-h-11 min-w-11 inline-flex items-center justify-center gap-1
                  disabled:opacity-50 disabled:cursor-not-allowed
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
       aria-label={`View ${attachmentCount} attachment${attachmentCount !== 1 ? 's' : ''}`}
     >
       <Paperclip className="w-4 h-4" />
       <span className="text-xs tabular-nums">{attachmentCount}</span>
     </button>
   )}
   ```
6. Also add a "Files" action button that always shows (for opening the modal even
   when count is 0):
   ```tsx
   <button
     type="button"
     onClick={() => onViewAttachments(bill)}
     disabled={isLoading}
     className="text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50
                font-medium text-sm px-2 py-1 rounded transition-colors cursor-pointer
                min-h-11 min-w-11 inline-flex items-center justify-center gap-1
                disabled:opacity-50 disabled:cursor-not-allowed
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
     aria-label="View attachments"
   >
     <Paperclip className="w-4 h-4" />
     <span className="hidden sm:inline">Files</span>
   </button>
   ```

   Wait — the spec says the Paperclip indicator with count is only shown when
   count > 0, and it IS the clickable element. There's also a separate "Files"
   action button. Let me re-read plan.md's BillCard section:

   > "Paperclip indicator + count (only when count>0), Files action button"

   So there are two things: a Paperclip count badge (shown conditionally) AND a
   "Files" action button. Both call `onViewAttachments`. The Paperclip indicator
   shows the count; the Files button is the named action. Per the plan layout:

   > `[Edit] [Mark Paid] [📎 3] [Delete]`

   This suggests the Paperclip+count replaces a separate "Files" label. The count
   badge IS the Files action. So implement as a single button:
   - When count > 0: show Paperclip icon + count number.
   - When count = 0: show just Paperclip icon (or hide entirely?).

   The spec (FR-032) says indicator only when count > 0. FR-033 says a "Files"
   action button. Reading both together: the action button always shows (it's how
   you open the modal to add files), and the count badge appears on it when > 0.

   Final implementation: **single button** with Paperclip icon + optional count.
   The button always shows. The count badge only renders when > 0.

**Test**: Bill with 0 files → Paperclip button shows, no count. Bill with 3 files
→ shows "📎 3". Click opens attachments modal.

---

## Task 13 — Wire `AttachmentsModal` into `BillsPage`

**File**: `src/pages/BillsPage.tsx`
**Refs**: FR-035, FR-036, requirement #9

Changes:
1. Import `AttachmentsModal` from `../components/bills/AttachmentsModal`.
2. Import `computeDisplayStatus` from `../services/billsService` (already imported
   transitively if needed).
3. Add state: `const [attachmentsTarget, setAttachmentsTarget] = useState<BillWithDisplay | null>(null);`
4. Add `folderId`: `const folderId = setupResult!.folderId;` (after the existing
   `spreadsheetId` line at line 37).
5. Add `handleViewAttachments`:
   ```ts
   function handleViewAttachments(bill: BillWithDisplay) {
     setAttachmentsTarget(bill);
   }
   ```
6. Add `handleBillUpdated`:
   ```ts
   function handleBillUpdated(updatedBill: Bill) {
     setBills((prev) =>
       prev.map((b) => {
         if (b.id !== updatedBill.id) return b;
         return {
           ...b,
           ...updatedBill,
           displayStatus: computeDisplayStatus(updatedBill.status, updatedBill.dueDate),
         };
       }),
     );
     setAttachmentsTarget((prev) => {
       if (!prev || prev.id !== updatedBill.id) return prev;
       return {
         ...prev,
         ...updatedBill,
         displayStatus: computeDisplayStatus(updatedBill.status, updatedBill.dueDate),
       };
     });
   }
   ```
7. Pass `onViewAttachments={handleViewAttachments}` to each `<BillCard>`.
8. Render `AttachmentsModal`:
   ```tsx
   {attachmentsTarget && (
     <AttachmentsModal
       bill={attachmentsTarget}
       folderId={folderId}
       onBillUpdated={handleBillUpdated}
       onClose={() => setAttachmentsTarget(null)}
     />
   )}
   ```

**Test**: Click "Files" on a BillCard → modal opens. Upload a file → modal updates
AND BillCard's Paperclip count updates (without page reload). Close modal → state
clears.

---

## Task 14 — End-to-end validation and polish

**Refs**: All FRs, NFRs, requirements #1–#9
**Design ref**: MASTER.md §10 (Pre-Delivery Checklist)

Checklist:
1. **Upload flow**: Select 3 files (1 invalid >10MB, 2 valid). Verify invalid is
   rejected before upload. Valid files upload sequentially. After each upload,
   Sheet cell updates. BillCard count updates.
2. **View flow**: Open modal after upload. Images show thumbnails. PDF shows
   FileText icon. Click "View" → opens Drive tab.
3. **Remove flow**: Remove a file → ConfirmDialog appears → file deleted from
   Drive → ID removed from Sheet → count updates. Try removing same file again
   (stale reference) → 404 handled gracefully.
4. **Object URL cleanup**: Open modal, close modal. Verify no blob: URLs remain
   (check via DevTools Performance/Memory tab).
5. **Empty states**: Bill with 0 files → "No bill documents attached" / "No
   receipts attached" with add buttons.
6. **Disable close during upload**: Start upload, try Escape/backdrop/X → blocked.
7. **Responsive**: Test at 375px width. Modal fits, thumbnails scale, buttons
   have 44px touch targets.
8. **Accessibility**: Tab through all controls. Focus rings visible. Screen
   reader reads aria-labels.
9. **Error handling**: Kill network mid-upload → error toast, file status shows
   failed, UI remains usable. Already-uploaded files in batch are preserved.
10. **TypeScript**: `npm run build` (or `npx tsc --noEmit`) passes with no errors.

**Test**: Manual walkthrough per `specs/005-bill-file-attachments/quickstart.md`.

---

## Dependency Graph

```
Task 1 (verify folderId)  ──── done (no code)
                                │
Task 2 (types)  ───────────────[P]──────────────────────────────────────┐
Task 3 (uploadFile)  ──────────[P]─────────────┐                       │
Task 4 (getFileMetadata)  ─────[P]──┐          │                       │
Task 5 (getFileMetadataBatch)  ─────┘ (4→5)    │                       │
Task 6 (deleteFile)  ──────────[P]──────────────┤                       │
Task 7 (getFileThumbnail)  ────[P]──────────────┤                       │
Task 8 (parseFileIds etc)  ────[P]──┐           │                       │
Task 9 (addFileIdToBill)  ─────────┘ (8→9)     │                       │
Task 10 (removeFileIdFromBill) ────── (8→10)    │                       │
                                │               │                       │
                                ├───────────────┴───────────────────────┘
                                ▼
Task 11 (AttachmentsModal)  ── depends on 2, 3, 4, 5, 6, 7, 8, 9, 10
                                │
Task 12 (BillCard changes)  ── depends on 2, 8
                                │
                                ▼
Task 13 (BillsPage wiring)  ── depends on 11, 12
                                │
                                ▼
Task 14 (validation/polish) ── depends on 13
```

**Parallelizable groups**:
- **Group A** [P]: Tasks 2, 3, 4, 6, 7, 8 (all independent — different files or pure additions)
- **Group B**: Tasks 5, 9, 10 (depend on items in Group A but within same file)
- **Group C**: Task 11 (depends on all service tasks)
- **Group D**: Task 12 (depends on types + parseFileIds; can parallel with 11)
- **Group E**: Task 13 (depends on 11 + 12)
- **Group F**: Task 14 (depends on 13)
