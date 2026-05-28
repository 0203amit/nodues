/**
 * Contract: Component Props & UI Interfaces for Bill File Attachments
 *
 * Defines the prop interfaces for new and modified UI components.
 */

import type { BillWithDisplay, Bill } from '../../../src/types';
import type { AttachmentCategory, FileAttachment, UploadingFile } from './types';

// ============================================================
// AttachmentsModal (src/components/bills/AttachmentsModal.tsx)
// ============================================================

/** Props for the file attachments modal. */
export interface AttachmentsModalProps {
  /** The bill whose attachments are being managed. */
  bill: BillWithDisplay;
  /** The Drive folder ID for the "NoDues" folder (from useBootstrap().setupResult.folderId). */
  folderId: string;
  /**
   * Called after a file operation (upload or remove) completes.
   * Passes the updated Bill so BillsPage can update its in-memory state
   * without a full refetch.
   */
  onBillUpdated: (updatedBill: Bill) => void;
  /** Called when the modal should close. Disabled during active uploads. */
  onClose: () => void;
}

// ============================================================
// BillCard Modifications (src/components/bills/BillCard.tsx)
// ============================================================

/**
 * Extended BillCardProps — adds onViewAttachments callback.
 *
 * The existing BillCardProps already has: bill, onMarkPaid, onEdit, onDelete, isLoading.
 * Phase 5 adds:
 */
export interface BillCardPropsExtension {
  /** Called when the user taps the Paperclip indicator or "Files" action button. */
  onViewAttachments: (bill: BillWithDisplay) => void;
}

// NOTE: The full BillCardProps will be:
// export interface BillCardProps {
//   bill: BillWithDisplay;
//   onMarkPaid: (bill: BillWithDisplay) => void;
//   onEdit: (bill: BillWithDisplay) => void;
//   onDelete: (bill: BillWithDisplay) => void;
//   onViewAttachments: (bill: BillWithDisplay) => void;  // NEW
//   isLoading: boolean;
// }

// ============================================================
// Internal Component Types (not exported from the module)
// ============================================================

/**
 * Props for a single file entry in the attachments list.
 * Used internally by AttachmentsModal.
 */
export interface FileEntryProps {
  attachment: FileAttachment;
  category: AttachmentCategory;
  /** True when a remove operation is in progress (disable other remove buttons). */
  isRemoving: boolean;
  /** Called when the user taps the remove button. */
  onRemove: (fileId: string) => void;
}

/**
 * Props for the upload progress section.
 * Shown during a batch upload inside the AttachmentsModal.
 */
export interface UploadProgressProps {
  files: UploadingFile[];
}
