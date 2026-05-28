/**
 * Contract: Types for Bill File Attachments
 *
 * These interfaces define the domain objects added in Phase 5.
 * They will be added to the existing src/types/index.ts file
 * alongside Bill, BillWithDisplay, and other existing types.
 */

// --- Drive File Metadata ---

/** Metadata for a file stored in Google Drive. Retrieved via Drive API v3 files.get. */
export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  /** File size in bytes as a string (from Drive API). */
  size?: string;
  /** Drive-generated thumbnail URL. May be null with drive.file scope. */
  thumbnailLink?: string;
  /** URL to view the file in Google Drive. */
  webViewLink?: string;
}

// --- File Attachment (UI layer) ---

/** UI representation of an attached file, combining Drive ID + metadata + loading state. */
export interface FileAttachment {
  fileId: string;
  /** null while loading or if metadata fetch failed. */
  metadata: DriveFileMetadata | null;
  isLoading: boolean;
  error: string | null;
  /** Object URL for image preview. null for PDFs or while loading. */
  thumbnailUrl: string | null;
}

// --- Attachment Category ---

/** Distinguishes bill documents from payment receipts. Maps to Sheet columns. */
export type AttachmentCategory = 'bill' | 'receipt';

// --- Upload File Status ---

/** Per-file status during a batch upload. */
export type UploadFileStatus = 'pending' | 'uploading' | 'done' | 'failed';

/** A file in the upload queue with its current status. */
export interface UploadingFile {
  file: File;
  status: UploadFileStatus;
  error: string | null;
  /** Drive file ID after successful upload. */
  driveFileId: string | null;
}
