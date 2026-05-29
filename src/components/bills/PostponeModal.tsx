import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { BillWithDisplay, PostponeFormData } from '../../types';
import {
  formatMonth,
  formatCurrency,
  formatDueDate,
} from '../../services/billsService';

export interface PostponeModalProps {
  bill: BillWithDisplay;
  isSaving: boolean;
  onSubmit: (data: PostponeFormData) => void;
  onClose: () => void;
}

export default function PostponeModal({
  bill,
  isSaving,
  onSubmit,
  onClose,
}: PostponeModalProps) {
  const [newDueDate, setNewDueDate] = useState('');
  const [reason, setReason] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!newDueDate) {
      newErrors.newDueDate = 'Please enter a new due date.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({ newDueDate, reason: reason.trim() });
  }

  function clearError(field: string) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-labelledby="postpone-bill-title"
        className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="postpone-bill-title"
          className="text-lg font-semibold text-slate-900 mb-2"
        >
          Postpone bill
        </h2>

        {/* Context line */}
        <p className="text-sm text-slate-600 mb-1">
          {bill.billTypeName} — {bill.propertyName}
        </p>
        <p className="text-sm text-slate-600 mb-4">
          {formatMonth(bill.month)}
          {bill.amount !== null && ` · ${formatCurrency(bill.amount)}`}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Current due date (read-only) */}
          <div className="block">
            <span className="text-sm font-medium text-slate-700">
              Current due date
            </span>
            <p className="mt-1 text-base text-slate-900">
              {formatDueDate(bill.dueDate)}
            </p>
          </div>

          {/* New due date */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              New due date <span className="text-red-600">*</span>
            </span>
            <input
              type="date"
              required
              value={newDueDate}
              onChange={(e) => {
                setNewDueDate(e.target.value);
                clearError('newDueDate');
              }}
              className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                         px-3 py-2 text-base
                         focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                         focus:outline-none"
            />
            {errors.newDueDate && (
              <span className="text-red-600 text-xs mt-1 block">
                {errors.newDueDate}
              </span>
            )}
          </label>

          {/* Reason (optional) */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Reason</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional"
              rows={3}
              className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                         px-3 py-2 text-base
                         focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                         focus:outline-none resize-vertical"
            />
          </label>

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700
                         font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer
                         min-h-11
                         disabled:opacity-50 disabled:cursor-not-allowed
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="bg-indigo-700 hover:bg-indigo-800 text-white
                         font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer
                         min-h-11 inline-flex items-center gap-2
                         disabled:opacity-50 disabled:cursor-not-allowed
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Postpone
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
