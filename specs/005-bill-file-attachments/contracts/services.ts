/**
 * Contract: Service Layer Interfaces for Bill File Attachments
 *
 * Defines the new functions to be added to:
 *   - src/services/driveService.ts (Drive file operations)
 *   - src/services/billsService.ts (file ID column management)
 */

import type { DriveFileMetadata } from './types';
import type { Bill } from '../../../src/types';

// ============================================================
// Drive Service Extensions (src/services/driveService.ts)
// ============================================================

/**
 * Upload a file to Google Drive using multipart upload.
 *
 * Uses the Drive API v3 multipart upload endpoint:
 *   POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart
 *
 * Constructs a multipart/related body with:
 *   Part 1: JSON metadata (name, parents:[folderId])
 *   Part 2: File binary content
 *
 * IMPORTANT: Uses raw fetch() (not googleApiFetch) because:
 *   - googleApiFetch forces Content-Type: application/json and JSON.stringify
 *   - Multipart upload needs Content-Type: multipart/related; boundary=...
 *   - Body is a Blob (not JSON-serializable)
 *
 * Wrapped in withRetry for consistency with other Drive calls.
 *
 * @param accessToken - OAuth access token
 * @param file - The browser File object to upload
 * @param folderId - Drive folder ID (NoDues folder) to upload into
 * @param fileName - The filename to use in Drive (naming convention:
 *   bill-{billId}-{category}-{timestamp}.{ext})
 * @returns Created file metadata including id, name, mimeType, size
 */
export type UploadFile = (
  accessToken: string,
  file: File,
  folderId: string,
  fileName: string,
) => Promise<DriveFileMetadata>;

/**
 * Fetch metadata for a single Drive file.
 *
 * Uses: GET /drive/v3/files/{fileId}?fields=id,name,mimeType,size,thumbnailLink,webViewLink
 *
 * Uses googleApiFetch (JSON response, standard auth header).
 * Throws GoogleApiRequestError on failure (404 if file not found).
 */
export type GetFileMetadata = (
  accessToken: string,
  fileId: string,
) => Promise<DriveFileMetadata>;

/**
 * Fetch metadata for multiple Drive files in parallel.
 *
 * Calls getFileMetadata for each file ID using Promise.allSettled.
 * Each result includes the fileId and either metadata or an error string.
 *
 * Individual failures (e.g., 404 for externally deleted files) do not
 * reject the batch — they appear as { fileId, error: "..." } entries.
 */
export type GetFileMetadataBatch = (
  accessToken: string,
  fileIds: string[],
) => Promise<Array<{ fileId: string; metadata?: DriveFileMetadata; error?: string }>>;

/**
 * Delete (trash) a file from Google Drive.
 *
 * Uses: DELETE /drive/v3/files/{fileId}
 *
 * Succeeds silently if the file is already deleted (404 is swallowed).
 * Non-404 errors are thrown.
 *
 * Uses googleApiFetch (204 No Content response handled).
 */
export type DeleteFile = (
  accessToken: string,
  fileId: string,
) => Promise<void>;

/**
 * Fetch image bytes from Drive and return an object URL for <img src>.
 *
 * Uses: GET /drive/v3/files/{fileId}?alt=media with Authorization header.
 *
 * IMPORTANT: Uses raw fetch() (not googleApiFetch) because:
 *   - The response is binary (not JSON)
 *   - We need the Response.blob() method
 *
 * Returns URL.createObjectURL(blob). The caller MUST revoke this URL
 * when done (URL.revokeObjectURL) to prevent memory leaks.
 *
 * Only called for image MIME types. PDFs get a file-type icon instead.
 * Wrapped in withRetry for consistency.
 *
 * @param accessToken - OAuth access token
 * @param fileId - Drive file ID to fetch
 * @returns Object URL string suitable for <img src>
 */
export type GetFileThumbnail = (
  accessToken: string,
  fileId: string,
) => Promise<string>;

// ============================================================
// Bills Service Extensions (src/services/billsService.ts)
// ============================================================

/**
 * Parse a comma-separated file ID string into an array.
 *
 * Handles: empty strings → [], whitespace, empty segments from
 * leading/trailing/double commas.
 *
 * Pure function, no side effects.
 */
export type ParseFileIds = (csv: string) => string[];

/**
 * Join an array of file IDs into a comma-separated string.
 *
 * Filters out empty/falsy values. Returns '' for empty arrays.
 *
 * Pure function, no side effects.
 */
export type SerializeFileIds = (ids: string[]) => string;

/**
 * Append a Drive file ID to a bill's file column (bill_file_ids or
 * receipt_file_ids).
 *
 * Full-row-safety: spreads the existing bill, modifies only the target
 * column + updated_at, writes the full 18-column row via updateRow.
 *
 * @param accessToken - OAuth access token
 * @param spreadsheetId - Google Sheets spreadsheet ID
 * @param bill - The existing Bill object (with _rowIndex and current column values)
 * @param fileId - The Drive file ID to append
 * @param column - Which column to modify: 'bill_file_ids' or 'receipt_file_ids'
 * @returns The updated Bill object (with the new file ID in the column)
 */
export type AddFileIdToBill = (
  accessToken: string,
  spreadsheetId: string,
  bill: Bill,
  fileId: string,
  column: 'bill_file_ids' | 'receipt_file_ids',
) => Promise<Bill>;

/**
 * Remove a Drive file ID from a bill's file column.
 *
 * Full-row-safety: spreads the existing bill, modifies only the target
 * column + updated_at, writes the full 18-column row via updateRow.
 *
 * Ensures no empty segments, leading commas, or trailing commas remain.
 *
 * @param accessToken - OAuth access token
 * @param spreadsheetId - Google Sheets spreadsheet ID
 * @param bill - The existing Bill object
 * @param fileId - The Drive file ID to remove
 * @param column - Which column to modify
 * @returns The updated Bill object (with the file ID removed from the column)
 */
export type RemoveFileIdFromBill = (
  accessToken: string,
  spreadsheetId: string,
  bill: Bill,
  fileId: string,
  column: 'bill_file_ids' | 'receipt_file_ids',
) => Promise<Bill>;
