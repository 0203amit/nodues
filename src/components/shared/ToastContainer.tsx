import { X, Undo2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import type { Toast } from '../../contexts/ToastContext';

// ── Single Toast ───────────────────────────────────────────────────

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const isSuccess = toast.variant === 'success';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        flex items-center justify-between gap-2 rounded-lg border p-3 shadow-sm
        transition-all duration-200
        ${
          isSuccess
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-red-50 border-red-200 text-red-900'
        }
      `}
    >
      <p className="text-sm font-medium">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="flex-shrink-0 min-h-11 min-w-11 flex items-center justify-center
                   rounded transition-colors cursor-pointer
                   hover:bg-slate-900/10
                   focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Undo Snackbar ──────────────────────────────────────────────────

function UndoSnackbarItem({
  message,
  onUndo,
  onDismiss,
}: {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="assertive"
      className="flex items-center justify-between gap-2 rounded-lg bg-slate-800 text-white p-3 shadow-sm
                 transition-all duration-200"
    >
      <p className="text-sm font-medium">{message}</p>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={() => {
            onUndo();
            onDismiss();
          }}
          className="min-h-11 min-w-11 flex items-center justify-center gap-1
                     text-white font-medium text-sm rounded transition-colors cursor-pointer
                     hover:bg-white/10
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-800"
        >
          <Undo2 className="w-4 h-4" />
          Undo
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-11 min-w-11 flex items-center justify-center
                     rounded transition-colors cursor-pointer
                     hover:bg-white/10
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-800"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Container ──────────────────────────────────────────────────────

export default function ToastContainer() {
  const { toasts, undoSnackbar, dismiss } = useToast();

  if (toasts.length === 0 && !undoSnackbar) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80
                 z-50 flex flex-col gap-2"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={() => dismiss(toast.id)}
        />
      ))}
      {undoSnackbar && (
        <UndoSnackbarItem
          message={undoSnackbar.message}
          onUndo={undoSnackbar.onUndo}
          onDismiss={() => dismiss(undoSnackbar.id)}
        />
      )}
    </div>
  );
}
