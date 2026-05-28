# Implementation Plan: Bill File Attachments

**Branch**: `005-bill-file-attachments` | **Date**: 2026-05-28 | **Spec**: [spec.md](specs/005-bill-file-attachments/spec.md)

**Input**: Feature specification from `/specs/005-bill-file-attachments/spec.md`

## Summary

Add file attachment support to bills: upload bill documents and payment receipts to Google Drive, store Drive file IDs in the existing `bill_file_ids` / `receipt_file_ids` Sheet columns, display attachments with image thumbnails and PDF icons in a new `AttachmentsModal`, remove files with Drive deletion, and show a Paperclip count indicator on `BillCard`. The feature extends existing `driveService.ts`, `billsService.ts`, `BillCard`, and `BillsPage` — no new contexts, no new pages, no new dependencies.

## Technical Context

**Language/Version**: TypeScript ~6.0.2 / React 19.2.6

**Primary Dependencies**: React 19, React Router 6.30.3, Tailwind CSS 3.4.19, Lucide React 1.16.0, Vite 8.0.12, `@react-oauth/google` 0.13.x, `uuid` 11.1.0

**Storage**: Google Drive (files) + Google Sheets (file ID references in bill columns). No local persistence.

**Testing**: Manual testing via acceptance scenarios (no test framework configured).

**Target Platform**: Web browser (mobile-first SPA, 375px primary breakpoint)

**Project Type**: Single-page web application (client-only, no backend)

**Performance Goals**: File uploads complete within network limits. Metadata batch-fetch completes within 3 seconds for up to 10 files. Object URLs created on demand, revoked on modal close.

**Constraints**: Memory-only state, WCAG 2.1 AA compliance, no backend server, `drive.file` scope. 10 MB max file size. Image + PDF only.

**Scale/Scope**: 1-10 attachments per bill typical. 20-200 bills in the app. Single-user per browser tab.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution is not yet ratified (template placeholders only). No gates to enforce. Proceeding with standard engineering best practices.

**Post-Phase 1 re-check**: No constitution violations — constitution remains unratified.

## Project Structure

### Documentation (this feature)

```text
specs/005-bill-file-attachments/
├── plan.md              # This file
├── research.md          # Phase 0 output — technical decisions
├── data-model.md        # Phase 1 output — entity definitions
├── quickstart.md        # Phase 1 output — developer setup guide
├── contracts/           # Phase 1 output — interface contracts
│   ├── types.ts         # DriveFileMetadata, FileAttachment, AttachmentCategory, UploadingFile
│   ├── services.ts      # driveService + billsService function signatures
│   └── components.ts    # AttachmentsModal props, BillCard extension, internal types
└── tasks.md             # Phase 2 output (via /speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── App.tsx                              # UNCHANGED — /bills route already exists
├── types/
│   └── index.ts                         # MODIFIED — add DriveFileMetadata, FileAttachment,
│                                        #   AttachmentCategory, UploadFileStatus, UploadingFile
├── services/
│   ├── googleApi.ts                     # UNCHANGED — reuse withRetry, GoogleApiRequestError,
│   │                                    #   isRetryableError, isAuthError (for raw fetch error handling)
│   ├── sheetsService.ts                 # UNCHANGED — reuse updateRow
│   ├── driveService.ts                  # MODIFIED — add uploadFile, getFileMetadata,
│   │                                    #   getFileMetadataBatch, deleteFile, getFileThumbnail
│   ├── billsService.ts                  # MODIFIED — add parseFileIds, serializeFileIds,
│   │                                    #   addFileIdToBill, removeFileIdFromBill
│   ├── propertiesService.ts             # UNCHANGED
│   └── billTypesService.ts              # UNCHANGED
├── contexts/
│   ├── AuthContext.tsx                   # UNCHANGED — provides accessToken
│   ├── BootstrapContext.tsx              # UNCHANGED — provides setupResult.folderId
│   └── ToastContext.tsx                  # UNCHANGED — reuse showToast
├── components/
│   ├── shared/
│   │   ├── ConfirmDialog.tsx            # UNCHANGED — reuse for remove confirmation
│   │   └── ToastContainer.tsx           # UNCHANGED
│   ├── bills/
│   │   ├── BillCard.tsx                 # MODIFIED — add Paperclip indicator + Files action
│   │   │                                #   + onViewAttachments prop
│   │   ├── AttachmentsModal.tsx          # NEW — attachments management modal
│   │   ├── BillFormModal.tsx            # UNCHANGED
│   │   ├── MarkPaidModal.tsx            # UNCHANGED
│   │   └── DuplicateWarningModal.tsx    # UNCHANGED
│   └── settings/                        # UNCHANGED
├── config/
│   └── schema.ts                        # UNCHANGED — Bills tab columns already defined
└── pages/
    └── BillsPage.tsx                    # MODIFIED — add AttachmentsModal state + onBillUpdated
```

