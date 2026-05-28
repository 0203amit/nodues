import { forwardRef } from 'react';
import { Paperclip, Pencil, Receipt, Trash2 } from 'lucide-react';
import type { BillWithDisplay } from '../../types';
import { formatMonth, formatCurrency, parseFileIds } from '../../services/billsService';
import BillStatusBadge from '../shared/BillStatusBadge';

export interface BillCardProps {
  bill: BillWithDisplay;
  onMarkPaid: (bill: BillWithDisplay) => void;
  onEdit: (bill: BillWithDisplay) => void;
  onViewAttachments: (bill: BillWithDisplay) => void;
  onDelete: (bill: BillWithDisplay) => void;
  isLoading: boolean;
}

const BillCard = forwardRef<HTMLDivElement, BillCardProps>(function BillCard(
  { bill, onMarkPaid, onEdit, onViewAttachments, onDelete, isLoading },
  ref,
) {
  const showMarkPaid =
    bill.displayStatus === 'pending' || bill.displayStatus === 'overdue';

  const attachmentCount =
    parseFileIds(bill.billFileIds).length +
    parseFileIds(bill.receiptFileIds).length;

  return (
    <div
      ref={ref}
      className="bg-white border border-slate-200 rounded-lg p-4"
    >
      {/* Top section: info + amount/badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Receipt className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate">
              {bill.billTypeName}
            </p>
            <p className="text-sm text-slate-600 truncate">
              {bill.propertyName} · {formatMonth(bill.month)}
            </p>
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

      {/* Action buttons row */}
      <div className="flex items-center gap-1 mt-3">
        <button
          type="button"
          onClick={() => onEdit(bill)}
          disabled={isLoading}
          className="text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50
                     font-medium text-sm px-2 py-1 rounded transition-colors cursor-pointer
                     min-h-11 min-w-11 inline-flex items-center justify-center gap-1
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label="Edit bill"
        >
          <Pencil className="w-4 h-4" />
          <span className="hidden sm:inline">Edit</span>
        </button>

        {showMarkPaid && (
          <button
            type="button"
            onClick={() => onMarkPaid(bill)}
            disabled={isLoading}
            className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50
                       font-medium text-sm px-2 py-1 rounded transition-colors cursor-pointer
                       min-h-11 min-w-11 inline-flex items-center justify-center gap-1
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            aria-label="Mark bill as paid"
          >
            <span>Mark Paid</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onViewAttachments(bill)}
          disabled={isLoading}
          className="text-slate-600 hover:text-slate-800 hover:bg-slate-100
                     font-medium text-sm px-2 py-1 rounded transition-colors cursor-pointer
                     min-h-11 min-w-11 inline-flex items-center justify-center gap-1
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label={
            attachmentCount > 0
              ? `View ${attachmentCount} attachment${attachmentCount !== 1 ? 's' : ''}`
              : 'Add or view attachments'
          }
        >
          <Paperclip className="w-4 h-4" />
          {attachmentCount > 0 && (
            <span className="text-xs tabular-nums">{attachmentCount}</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onDelete(bill)}
          disabled={isLoading}
          className="text-red-600 hover:text-red-700 hover:bg-red-50
                     font-medium text-sm px-2 py-1 rounded transition-colors cursor-pointer
                     min-h-11 min-w-11 inline-flex items-center justify-center gap-1
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label="Delete bill"
        >
          <Trash2 className="w-4 h-4" />
          <span className="hidden sm:inline">Delete</span>
        </button>
      </div>
    </div>
  );
});

export default BillCard;
