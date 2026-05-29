import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { MarkDoneFormData, TodoWithDisplay } from '../../types';
import { formatDueDate } from '../../services/calendarReminders';

export interface MarkDoneModalProps {
  todo: TodoWithDisplay;
  isSaving: boolean;
  onSubmit: (data: MarkDoneFormData) => void;
  onClose: () => void;
}

export default function MarkDoneModal({
  todo,
  isSaving,
  onSubmit,
  onClose,
}: MarkDoneModalProps) {
  const [notes, setNotes] = useState('');

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isSaving) onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isSaving]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ notes: notes.trim() });
  }

  function handleBackdropClick() {
    if (!isSaving) onClose();
  }

  // Build context line: categoryName · formatted due date
  const contextParts = [
    todo.categoryName,
    todo.dueDate ? formatDueDate(todo.dueDate) : '',
  ].filter(Boolean);
  const contextLine = contextParts.join(' \u00b7 ');

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-labelledby="mark-done-title"
        className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <h2
            id="mark-done-title"
            className="text-lg font-semibold text-slate-900"
          >
            Mark as Done
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

        {/* Context (read-only) */}
        <p className="text-sm font-semibold text-slate-900 mb-1">
          {todo.title}
        </p>
        {contextLine && (
          <p className="text-sm text-slate-600 mb-4">{contextLine}</p>
        )}
        {!contextLine && <div className="mb-4" />}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Notes */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about completing this to-do"
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white
                         font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer
                         min-h-11 inline-flex items-center gap-2
                         disabled:opacity-50 disabled:cursor-not-allowed
                         focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Mark Done
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
