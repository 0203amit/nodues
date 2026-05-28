# Research: Bill File Attachments

**Feature**: 005-bill-file-attachments | **Date**: 2026-05-28

## R1: Multipart Upload Body Assembly

**Decision**: Use `new Blob([...parts])` to assemble the `multipart/related` request body.

**Rationale**: The Drive API v3 multipart upload endpoint (`/upload/drive/v3/files?uploadType=multipart`) requires a `multipart/related` body with a JSON metadata part and a binary file part separated by a boundary. In the browser, `Blob` is the only reliable way to concatenate string segments (boundary markers, headers) with binary data (the `File` object, which extends `Blob`). The alternative — hand-building a string with `\r\n` separators — would corrupt binary file contents because `String` cannot represent arbitrary bytes. `FormData` is not appropriate here because Drive's multipart/related format differs from the `multipart/form-data` that `FormData` produces.

**Body assembly pattern**:
```typescript
const boundary = 'nodues_upload_' + crypto.randomUUID().replace(/-/g, '');
const metadata = JSON.stringify({ name: fileName, parents: [folderId] });

const body = new Blob([
  `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
  metadata,
  `\r\n--${boundary}\r\nContent-Type: ${file.type}\r\n\r\n`,
  file,                    // File extends Blob — binary preserved
  `\r\n--${boundary}--\r\n`,
]);
```

The `Content-Type` header on the request is `multipart/related; boundary=${boundary}`.

**Alternatives considered**:
- `FormData` — rejected because it produces `multipart/form-data`, not `multipart/related`. Drive API rejects this for the multipart upload endpoint.
- Hand-built string with `btoa` encoding — rejected because it's fragile, doubles memory for base64 encoding, and doesn't handle large files well.
- `ReadableStream` — rejected as over-complex for files under 10 MB.

## R2: Bypassing `googleApiFetch` for Uploads

**Decision**: Use raw `fetch()` with the `Authorization: Bearer` header for `uploadFile`, wrapped in `withRetry` from `googleApi.ts`. Do not modify `googleApiFetch`.

**Rationale**: The existing `googleApiFetch` has two behaviors incompatible with multipart upload:
1. When `options.body` is provided, it forces `Content-Type: application/json` and calls `JSON.stringify(body)`.
2. It calls `response.json()` on success, but the upload response is JSON (so this part is fine).

Modifying `googleApiFetch` to accept a pre-built body would require changing its signature and adding conditional logic, which risks breaking existing callers. Since `uploadFile` is the only function that needs this, it's cleaner to use raw `fetch` directly:

```typescript
const response = await fetch(url, {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
  body: blob,
});
```

This is wrapped in `withRetry` to maintain consistency with all other Drive/Sheets calls. Error handling follows the same `GoogleApiRequestError` pattern.

For `getFileThumbnail` (which returns binary, not JSON), raw `fetch` is also needed since `googleApiFetch` always parses JSON. For `getFileMetadata` and `deleteFile`, `googleApiFetch` works fine (JSON responses).

**Alternatives considered**:
- Adding a `rawBody?: Blob` option to `googleApiFetch` — rejected because it adds complexity to a well-tested generic helper for one caller.
- Creating a `googleApiRawFetch` variant — rejected as over-abstraction. The two raw-fetch callsites (`uploadFile`, `getFileThumbnail`) are small enough to inline the pattern.

## R3: Image Preview under `drive.file` Scope

**Decision**: Fetch image bytes via `GET /drive/v3/files/{id}?alt=media` with the `Authorization` header, create an object URL with `URL.createObjectURL`, use as `<img src>`, and revoke all object URLs when the modal closes or the file list changes.

**Rationale**: The `drive.file` scope does not grant access to the `thumbnailLink` field in file metadata (it returns `null`). Even if it did, `thumbnailLink` URLs expire and require cookies, making them unreliable. The `alt=media` endpoint returns the raw file bytes and works with `drive.file` scope since the app created the file.

The authorization token must be in the `Authorization` header, never in a query parameter (security: tokens in URLs get logged in server access logs, browser history, and referrer headers).

**Object URL lifecycle**:
1. When `AttachmentsModal` opens → parse file IDs → fetch metadata → for image types, fetch bytes via `alt=media` → create object URLs.
2. Store object URLs in a `Map<string, string>` (fileId → objectUrl) in component state.
3. On modal close or when the file list changes (upload/remove) → `URL.revokeObjectURL` for each URL in the map → clear the map.
4. Use a `useEffect` cleanup function to ensure revocation on unmount.

**PDFs**: Display a file-type icon (Lucide `FileText`), not a thumbnail. PDF rendering in `<img>` is not supported; attempting `alt=media` for a PDF would waste bandwidth.

**Alternatives considered**:
- `webViewLink` as thumbnail source — rejected because it's a full Google Drive viewer page, not an image URL.
- Embedding Drive viewer in an iframe — rejected as overkill for a thumbnail.
- `thumbnailLink` from metadata — rejected because `drive.file` scope doesn't populate it, and it has expiry/auth issues.

## R4: Full-Row-Safety for File ID Column Updates

**Decision**: `addFileIdToBill` and `removeFileIdFromBill` accept the current `Bill` object (already in memory), modify the target file ID column, and write the full 18-column row via `updateRow`. They do not read from the Sheet first.

**Rationale**: The full-row-safety pattern established in Phase 4's `updateBill` and `markBillPaid` writes the entire row to avoid overwriting adjacent columns. Since the AttachmentsModal already has the `BillWithDisplay` object (passed as a prop from `BillsPage`), we can use it directly — avoiding an extra Sheet read.

The flow:
1. `addFileIdToBill(accessToken, spreadsheetId, bill, fileId, column)`:
   - Parse existing IDs from `bill.billFileIds` or `bill.receiptFileIds`.
   - Append the new ID.
   - Serialize back to CSV.
   - Spread `...bill`, override the target column + `updatedAt`.
   - Write via `updateRow`.
   - Return the updated `Bill`.

2. `removeFileIdFromBill(accessToken, spreadsheetId, bill, fileId, column)`:
   - Parse existing IDs.
   - Filter out the target ID.
   - Serialize back to CSV.
   - Same spread + write pattern.
   - Return the updated `Bill`.

**Concurrency note**: Two tabs uploading to the same bill simultaneously could overwrite each other's file IDs. This is acceptable for a 1-4 person household app per the spec's assumptions.

**Alternatives considered**:
- Using `updateCell` for surgical column writes — rejected because it doesn't bump `updated_at` atomically and breaks the full-row-safety contract.
- Reading the sheet before each write — rejected as an unnecessary extra API call when we already have the bill in memory.

## R5: `parseFileIds` / `serializeFileIds` Edge Cases

**Decision**: Pure functions that handle all edge cases: empty strings, whitespace, leading/trailing commas, duplicate commas.

**Implementation**:
```typescript
function parseFileIds(csv: string): string[] {
  if (!csv || !csv.trim()) return [];
  return csv.split(',').map(s => s.trim()).filter(Boolean);
}

