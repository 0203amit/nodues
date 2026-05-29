import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { TodoCategory, TodoCategoryFormData } from '../../types';
import { CATEGORY_COLOR_PALETTE } from '../../types';

export interface CategoryFormModalProps {
  category: TodoCategory | null;
  isSaving: boolean;
  onSubmit: (data: TodoCategoryFormData) => void;
  onClose: () => void;
}

export default function CategoryFormModal({
  category,
  isSaving,
  onSubmit,
  onClose,
}: CategoryFormModalProps) {
  const isEdit = category !== null;

  const [name, setName] = useState(category?.name ?? '');
  const [nameError, setNameError] = useState('');

  // Resolve initial color: match palette entry or default to first
  const initialColor = (() => {
    if (category?.color) {
      const match = CATEGORY_COLOR_PALETTE.find(
        (s) => s.hex.toLowerCase() === category.color.toLowerCase(),
      );
      return match ? match.hex : CATEGORY_COLOR_PALETTE[0].hex;
    }
    return CATEGORY_COLOR_PALETTE[0].hex;
  })();
  const [selectedColor, setSelectedColor] = useState(initialColor);

  // Close on Escape key (blocked while saving)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isSaving) onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isSaving]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Category name is required.');
      return;
    }
    setNameError('');

    onSubmit({ name: trimmedName, color: selectedColor });
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
        aria-labelledby="category-form-title"
        className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            id="category-form-title"
            className="text-lg font-semibold text-slate-900"
          >
            {isEdit ? 'Edit Category' : 'Add Category'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer
                       min-h-11 min-w-11 inline-flex items-center justify-center rounded
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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
              placeholder="e.g. Household"
              autoFocus
            />
            {nameError && (
              <span className="text-red-600 text-xs mt-1 block">{nameError}</span>
            )}
          </label>

          {/* Color palette */}
          <fieldset>
            <legend className="text-sm font-medium text-slate-700 mb-2">Color</legend>
            <div className="flex flex-wrap gap-1">
              {CATEGORY_COLOR_PALETTE.map((swatch) => (
                <button
                  key={swatch.hex}
                  type="button"
                  onClick={() => setSelectedColor(swatch.hex)}
                  className={`p-1.5 rounded-full transition-all cursor-pointer
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                    ${selectedColor === swatch.hex ? 'ring-2 ring-offset-2 ring-indigo-500' : ''}`}
                  title={swatch.name}
                  aria-label={`Select ${swatch.name}`}
                  aria-pressed={selectedColor === swatch.hex}
                >
                  <span
                    className="block w-8 h-8 rounded-full"
                    style={{ backgroundColor: swatch.hex }}
                  />
                </button>
              ))}
            </div>
          </fieldset>

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
              {isEdit ? 'Save Changes' : 'Add Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