### New Files (1)

| File | Purpose |
|------|---------|
| `src/components/bills/AttachmentsModal.tsx` | Attachments management modal: two sections (Bill Documents + Receipts), upload with validation and sequential processing, file list with image thumbnails and PDF icons, view in new tab, remove with confirmation |

### Modified Files (4)

| File | Changes |
|------|---------|
| `src/types/index.ts` | Add `DriveFileMetadata`, `FileAttachment`, `AttachmentCategory`, `UploadFileStatus`, `UploadingFile` |
| `src/services/driveService.ts` | Add `uploadFile`, `getFileMetadata`, `getFileMetadataBatch`, `deleteFile`, `getFileThumbnail` |
| `src/services/billsService.ts` | Add `parseFileIds`, `serializeFileIds`, `addFileIdToBill`, `removeFileIdFromBill` |
| `src/components/bills/BillCard.tsx` | Add Paperclip indicator with count badge, "Files" action button, `onViewAttachments` prop |
| `src/pages/BillsPage.tsx` | Add `attachmentsTarget` state, `handleViewAttachments`, `handleBillUpdated` handler, render `AttachmentsModal`, pass `folderId` |

### New Dependencies

None. All existing dependencies are sufficient.

## Service Layer Design

### Reused Helpers

- `withRetry` from `googleApi.ts` — retry with exponential backoff (wraps all new Drive calls)
- `GoogleApiRequestError` from `googleApi.ts` — error classification for 401/403/404/retryable
- `googleApiFetch` from `googleApi.ts` — for JSON-response Drive API calls (metadata, delete)
- `updateRow` from `sheetsService.ts` — full-row writes for bill column updates
- `serializeRow` from `billsService.ts` — convert Bill to row array

### New Drive Service Functions (`driveService.ts`)

#### `uploadFile(accessToken, file, folderId, fileName) → DriveFileMetadata`

```typescript
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size';

export async function uploadFile(
  accessToken: string,
  file: File,
  folderId: string,
  fileName: string,
): Promise<DriveFileMetadata> {
  return withRetry(async () => {
    const boundary = 'nodues_upload_' + crypto.randomUUID().replace(/-/g, '');
    const metadata = JSON.stringify({ name: fileName, parents: [folderId] });

    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      metadata,
      `\r\n--${boundary}\r\nContent-Type: ${file.type}\r\n\r\n`,
      file,
      `\r\n--${boundary}--\r\n`,
    ]);

    const response = await fetch(UPLOAD_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });

    if (!response.ok) {
      let errorBody: GoogleApiErrorBody;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = { error: { code: response.status, message: response.statusText, status: 'UNKNOWN' } };
      }
      throw new GoogleApiRequestError(response.status, errorBody);
    }

    return (await response.json()) as DriveFileMetadata;
  });
}
```

**Key design decisions** (see research.md R1, R2):
- Raw `fetch` (not `googleApiFetch`) because multipart body is a `Blob`, not JSON.
- `Blob` assembly preserves binary data correctly (File extends Blob).
- `withRetry` wrapping for consistency with all other Drive calls.
- Error handling matches `googleApiFetch` pattern: parse JSON error body, throw `GoogleApiRequestError`.

#### `getFileMetadata(accessToken, fileId) → DriveFileMetadata`

```typescript
const METADATA_FIELDS = 'id,name,mimeType,size,thumbnailLink,webViewLink';

export async function getFileMetadata(
  accessToken: string,
  fileId: string,
): Promise<DriveFileMetadata> {
  const url = `${DRIVE_API}/files/${fileId}?fields=${encodeURIComponent(METADATA_FIELDS)}`;
  return withRetry(() => googleApiFetch<DriveFileMetadata>(accessToken, url));
}
```

Uses `googleApiFetch` — standard JSON response.

