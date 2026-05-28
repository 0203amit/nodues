import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { BillWithDisplay, MarkPaidFormData } from '../../types';
import { PAYMENT_METHOD_OPTIONS } from '../../types';
import { formatMonth, formatCurrency } from '../../services/billsService';

export interface MarkPaidModalProps {
  bill: BillWithDisplay;
  isSaving: boolean;
  onSubmit: (data: MarkPaidFormData) => void;
  onClose: () => void;
}

function getISTToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export default function MarkPaidModal({
  bill,
  isSaving,
  onSubmit,
  onClose,
}: MarkPaidModalProps) {
  const [paidDate, setPaidDate] = useState(getISTToday());
  const [paymentMethod, setPaymentMethod] = useState('');
  const [transactionRef, setTransactionRef] = useState('');

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
    if (!paidDate) {
      newErrors.paidDate = 'Please enter the paid date.';
    }
    if (!paymentMethod) {
      newErrors.paymentMethod = 'Please select a payment method.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      paidDate,
      paymentMethod,
      transactionRef: transactionRef.trim(),
    });
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
        aria-labelledby="mark-paid-title"
        className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="mark-paid-title"
          className="text-lg font-semibold text-slate-900 mb-2"
        >
          Mark as Paid
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
          {/* Paid Date */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Paid Date <span className="text-red-600">*</span>
            </span>
            <input
              type="date"
              value={paidDate}
              onChange={(e) => {
                setPaidDate(e.target.value);
                clearError('paidDate');
              }}
              className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                         px-3 py-2 text-base
                         focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                         focus:outline-none"
            />
            {errors.paidDate && (
              <span className="text-red-600 text-xs mt-1 block">
                {errors.paidDate}
              </span>
            )}
          </label>

          {/* Payment Method */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Payment Method <span className="text-red-600">*</span>
            </span>
            <select
              value={paymentMethod}
              onChange={(e) => {
                setPaymentMethod(e.target.value);
                clearError('paymentMethod');
              }}
              className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                         px-3 py-2 text-base
                         focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                         focus:outline-none cursor-pointer"
            >
              <option value="">Select payment method</option>
              {PAYMENT_METHOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.paymentMethod && (
              <span className="text-red-600 text-xs mt-1 block">
                {errors.paymentMethod}
              </span>
            )}
          </label>

          {/* Transaction Reference */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Transaction Reference
            </span>
            <input
              type="text"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                         px-3 py-2 text-base
                         focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                         focus:outline-none"
              placeholder="Optional"
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
              Mark Paid
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
