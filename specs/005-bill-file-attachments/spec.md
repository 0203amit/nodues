# Feature Specification: Bill File Attachments

**Feature Branch**: `005-bill-file-attachments`

**Created**: 2026-05-28

**Status**: Draft

**Input**: User description: "Bill File Attachments — Upload, View, Remove bill documents and payment receipts (Phase 5 of the Build Order). From a bill, the user can attach bill documents (the invoice itself) and payment receipts (proof of payment). Files go to Google Drive. Metadata (Drive file IDs) are stored in the existing bill_file_ids and receipt_file_ids columns. View attached files with previews. Remove attachments with confirmation."

## Clarifications

**Q1: Flat folder or subfolder structure in Drive?**
Flat folder with descriptive filenames. All attachments live directly inside the existing "NoDues" Drive folder using the naming convention `bill-{billId}-{bill|receipt}-{timestamp}.{ext}` (e.g., `bill-a1b2c3-bill-1716912000000.jpg`). This avoids creating potentially hundreds of empty subfolders if bills have no attachments, avoids an extra API call per upload to create/find a subfolder, and keeps the Drive structure simple. The bill ID prefix makes files trivially searchable in Drive if the user ever browses the folder directly.

**Q2: Does removing an attachment delete the Drive file or just unlink it?**
Deleting from Drive. When the user removes an attachment, the file is permanently deleted from Google Drive (moved to trash via the Drive API) and its ID is removed from the bill's column. A ConfirmDialog confirms the action. Rationale: leftover orphaned files in Drive are confusing and waste quota. Since these are app-created files (drive.file scope), the app has full authority to trash them.

**Q3: Where do attachments appear in the UI?**
A dedicated "Attachments" modal accessible from a new action button on the BillCard. This keeps the BillCard compact and avoids cluttering the edit form or mark-paid modal with file management. The BillCard shows a small attachment count indicator (e.g., a Paperclip icon with a count badge) when the bill has attachments.

**Q4: Should upload support multiple files at once?**
Yes. The file input accepts `multiple`, so the user can select several files in one go. Each file is uploaded sequentially (to avoid overwhelming the network on mobile) with a per-file progress indicator.

**Q5: File size limit?**
10 MB per file. Phone photos are typically 2-5 MB; scanned PDFs are typically under 5 MB. A 10 MB limit prevents accidental upload of video files or very large scans while covering all reasonable bill/receipt images. Validation happens client-side before upload; the Drive API has its own limits (~5 TB) that we won't hit.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Owner attaches bill documents to a bill (Priority: P1)

The owner has a bill in the list and wants to attach the original invoice document (a photo or PDF). They open the attachments view for that bill, tap "Add Bill Document", select or photograph one or more files, and the files upload to Google Drive. The bill's `bill_file_ids` column is updated with the new Drive file IDs.

**Why this priority**: Attaching bill documents is the primary use case — the owner wants proof of what was billed. Without this, the bill record is just metadata with no supporting document.

**Independent Test**: Navigate to `/bills`. Open the attachments view for a bill. Tap "Add Bill Document". Select a JPG image. Verify the file appears in the Drive folder with the correct naming convention. Verify the bill's `bill_file_ids` column in the Sheet now contains the Drive file ID. Verify the attachment appears in the list with its name and a preview.

**Acceptance Scenarios**:

