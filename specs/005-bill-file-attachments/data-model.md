# Data Model: Bill File Attachments

**Feature**: 005-bill-file-attachments | **Date**: 2026-05-28

## Existing Entities (Referenced, Not Modified)

### Bill (from Phase 4)

The `Bill` interface already contains the file ID columns. No schema changes needed.

| Field | Type | Source |
|-------|------|--------|
| `billFileIds` | `string` | Sheet column `bill_file_ids` (index 10). CSV of Drive file IDs. |
| `receiptFileIds` | `string` | Sheet column `receipt_file_ids` (index 11). CSV of Drive file IDs. |

These columns were defined in Phase 4 and are currently empty strings for all bills. Phase 5 populates them.

### SetupResult (from Phase 2)

| Field | Type | Source |
|-------|------|--------|
| `folderId` | `string` | `useBootstrap().setupResult.folderId` — the "NoDues" Drive folder ID. |

Used as the parent folder for all uploaded files.

## New Types

### DriveFileMetadata

Metadata for a file stored in Google Drive. Retrieved via `GET /drive/v3/files/{fileId}`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Drive file ID |
| `name` | `string` | Yes | File name in Drive |
| `mimeType` | `string` | Yes | MIME type (e.g., `image/jpeg`, `application/pdf`) |
| `size` | `string` | No | File size in bytes (string from Drive API) |
| `thumbnailLink` | `string` | No | Drive-provided thumbnail URL (may be null with `drive.file` scope) |
| `webViewLink` | `string` | No | URL to view the file in Google Drive |

**Location**: `src/types/index.ts`

### FileAttachment

UI-layer representation of an attached file, combining the Drive file ID with its metadata, loading state, and error state.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fileId` | `string` | Yes | Drive file ID |
| `metadata` | `DriveFileMetadata \| null` | Yes | `null` while loading or if fetch failed |
| `isLoading` | `boolean` | Yes | `true` while metadata is being fetched |
| `error` | `string \| null` | Yes | Error message if metadata fetch failed |
| `thumbnailUrl` | `string \| null` | Yes | Object URL for image preview, `null` for PDFs or during loading |

**Location**: `src/types/index.ts`

### AttachmentCategory

Distinguishes bill documents from payment receipts. Maps to specific Sheet columns.

| Value | Column | Description |
|-------|--------|-------------|
| `'bill'` | `bill_file_ids` | Original invoice / bill document |
| `'receipt'` | `receipt_file_ids` | Proof of payment |

**Type**: `'bill' | 'receipt'`

**Location**: `src/types/index.ts`

### UploadFileStatus

Tracks the state of each file during a batch upload. Used internally by `AttachmentsModal`.

| Value | Description |
|-------|-------------|
| `'pending'` | Queued, not yet started |
| `'uploading'` | Currently uploading to Drive |
| `'done'` | Upload succeeded, file ID persisted |
| `'failed'` | Upload failed (network, validation, Drive API error) |

**Type**: `'pending' | 'uploading' | 'done' | 'failed'`

**Location**: `src/types/index.ts`

### UploadingFile

Represents a file in the upload queue with its current status.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | `File` | Yes | The browser `File` object |
| `status` | `UploadFileStatus` | Yes | Current upload status |
| `error` | `string \| null` | Yes | Error message if validation or upload failed |
| `driveFileId` | `string \| null` | Yes | Drive file ID after successful upload |

**Location**: `src/types/index.ts`

## Column Mapping Reference

From `HEADER_DEFINITIONS` for the Bills tab:

| Index | Header | Phase 5 Usage |
|-------|--------|---------------|
| 10 | `bill_file_ids` | CSV of Drive file IDs for bill documents |
| 11 | `receipt_file_ids` | CSV of Drive file IDs for payment receipts |
| 15 | `updated_at` | Bumped on every file add/remove operation |

## State Transitions

### File Upload Flow
```
[File Selected] → validate → [pending]
     ↓ (valid)                    ↓
[uploading] ← start upload ← dequeue
     ↓                           ↓
[done] ← upload success    [failed] ← upload error / validation error
     ↓                           ↓
addFileIdToBill()           show error, offer retry
```

### File Remove Flow
```
[User taps remove] → ConfirmDialog
     ↓ (confirmed)
[removing] → deleteFile() from Drive
     ↓ success                ↓ 404
removeFileIdFromBill()   removeFileIdFromBill() + toast "already deleted"
     ↓ non-404 error
keep file ID, show error toast
```
