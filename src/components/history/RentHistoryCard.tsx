import type { RentCollectionWithDisplay, RentDisplayStatus } from '../../types';
import { formatCurrency, formatDateDisplay, formatMonth } from '../../services/billsService';

const STATUS_CONFIG: Record<
  RentDisplayStatus,
  { label: string; bg: string; text: string }
> = {
  received: { label: 'Received', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  partial: { label: 'Partial', bg: 'bg-blue-50', text: 'text-blue-700' },
  pending: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700' },
  overdue: { label: 'Overdue', bg: 'bg-red-50', text: 'text-red-700' },
};

export default function RentHistoryCard({ collection }: { collection: RentCollectionWithDisplay }) {
  const badge = STATUS_CONFIG[collection.displayStatus];
  const displayName = collection.unitLabel
    ? `${collection.tenancyName} (${collection.unitLabel})`
    : collection.tenancyName;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      {/* Header: name + property/month + status badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 truncate">{displayName}</p>
          <p className="text-sm text-slate-600 truncate">
            {collection.propertyName} &middot; {formatMonth(collection.month)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Due: {formatDateDisplay(collection.dueDate)}
          </p>
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
    </div>
  );
}
