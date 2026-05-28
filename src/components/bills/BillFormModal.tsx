import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { BillFormData, BillTypeWithProperty, BillWithDisplay } from '../../types';
import { computeDueDate } from '../../services/billsService';

export interface BillFormModalProps {
  bill: BillWithDisplay | null;
  availableBillTypes: BillTypeWithProperty[];
  isSaving: boolean;
  onSubmit: (data: BillFormData) => void;
  onClose: () => void;
}

export default function BillFormModal({
  bill,
  availableBillTypes,
  isSaving,
  onSubmit,
  onClose,
}: BillFormModalProps) {
  const isEdit = bill !== null;

  // Filter to active, non-deleted bill types
  const activeBillTypes = availableBillTypes.filter(
    (bt) => bt.active && bt.deletedAt === '',
  );

  const [billTypeId, setBillTypeId] = useState(bill?.billTypeId ?? '');
  const [month, setMonth] = useState(bill?.month ?? '');
  const [amount, setAmount] = useState(
    bill?.amount !== null && bill?.amount !== undefined
      ? String(bill.amount)
      : '',
  );
  const [dueDate, setDueDate] = useState(bill?.dueDate ?? '');
  const [notes, setNotes] = useState(bill?.notes ?? '');
  const [userEditedDueDate, setUserEditedDueDate] = useState(isEdit);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Get selected bill type object
  const selectedBillType = activeBillTypes.find((bt) => bt.id === billTypeId);

  // Auto-fill amount from defaultAmount on bill type change (add mode only)
  useEffect(() => {
    if (isEdit) return;
    if (!selectedBillType) return;
    if (selectedBillType.defaultAmount !== null) {
      setAmount(String(selectedBillType.defaultAmount));
    } else {
      setAmount('');
    }
  }, [billTypeId, isEdit, selectedBillType]);

  // Auto-compute due date when bill type + month change (if user hasn't manually edited)
  useEffect(() => {
    if (userEditedDueDate) return;
    if (!selectedBillType || !month) {
      setDueDate('');
      return;
    }
    const computed = computeDueDate(month, selectedBillType.defaultDueDay);
    setDueDate(computed);
  }, [billTypeId, month, userEditedDueDate, selectedBillType]);

  // Resolve bill type name for read-only display in edit mode
  const editBillTypeName = isEdit
    ? (activeBillTypes.find((bt) => bt.id === bill.billTypeId)?.name ?? bill.billTypeName) +
      ' \u2014 ' +
      (activeBillTypes.find((bt) => bt.id === bill.billTypeId)?.propertyName ?? bill.propertyName)
    : '';

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!billTypeId) {
      newErrors.billTypeId = 'Please select a bill type.';
    }
    if (!month) {
      newErrors.month = 'Please select a billing month.';
    }
    if (amount.trim() !== '') {
      const num = Number(amount);
      if (isNaN(num) || num < 0) {
        newErrors.amount = 'Amount must be a non-negative number.';
      }
    }
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      newErrors.dueDate = 'Please enter a valid date.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      billTypeId: isEdit ? bill.billTypeId : billTypeId,
      month,
      amount: amount.trim(),
      dueDate,
      notes: notes.trim(),
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

  const noBillTypes = activeBillTypes.length === 0;

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-labelledby="bill-form-title"
        className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="bill-form-title"
          className="text-lg font-semibold text-slate-900 mb-4"
        >
          {isEdit ? 'Edit Bill' : 'Add Bill'}
        </h2>

        {/* No bill types empty state */}
        {!isEdit && noBillTypes ? (
          <div className="text-center py-8">
            <p className="text-sm text-slate-600 mb-4">
              No active bill types. Configure bill types in Settings first.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700
                         font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer
                         min-h-11
                         focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Bill Type */}
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Bill Type <span className="text-red-600">*</span>
              </span>
              {isEdit ? (
                <input
                  type="text"
                  value={editBillTypeName}
                  readOnly
                  className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50
                             px-3 py-2 text-base text-slate-500 cursor-not-allowed"
                />
              ) : (
                <select
                  value={billTypeId}
                  onChange={(e) => {
                    setBillTypeId(e.target.value);
                    clearError('billTypeId');
                  }}
                  className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                             px-3 py-2 text-base
                             focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                             focus:outline-none cursor-pointer"
                >
                  <option value="">Select a bill type</option>
                  {activeBillTypes.map((bt) => (
                    <option key={bt.id} value={bt.id}>
                      {bt.name} — {bt.propertyName}
                    </option>
                  ))}
                </select>
              )}
              {errors.billTypeId && (
                <span className="text-red-600 text-xs mt-1 block">
                  {errors.billTypeId}
                </span>
              )}
            </label>

            {/* Month */}
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Month <span className="text-red-600">*</span>
              </span>
              <input
                type="month"
                value={month}
                onChange={(e) => {
                  setMonth(e.target.value);
                  clearError('month');
                }}
                className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                           px-3 py-2 text-base
                           focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                           focus:outline-none"
              />
              {errors.month && (
                <span className="text-red-600 text-xs mt-1 block">
                  {errors.month}
                </span>
              )}
            </label>

            {/* Amount */}
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Amount</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  clearError('amount');
                }}
                className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                           px-3 py-2 text-base tabular-nums
                           focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                           focus:outline-none"
                placeholder="0"
                min="0"
                step="any"
              />
              {errors.amount && (
                <span className="text-red-600 text-xs mt-1 block">
                  {errors.amount}
                </span>
              )}
            </label>

            {/* Due Date */}
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Due Date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setUserEditedDueDate(true);
                  clearError('dueDate');
                }}
                className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                           px-3 py-2 text-base
                           focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                           focus:outline-none"
              />
              {errors.dueDate && (
                <span className="text-red-600 text-xs mt-1 block">
                  {errors.dueDate}
                </span>
              )}
            </label>

            {/* Notes */}
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                           px-3 py-2 text-base
                           focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                           focus:outline-none"
                rows={3}
                placeholder="Optional notes"
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
                {isEdit ? 'Save' : 'Add Bill'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
