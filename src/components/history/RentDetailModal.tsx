import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Loader2, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getFileMetadata, getFileThumbnail } from '../../services/driveService';
import { formatCurrency, formatDateDisplay, formatMonth } from '../../services/billsService';
import type {
  RentCollectionWithDisplay,
  RentDisplayStatus,
  PaymentEvent,
  DriveFileMetadata,
} from '../../types';

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const STATUS_CONFIG: Record<
  RentDisplayStatus,
  { label: string; bg: string; text: string }
> = {
  received: { label: 'Received', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  partial: { label: 'Partial', bg: 'bg-blue-50', text: 'text-blue-700' },
  pending: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700' },
  overdue: { label: 'Overdue', bg: 'bg-red-50', text: 'text-red-700' },
};

interface ReceiptInfo {
  isLoading: boolean;
  metadata: DriveFileMetadata | null;
  thumbnailUrl: string | null;
  error: string | null;
}

export default function RentDetailModal({
  collection,
  paymentEvents,
  onClose,
}: {
  collection: RentCollectionWithDisplay;
  paymentEvents: PaymentEvent[];
  onClose: () => void;
}) {
  const { accessToken } = useAuth();
  const badge = STATUS_CONFIG[collection.displayStatus];

  const displayName = collection.unitLabel
    ? `${collection.tenancyName} (${collection.unitLabel})`
    : collection.tenancyName;

  // Non-deleted events sorted by paymentDate desc
  const sortedEvents = [...paymentEvents]
    .filter((e) => e.deletedAt === '')
    .sort((a, b) => {
      const dateCmp = b.paymentDate.localeCompare(a.paymentDate);
      if (dateCmp !== 0) return dateCmp;
      return b.createdAt.localeCompare(a.createdAt);
    });

  const total = sortedEvents.reduce((sum, e) => sum + e.amount, 0);

  // --- Receipt metadata state ---
  const [receiptInfos, setReceiptInfos] = useState<Map<string, ReceiptInfo>>(new Map());
  const objectUrlsRef = useRef<Map<string, string>>(new Map());

  // Object URL cleanup
  useEffect(() => {
    const ref = objectUrlsRef;
    return () => {
      ref.current.forEach((url) => URL.revokeObjectURL(url));
      ref.current.clear();
    };
  }, []);

  // Load receipt metadata for events that have receiptFileId
  const loadReceipts = useCallback(async () => {
    if (!accessToken) return;

    const eventsWithReceipts = sortedEvents.filter((e) => e.receiptFileId);
    if (eventsWithReceipts.length === 0) return;

    // Set loading states
    const initial = new Map<string, ReceiptInfo>();
    for (const event of eventsWithReceipts) {
      initial.set(event.id, {
        isLoading: true,
        metadata: null,
        thumbnailUrl: null,
        error: null,
      });
    }
    setReceiptInfos(new Map(initial));

    // Fetch in parallel
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
              // Thumbnail failed
            }
          }
          return { eventId: event.id, metadata, thumbnailUrl, error: null };
        } catch {
          return { eventId: event.id, metadata: null, thumbnailUrl: null, error: 'File not found' };
        }
      }),
    );

    setReceiptInfos((prev) => {
      const next = new Map(prev);
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { eventId, metadata, thumbnailUrl, error } = result.value;
          next.set(eventId, {
            isLoading: false,
            metadata,
            thumbnailUrl,
            error,
          });
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

  // --- ESC / backdrop ---
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function handleBackdropClick() {
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-labelledby="rent-detail-modal-title"
        className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="min-w-0 flex-1">
            <h2
              id="rent-detail-modal-title"
              className="text-lg font-semibold text-slate-900"
            >
              {displayName}
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              {collection.propertyName} &middot; {formatMonth(collection.month)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer
                       min-h-11 min-w-11 inline-flex items-center justify-center rounded
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status + Due Date */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-slate-500">
            Due: {formatDateDisplay(collection.dueDate)}
          </p>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}
          >
            {badge.label}
          </span>
        </div>

        {/* Amount breakdown */}
        <div className="grid grid-cols-3 gap-2 text-sm mb-3">
          <div>
            <p className="text-xs text-slate-500">Expected</p>
            <p className="font-medium text-slate-900 tabular-nums">
              {formatCurrency(collection.expectedAmount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Received</p>
            <p className="font-medium text-emerald-700 tabular-nums">
              {formatCurrency(collection.totalReceived)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Remaining</p>
            <p className="font-medium text-slate-900 tabular-nums">
              {formatCurrency(collection.remainingBalance)}
            </p>
          </div>
        </div>

        {/* Notes */}
        {collection.notes && (
          <div className="text-sm mb-3">
            <span className="text-slate-500">Notes: </span>
            <span className="text-slate-900">{collection.notes}</span>
          </div>
        )}

        {/* Payment History */}
        <hr className="my-4 border-slate-200" />

        <h3 className="text-sm font-semibold text-slate-900 mb-2">
          Payment History ({sortedEvents.length})
        </h3>

        {sortedEvents.length === 0 && (
          <p className="text-sm text-slate-500 py-2 text-center">
            No payments recorded yet.
          </p>
        )}

        {sortedEvents.length > 0 && (
          <div className="space-y-3">
            {sortedEvents.map((event) => {
              const receipt = receiptInfos.get(event.id);

              return (
                <div
                  key={event.id}
                  className="bg-slate-50 rounded-lg px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 tabular-nums">
                        {formatCurrency(event.amount)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDateDisplay(event.paymentDate)} &middot; {event.paymentMethod}
                        {event.notes ? ` \u2014 ${event.notes}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Receipt for this event */}
                  {event.receiptFileId && receipt && (
                    <div className="mt-2">
                      {receipt.isLoading && (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />
                          <span className="text-xs text-slate-400">Loading receipt...</span>
                        </div>
                      )}

                      {!receipt.isLoading && receipt.error && (
                        <p className="text-xs text-red-500">Receipt file not found</p>
                      )}

                      {!receipt.isLoading && !receipt.error && receipt.metadata && (
                        <div className="flex items-center gap-2">
                          {receipt.thumbnailUrl ? (
                            <img
                              src={receipt.thumbnailUrl}
                              alt=""
                              className="w-8 h-8 object-cover rounded flex-shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded bg-slate-200 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-4 h-4 text-slate-400" />
                            </div>
                          )}
                          <span className="text-xs text-slate-600 flex-1 truncate">
                            Receipt
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              window.open(
                                `https://drive.google.com/file/d/${event.receiptFileId}/view`,
                                '_blank',
                              )
                            }
                            className="text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50
                                       text-xs font-medium px-2 py-1 rounded transition-colors cursor-pointer
                                       inline-flex items-center
                                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                          >
                            View
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <p className="text-xs font-medium text-slate-600 px-3 pt-1">
              Total: {formatCurrency(total)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
