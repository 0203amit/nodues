import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  FileText,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useBootstrap } from '../../contexts/BootstrapContext';
import { useToast } from '../../contexts/ToastContext';
import ConfirmDialog from '../shared/ConfirmDialog';
import {
  uploadFile,
  getFileMetadataBatch,
  deleteFile,
  getFileThumbnail,
} from '../../services/driveService';
import {
  addFileIdToBill,
  removeFileIdFromBill,
  parseFileIds,
  formatMonth,
} from '../../services/billsService';
import type {
  Bill,
  BillWithDisplay,
  FileAttachment,
  UploadingFile,
  AttachmentCategory,
  UploadFileStatus,
  DriveFileMetadata,
} from '../../types';

// --- Constants (11e) ---

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]);
const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

// --- Validation (11e) ---

function validateFile(file: File): string | null {
  if (file.size === 0) return `File is empty: ${file.name}`;
  if (file.size > MAX_FILE_SIZE) return `File exceeds 10 MB limit: ${file.name}`;
  if (!ALLOWED_MIME_TYPES.has(file.type)) return `Unsupported file type: ${file.name}`;
  return null;
}

// --- Helpers ---

function formatFileSize(sizeStr?: string): string {
  if (!sizeStr) return '';
  const bytes = Number(sizeStr);
  if (isNaN(bytes) || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(file: File): string {
  const dotIndex = file.name.lastIndexOf('.');
  if (dotIndex !== -1) return file.name.slice(dotIndex + 1).toLowerCase();
  if (file.type === 'image/jpeg') return 'jpg';
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/gif') return 'gif';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'application/pdf') return 'pdf';
  return 'bin';
}

function truncateFilename(name: string, maxLen = 24): string {
  if (name.length <= maxLen) return name;
  const dotIdx = name.lastIndexOf('.');
  const ext = dotIdx !== -1 ? name.slice(dotIdx) : '';
  const base = name.slice(0, name.length - ext.length);
  const keep = maxLen - ext.length - 1;
  if (keep <= 0) return name.slice(0, maxLen);
  return base.slice(0, keep) + '\u2026' + ext;
}

// --- Props ---

export interface AttachmentsModalProps {
  bill: BillWithDisplay;
  folderId: string;
  onBillUpdated: (updatedBill: Bill) => void;
  onClose: () => void;
}

export default function AttachmentsModal({
  bill,
  folderId,
  onBillUpdated,
  onClose,
}: AttachmentsModalProps) {
  const { accessToken } = useAuth();
  const { setupResult } = useBootstrap();
  const { showToast } = useToast();
  const spreadsheetId = setupResult!.spreadsheetId;

  // --- State (11b) ---
  const [billDocs, setBillDocs] = useState<FileAttachment[]>([]);
  const [receipts, setReceipts] = useState<FileAttachment[]>([]);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isRemoving, setIsRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{
    fileId: string;
    category: AttachmentCategory;
    fileName: string;
  } | null>(null);

  // --- Refs ---
  const objectUrlsRef = useRef<Map<string, string>>(new Map());
  const latestBillRef = useRef<Bill>(bill);
  const billFileInputRef = useRef<HTMLInputElement | null>(null);
  const receiptFileInputRef = useRef<HTMLInputElement | null>(null);

  const isUploading = uploadingFiles.length > 0;

  // Keep latestBillRef in sync with bill prop
  useEffect(() => {
    latestBillRef.current = bill;
  }, [bill]);

  // --- Object URL management (11c) ---
  const objectUrlsRefStable = objectUrlsRef;

  function revokeObjectUrl(fileId: string) {
    const url = objectUrlsRefStable.current.get(fileId);
    if (url) {
      URL.revokeObjectURL(url);
      objectUrlsRefStable.current.delete(fileId);
    }
  }

  // Revoke all object URLs on unmount
  useEffect(() => {
    const ref = objectUrlsRefStable;
    return () => {
      ref.current.forEach((url) => URL.revokeObjectURL(url));
      ref.current.clear();
    };
  }, [objectUrlsRefStable]);

  // --- Metadata loading (11b) ---
  const loadMetadata = useCallback(async () => {
    if (!accessToken) return;
    const token = accessToken;

    setIsLoadingMetadata(true);
    const currentBill = latestBillRef.current;

    const billFileIds = parseFileIds(currentBill.billFileIds);
    const receiptFileIds = parseFileIds(currentBill.receiptFileIds);

    const [billResults, receiptResults] = await Promise.all([
      billFileIds.length > 0
        ? getFileMetadataBatch(token, billFileIds)
        : Promise.resolve([] as Array<{ fileId: string; metadata?: DriveFileMetadata; error?: string }>),
      receiptFileIds.length > 0
        ? getFileMetadataBatch(token, receiptFileIds)
        : Promise.resolve([] as Array<{ fileId: string; metadata?: DriveFileMetadata; error?: string }>),
    ]);

    async function buildAttachments(
      results: Array<{ fileId: string; metadata?: DriveFileMetadata; error?: string }>,
    ): Promise<FileAttachment[]> {
      const attachments: FileAttachment[] = [];
      for (const result of results) {
        if (result.error || !result.metadata) {
          attachments.push({
            fileId: result.fileId,
            metadata: null,
            isLoading: false,
            error: result.error ?? 'File not found',
            thumbnailUrl: null,
          });
          continue;
        }

        let thumbnailUrl: string | null = null;
        if (IMAGE_MIME_TYPES.has(result.metadata.mimeType)) {
          try {
            thumbnailUrl = await getFileThumbnail(token, result.fileId);
            objectUrlsRefStable.current.set(result.fileId, thumbnailUrl);
          } catch {
            // Thumbnail fetch failed — show without preview
          }
        }

        attachments.push({
          fileId: result.fileId,
          metadata: result.metadata,
          isLoading: false,
          error: null,
          thumbnailUrl,
        });
      }
      return attachments;
    }

    const [billAttachments, receiptAttachments] = await Promise.all([
      buildAttachments(billResults),
      buildAttachments(receiptResults),
    ]);

    setBillDocs(billAttachments);
    setReceipts(receiptAttachments);
    setIsLoadingMetadata(false);
  }, [accessToken, objectUrlsRefStable]);

  // Load metadata on mount
  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  // --- Escape + backdrop close (11a) ---
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isUploading && !confirmRemove) onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isUploading, confirmRemove]);

  function handleBackdropClick() {
    if (!isUploading && !confirmRemove) onClose();
  }

  // --- Upload flow (11f) ---
  async function handleFileSelect(
    files: FileList | null,
    category: AttachmentCategory,
  ) {
    if (!files || files.length === 0 || !accessToken) return;

    const fileArray = Array.from(files);
    const column: 'bill_file_ids' | 'receipt_file_ids' =
      category === 'bill' ? 'bill_file_ids' : 'receipt_file_ids';

    const initialUploading: UploadingFile[] = fileArray.map((file) => {
      const error = validateFile(file);
      return {
        file,
        status: (error ? 'failed' : 'pending') as UploadFileStatus,
        error,
        driveFileId: null,
      };
    });

    setUploadingFiles(initialUploading);
    const updatedUploading = [...initialUploading];
    let currentBill = latestBillRef.current;

    for (let i = 0; i < fileArray.length; i++) {
      if (updatedUploading[i].status === 'failed') continue;

      updatedUploading[i] = { ...updatedUploading[i], status: 'uploading' };
      setUploadingFiles([...updatedUploading]);

      try {
        const file = fileArray[i];
        const ext = getFileExtension(file);
        const timestamp = Date.now();
        const fileName = `bill-${bill.id}-${category}-${timestamp}.${ext}`;

        const driveFile = await uploadFile(accessToken, file, folderId, fileName);

        currentBill = await addFileIdToBill(
          accessToken,
          spreadsheetId,
          currentBill,
          driveFile.id,
          column,
        );

        latestBillRef.current = currentBill;
        onBillUpdated(currentBill);

        updatedUploading[i] = {
          ...updatedUploading[i],
          status: 'done',
          driveFileId: driveFile.id,
        };
        setUploadingFiles([...updatedUploading]);
      } catch (error) {
        updatedUploading[i] = {
          ...updatedUploading[i],
          status: 'failed',
          error: error instanceof Error ? error.message : 'Upload failed',
        };
        setUploadingFiles([...updatedUploading]);
      }
    }

    await loadMetadata();
    setUploadingFiles([]);
  }

  // --- Remove flow (11g) ---
  function handleRemoveClick(
    fileId: string,
    category: AttachmentCategory,
    fileName: string,
  ) {
    setConfirmRemove({ fileId, category, fileName });
  }

  async function handleRemoveConfirm() {
    if (!confirmRemove || !accessToken) return;

    const { fileId, category } = confirmRemove;
    const column: 'bill_file_ids' | 'receipt_file_ids' =
      category === 'bill' ? 'bill_file_ids' : 'receipt_file_ids';

    setIsRemoving(true);
    setConfirmRemove(null);

    try {
      await deleteFile(accessToken, fileId);
      const updatedBill = await removeFileIdFromBill(
        accessToken,
        spreadsheetId,
        latestBillRef.current,
        fileId,
        column,
      );

      latestBillRef.current = updatedBill;
      onBillUpdated(updatedBill);
      revokeObjectUrl(fileId);
      await loadMetadata();
      showToast('Attachment removed.', 'success');
    } catch {
      showToast('Failed to remove attachment.', 'error');
    } finally {
      setIsRemoving(false);
    }
  }

  // --- Render: file entry (11d) ---
  function renderFileEntry(
    attachment: FileAttachment,
    category: AttachmentCategory,
  ) {
    const { fileId, metadata, error, thumbnailUrl } = attachment;

    if (attachment.isLoading) {
      return (
        <div key={fileId} className="flex items-center gap-3 py-2">
          <div className="w-16 h-16 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-400">Loading...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div key={fileId} className="flex items-center gap-3 py-2">
          <div className="w-16 h-16 rounded bg-red-50 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-red-600">File not found</p>
            <p className="text-xs text-slate-400 truncate">{fileId}</p>
          </div>
          <button
            type="button"
            onClick={() => handleRemoveClick(fileId, category, fileId)}
            disabled={isRemoving}
            className="text-red-600 hover:text-red-700 hover:bg-red-50
                       text-sm px-2 py-1 rounded transition-colors cursor-pointer
                       min-h-11 min-w-11 inline-flex items-center justify-center
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            aria-label="Remove stale file reference"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      );
    }

    const fileName = metadata?.name ?? fileId;
    const isImage = metadata && IMAGE_MIME_TYPES.has(metadata.mimeType);

    return (
      <div key={fileId} className="flex items-center gap-3 py-2">
        {isImage && thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            className="w-16 h-16 object-cover rounded flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-slate-400" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-900 truncate" title={fileName}>
            {truncateFilename(fileName)}
          </p>
          {metadata?.size && (
            <p className="text-xs text-slate-500">{formatFileSize(metadata.size)}</p>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() =>
              window.open(
                `https://drive.google.com/file/d/${fileId}/view`,
                '_blank',
              )
            }
            className="text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50
                       text-sm font-medium px-2 py-1 rounded transition-colors cursor-pointer
                       min-h-11 min-w-11 inline-flex items-center justify-center
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            aria-label={`View ${fileName} in Google Drive`}
          >
            View
          </button>
          <button
            type="button"
            onClick={() => handleRemoveClick(fileId, category, fileName)}
            disabled={isRemoving}
            className="text-red-600 hover:text-red-700 hover:bg-red-50
                       text-sm px-2 py-1 rounded transition-colors cursor-pointer
                       min-h-11 min-w-11 inline-flex items-center justify-center
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            aria-label={`Remove ${fileName}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // --- Render: upload progress (11f) ---
  function renderUploadProgress() {
    if (uploadingFiles.length === 0) return null;

    return (
      <div className="mb-4 flex flex-col gap-2 rounded-lg bg-slate-50 p-3">
        {uploadingFiles.map((uf, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            {uf.status === 'uploading' && (
              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin flex-shrink-0" />
            )}
            {uf.status === 'done' && (
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            )}
            {uf.status === 'failed' && (
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            {uf.status === 'pending' && (
              <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />
            )}
            <span
              className={`truncate ${uf.status === 'failed' ? 'text-red-600' : 'text-slate-700'}`}
            >
              {uf.file.name}
            </span>
            {uf.error && (
              <span className="text-xs text-red-500 flex-shrink-0 ml-auto">
                {uf.error}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  // --- Render: section (11d) ---
  function renderSection(
    title: string,
    attachments: FileAttachment[],
    category: AttachmentCategory,
    inputRef: React.RefObject<HTMLInputElement | null>,
    emptyMessage: string,
  ) {
    return (
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50
                       font-medium text-sm px-3 py-1.5 rounded transition-colors cursor-pointer
                       min-h-11 inline-flex items-center gap-1.5
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            aria-label={`Add ${category === 'bill' ? 'bill document' : 'receipt'}`}
          >
            <Upload className="w-4 h-4" />
            {category === 'bill' ? 'Add Bill Document' : 'Add Receipt'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.pdf"
            multiple
            capture="environment"
            className="hidden"
            onChange={(e) => {
              handleFileSelect(e.target.files, category);
              e.target.value = '';
            }}
          />
        </div>

        {isLoadingMetadata ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
          </div>
        ) : attachments.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">{emptyMessage}</p>
        ) : (
          <div className="flex flex-col divide-y divide-slate-100">
            {attachments.map((att) => renderFileEntry(att, category))}
          </div>
        )}
      </section>
    );
  }

  // --- Main render (11a) ---
  return (
    <div
      className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-labelledby="attachments-modal-title"
        className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2
              id="attachments-modal-title"
              className="text-lg font-semibold text-slate-900"
            >
              Attachments
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {bill.billTypeName} &middot; {bill.propertyName} &middot;{' '}
              {formatMonth(bill.month)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer
                       min-h-11 min-w-11 inline-flex items-center justify-center rounded
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            aria-label="Close attachments"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Upload progress */}
        {renderUploadProgress()}

        {/* Bill Documents section */}
        {renderSection(
          'Bill Documents',
          billDocs,
          'bill',
          billFileInputRef,
          'No bill documents attached',
        )}

        <hr className="my-4 border-slate-200" />

        {/* Receipts section */}
        {renderSection(
          'Receipts',
          receipts,
          'receipt',
          receiptFileInputRef,
          'No receipts attached',
        )}
      </div>

      {/* Remove confirmation dialog (11g) */}
      {confirmRemove && (
        <ConfirmDialog
          title="Remove attachment"
          message="This file will be permanently deleted from Google Drive. This cannot be undone."
          confirmLabel="Remove"
          confirmVariant="destructive"
          isLoading={isRemoving}
          onConfirm={handleRemoveConfirm}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}
