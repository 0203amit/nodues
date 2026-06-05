import { Check, ChevronsUp, Pencil, Trash2 } from 'lucide-react';
import type {
  RentCollectionWithDisplay,
  PaymentEvent,
  TenancyWithDisplay,
  RentDisplayStatus,
} from '../../types';
import { formatCurrency, formatDateDisplay } from '../../services/billsService';
import PaymentHistorySection from './PaymentHistorySection';

export interface CollectionCardProps {
  collection: RentCollectionWithDisplay;
  paymentEvents: PaymentEvent[];
  tenancy: TenancyWithDisplay;
  onMarkReceivedFull: (collection: RentCollectionWithDisplay) => void;
  onMarkReceivedPartial: (collection: RentCollectionWithDisplay) => void;
  onEdit: (collection: RentCollectionWithDisplay) => void;
  onDelete: (collection: RentCollectionWithDisplay) => void;
  onDeletePaymentEvent: (event: PaymentEvent) => void;
  isLoading: boolean;
}

const STATUS_CONFIG: Record<
  RentDisplayStatus,
  { label: string; bg: string; text: string }
> = {
  received: { label: 'Received', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  partial: { label: 'Partial', bg: 'bg-blue-50', text: 'text-blue-700' },
  pending: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700' },
  overdue: { label: 'Overdue', bg: 'bg-red-50', text: 'text-red-700' },
};

export default function CollectionCard({
  collection,
  paymentEvents,
  tenancy,
  onMarkReceivedFull,
  onMarkReceivedPartial,
  onEdit,
  onDelete,
  onDeletePaymentEvent,
  isLoading,
}: CollectionCardProps) {
  const status = collection.displayStatus;
  const badge = STATUS_CONFIG[status];
  const isReceived = status === 'received';

  const displayName = tenancy.unitLabel
    ? `${tenancy.name} (${tenancy.unitLabel})`
    : tenancy.name;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      {/* Header: name + status badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 truncate">{displayName}</p>
          <p className="text-sm text-slate-500">Due: {formatDateDisplay(collection.dueDate)}</p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0
                      ${badge.bg} ${badge.text}`}
        >
          {badge.label}
        </span>
      </div>

      {/* Amount breakdown */}
      <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
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

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-1 mt-3">
        {/* R-004: Mark Received Full/Partial HIDDEN when received */}
        {!isReceived && (
          <>
            <button
              type="button"
              onClick={() => onMarkReceivedFull(collection)}
              disabled={isLoading}
              className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50
                         font-medium text-sm px-2 py-1 rounded transition-colors cursor-pointer
                         min-h-11 inline-flex items-center gap-1
                         disabled:opacity-50 disabled:cursor-not-allowed
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <Check className="w-4 h-4" />
              <span className="hidden sm:inline">Full</span>
            </button>

            <button
              type="button"
              onClick={() => onMarkReceivedPartial(collection)}
              disabled={isLoading}
              className="text-blue-700 hover:text-blue-800 hover:bg-blue-50
                         font-medium text-sm px-2 py-1 rounded transition-colors cursor-pointer
                         min-h-11 inline-flex items-center gap-1
                         disabled:opacity-50 disabled:cursor-not-allowed
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <ChevronsUp className="w-4 h-4" />
              <span className="hidden sm:inline">Partial</span>
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => onEdit(collection)}
          disabled={isLoading}
          className="text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50
                     font-medium text-sm px-2 py-1 rounded transition-colors cursor-pointer
                     min-h-11 min-w-11 inline-flex items-center justify-center gap-1
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label="Edit collection"
        >
          <Pencil className="w-4 h-4" />
          <span className="hidden sm:inline">Edit</span>
        </button>

        <button
          type="button"
          onClick={() => onDelete(collection)}
          disabled={isLoading}
          className="text-red-600 hover:text-red-700 hover:bg-red-50
                     font-medium text-sm px-2 py-1 rounded transition-colors cursor-pointer
                     min-h-11 min-w-11 inline-flex items-center justify-center gap-1
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label="Delete collection"
        >
          <Trash2 className="w-4 h-4" />
          <span className="hidden sm:inline">Delete</span>
        </button>
      </div>

      {/* Payment history (T038) */}
      <PaymentHistorySection
        paymentEvents={paymentEvents}
        onDelete={onDeletePaymentEvent}
        isLoading={isLoading}
      />
    </div>
  );
}
