import { Receipt } from 'lucide-react';
import type { BillWithDisplay } from '../../types';
import { formatMonth, formatCurrency, formatDateDisplay } from '../../services/billsService';
import BillStatusBadge from '../shared/BillStatusBadge';

export default function BillHistoryCard({ bill, onClick }: { bill: BillWithDisplay; onClick: () => void }) {
  return (
    <div
      className="bg-white border border-slate-200 rounded-lg p-4 cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Receipt className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate">
              {bill.billTypeName}
            </p>
            <p className="text-sm text-slate-600 truncate">
              {bill.propertyName} &middot; {formatMonth(bill.month)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Due: {formatDateDisplay(bill.dueDate)}
            </p>
            {bill.status === 'paid' && bill.paidDate && (
              <p className="text-xs text-emerald-600 mt-0.5">
                Paid: {formatDateDisplay(bill.paidDate)}
                {bill.paymentMethod ? ` \u00b7 ${bill.paymentMethod}` : ''}
              </p>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {bill.amount !== null && (
            <p className="font-semibold text-slate-900 tabular-nums">
              {formatCurrency(bill.amount)}
            </p>
          )}
          <div className={bill.amount !== null ? 'mt-1' : ''}>
            <BillStatusBadge displayStatus={bill.displayStatus} />
          </div>
        </div>
      </div>
    </div>
  );
}
