import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
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
  deleteFile,
  getFileMetadata,
  getFileThumbnail,
  ensureSubfolder,
} from '../../services/driveService';
import {
  setReceiptFileIdForPaymentEvent,
  clearReceiptFileIdForPaymentEvent,
} from '../../services/paymentEventsService';
import { formatCurrency, formatDateDisplay, formatMonth } from '../../services/billsService';
import type {
  RentCollectionWithDisplay,
  PaymentEvent,
  DriveFileMetadata,
} from '../../types';
import { GoogleApiRequestError } from '../../services/googleApi';

// --- Constants ---

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
const ACCEPT_STRING = 'image/jpeg,image/png,image/gif,image/webp,application/pdf';
const RENTALS_SUBFOLDER_NAME = 'Rentals';

// --- Helpers ---

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

// --- Per-event receipt state ---

interface ReceiptState {
  isLoading: boolean;
  metadata: DriveFileMetadata | null;
  thumbnailUrl: string | null;
  error: string | null;
  isUploading: boolean;
  uploadError: string | null;
}

// --- Props ---

export interface RentReceiptsModalProps {
  collection: RentCollectionWithDisplay;
  paymentEvents: PaymentEvent[];
  onClose: () => void;
  onUpdate: () => void;
}

export default function RentReceiptsModal({
  collection,
  paymentEvents,
  onClose,
  onUpdate,
}: RentReceiptsModalProps) {
  const { accessToken } = useAuth();
  const { setupResult } = useBootstrap();
  const { showToast } = useToast();
  const folderId = setupResult!.folderId;
  const spreadsheetId = setupResult!.spreadsheetId;

  // Non-deleted events sorted by date desc
  const events = [...paymentEvents]
    .filter((e) => e.deletedAt === '')
    .sort((a, b) => {
      const dateCompare = b.paymentDate.localeCompare(a.paymentDate);
      if (dateCompare !== 0) return dateCompare;
      return b.createdAt.localeCompare(a.createdAt);
    });

  // --- State ---
  const [receiptStates, setReceiptStates] = useState<Map<string, ReceiptState>>(new Map());
  const [isRemoving, setIsRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<{
    event: PaymentEvent;
    fileName: string;
  } | null>(null);

  // Track object URLs for cleanup
  const objectUrlsRef = useRef<Map<string, string>>(new Map());
  // Rentals subfolder ID cache
  const rentalsFolderIdRef = useRef<string | null>(null);

  const isAnyUploading = Array.from(receiptStates.values()).some((s) => s.isUploading);

  // --- Object URL cleanup ---
  useEffect(() => {
    const ref = objectUrlsRef;
    return () => {
      ref.current.forEach((url) => URL.revokeObjectURL(url));
      ref.current.clear();
    };
  }, []);

  // --- Load metadata for events that have receiptFileId ---
  const loadReceiptMetadata = useCallback(async () => {
    if (!accessToken) return;

    const newStates = new Map<string, ReceiptState>();

    for (const event of events) {
      if (!event.receiptFileId) {
        newStates.set(event.id, {
          isLoading: false,
          metadata: null,
          thumbnailUrl: null,
          error: null,
          isUploading: false,
          uploadError: null,
        });
        continue;
      }

      newStates.set(event.id, {
        isLoading: true,
        metadata: null,
        thumbnailUrl: null,
        error: null,
        isUploading: false,
        uploadError: null,
      });
    }

    setReceiptStates(new Map(newStates));

    // Fetch metadata in parallel for events with receipts
    const eventsWithReceipts = events.filter((e) => e.receiptFileId);
    const results = await Promise.allSettled(
      eventsWithReceipts.map(async (event) => {
        try {
          const metadata = await getFileMetadata(accessToken, event.receiptFileId);
          let thumbnailUrl: string | null = null;
          if (IMAGE_MIME_TYPES.has(metadata.mimeType)) {
            try {
              thumbnailUrl = await getFileThumbnail(accessToken, event.receiptFileId);
              objectUrlsRef.current.set(event.receiptFileId, thumbnailUrl);
            } catch {
              // Thumbnail failed, show without preview
            }
          }
          return { eventId: event.id, metadata, thumbnailUrl, error: null };
        } catch (err) {
          const isNotFound = err instanceof GoogleApiRequestError && err.status === 404;
          return {
            eventId: event.id,
            metadata: null,
            thumbnailUrl: null,
            error: isNotFound ? 'File not found' : 'Failed to load file info',
          };
        }
      }),
    );

    setReceiptStates((prev) => {
      const next = new Map(prev);
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { eventId, metadata, thumbnailUrl, error } = result.value;
          const existing = next.get(eventId);
          next.set(eventId, {
            isLoading: false,
            metadata,
            thumbnailUrl,
            error,
            isUploading: existing?.isUploading ?? false,
            uploadError: existing?.uploadError ?? null,
          });
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    loadReceiptMetadata();
  }, [loadReceiptMetadata]);

  // --- Escape / backdrop ---
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isAnyUploading && !confirmRemove) onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isAnyUploading, confirmRemove]);

  function handleBackdropClick() {
    if (!isAnyUploading && !confirmRemove) onClose();
  }

  // --- Ensure Rentals subfolder ---
  async function ensureRentalsFolder(): Promise<string> {
    if (rentalsFolderIdRef.current) return rentalsFolderIdRef.current;
    const id = await ensureSubfolder(accessToken!, folderId, RENTALS_SUBFOLDER_NAME);
    rentalsFolderIdRef.current = id;
    return id;
  }

  // --- Upload handler ---
  async function handleFileSelect(event: PaymentEvent, files: FileList | null) {
    if (!files || files.length === 0 || !accessToken) return;
    const file = files[0];

    // Client-side validation
    if (file.size === 0) {
      setReceiptStates((prev) => {
        const next = new Map(prev);
        const existing = next.get(event.id);
        next.set(event.id, { ...existing!, uploadError: 'File is empty' });
        return next;
      });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setReceiptStates((prev) => {
        const next = new Map(prev);
        const existing = next.get(event.id);
        next.set(event.id, { ...existing!, uploadError: 'File exceeds 10 MB limit' });
        return next;
      });
      return;
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      setReceiptStates((prev) => {
        const next = new Map(prev);
        const existing = next.get(event.id);
        next.set(event.id, { ...existing!, uploadError: 'Unsupported file type' });
        return next;
      });
      return;
    }

    // Set uploading state
    setReceiptStates((prev) => {
      const next = new Map(prev);
      const existing = next.get(event.id);
      next.set(event.id, { ...existing!, isUploading: true, uploadError: null });
      return next;
    });

    try {
      const rentalsFolderId = await ensureRentalsFolder();
      const ext = getFileExtension(file);
      const timestamp = Date.now();
      const fileName = `rent-receipt-${event.id}-${timestamp}.${ext}`;

      const driveFile = await uploadFile(accessToken, file, rentalsFolderId, fileName);
      await setReceiptFileIdForPaymentEvent(accessToken, spreadsheetId, event, driveFile.id);

      onUpdate();
      showToast('Receipt uploaded.', 'success');

      // Reload metadata for this event
      let thumbnailUrl: string | null = null;
      if (IMAGE_MIME_TYPES.has(driveFile.mimeType)) {
        try {
          thumbnailUrl = await getFileThumbnail(accessToken, driveFile.id);
          objectUrlsRef.current.set(driveFile.id, thumbnailUrl);
        } catch {
          // Thumbnail failed
        }
      }

      // Fetch full metadata (to get size etc.)
      let metadata: DriveFileMetadata = driveFile;
      try {
        metadata = await getFileMetadata(accessToken, driveFile.id);
      } catch {
        // Use upload result as fallback
      }

      setReceiptStates((prev) => {
        const next = new Map(prev);
        next.set(event.id, {
          isLoading: false,
          metadata,
          thumbnailUrl,
          error: null,
          isUploading: false,
          uploadError: null,
        });
        return next;
      });
    } catch (err) {
      setReceiptStates((prev) => {
        const next = new Map(prev);
        const existing = next.get(event.id);
        next.set(event.id, {
          ...existing!,
          isUploading: false,
          uploadError: err instanceof Error ? err.message : 'Upload failed',
        });
        return next;
      });
    }
  }

  // --- Remove handler ---
  async function handleRemoveConfirm() {
    if (!confirmRemove || !accessToken) return;
    const { event } = confirmRemove;

    setIsRemoving(true);
    setConfirmRemove(null);

    try {
      await deleteFile(accessToken, event.receiptFileId);
      await clearReceiptFileIdForPaymentEvent(accessToken, spreadsheetId, event);

      // Revoke object URL
      const url = objectUrlsRef.current.get(event.receiptFileId);
      if (url) {
        URL.revokeObjectURL(url);
        objectUrlsRef.current.delete(event.receiptFileId);
      }

      onUpdate();
      showToast('Receipt removed.', 'success');

      setReceiptStates((prev) => {
        const next = new Map(prev);
        next.set(event.id, {
          isLoading: false,
          metadata: null,
          thumbnailUrl: null,
          error: null,
          isUploading: false,
          uploadError: null,
        });
        return next;
      });
    } catch {
      showToast('Failed to remove receipt.', 'error');
    } finally {
      setIsRemoving(false);
    }
  }

  // --- Render ---

  const displayName = collection.unitLabel
    ? `${collection.tenancyName} (${collection.unitLabel})`
    : collection.tenancyName;

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-labelledby="rent-receipts-modal-title"
        className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2
              id="rent-receipts-modal-title"
              className="text-lg font-semibold text-slate-900"
            >
              Receipts for {displayName}
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              {formatMonth(collection.month)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isAnyUploading}
            className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer
                       min-h-11 min-w-11 inline-flex items-center justify-center rounded
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            aria-label="Close receipts"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Empty state */}
        {events.length === 0 && (
          <p className="text-sm text-slate-500 py-4 text-center">
            No payments recorded yet. Mark a payment first to attach receipts.
          </p>
        )}

        {/* Payment event sections */}
        {events.length > 0 && (
          <div className="flex flex-col divide-y divide-slate-200">
            {events.map((event) => {
              const state = receiptStates.get(event.id);
              return (
                <div key={event.id} className="py-3 first:pt-0 last:pb-0">
                  {/* Section header */}
                  <p className="text-sm font-medium text-slate-900 mb-2">
                    {formatDateDisplay(event.paymentDate)} &middot; {formatCurrency(event.amount)}
                  </p>

                  {/* Loading state */}
                  {state?.isLoading && (
                    <div className="flex items-center gap-2 py-2">
                      <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                      <span className="text-sm text-slate-400">Loading...</span>
                    </div>
                  )}

                  {/* Uploading state */}
                  {state?.isUploading && (
                    <div className="flex items-center gap-2 py-2">
                      <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                      <span className="text-sm text-slate-700">Uploading...</span>
                    </div>
                  )}

                  {/* Error state: file not found in Drive */}
                  {!state?.isLoading && !state?.isUploading && state?.error && event.receiptFileId && (
                    <div className="flex items-center gap-3 py-2">
                      <div className="w-12 h-12 rounded bg-red-50 flex items-center justify-center flex-shrink-0">
                        <AlertCircle className="w-5 h-5 text-red-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-red-600">File not found</p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmRemove({ event, fileName: 'stale receipt' })
                        }
                        disabled={isRemoving}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50
                                   text-sm px-2 py-1 rounded transition-colors cursor-pointer
                                   min-h-11 min-w-11 inline-flex items-center justify-center
                                   disabled:opacity-50 disabled:cursor-not-allowed
                                   focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                        aria-label="Remove stale receipt reference"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Receipt attached: show thumbnail/icon + view/remove */}
                  {!state?.isLoading && !state?.isUploading && !state?.error && state?.metadata && (
                    <div className="flex items-center gap-3 py-2">
                      {state.thumbnailUrl ? (
                        <img
                          src={state.thumbnailUrl}
                          alt=""
                          className="w-12 h-12 object-cover rounded flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-slate-400" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 truncate" title={state.metadata.name}>
                          Receipt
                        </p>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            window.open(
                              `https://drive.google.com/file/d/${event.receiptFileId}/view`,
                              '_blank',
                            )
                          }
                          className="text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50
                                     text-sm font-medium px-2 py-1 rounded transition-colors cursor-pointer
                                     min-h-11 min-w-11 inline-flex items-center justify-center
                                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                          aria-label="View receipt in Google Drive"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmRemove({
                              event,
                              fileName: state.metadata?.name ?? 'Receipt',
                            })
                          }
                          disabled={isRemoving}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50
                                     text-sm px-2 py-1 rounded transition-colors cursor-pointer
                                     min-h-11 min-w-11 inline-flex items-center justify-center
                                     disabled:opacity-50 disabled:cursor-not-allowed
                                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                          aria-label="Remove receipt"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* No receipt: show upload input */}
                  {!state?.isLoading && !state?.isUploading && !event.receiptFileId && (
                    <div>
                      <label
                        className="flex items-center gap-2 text-indigo-700 hover:text-indigo-800
                                   hover:bg-indigo-50 font-medium text-sm px-3 py-2 rounded
                                   transition-colors cursor-pointer inline-flex
                                   min-h-11"
                      >
                        <Upload className="w-4 h-4" />
                        Upload Receipt
                        <input
                          type="file"
                          accept={ACCEPT_STRING}
                          capture="environment"
                          className="hidden"
                          onChange={(e) => {
                            handleFileSelect(event, e.target.files);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {state?.uploadError && (
                        <p className="text-xs text-red-600 mt-1 ml-3">{state.uploadError}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Remove confirmation dialog */}
      {confirmRemove && (
        <ConfirmDialog
          title="Remove receipt"
          message="Permanently delete this receipt from Google Drive?"
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