1. **Given** the owner is viewing a bill's attachments, **When** they tap "Add Bill Document", **Then** a file picker opens accepting images (jpg, jpeg, png, gif, webp) and PDFs. On mobile, the file picker also offers camera capture (via `capture="environment"` attribute on input).
2. **Given** the owner selects one or more files, **When** upload begins, **Then** each file is uploaded to the "NoDues" Drive folder using the multipart upload API. A loading indicator shows upload progress (per-file: uploading, done, or failed). The user cannot close the modal while uploads are in progress.
3. **Given** a file upload succeeds, **Then** the returned Drive file ID is appended to the bill's `bill_file_ids` column (comma-separated). `updated_at` is bumped. The file appears in the attachments list immediately.
4. **Given** a file exceeds 10 MB, **When** the user selects it, **Then** it is rejected before upload with an error message: "File exceeds 10 MB limit: {filename}". Other valid files in the batch proceed.
5. **Given** a file has an unsupported extension (e.g., .doc, .zip), **When** the user selects it, **Then** the file input's `accept` attribute prevents selection in most browsers. If somehow selected (e.g., via drag-drop), validate client-side and reject with a message.
6. **Given** a file upload fails (network error, Drive API error), **Then** that file shows an error state with a retry option. Successfully uploaded files in the batch are kept. The bill column is updated only with the IDs of successfully uploaded files.
7. **Given** the bill's `bill_file_ids` was previously empty (""), **When** a file is uploaded, **Then** `bill_file_ids` becomes the single file ID (no leading comma). For subsequent uploads, IDs are comma-separated.

---

### User Story 2 - Owner attaches payment receipts to a bill (Priority: P1)

The owner has paid a bill and wants to attach the payment receipt (screenshot of a UPI payment, bank statement excerpt, etc.). The flow is identical to bill documents but targets the `receipt_file_ids` column.

**Why this priority**: Payment receipts are the second essential attachment type — proof that the bill was actually paid.

**Independent Test**: Mark a bill as paid. Open attachments. Tap "Add Receipt". Upload a PNG screenshot. Verify `receipt_file_ids` is updated in the Sheet. Verify the receipt appears in a separate "Receipts" section.

**Acceptance Scenarios**:

1. **Given** the owner is viewing a bill's attachments, **When** they tap "Add Receipt", **Then** a file picker opens with the same accept types and camera support as bill documents.
2. **Given** a receipt is uploaded successfully, **Then** its Drive file ID is appended to `receipt_file_ids` (not `bill_file_ids`). The receipt appears in the "Receipts" section of the attachments view.
3. **Given** a bill is not yet paid, **Then** the "Add Receipt" action is still available — the owner may attach a receipt preemptively or for a payment-in-progress.
4. **Given** the bill already has 2 bill documents and the owner uploads a receipt, **Then** `bill_file_ids` remains unchanged; only `receipt_file_ids` is updated.

---

### User Story 3 - Owner views and previews attached files (Priority: P1)

The owner opens the attachments modal for a bill and sees all attached bill documents and receipts. For images, a thumbnail preview is shown. For PDFs, a file icon with the filename is shown. The owner can tap a file to view/download it.

**Why this priority**: Viewing attachments is the read side of the feature. Without it, the user cannot verify what they uploaded or review past bills.

**Independent Test**: Attach an image and a PDF to the same bill. Open the attachments modal. Verify the image shows a thumbnail preview. Verify the PDF shows a file-type icon and name. Tap each to verify it opens in a new tab via a Drive view link.

**Acceptance Scenarios**:

1. **Given** a bill has attached bill documents, **When** the owner opens the attachments modal, **Then** a "Bill Documents" section lists each file showing: filename, file size (if available from metadata), and a thumbnail preview (for images) or a file-type icon (for PDFs).
2. **Given** a bill has attached receipts, **Then** a "Receipts" section lists each receipt with the same format as bill documents.
3. **Given** a bill has no attachments of either type, **Then** the respective section shows an empty state message: "No bill documents attached" / "No receipts attached" with the respective add button.
4. **Given** the owner taps/clicks on an attached image, **Then** the image opens in a new browser tab via a Google Drive viewable link (`https://drive.google.com/file/d/{fileId}/view`).
5. **Given** the owner taps/clicks on an attached PDF, **Then** the PDF opens in a new browser tab via the same Drive view link.
6. **Given** file metadata is loading (e.g., fetching file names/sizes from Drive), **Then** a loading skeleton or spinner is shown in the attachments list.
7. **Given** fetching file metadata fails (e.g., file was externally deleted from Drive), **Then** the file entry shows an error state: "File not found" with an option to remove the stale reference.