#### `getFileMetadataBatch(accessToken, fileIds) → BatchResult[]`

```typescript
export async function getFileMetadataBatch(
  accessToken: string,
  fileIds: string[],
): Promise<Array<{ fileId: string; metadata?: DriveFileMetadata; error?: string }>> {
  const results = await Promise.allSettled(
    fileIds.map((fileId) => getFileMetadata(accessToken, fileId)),
  );

  return results.map((result, i) => {
    if (result.status === 'fulfilled') {
      return { fileId: fileIds[i], metadata: result.value };
    }
    return { fileId: fileIds[i], error: result.reason?.message ?? 'Failed to load file info' };
  });
}
```

**Design**: `Promise.allSettled` handles individual failures gracefully. A 404 for one file doesn't prevent loading metadata for other files.

#### `deleteFile(accessToken, fileId) → void`

```typescript
export async function deleteFile(
  accessToken: string,
  fileId: string,
): Promise<void> {
  try {
    await withRetry(() =>
      googleApiFetch<undefined>(accessToken, `${DRIVE_API}/files/${fileId}`, {
        method: 'DELETE',
      }),
    );
  } catch (error) {
    // 404 = file already deleted — not an error for this operation
    if (error instanceof GoogleApiRequestError && error.status === 404) {
      return;
    }
    throw error;
  }
}
```

**Design**: 404 is swallowed (file already gone). `googleApiFetch` handles 204 No Content by returning `undefined`.

#### `getFileThumbnail(accessToken, fileId) → string (object URL)`

```typescript
export async function getFileThumbnail(
  accessToken: string,
  fileId: string,
): Promise<string> {
  return withRetry(async () => {
    const url = `${DRIVE_API}/files/${fileId}?alt=media`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      let errorBody: GoogleApiErrorBody;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = { error: { code: response.status, message: response.statusText, status: 'UNKNOWN' } };
      }
      throw new GoogleApiRequestError(response.status, errorBody);
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  });
}
```

**Key design decisions** (see research.md R3):
- Raw `fetch` because response is binary, not JSON.
- Returns an object URL. **Caller must revoke** via `URL.revokeObjectURL`.
- Only called for image MIME types; PDFs get a file-type icon.
- Token in `Authorization` header, never in query string.

### New Bills Service Functions (`billsService.ts`)

#### `parseFileIds(csv) → string[]`

```typescript
export function parseFileIds(csv: string): string[] {
  if (!csv || !csv.trim()) return [];
  return csv.split(',').map(s => s.trim()).filter(Boolean);
}
```

#### `serializeFileIds(ids) → string`

```typescript
export function serializeFileIds(ids: string[]): string {
  return ids.filter(Boolean).join(',');
}
```

#### `addFileIdToBill(accessToken, spreadsheetId, bill, fileId, column) → Bill`

```typescript
export async function addFileIdToBill(
  accessToken: string,
  spreadsheetId: string,
  bill: Bill,
  fileId: string,
  column: 'bill_file_ids' | 'receipt_file_ids',
): Promise<Bill> {
  const fieldKey = column === 'bill_file_ids' ? 'billFileIds' : 'receiptFileIds';
  const existingIds = parseFileIds(bill[fieldKey]);
  existingIds.push(fileId);

  const updatedBill: Bill = {
    ...bill,
    [fieldKey]: serializeFileIds(existingIds),
    updatedAt: new Date().toISOString(),
  };

  await updateRow(accessToken, spreadsheetId, TAB_NAME, bill._rowIndex, serializeRow(updatedBill));
  return updatedBill;
}
```

**Design**: Full-row-safety via spread + `updateRow`. Consistent with `updateBill` and `markBillPaid` patterns.

#### `removeFileIdFromBill(accessToken, spreadsheetId, bill, fileId, column) → Bill`

```typescript
export async function removeFileIdFromBill(
  accessToken: string,
  spreadsheetId: string,
  bill: Bill,
  fileId: string,
  column: 'bill_file_ids' | 'receipt_file_ids',
): Promise<Bill> {
  const fieldKey = column === 'bill_file_ids' ? 'billFileIds' : 'receiptFileIds';
  const existingIds = parseFileIds(bill[fieldKey]);
  const filtered = existingIds.filter(id => id !== fileId);

  const updatedBill: Bill = {
    ...bill,
    [fieldKey]: serializeFileIds(filtered),
    updatedAt: new Date().toISOString(),
  };

  await updateRow(accessToken, spreadsheetId, TAB_NAME, bill._rowIndex, serializeRow(updatedBill));
  return updatedBill;
}
```

