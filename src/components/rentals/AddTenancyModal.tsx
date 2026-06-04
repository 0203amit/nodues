import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Property, Tenancy, TenancyFormData } from '../../types';

export interface AddTenancyModalProps {
  mode: 'add' | 'edit';
  tenancy?: Tenancy;
  properties: Property[];
  isSaving: boolean;
  onSubmit: (data: TenancyFormData) => void;
  onClose: () => void;
}

export default function AddTenancyModal({
  mode,
  tenancy,
  properties,
  isSaving,
  onSubmit,
  onClose,
}: AddTenancyModalProps) {
  const isEdit = mode === 'edit';

  const [propertyId, setPropertyId] = useState(tenancy?.propertyId ?? '');
  const [unitLabel, setUnitLabel] = useState(tenancy?.unitLabel ?? '');
  const [name, setName] = useState(tenancy?.name ?? '');
  const [phone, setPhone] = useState(tenancy?.phone ?? '');
  const [email, setEmail] = useState(tenancy?.email ?? '');
  const [rentAmount, setRentAmount] = useState(
    tenancy ? String(tenancy.rentAmount) : '',
  );
  const [securityDeposit, setSecurityDeposit] = useState(
    tenancy?.securityDeposit !== null && tenancy?.securityDeposit !== undefined
      ? String(tenancy.securityDeposit)
      : '',
  );
  const [rentDueDay, setRentDueDay] = useState(
    tenancy ? String(tenancy.rentDueDay) : '1',
  );
  const [leaseStartDate, setLeaseStartDate] = useState(tenancy?.leaseStartDate ?? '');
  const [leaseEndDate, setLeaseEndDate] = useState(tenancy?.leaseEndDate ?? '');
  const [notes, setNotes] = useState(tenancy?.notes ?? '');

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function clearError(field: string) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!propertyId) {
      newErrors.propertyId = 'Please select a property.';
    }
    if (!name.trim()) {
      newErrors.name = 'Tenant name is required.';
    }
    const rentNum = Number(rentAmount);
    if (!rentAmount.trim() || isNaN(rentNum) || rentNum <= 0) {
      newErrors.rentAmount = 'Rent amount must be greater than 0.';
    }
    const depositStr = securityDeposit.trim();
    if (depositStr !== '') {
      const depositNum = Number(depositStr);
      if (isNaN(depositNum) || depositNum < 0) {
        newErrors.securityDeposit = 'Security deposit must be 0 or greater.';
      }
    }
    const dayNum = Number(rentDueDay);
    if (!rentDueDay.trim() || isNaN(dayNum) || dayNum < 1 || dayNum > 31 || !Number.isInteger(dayNum)) {
      newErrors.rentDueDay = 'Due day must be between 1 and 31.';
    }
    if (!leaseStartDate || !/^\d{4}-\d{2}-\d{2}$/.test(leaseStartDate)) {
      newErrors.leaseStartDate = 'Lease start date is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      propertyId: isEdit && tenancy ? tenancy.propertyId : propertyId,
      unitLabel: unitLabel.trim(),
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      rentAmount: rentAmount.trim(),
      securityDeposit: securityDeposit.trim(),
      rentDueDay: rentDueDay.trim(),
      leaseStartDate,
      leaseEndDate,
      notes: notes.trim(),
    });
  }

  const noProperties = properties.length === 0;

  // Resolve property name for read-only display in edit mode
  const editPropertyName = isEdit && tenancy
    ? (properties.find((p) => p.id === tenancy.propertyId)?.name ?? 'Unknown property')
    : '';

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-labelledby="tenancy-form-title"
        className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="tenancy-form-title"
          className="text-lg font-semibold text-slate-900 mb-4"
        >
          {isEdit ? 'Edit Tenancy' : 'Add Tenancy'}
        </h2>

        {/* No-properties guard */}
        {!isEdit && noProperties ? (
          <div className="text-center py-8">
            <p className="text-sm text-slate-600 mb-4">
              No active properties. Add a property in Settings first.
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
                  {properties.map((p) => (
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

            {/* Unit Label */}
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Unit Label</span>
              <input
                type="text"
                value={unitLabel}
                onChange={(e) => setUnitLabel(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                           px-3 py-2 text-base
                           focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                           focus:outline-none"
                placeholder='e.g., "Room 1", "Flat 3A"'
              />
            </label>

            {/* Name */}
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Tenant Name <span className="text-red-600">*</span>
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
                placeholder="Tenant name"
              />
              {errors.name && (
                <span className="text-red-600 text-xs mt-1 block">
                  {errors.name}
                </span>
              )}
            </label>

            {/* Phone */}
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Phone</span>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                           px-3 py-2 text-base
                           focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                           focus:outline-none"
                placeholder="Optional"
              />
            </label>

            {/* Email */}
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                           px-3 py-2 text-base
                           focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                           focus:outline-none"
                placeholder="Optional"
              />
            </label>

            {/* Rent Amount */}
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Rent Amount <span className="text-red-600">*</span>
              </span>
              <input
                type="number"
                value={rentAmount}
                onChange={(e) => {
                  setRentAmount(e.target.value);
                  clearError('rentAmount');
                }}
                className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                           px-3 py-2 text-base tabular-nums
                           focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                           focus:outline-none"
                placeholder="0"
                min="1"
                step="any"
              />
              {errors.rentAmount && (
                <span className="text-red-600 text-xs mt-1 block">
                  {errors.rentAmount}
                </span>
              )}
            </label>

            {/* Security Deposit */}
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Security Deposit</span>
              <input
                type="number"
                value={securityDeposit}
                onChange={(e) => {
                  setSecurityDeposit(e.target.value);
                  clearError('securityDeposit');
                }}
                className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                           px-3 py-2 text-base tabular-nums
                           focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                           focus:outline-none"
                placeholder="Optional"
                min="0"
                step="any"
              />
              {errors.securityDeposit && (
                <span className="text-red-600 text-xs mt-1 block">
                  {errors.securityDeposit}
                </span>
              )}
            </label>

            {/* Rent Due Day */}
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Rent Due Day <span className="text-red-600">*</span>
              </span>
              <input
                type="number"
                value={rentDueDay}
                onChange={(e) => {
                  setRentDueDay(e.target.value);
                  clearError('rentDueDay');
                }}
                className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                           px-3 py-2 text-base tabular-nums
                           focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                           focus:outline-none"
                min="1"
                max="31"
                step="1"
              />
              {errors.rentDueDay && (
                <span className="text-red-600 text-xs mt-1 block">
                  {errors.rentDueDay}
                </span>
              )}
            </label>

            {/* Lease Start Date */}
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Lease Start Date <span className="text-red-600">*</span>
              </span>
              <input
                type="date"
                value={leaseStartDate}
                onChange={(e) => {
                  setLeaseStartDate(e.target.value);
                  clearError('leaseStartDate');
                }}
                className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                           px-3 py-2 text-base
                           focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                           focus:outline-none"
              />
              {errors.leaseStartDate && (
                <span className="text-red-600 text-xs mt-1 block">
                  {errors.leaseStartDate}
                </span>
              )}
            </label>

            {/* Lease End Date */}
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Lease End Date</span>
              <input
                type="date"
                value={leaseEndDate}
                onChange={(e) => setLeaseEndDate(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                           px-3 py-2 text-base
                           focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                           focus:outline-none"
              />
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
                {isEdit ? 'Save' : 'Add Tenancy'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