function serializeFileIds(ids: string[]): string {
  return ids.filter(Boolean).join(',');
}
```

**Rationale**: The Sheet column may contain artifacts from manual editing or previous bugs. `parseFileIds` defensively trims whitespace and filters empty segments. `serializeFileIds` ensures no empty segments or leading/trailing commas.

## R6: Sequential Upload with Per-File Immediate Persistence

**Decision**: Files in a batch upload sequentially (one at a time). After each successful upload, the returned file ID is immediately written to the bill's column via `addFileIdToBill` before starting the next file.

**Rationale**: Sequential uploads prevent network congestion on mobile (per spec Q4). Immediate persistence ensures that if upload #3 of 5 fails, the first 2 files are already saved to the Sheet and won't be lost. This matches FR-025's requirement for per-file-ID immediate persistence.

**Upload status tracking**: Each file in the batch has a status: `pending | uploading | done | failed`. The UI shows a spinner for "uploading", checkmark for "done", and error icon with retry for "failed". Since `fetch` doesn't support upload progress natively, no percentage progress bar is shown.

**Modal close prevention**: While any file has status `uploading`, the modal's close button and backdrop click are disabled (FR-026).

## R7: File Validation Rules

**Decision**: Validate client-side before upload: size <= 10 MB, MIME type is image or PDF, size > 0 bytes.

**Implementation**:
```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf',
]);

function validateFile(file: File): string | null {
  if (file.size === 0) return `File is empty: ${file.name}`;
  if (file.size > MAX_FILE_SIZE) return `File exceeds 10 MB limit: ${file.name}`;
  if (!ALLOWED_MIME_TYPES.has(file.type)) return `Unsupported file type: ${file.name}`;
  return null; // valid
}
```

The `<input>` also has `accept="image/*,.pdf"` to pre-filter in the file picker. Client-side validation catches files that slip through (e.g., drag-drop).

## R8: Drive File Naming Convention

**Decision**: `bill-{billId}-{category}-{timestamp}.{ext}` where category is `bill` or `receipt`, timestamp is `Date.now()`, and ext is the original file's extension.

**Example**: `bill-a1b2c3d4-bill-1716912000000.jpg`

**Rationale**: The bill ID prefix makes files searchable in Drive if the user browses the folder directly. The timestamp ensures uniqueness within the same bill. The original filename is not used (may contain special characters), but it's preserved in Drive metadata for display.

## R9: Remove Flow — 404 Handling

**Decision**: When deleting a file from Drive, if the API returns 404 (file already deleted externally), still remove the file ID from the bill's column and show a toast: "File was already deleted from Drive." For non-404 errors, keep the file ID in the column and show an error toast.

**Rationale**: 404 means the file is gone anyway — cleaning up the stale reference is the correct action. Non-404 errors (network, 500, etc.) are transient; keeping the reference lets the user retry.