## Component Architecture

```text
BillsPage
├── State: bills[], attachmentsTarget (BillWithDisplay | null)
├── Existing: formModal, markPaidTarget, deleteTarget, etc.
│
├── BillCard (per bill)  [MODIFIED]
│   ├── Existing: billTypeName, amount, status badge, Edit/MarkPaid/Delete
│   ├── NEW: Paperclip icon + count badge (when bill has file IDs)
│   ├── NEW: "Files" action button → onViewAttachments(bill)
│   └── Paperclip indicator click → also calls onViewAttachments(bill)
│
└── AttachmentsModal  [NEW]  (when attachmentsTarget !== null)
    ├── Props: bill, folderId, onBillUpdated, onClose
    ├── Internal state: billDocs (FileAttachment[]), receipts (FileAttachment[]),
    │   uploadingFiles (UploadingFile[]), isUploading, isRemoving, objectUrls (Map)
    │
    ├── On open → parseFileIds(bill.billFileIds) + parseFileIds(bill.receiptFileIds)
    │   → getFileMetadataBatch → for image mimeTypes, getFileThumbnail → setState
    │
    ├── "Bill Documents" section
    │   ├── File list: image thumbnail or PDF icon + name + size + View + Remove
    │   ├── Empty state: "No bill documents attached"
    │   └── "Add Bill Document" button → file input (accept="image/*,.pdf", multiple)
    │
    ├── "Receipts" section
    │   ├── File list: same layout as bill documents
    │   ├── Empty state: "No receipts attached"
    │   └── "Add Receipt" button → file input
    │
    ├── Upload flow (on file select):
    │   1. Validate each file (size, type, >0 bytes)
    │   2. Show upload queue with per-file status
    │   3. Upload sequentially: pending → uploading → done/failed
    │   4. After each success: addFileIdToBill → onBillUpdated(updatedBill)
    │   5. Update internal file list (re-fetch metadata for new file)
    │   6. Disable close during upload
    │
    ├── Remove flow (on remove click):
    │   1. Show ConfirmDialog
    │   2. On confirm: deleteFile(fileId) → removeFileIdFromBill → onBillUpdated
    │   3. Handle 404: still remove ID from bill, show toast
    │   4. Handle other errors: keep ID, show error toast
    │
    └── Cleanup: revoke all object URLs on close/unmount
```

## AttachmentsModal Layout

```text
┌─────────────────────────────────────────┐
│ Attachments                       [X]   │   ← Title + close button
│ BillTypeName · PropertyName · Month     │   ← Context subtitle
│                                         │
│ ─── Bill Documents ─────────────────── │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ [thumb]  bill-a1b2-bill-17...jpg    │ │   ← Image: thumbnail preview
│ │          2.3 MB                     │ │
│ │             [View] [Remove]         │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ [icon]   invoice-scan.pdf           │ │   ← PDF: FileText icon
│ │          1.1 MB                     │ │
│ │             [View] [Remove]         │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [+ Add Bill Document]                   │   ← Opens file picker
│                                         │
│ ─── Receipts ───────────────────────── │
│                                         │
│ No receipts attached                    │   ← Empty state
│                                         │
│ [+ Add Receipt]                         │   ← Opens file picker
│                                         │
│ ─── Upload Progress ────────────────── │   ← Only shown during upload
│ ✓ photo1.jpg                           │
│ ⟳ photo2.jpg  (uploading...)          │
│ ○ photo3.jpg  (pending)                │
│                                         │
└─────────────────────────────────────────┘
```

## BillCard Attachment Indicator Layout

```text
┌─────────────────────────────────────────┐
│ [Receipt icon] BillType          ₹Amt   │
│                PropertyName ·            │
│                MonthLabel                │
│                    [StatusBadge]         │
│                                         │
│ [Edit] [Mark Paid] [📎 3] [Delete]     │   ← Paperclip with count in actions row
└─────────────────────────────────────────┘
```

The Paperclip indicator:
- Uses Lucide `Paperclip` icon with a count badge
- Count = `parseFileIds(bill.billFileIds).length + parseFileIds(bill.receiptFileIds).length`
- Only shown when count > 0
- Clickable — calls `onViewAttachments(bill)`
- Appears as an action button in the actions row, between Mark Paid and Delete (or after Edit if Mark Paid is hidden)