---

### User Story 4 - Owner removes an attached file (Priority: P2)

The owner wants to remove an incorrect or outdated attachment. They tap a remove/delete action on a specific file, confirm via ConfirmDialog, the file is trashed in Google Drive, and its ID is removed from the bill's column.

**Why this priority**: Removal is a corrective action. Users may upload the wrong file or want to replace an attachment. Lower priority than upload and view because it's less frequent.

**Independent Test**: Attach a file to a bill. Open attachments. Tap remove on the file. Confirm in the dialog. Verify the file ID is removed from the bill's column in the Sheet. Verify the file is trashed in Google Drive. Verify the file disappears from the attachments list.

**Acceptance Scenarios**:

1. **Given** an attached file is displayed in the attachments modal, **When** the owner taps the remove action (trash icon), **Then** a ConfirmDialog appears: "Remove this file? It will be permanently deleted from Google Drive."
2. **Given** the owner confirms removal, **Then** the file is trashed in Google Drive via `DELETE /drive/v3/files/{fileId}` (which moves to trash). The file ID is removed from the bill's `bill_file_ids` or `receipt_file_ids` column. `updated_at` is bumped. The file disappears from the list.
3. **Given** the Drive delete fails (e.g., file already deleted externally), **Then** the file ID is still removed from the bill's column (to clean up the stale reference) and a toast informs the user.
4. **Given** removing a file leaves the column with no remaining IDs, **Then** the column value becomes an empty string (not a trailing comma or other artifact).
5. **Given** a remove operation is in progress, **Then** the remove button shows a loading state and other remove actions are disabled until it completes.

---

### User Story 5 - Attachment indicators on BillCard (Priority: P2)

The BillCard shows a visual indicator when a bill has attachments, so the owner can quickly see which bills have documents attached without opening each one.

**Why this priority**: A quick visual indicator reduces the need to open every bill to check for attachments. Lower priority because the feature works without it.

**Independent Test**: Attach files to some bills but not others. View the bills list. Verify bills with attachments show a Paperclip icon with a count. Verify bills without attachments show no indicator.

**Acceptance Scenarios**:

1. **Given** a bill has one or more attachments (bill documents or receipts), **When** it is displayed in the bill list, **Then** a Paperclip icon with a count badge appears on the BillCard (e.g., near the action buttons area), showing the total number of attached files.
2. **Given** a bill has no attachments, **Then** no Paperclip indicator is shown.
3. **Given** a bill has 3 bill documents and 2 receipts, **Then** the count badge shows "5".
4. **Given** the owner taps the Paperclip indicator, **Then** the attachments modal opens (same as the dedicated "Files" action button).

---

### User Story 6 - Loading and error states for file operations (Priority: P2)

All file operations (upload, metadata fetch, remove) show appropriate loading indicators and handle errors gracefully.

**Why this priority**: Consistent with the loading/error patterns established in Phases 3 and 4.

**Independent Test**: Upload a large file and observe the loading indicator. Simulate a network error during upload. Verify error toast appears and UI remains usable.

**Acceptance Scenarios**:

1. **Given** a file upload is in progress, **Then** a loading indicator is shown per-file (e.g., spinner or progress bar). The "Add" buttons are disabled until all uploads complete. The modal cannot be closed.
2. **Given** file metadata is being fetched when the attachments modal opens, **Then** a loading spinner is shown in the file list area.
3. **Given** a file upload fails, **Then** the failed file shows an error indicator with the option to retry. A toast message explains the failure.
4. **Given** a remove operation fails, **Then** the file remains in the list and an error toast is shown.
5. **Given** any file operation fails, **Then** the UI remains in a usable state — no blank screen, no stuck spinner, no lost data.

---

### Edge Cases

