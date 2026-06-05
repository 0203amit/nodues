import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Loader2, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getFileMetadataBatch, getFileThumbnail } from '../../services/driveService';
import {
  parseFileIds,
  formatMonth,
  formatCurrency,
  formatDateDisplay,
} from '../../services/billsService';
import BillStatusBadge from '../shared/BillStatusBadge';
import type { BillWithDisplay, FileAttachment } from '../../types';

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

function formatFileSize(sizeStr?: string): string {
  if (!sizeStr) return '';
  const bytes = Number(sizeStr);
  if (isNaN(bytes) || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

export default function BillDetailModal({
  bill,
  onClose,
}: {
  bill: BillWithDisplay;
  onClose: () => void;
}) {
  const { accessToken } = useAuth();

  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const objectUrlsRef = useRef<Map<string, string>>(new Map());

  const billFileIds = parseFileIds(bill.billFileIds);
  const receiptFileIds = parseFileIds(bill.receiptFileIds);
  const allFileIds = [...billFileIds, ...receiptFileIds];
  const hasAttachments = allFileIds.length > 0;

  // --- Object URL cleanup ---
  useEffect(() => {
    const ref = objectUrlsRef;
    return () => {
      ref.current.forEach((url) => URL.revokeObjectURL(url));
      ref.current.clear();
    };
  }, []);

  // --- Load file metadata ---
  const loadFiles = useCallback(async () => {
    if (!accessToken || allFileIds.length === 0) return;
    setIsLoadingFiles(true);

    const results = await getFileMetadataBatch(accessToken, allFileIds);

    const built: FileAttachment[] = [];
    for (const result of results) {
      if (result.error || !result.metadata) {
        built.push({
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
          thumbnailUrl = await getFileThumbnail(accessToken, result.fileId);
          objectUrlsRef.current.set(result.fileId, thumbnailUrl);
        } catch {
          // Thumbnail fetch failed
        }
      }

      built.push({
        fileId: result.fileId,
        metadata: result.metadata,
        isLoading: false,
        error: null,
        thumbnailUrl,
      });
    }

    setAttachments(built);
    setIsLoadingFiles(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

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

  // --- Render file entry ---
  function renderFileEntry(att: FileAttachment, label: string) {
    const { fileId, metadata, error, thumbnailUrl } = att;
    const isImage = metadata && IMAGE_MIME_TYPES.has(metadata.mimeType);
    const fileName = metadata?.name ?? fileId;

    if (error) {
      return (
        <div key={fileId} className="flex items-center gap-3 py-2">
          <div className="w-12 h-12 rounded bg-red-50 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-red-600">File not found</p>
          </div>
        </div>
      );
    }

    return (
      <div key={fileId} className="flex items-center gap-3 py-2">
        {isImage && thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            className="w-12 h-12 object-cover rounded flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-slate-400" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-900 truncate" title={fileName}>
            {truncateFilename(fileName)}
          </p>
          <p className="text-xs text-slate-500">
            {label}
            {metadata?.size ? ` \u00b7 ${formatFileSize(metadata.size)}` : ''}
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            window.open(`https://drive.google.com/file/d/${fileId}/view`, '_blank')
          }
          className="text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50
                     text-sm font-medium px-2 py-1 rounded transition-colors cursor-pointer
                     min-h-11 min-w-11 inline-flex items-center justify-center flex-shrink-0
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label={`View ${fileName} in Google Drive`}
        >
          View
        </button>
      </div>
    );
  }

  // Split attachments back into bill docs vs receipts
  const billDocAttachments = attachments.filter((a) =>
    billFileIds.includes(a.fileId),
  );
  const receiptAttachments = attachments.filter((a) =>
    receiptFileIds.includes(a.fileId),
  );

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-labelledby="bill-detail-modal-title"
        className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="min-w-0 flex-1">
            <h2
              id="bill-detail-modal-title"
              className="text-lg font-semibold text-slate-900"
            >
              {bill.billTypeName}
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              {bill.propertyName} &middot; {formatMonth(bill.month)}
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

        {/* Amount + Status */}
        <div className="flex items-center justify-between mb-3">
          {bill.amount !== null && (
            <p className="text-xl font-bold text-slate-900 tabular-nums">
              {formatCurrency(bill.amount)}
            </p>
          )}
          <BillStatusBadge displayStatus={bill.displayStatus} />
        </div>

        {/* Details */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Due Date</span>
            <span className="text-slate-900">{formatDateDisplay(bill.dueDate)}</span>
          </div>

          {bill.status === 'paid' && bill.paidDate && (
            <div className="flex justify-between">
              <span className="text-slate-500">Paid Date</span>
              <span className="text-emerald-700">{formatDateDisplay(bill.paidDate)}</span>
            </div>
          )}

          {bill.status === 'paid' && bill.paymentMethod && (
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Method</span>
              <span className="text-slate-900">{bill.paymentMethod}</span>
            </div>
          )}

          {bill.transactionRef && (
            <div className="flex justify-between">
              <span className="text-slate-500">Transaction Ref</span>
              <span className="text-slate-900 truncate ml-4">{bill.transactionRef}</span>
            </div>
          )}

          {bill.notes && (
            <div className="flex justify-between">
              <span className="text-slate-500">Notes</span>
              <span className="text-slate-900 text-right ml-4">{bill.notes}</span>
            </div>
          )}
        </div>

        {/* Attachments */}
        {hasAttachments && (
          <>
            <hr className="my-4 border-slate-200" />

            <h3 className="text-sm font-semibold text-slate-900 mb-2">Attachments</h3>

            {isLoadingFiles ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-slate-100">
                {billDocAttachments.map((att) => renderFileEntry(att, 'Bill'))}
                {receiptAttachments.map((att) => renderFileEntry(att, 'Receipt'))}
              </div>
            )}
          </>
        )}

        {!hasAttachments && (
          <>
            <hr className="my-4 border-slate-200" />
            <p className="text-sm text-slate-500 text-center py-2">No attachments</p>
          </>
        )}
      </div>
    </div>
  );
}
