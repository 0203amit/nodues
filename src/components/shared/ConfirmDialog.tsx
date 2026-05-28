import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant: 'primary' | 'destructive';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  confirmVariant,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const confirmClasses =
    confirmVariant === 'destructive'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-indigo-700 hover:bg-indigo-800 text-white';

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="confirm-dialog-title"
          className="text-lg font-semibold text-slate-900 mb-2"
        >
          {title}
        </h2>
        <p
          id="confirm-dialog-message"
          className="text-sm text-slate-600 mb-4"
        >
          {message}
        </p>
        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700
                       font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer
                       min-h-11 min-w-11
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`${confirmClasses}
                       font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer
                       min-h-11 min-w-11 inline-flex items-center gap-2
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