## BillsPage State Changes

```typescript
// New state
const [attachmentsTarget, setAttachmentsTarget] = useState<BillWithDisplay | null>(null);

// folderId from bootstrap
const folderId = setupResult!.folderId;

// Handler: open attachments modal
function handleViewAttachments(bill: BillWithDisplay) {
  setAttachmentsTarget(bill);
}

// Handler: bill updated after file operation (upload or remove)
function handleBillUpdated(updatedBill: Bill) {
  setBills((prev) =>
    prev.map((b) => {
      if (b.id !== updatedBill.id) return b;
      // Merge updated Bill fields into BillWithDisplay (preserve display fields)
      return { ...b, ...updatedBill, displayStatus: computeDisplayStatus(updatedBill.status, updatedBill.dueDate) };
    }),
  );
  // Also update attachmentsTarget so the modal reflects changes
  setAttachmentsTarget((prev) => {
    if (!prev || prev.id !== updatedBill.id) return prev;
    return { ...prev, ...updatedBill, displayStatus: computeDisplayStatus(updatedBill.status, updatedBill.dueDate) };
  });
}

// Render AttachmentsModal
{attachmentsTarget && (
  <AttachmentsModal
    bill={attachmentsTarget}
    folderId={folderId}
    onBillUpdated={handleBillUpdated}
    onClose={() => setAttachmentsTarget(null)}
  />
)}
```

## File Validation Rules

| Rule | Threshold | Error Message |
|------|-----------|---------------|
| File size | <= 10 MB (10 * 1024 * 1024 bytes) | "File exceeds 10 MB limit: {filename}" |
| File type | image/jpeg, image/png, image/gif, image/webp, application/pdf | "Unsupported file type: {filename}" |
| File size | > 0 bytes | "File is empty: {filename}" |

Validation happens before any network request. Invalid files are marked as `failed` in the upload queue. Valid files proceed to upload.

```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf',
]);

function validateFile(file: File): string | null {
  if (file.size === 0) return `File is empty: ${file.name}`;
  if (file.size > MAX_FILE_SIZE) return `File exceeds 10 MB limit: ${file.name}`;
  if (!ALLOWED_MIME_TYPES.has(file.type)) return `Unsupported file type: ${file.name}`;
  return null;
}
```

## File Naming Convention

Uploaded files use: `bill-{billId}-{category}-{timestamp}.{ext}`

```typescript
function generateDriveFileName(billId: string, category: AttachmentCategory, originalName: string): string {
  const ext = originalName.split('.').pop()?.toLowerCase() || 'bin';
  return `bill-${billId}-${category}-${Date.now()}.${ext}`;
}
```

Examples:
- `bill-a1b2c3d4-bill-1716912000000.jpg`
- `bill-a1b2c3d4-receipt-1716912060000.pdf`

## Object URL Memory Management

```typescript
// In AttachmentsModal:
const objectUrlsRef = useRef<Map<string, string>>(new Map());

function revokeAllObjectUrls() {
  objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  objectUrlsRef.current.clear();
}

// Revoke on unmount
useEffect(() => {
  return () => revokeAllObjectUrls();
}, []);

// Revoke old URLs when file list changes (before creating new ones)
// Called inside the metadata+thumbnail fetch effect
```

## Upload Flow (Sequential with Immediate Persistence)

```typescript
async function processUploads(
  files: File[],
  category: AttachmentCategory,
  currentBill: Bill,
) {
  // 1. Validate all files, mark invalid as 'failed'
  const queue: UploadingFile[] = files.map(file => {
    const error = validateFile(file);
    return { file, status: error ? 'failed' : 'pending', error, driveFileId: null };
  });
  setUploadingFiles(queue);

  let latestBill = currentBill;

  // 2. Process valid files sequentially
  for (let i = 0; i < queue.length; i++) {
    if (queue[i].status !== 'pending') continue;

    // Mark as uploading
    queue[i].status = 'uploading';
    setUploadingFiles([...queue]);

    try {
      const fileName = generateDriveFileName(latestBill.id, category, queue[i].file.name);
      const result = await uploadFile(accessToken, queue[i].file, folderId, fileName);

      // Immediately persist to Sheet
      const column = category === 'bill' ? 'bill_file_ids' : 'receipt_file_ids';
      latestBill = await addFileIdToBill(accessToken, spreadsheetId, latestBill, result.id, column);
      onBillUpdated(latestBill);

      queue[i].status = 'done';
      queue[i].driveFileId = result.id;
    } catch (err) {
      queue[i].status = 'failed';
      queue[i].error = err instanceof Error ? err.message : 'Upload failed';
    }
    setUploadingFiles([...queue]);
  }

  // 3. Refresh file list (re-fetch metadata for all current IDs)
  await refreshAttachments(latestBill);
  setUploadingFiles([]);
}
```

