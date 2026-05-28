import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { BillType, BillTypeFormData, Property } from '../../types';
import { FREQUENCY_OPTIONS } from '../../types';

export interface BillTypeFormModalProps {
  billType: BillType | null;
  availableProperties: Property[];
  isSaving: boolean;
  onSubmit: (data: BillTypeFormData) => void;
  onClose: () => void;
}

export default function BillTypeFormModal({
  billType,
  availableProperties,
  isSaving,
  onSubmit,
  onClose,
}: BillTypeFormModalProps) {
  const isEdit = billType !== null;

  const [propertyId, setPropertyId] = useState(billType?.propertyId ?? '');
  const [name, setName] = useState(billType?.name ?? '');
  const [defaultAmount, setDefaultAmount] = useState(
    billType?.defaultAmount !== null && billType?.defaultAmount !== undefined
      ? String(billType.defaultAmount)
      : '',
  );
  const [defaultDueDay, setDefaultDueDay] = useState(
    billType?.defaultDueDay !== null && billType?.defaultDueDay !== undefined
      ? String(billType.defaultDueDay)
      : '',
  );
  const [frequency, setFrequency] = useState(billType?.frequency ?? '');
  const [reminderOffsetsDays, setReminderOffsetsDays] = useState(
    billType?.reminderOffsetsDays?.length
      ? billType.reminderOffsetsDays.join(', ')
      : '',
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Resolve property name for read-only display in edit mode
  const editPropertyName =
    isEdit
      ? availableProperties.find((p) => p.id === billType.propertyId)?.name ??
        billType.propertyId
      : '';

  const noProperties = availableProperties.length === 0;

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Bill type name is required.';
    }

    if (!isEdit && !propertyId) {
      newErrors.propertyId = 'Please select a property.';
    }

    if (!frequency) {
      newErrors.frequency = 'Please select a frequency.';
    }

    if (defaultAmount.trim() !== '') {
      const num = Number(defaultAmount);
      if (isNaN(num) || num < 0) {
        newErrors.defaultAmount = 'Amount must be a non-negative number.';
      }
    }

    if (defaultDueDay.trim() !== '') {
      const day = Number(defaultDueDay);
      if (!Number.isInteger(day) || day < 1 || day > 31) {
        newErrors.defaultDueDay = 'Day must be between 1 and 31.';
      }
    }

    if (reminderOffsetsDays.trim() !== '') {
      const parts = reminderOffsetsDays.split(',');
      const valid = parts.every((part) => {
        const trimmed = part.trim();
        if (!trimmed) return false;
        const n = Number(trimmed);
        return Number.isInteger(n) && n > 0;
      });
      if (!valid) {
        newErrors.reminderOffsetsDays =
          'Offsets must be comma-separated positive integers.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      propertyId: isEdit ? billType.propertyId : propertyId,
      name: name.trim(),
      defaultAmount: defaultAmount.trim(),
      defaultDueDay: defaultDueDay.trim(),
      frequency: frequency as BillTypeFormData['frequency'],
      reminderOffsetsDays: reminderOffsetsDays.trim(),
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
        aria-labelledby="billtype-form-title"
        className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="billtype-form-title"
          className="text-lg font-semibold text-slate-900 mb-4"
        >
          {isEdit ? 'Edit Bill Type' : 'Add Bill Type'}
        </h2>

        {/* No properties empty state */}
        {!isEdit && noProperties ? (
          <div className="text-center py-8">
            <p className="text-sm text-slate-600 mb-4">
              No active properties. Add a property first.
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
            {/* Property */}
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Property <span className="text-red-600">*</span>
              </span>
              {isEdit ? (
                <input
                  type="text"
                  value={editPropertyName}
                  readOnly
                  className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50
                             px-3 py-2 text-base text-slate-500 cursor-not-allowed"
                />
              ) : (
                <select
                  value={propertyId}
                  onChange={(e) => {
                    setPropertyId(e.target.value);
                    clearError('propertyId');
                  }}
                  className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                             px-3 py-2 text-base
                             focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                             focus:outline-none cursor-pointer"
                >
                  <option value="">Select a property</option>
                  {availableProperties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
              {errors.propertyId && (
                <span className="text-red-600 text-xs mt-1 block">
                  {errors.propertyId}
                </span>
              )}
            </label>

            {/* Name (required) */}
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Name <span className="text-red-600">*</span>
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearError('name');
                }}
                className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                           px-3 py-2 text-base
                           focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                           focus:outline-none"
                placeholder="e.g. Maintenance"
                autoFocus
              />
              {errors.name && (
                <span className="text-red-600 text-xs mt-1 block">
                  {errors.name}
                </span>
              )}
            </label>

            {/* Default Amount (optional) */}
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Default Amount
              </span>
              <input
                type="number"
                value={defaultAmount}
                onChange={(e) => {
                  setDefaultAmount(e.target.value);
                  clearError('defaultAmount');
                }}
                className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                           px-3 py-2 text-base tabular-nums
                           focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                           focus:outline-none"
                placeholder="0"
                min="0"
                step="any"
              />
              {errors.defaultAmount && (
                <span className="text-red-600 text-xs mt-1 block">
                  {errors.defaultAmount}
                </span>
              )}
            </label>

            {/* Default Due Day (optional) */}
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Default Due Day
              </span>
              <input
                type="number"
                value={defaultDueDay}
                onChange={(e) => {
                  setDefaultDueDay(e.target.value);
                  clearError('defaultDueDay');
                }}
                className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                           px-3 py-2 text-base tabular-nums
                           focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                           focus:outline-none"
                placeholder="1–31"
                min="1"
                max="31"
              />
              {errors.defaultDueDay && (
                <span className="text-red-600 text-xs mt-1 block">
                  {errors.defaultDueDay}
                </span>
              )}
            </label>

            {/* Frequency (required) */}
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Frequency <span className="text-red-600">*</span>
              </span>
              <select
                value={frequency}
                onChange={(e) => {
                  setFrequency(e.target.value);
                  clearError('frequency');
                }}
                className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                           px-3 py-2 text-base
                           focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                           focus:outline-none cursor-pointer"
              >
                <option value="">Select frequency</option>
                {FREQUENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {errors.frequency && (
                <span className="text-red-600 text-xs mt-1 block">
                  {errors.frequency}
                </span>
              )}
            </label>

            {/* Reminder Offsets (optional) */}
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Reminder Offsets (days)
              </span>
              <input
                type="text"
                value={reminderOffsetsDays}
                onChange={(e) => {
                  setReminderOffsetsDays(e.target.value);
                  clearError('reminderOffsetsDays');
                }}
                className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                           px-3 py-2 text-base
                           focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                           focus:outline-none"
                placeholder="e.g. 7,3,1"
              />
              <span className="text-xs text-slate-500 mt-1 block">
                Comma-separated days before due date to send reminders
              </span>
              {errors.reminderOffsetsDays && (
                <span className="text-red-600 text-xs mt-1 block">
                  {errors.reminderOffsetsDays}
                </span>
              )}
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
                {isEdit ? 'Save Changes' : 'Add Bill Type'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
