import { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import type { PaymentEvent } from '../../types';
import { formatCurrency, formatDateDisplay } from '../../services/billsService';

export interface PaymentHistorySectionProps {
  paymentEvents: PaymentEvent[];
  onDelete: (event: PaymentEvent) => void;
  isLoading: boolean;
}

export default function PaymentHistorySection({
  paymentEvents,
  onDelete,
  isLoading,
}: PaymentHistorySectionProps) {
  const [expanded, setExpanded] = useState(false);

  // Non-deleted events, reverse chronological (paymentDate desc, then createdAt desc)
  const sortedEvents = [...paymentEvents]
    .filter((e) => e.deletedAt === '')
    .sort((a, b) => {
      const dateCompare = b.paymentDate.localeCompare(a.paymentDate);
      if (dateCompare !== 0) return dateCompare;
      return b.createdAt.localeCompare(a.createdAt);
    });

  const total = sortedEvents.reduce((sum, e) => sum + e.amount, 0);

  if (sortedEvents.length === 0) {
    return (
      <p className="text-xs text-slate-500 mt-2">No payments recorded yet.</p>
    );
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-700
                   hover:text-slate-900 cursor-pointer focus:outline-none"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        Payment History ({sortedEvents.length})
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {sortedEvents.map((event) => (
            <div
              key={event.id}
              className="flex items-start justify-between gap-2 text-sm bg-slate-50 rounded-lg px-3 py-2"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-900 tabular-nums">
                  {formatCurrency(event.amount)}
                </p>
                <p className="text-xs text-slate-500">
                  {formatDateDisplay(event.paymentDate)} &middot; {event.paymentMethod}
                  {event.notes ? ` \u2014 ${event.notes}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDelete(event)}
                disabled={isLoading}
                className="text-red-600 hover:text-red-700 hover:bg-red-50
                           p-1 rounded transition-colors cursor-pointer flex-shrink-0
                           min-h-8 min-w-8 inline-flex items-center justify-center
                           disabled:opacity-50 disabled:cursor-not-allowed
                           focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                aria-label="Delete payment"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          <p className="text-xs font-medium text-slate-600 px-3 pt-1">
            Total: {formatCurrency(total)}
          </p>
        </div>
      )}
    </div>
  );
}
