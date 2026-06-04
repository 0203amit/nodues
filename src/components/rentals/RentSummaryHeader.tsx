import { formatCurrency } from '../../services/billsService';

export interface RentSummaryHeaderProps {
  totalExpected: number;
  totalReceived: number;
  totalOutstanding: number;
  pendingCount: number;
}

export default function RentSummaryHeader({
  totalExpected,
  totalReceived,
  totalOutstanding,
  pendingCount,
}: RentSummaryHeaderProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <div className="bg-white border border-slate-200 rounded-lg p-3">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Expected</p>
        <p className="text-lg font-semibold text-slate-900 tabular-nums">
          {formatCurrency(totalExpected)}
        </p>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg p-3">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Received</p>
        <p className="text-lg font-semibold text-emerald-700 tabular-nums">
          {formatCurrency(totalReceived)}
        </p>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg p-3">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Outstanding</p>
        <p className="text-lg font-semibold text-red-700 tabular-nums">
          {formatCurrency(totalOutstanding)}
        </p>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg p-3">
        <p className="text-xs text-slate-500 uppercase tracking-wide">Pending</p>
        <p className="text-lg font-semibold text-amber-700 tabular-nums">
          {pendingCount}
        </p>
      </div>
    </div>
  );
}