- **Bill with no file IDs (empty string)**: This is the default state from Phase 4. The attachments modal shows empty states for both sections with add buttons.
- **Stale file ID (file deleted externally from Drive)**: When fetching metadata, the file returns 404. Display "File not found" with an option to remove the stale reference (which just strips the ID from the column).
- **Same file uploaded twice**: No client-side deduplication. Each upload creates a separate Drive file with a unique ID. The user can remove duplicates manually.
- **Upload during edit/mark-paid**: Attachments are managed independently from bill field edits. The attachments modal uses billsService.updateBill with a purpose-built function that only touches file ID columns (or uses updateCell for surgical column updates), so it does not conflict with concurrent edits.
- **Very long file ID lists**: Unlikely in practice (a bill won't have 100 attachments), but comma-separated string in a Sheet cell has a 50,000-character limit which far exceeds practical use.
- **File with special characters in filename**: The uploaded filename in Drive uses our naming convention (bill-{id}-{type}-{timestamp}.{ext}), not the original filename. The original filename is preserved in Drive metadata for display.
- **Multiple rapid uploads**: Files upload sequentially to prevent network congestion on mobile. Each successful upload triggers a column update. If the user initiates another batch while one is in progress, it queues behind the current batch.
- **Token expiration mid-upload**: The googleApiFetch wrapper throws a 401 error. The upload fails and shows an error. The user re-authenticates (handled by AuthContext) and retries.
- **Camera capture on desktop**: The `capture` attribute is ignored on desktop browsers; the file picker just shows the normal file dialog. No special handling needed.
- **Zero-byte files**: Rejected client-side with error message "File is empty: {filename}".

## Requirements *(mandatory)*

### Functional Requirements

#### Service Layer — Drive File Operations

- **FR-001**: `driveService.ts` MUST be extended with a function `uploadFile(accessToken, file, folderId, fileName)` that uploads a file to Google Drive inside the specified folder using the Drive API v3 multipart upload endpoint (`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`). The request sends a multipart/related body with JSON metadata (name, parents) and the file bytes. Returns the created file metadata (id, name, mimeType, size).
- **FR-002**: `driveService.ts` MUST be extended with a function `getFileMetadata(accessToken, fileId)` that fetches metadata for a Drive file by ID (`GET /drive/v3/files/{fileId}?fields=id,name,mimeType,size,thumbnailLink,webViewLink`). Returns the file metadata or throws if not found.
- **FR-003**: `driveService.ts` MUST be extended with a function `getFileMetadataBatch(accessToken, fileIds)` that fetches metadata for multiple files. This calls `getFileMetadata` for each file ID in parallel (using `Promise.allSettled` to handle individual failures gracefully). Returns an array of results: `{ fileId, metadata?, error? }`.
- **FR-004**: `driveService.ts` MUST be extended with a function `deleteFile(accessToken, fileId)` that deletes (trashes) a file from Google Drive (`DELETE /drive/v3/files/{fileId}`). Succeeds silently if the file is already deleted (404 is not an error for this operation).
- **FR-005**: `driveService.ts` MUST be extended with a function `getFileThumbnail(accessToken, fileId)` that returns a URL suitable for displaying an image preview. For image files, this uses the Drive content download URL (`https://www.googleapis.com/drive/v3/files/{fileId}?alt=media`) with the access token. For PDFs, no thumbnail is generated (a file-type icon is shown instead).
- **FR-006**: All new Drive functions MUST use `withRetry` from `googleApi.ts` for retry with exponential backoff, consistent with existing Drive functions.

#### Service Layer — Bill File ID Management

- **FR-007**: `billsService.ts` MUST be extended with a function `addFileIdToBill(accessToken, spreadsheetId, bill, fileId, column: 'bill_file_ids' | 'receipt_file_ids')` that appends a Drive file ID to the specified column. If the column is empty, the value becomes the single ID. If non-empty, the ID is appended with a comma separator. `updated_at` is also bumped. Uses `updateRow` with full-row-safety (reads existing bill, appends ID, writes full row).
- **FR-008**: `billsService.ts` MUST be extended with a function `removeFileIdFromBill(accessToken, spreadsheetId, bill, fileId, column: 'bill_file_ids' | 'receipt_file_ids')` that removes a Drive file ID from the specified column. The remaining IDs stay comma-separated with no empty segments, leading commas, or trailing commas. `updated_at` is bumped. Uses `updateRow` with full-row-safety.
- **FR-009**: Both `addFileIdToBill` and `removeFileIdFromBill` MUST preserve all other bill fields (full-row-safety), consistent with the `updateBill` and `markBillPaid` patterns.
- **FR-010**: A pure helper function `parseFileIds(csvString: string): string[]` MUST be provided to split a comma-separated file ID string into an array, handling empty strings (returns `[]`), whitespace, and edge cases.
- **FR-011**: A pure helper function `serializeFileIds(ids: string[]): string` MUST be provided to join an array of file IDs into a comma-separated string.

#### Types

- **FR-012**: A `DriveFileMetadata` interface MUST be defined in `src/types/index.ts`:
  ```
  interface DriveFileMetadata {
    id: string;
    name: string;
    mimeType: string;
    size?: string;          // bytes as string from Drive API
    thumbnailLink?: string;
    webViewLink?: string;
  }
  ```
- **FR-013**: A `FileAttachment` interface MUST be defined for the UI layer:
  ```
  interface FileAttachment {
    fileId: string;
    metadata: DriveFileMetadata | null;  // null while loading or if fetch failed
    isLoading: boolean;
    error: string | null;
  }
  ```
- **FR-014**: An `AttachmentCategory` type MUST be defined: `'bill' | 'receipt'`.

#### Attachments Modal UI

- **FR-015**: A new component `AttachmentsModal` MUST be created. It receives a `BillWithDisplay` and displays two sections: "Bill Documents" and "Receipts". Each section lists the files from the respective column and provides an "Add" button.
- **FR-016**: When `AttachmentsModal` opens, it MUST parse the bill's `bill_file_ids` and `receipt_file_ids` into arrays and fetch metadata for each file ID from the Drive API (using `getFileMetadataBatch`).
- **FR-017**: Each file in the list MUST display: the file name (from Drive metadata), and either a thumbnail preview (for image mimeTypes: image/jpeg, image/png, image/gif, image/webp) or a file-type icon (for application/pdf and others).
- **FR-018**: Each file entry MUST have a "View" action that opens the file in a new browser tab using `https://drive.google.com/file/d/{fileId}/view`.
- **FR-019**: Each file entry MUST have a "Remove" action (trash icon) that triggers a ConfirmDialog before deletion.
- **FR-020**: The "Add Bill Document" and "Add Receipt" buttons MUST open a file input (`<input type="file">`) with `accept="image/*,.pdf"` and `multiple` enabled. On mobile, the input MUST include `capture="environment"` to offer camera capture.
- **FR-021**: The modal MUST follow the established modal pattern: `fixed inset-0 bg-slate-900/50` backdrop, `bg-white rounded-xl max-w-md w-full p-6 shadow-xl` container, `role="dialog"` with `aria-labelledby`, Escape key closes (unless upload in progress), click outside closes (unless upload in progress).

#### Upload Flow

- **FR-022**: When files are selected, each file MUST be validated client-side before upload: file size <= 10 MB, file type is image or PDF (check both MIME type and extension), file size > 0 bytes.
- **FR-023**: Files MUST be uploaded sequentially (one at a time) to avoid overwhelming mobile network connections. Each file shows its individual status: pending, uploading, done, or failed.
- **FR-024**: The uploaded file MUST be named using the convention: `bill-{billId}-{category}-{timestamp}.{ext}` where category is "bill" or "receipt", timestamp is `Date.now()`, and ext is the original file extension.
- **FR-025**: After each successful upload, the returned Drive file ID MUST be immediately persisted to the bill's column via `addFileIdToBill`. This ensures that if a batch upload is interrupted, already-uploaded files are not lost.
- **FR-026**: During upload, the modal's close button and backdrop click MUST be disabled (to prevent accidental navigation away from an active upload).
- **FR-027**: Upload progress MUST be indicated. Since `fetch` does not natively support upload progress, a per-file status indicator (spinner for "uploading", checkmark for "done", error icon for "failed") is sufficient. No percentage progress bar is required.

#### Remove Flow

- **FR-028**: When the owner taps remove on a file, a ConfirmDialog MUST appear with title "Remove attachment" and message "This file will be permanently deleted from Google Drive. This cannot be undone."
- **FR-029**: On confirmation, the file MUST be deleted from Drive via `deleteFile`, then the file ID removed from the bill's column via `removeFileIdFromBill`.
- **FR-030**: If the Drive delete fails with 404 (file already gone), the removal MUST still proceed — the stale ID is removed from the bill's column and a toast explains "File was already deleted from Drive."
- **FR-031**: If the Drive delete fails with a non-404 error, the file ID MUST remain in the bill's column, an error toast is shown, and the file stays in the list.

#### BillCard Attachment Indicator

- **FR-032**: `BillCard` MUST be updated to show an attachment count indicator when the bill has any file IDs in `bill_file_ids` or `receipt_file_ids`. The indicator uses a Paperclip icon from Lucide with a count of total attached files.
- **FR-033**: `BillCard` MUST be updated with a new action button (e.g., Paperclip icon labeled "Files") that opens the `AttachmentsModal`.
- **FR-034**: The `BillCardProps` interface MUST be extended with an `onViewAttachments: (bill: BillWithDisplay) => void` callback.

#### BillsPage Integration

- **FR-035**: `BillsPage` MUST manage the state for the `AttachmentsModal` (which bill is being viewed, open/closed state).
- **FR-036**: After any file operation (upload or remove) completes in the `AttachmentsModal`, the bill's in-memory data in `BillsPage` state MUST be updated to reflect the new file ID columns, so the attachment count indicator on BillCard updates without a full page reload.

#### Cross-Cutting

- **FR-037**: The Drive multipart upload MUST construct a `multipart/related` request body with a JSON metadata part and a file content part, using a unique boundary string. The `Content-Type` header MUST be `multipart/related; boundary={boundary}`.
- **FR-038**: Image thumbnails in the attachments list MUST be loaded using the Drive content download URL with the access token passed as an `Authorization` header (via a Blob URL pattern: fetch the image bytes, create an object URL). Direct URLs with token-in-query are not used (security concern).
- **FR-039**: All loading states MUST show a spinner or skeleton. All errors MUST show a toast via `useToast()`. The UI MUST never crash or become unusable after an error.
- **FR-040**: All interactive elements MUST have 44px minimum touch targets (`min-h-11 min-w-11`), visible focus rings, and WCAG AA contrast ratios, consistent with MASTER.md.

### Non-Functional Requirements

- **NFR-001**: All UI MUST follow MASTER.md: indigo-700 primary, IBM Plex Sans, Lucide icons, slate neutrals, rounded-lg corners, 44px touch targets, WCAG AA contrast, visible focus rings, no emoji as icons, no gradients, no heavy shadows.
- **NFR-002**: All pages and modals MUST be responsive and mobile-first, tested at 375px width. File thumbnails MUST scale appropriately on small screens.
- **NFR-003**: The existing `driveService.ts` and `googleApi.ts` MUST be extended (not duplicated). New functions follow the same patterns: `withRetry` for retries, `googleApiFetch` for authenticated requests, error classification for 401/403/retryable.
- **NFR-004**: The existing `billsService.ts` full-row-safety pattern MUST be used for all bill column updates. No raw cell writes for file ID columns — always read-modify-write the full row.
- **NFR-005**: New types MUST be defined in `src/types/index.ts` alongside existing types.
- **NFR-006**: File uploads MUST work on mobile Safari, mobile Chrome, and desktop Chrome/Firefox/Edge. Camera capture (`capture="environment"`) MUST be present for mobile but degrades gracefully on desktop.
- **NFR-007**: Thumbnail images MUST be loaded lazily (only when visible in the modal) and MUST use object URLs that are revoked when the modal closes (to prevent memory leaks).
- **NFR-008**: Maximum file size validation (10 MB) MUST happen client-side before any network request is made.

### Key Entities

- **DriveFileMetadata**: Metadata for a file stored in Google Drive. Fields: id, name, mimeType, size, thumbnailLink, webViewLink. Retrieved via the Drive API v3.
- **FileAttachment**: A UI-layer representation of an attached file, combining the Drive file ID with its fetched metadata, loading state, and error state.
- **AttachmentCategory**: `'bill' | 'receipt'` — distinguishes bill documents from payment receipts. Maps to `bill_file_ids` and `receipt_file_ids` columns respectively.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After uploading a file via the "Add Bill Document" button, the file exists in the "NoDues" Drive folder with the correct naming convention, and the bill's `bill_file_ids` column in the Sheet contains the new file ID. The file appears in the attachments modal.
- **SC-002**: After uploading a receipt via "Add Receipt", the `receipt_file_ids` column is updated (not `bill_file_ids`). The receipt appears in the "Receipts" section.
- **SC-003**: Image attachments show a thumbnail preview in the attachments modal. PDF attachments show a file-type icon and filename.
- **SC-004**: Tapping a file opens it in a new tab via Google Drive.
- **SC-005**: Removing a file: ConfirmDialog appears, file is trashed in Drive, ID is removed from the bill column, `updated_at` is bumped, the file disappears from the list.
- **SC-006**: BillCards with attachments show a Paperclip icon with the correct file count. BillCards without attachments show no indicator.
- **SC-007**: Files over 10 MB are rejected client-side with a clear error message, before any upload is attempted.
- **SC-008**: On mobile, the file picker offers camera capture for photographing paper bills.
- **SC-009**: Uploading multiple files processes them sequentially with per-file status indicators. Partial failures do not lose successfully uploaded files.
- **SC-010**: All error states (upload failure, metadata fetch failure, remove failure) show appropriate toasts and leave the UI in a usable state.

## Assumptions

- Phases 1-4 are complete: sign-in, bootstrapping, Properties & Bill Types CRUD, and the Bills core loop (add, list, mark paid, edit, delete, duplicate detection) all work.
- The `accessToken` from `useAuth()` has the `drive.file` scope, which grants read/write/delete access to files created by this application.
- The `folderId` from `useBootstrap().setupResult` points to the existing "NoDues" folder in the user's Google Drive.
- The `bill_file_ids` and `receipt_file_ids` columns exist in the Bills tab (columns 11 and 12, 0-indexed 10 and 11) and are currently empty strings for all bills.
- The Google Drive API v3 multipart upload endpoint (`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`) is available and works with the user's access token.
- `googleApiFetch` in `googleApi.ts` currently sets `Content-Type: application/json` when `options.body` is provided. The multipart upload function will need to use raw `fetch` (or a variant of `googleApiFetch` that accepts pre-built body/headers) because the multipart body is not JSON. This is an implementation detail to handle in the plan phase.
- No concurrent-write protection is needed. File ID column updates use full-row-safety but do not guard against two tabs uploading simultaneously to the same bill. For a 1-4 person household app, this is an acceptable trade-off.
- The Drive API `files.get` endpoint with `fields=id,name,mimeType,size,thumbnailLink,webViewLink` returns sufficient metadata for display. The `thumbnailLink` field may not be available for all files; the implementation falls back to a file-type icon.
- The Drive API `files.delete` endpoint moves files to trash (recoverable by the user in Drive for 30 days) rather than permanently deleting them. This is acceptable behavior.
