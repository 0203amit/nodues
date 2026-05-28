import { useEffect } from 'react';
import type { BillWithDisplay } from '../../types';
import { formatMonth, formatCurrency } from '../../services/billsService';

export interface DuplicateWarningModalProps {
  existingBill: BillWithDisplay;
  onOpenExisting: () => void;
  onAddAnyway: () => void;
  onCancel: () => void;
}

export default function DuplicateWarningModal({
  existingBill,
  onOpenExisting,
  onAddAnyway,
  onCancel,
}: DuplicateWarningModalProps) {
  // Close on Escape → onCancel
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const amountDisplay =
    existingBill.amount !== null ? formatCurrency(existingBill.amount) : 'no amount';

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-labelledby="duplicate-warning-title"
        className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="duplicate-warning-title"
          className="text-lg font-semibold text-slate-900 mb-2"
        >
          Duplicate Bill Found
        </h2>

        <p className="text-sm text-slate-600 mb-6">
          A bill for {existingBill.propertyName} {existingBill.billTypeName} for{' '}
          {formatMonth(existingBill.month)} already exists ({amountDisplay},{' '}
          {existingBill.displayStatus === 'not_yet_generated'
            ? 'not received yet'
            : existingBill.displayStatus}
          ).
        </p>

        {/* Three stacked buttons for 44px touch targets on mobile */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onOpenExisting}
            className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700
                       font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer
                       min-h-11 w-full text-center
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Open existing
          </button>

          <button
            type="button"
            onClick={onAddAnyway}
            className="bg-amber-600 hover:bg-amber-700 text-white
                       font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer
                       min-h-11 w-full text-center
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Add anyway
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="text-slate-700 hover:text-slate-800 hover:bg-slate-50
                       font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer
                       min-h-11 w-full text-center
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