**Key**: Each successful upload calls `addFileIdToBill` **before** the next file starts. If upload #3 of 5 fails, files 1-2 are already persisted.

## Remove Flow

```typescript
async function handleRemoveFile(fileId: string, category: AttachmentCategory) {
  setIsRemoving(true);
  const column = category === 'bill' ? 'bill_file_ids' : 'receipt_file_ids';

  try {
    // Try to delete from Drive (404 = already gone, silently succeeds)
    let wasAlreadyDeleted = false;
    try {
      await deleteFile(accessToken, fileId);
    } catch {
      // deleteFile swallows 404 internally, so if we get here it's a real error
      throw error;
    }

    // Remove ID from bill column
    const updatedBill = await removeFileIdFromBill(accessToken, spreadsheetId, currentBill, fileId, column);
    onBillUpdated(updatedBill);

    // Revoke object URL if it exists
    const objUrl = objectUrlsRef.current.get(fileId);
    if (objUrl) {
      URL.revokeObjectURL(objUrl);
      objectUrlsRef.current.delete(fileId);
    }

    // Refresh attachments list
    await refreshAttachments(updatedBill);
    showToast('Attachment removed.', 'success');
  } catch {
    showToast('Failed to remove attachment.', 'error');
  } finally {
    setIsRemoving(false);
  }
}
```

**Special case**: `deleteFile` already handles 404 internally (returns silently). The caller always proceeds to `removeFileIdFromBill` after `deleteFile` succeeds.

Wait — re-reading the spec: FR-030 says if Drive delete fails with 404, still remove the ID. FR-031 says if non-404 error, keep the ID. The current `deleteFile` implementation swallows 404 and re-throws non-404 errors. So the remove handler just needs:

```typescript
try {
  await deleteFile(accessToken, fileId);       // 404 handled inside, non-404 throws
  const updatedBill = await removeFileIdFromBill(...);
  onBillUpdated(updatedBill);
  showToast('Attachment removed.', 'success');
} catch {
  showToast('Failed to remove attachment.', 'error');
}
```

This correctly handles all three cases:
- File exists: deleted from Drive + removed from bill ✓
- File was already deleted (404): `deleteFile` returns → removed from bill ✓
- Drive error (500, network): `deleteFile` throws → ID stays in bill, error toast ✓

## Modal Pattern (MASTER.md Compliance)

```html
<div class="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
  <div class="bg-white rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto"
       role="dialog" aria-labelledby="attachments-modal-title">
    <!-- Content -->
  </div>
</div>
```

- Escape key closes (unless `isUploading`)
- Backdrop click closes (unless `isUploading`)
- Close button disabled during upload
- `max-h-[90vh] overflow-y-auto` for scrollable content when many attachments

## Image vs PDF Display Logic

```typescript
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

function isImageMimeType(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.has(mimeType);
}
```

- **Image files**: Fetch via `getFileThumbnail` → show `<img src={objectUrl}>` as a small thumbnail (e.g., `w-16 h-16 object-cover rounded`)
- **PDF files**: Show Lucide `FileText` icon (same size as thumbnail area)
- **Both**: Show filename + size + View button + Remove button

## Accessibility

- Modal: `role="dialog"`, `aria-labelledby` for title
- Close button: `aria-label="Close attachments"`
- File entries: each remove button has `aria-label="Remove {filename}"`
- View links: `aria-label="View {filename} in Google Drive"`
- Upload buttons: descriptive labels "Add bill document" / "Add receipt"
- All interactive elements: 44px min touch targets (`min-h-11 min-w-11`)
- Focus rings: `focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`
- Loading states: spinner with `aria-label="Loading"`

## Complexity Tracking

No constitution violations to justify — constitution remains unratified.
