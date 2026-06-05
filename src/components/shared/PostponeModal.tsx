import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { PostponeFormData } from '../../types';
import { formatDateDisplay } from '../../services/billsService';

export interface PostponeModalProps {
  title: string;
  itemTitle: string;
  contextLine: string;
  currentDueDate: string;
  isSaving: boolean;
  onSubmit: (data: PostponeFormData) => void;
  onClose: () => void;
}

export default function PostponeModal({
  title,
  itemTitle,
  contextLine,
  currentDueDate,
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
      if (e.key === 'Escape' && !isSaving) onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isSaving]);

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

  function handleBackdropClick() {
    if (!isSaving) onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-labelledby="postpone-modal-title"
        className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <h2
            id="postpone-modal-title"
            className="text-lg font-semibold text-slate-900"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="text-slate-400 hover:text-slate-600 p-1 rounded transition-colors cursor-pointer
                       min-h-11 min-w-11 inline-flex items-center justify-center
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Context lines */}
        <p className="text-sm text-slate-600 mb-1">{itemTitle}</p>
        {contextLine && (
          <p className="text-sm text-slate-600 mb-4">{contextLine}</p>
        )}
        {!contextLine && <div className="mb-4" />}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Current due date (read-only) */}
          <div className="block">
            <span className="text-sm font-medium text-slate-700">
              Current due date
            </span>
            <p className="mt-1 text-base text-slate-900">
              {formatDateDisplay(currentDueDate)}
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
