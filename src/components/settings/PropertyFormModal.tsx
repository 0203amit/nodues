import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Property, PropertyFormData } from '../../types';

export interface PropertyFormModalProps {
  property: Property | null;
  isSaving: boolean;
  onSubmit: (data: PropertyFormData) => void;
  onClose: () => void;
}

export default function PropertyFormModal({
  property,
  isSaving,
  onSubmit,
  onClose,
}: PropertyFormModalProps) {
  const isEdit = property !== null;

  const [name, setName] = useState(property?.name ?? '');
  const [address, setAddress] = useState(property?.address ?? '');
  const [notes, setNotes] = useState(property?.notes ?? '');
  const [isRental, setIsRental] = useState(property?.isRental ?? false);
  const [nameError, setNameError] = useState('');

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Property name is required.');
      return;
    }
    setNameError('');

    onSubmit({
      name: trimmedName,
      address: address.trim(),
      notes: notes.trim(),
      isRental,
    });
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-labelledby="property-form-title"
        className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="property-form-title"
          className="text-lg font-semibold text-slate-900 mb-4"
        >
          {isEdit ? 'Edit Property' : 'Add Property'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                if (nameError) setNameError('');
              }}
              className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                         px-3 py-2 text-base
                         focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                         focus:outline-none"
              placeholder="e.g. Property 1"
              autoFocus
            />
            {nameError && (
              <span className="text-red-600 text-xs mt-1 block">{nameError}</span>
            )}
          </label>

          {/* Address (optional) */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Address</span>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                         px-3 py-2 text-base
                         focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                         focus:outline-none"
              placeholder="e.g. 123 Main St, City"
            />
          </label>

          {/* Notes (optional) */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                         px-3 py-2 text-base resize-y
                         focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                         focus:outline-none"
              placeholder="Any additional notes"
            />
          </label>

          {/* Rental checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isRental}
              onChange={(e) => setIsRental(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600
                         focus:ring-indigo-500 cursor-pointer"
            />
            <span className="text-sm text-slate-700">This is a rental property</span>
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
              {isEdit ? 'Save Changes' : 'Add Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
