import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { RentCollectionWithDisplay, RentDisplayStatus } from '../../types';
import { formatCurrency, formatMonth } from '../../services/billsService';

export interface CollectionHistorySectionProps {
  collections: RentCollectionWithDisplay[];
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

export default function CollectionHistorySection({
  collections,
}: CollectionHistorySectionProps) {
  const [expanded, setExpanded] = useState(false);

  if (collections.length === 0) return null;

  return (
    <div className="mt-2">
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
        Collection History ({collections.length})
      </button>

      {expanded && (
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="pb-1 pr-3">Month</th>
                <th className="pb-1 pr-3">Expected</th>
                <th className="pb-1 pr-3">Received</th>
                <th className="pb-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {collections.map((coll) => {
                const badge = STATUS_CONFIG[coll.displayStatus];
                return (
                  <tr key={coll.id} className="border-t border-slate-100">
                    <td className="py-1.5 pr-3 text-slate-700">{formatMonth(coll.month)}</td>
                    <td className="py-1.5 pr-3 tabular-nums text-slate-900">
                      {formatCurrency(coll.expectedAmount)}
                    </td>
                    <td className="py-1.5 pr-3 tabular-nums text-emerald-700">
                      {formatCurrency(coll.totalReceived)}
                    </td>
                    <td className="py-1.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
                                    ${badge.bg} ${badge.text}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
