import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { TodoFormData, TodoCategory, RecurrencePattern, TodoWithDisplay } from '../../types';

export interface TodoFormModalProps {
  todo: TodoWithDisplay | null;
  categories: TodoCategory[];
  recurrencePatterns: RecurrencePattern[];
  isSaving: boolean;
  onSubmit: (data: TodoFormData) => void;
  onClose: () => void;
}

export default function TodoFormModal({
  todo,
  categories,
  recurrencePatterns,
  isSaving,
  onSubmit,
  onClose,
}: TodoFormModalProps) {
  const isEdit = todo !== null;

  // Filter to active, non-deleted categories
  const activeCategories = categories.filter(
    (c) => c.active && c.deletedAt === '',
  );

  // Find default recurrence pattern (one-time = intervalValue 0)
  const defaultPatternId =
    recurrencePatterns.find((p) => p.intervalValue === 0)?.id ??
    recurrencePatterns[0]?.id ??
    '';

  const [title, setTitle] = useState(todo?.title ?? '');
  const [categoryId, setCategoryId] = useState(todo?.categoryId ?? '');
  const [dueDate, setDueDate] = useState(todo?.dueDate ?? '');
  const [recurrencePatternId, setRecurrencePatternId] = useState(
    todo?.recurrencePatternId ?? defaultPatternId,
  );
  const [reminderOffsetsDays, setReminderOffsetsDays] = useState(
    todo?.reminderOffsetsDays ?? '3,1',
  );
  const [description, setDescription] = useState(todo?.description ?? '');
  const [notes, setNotes] = useState(todo?.notes ?? '');

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
    if (!title.trim()) {
      newErrors.title = 'Title is required.';
    }
    const trimmedOffsets = reminderOffsetsDays.trim();
    if (trimmedOffsets !== '') {
      if (!/^\d+(,\d+)*$/.test(trimmedOffsets)) {
        newErrors.reminderOffsetsDays = 'Enter comma-separated numbers (e.g., 3,1).';
      } else {
        const nums = trimmedOffsets.split(',').map(Number);
        if (nums.some((n) => n <= 0)) {
          newErrors.reminderOffsetsDays = 'Enter comma-separated numbers (e.g., 3,1).';
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      categoryId,
      dueDate,
      recurrencePatternId,
      reminderOffsetsDays: reminderOffsetsDays.trim(),
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
        aria-labelledby="todo-form-title"
        className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 mb-4">
          <h2
            id="todo-form-title"
            className="text-lg font-semibold text-slate-900"
          >
            {isEdit ? 'Edit To-Do' : 'Add To-Do'}
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Title */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Title <span className="text-red-600">*</span>
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                clearError('title');
              }}
              className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                         px-3 py-2 text-base
                         focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                         focus:outline-none"
              placeholder="What needs to be done?"
            />
            {errors.title && (
              <span className="text-red-600 text-xs mt-1 block">
                {errors.title}
              </span>
            )}
          </label>

          {/* Category */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Category</span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                         px-3 py-2 text-base
                         focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                         focus:outline-none cursor-pointer"
            >
              <option value="">No category</option>
              {activeCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {/* Due Date */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Due Date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                         px-3 py-2 text-base
                         focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                         focus:outline-none"
            />
          </label>

          {/* Recurrence Pattern */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Recurrence
            </span>
            <select
              value={recurrencePatternId}
              onChange={(e) => setRecurrencePatternId(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                         px-3 py-2 text-base
                         focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                         focus:outline-none cursor-pointer"
            >
              {recurrencePatterns.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          {/* Reminder Offsets */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Reminder days before due
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
              placeholder="3,1"
            />
            <span className="text-xs text-slate-500 mt-1 block">
              Comma-separated days (e.g., 3,1)
            </span>
            {errors.reminderOffsetsDays && (
              <span className="text-red-600 text-xs mt-1 block">
                {errors.reminderOffsetsDays}
              </span>
            )}
          </label>

          {/* Description */}
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                         px-3 py-2 text-base
                         focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                         focus:outline-none resize-vertical"
              rows={3}
              placeholder="Optional description"
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
                         focus:outline-none resize-vertical"
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
              {isEdit ? 'Save' : 'Add To-Do'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
