import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

// ── Types ──────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  variant: ToastVariant;
  message: string;
}

export interface UndoSnackbar {
  id: string;
  message: string;
  onUndo: () => void;
  durationMs: number;
}

export interface ToastContextValue {
  toasts: Toast[];
  undoSnackbar: UndoSnackbar | null;
  showToast: (message: string, variant: ToastVariant) => void;
  showUndo: (message: string, onUndo: () => void, durationMs?: number) => void;
  dismiss: (id: string) => void;
}

// ── Context ────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [undoSnackbar, setUndoSnackbar] = useState<UndoSnackbar | null>(null);

  // Track toast timers so we can clean up on unmount
  const toastTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up all timers on unmount
  useEffect(() => {
    return () => {
      toastTimers.current.forEach((timer) => clearTimeout(timer));
      toastTimers.current.clear();
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    // Try removing from toasts
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = toastTimers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimers.current.delete(id);
    }

    // Try removing undo snackbar
    setUndoSnackbar((prev) => {
      if (prev?.id === id) {
        if (undoTimer.current) {
          clearTimeout(undoTimer.current);
          undoTimer.current = null;
        }
        return null;
      }
      return prev;
    });
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant) => {
      const id = crypto.randomUUID();
      const toast: Toast = { id, variant, message };
      setToasts((prev) => [...prev, toast]);

      const timer = setTimeout(() => {
        dismiss(id);
      }, 4000);
      toastTimers.current.set(id, timer);
    },
    [dismiss],
  );

  const showUndo = useCallback(
    (message: string, onUndo: () => void, durationMs = 10000) => {
      // Clear any existing undo snackbar timer
      if (undoTimer.current) {
        clearTimeout(undoTimer.current);
        undoTimer.current = null;
      }

      const id = crypto.randomUUID();
      const snackbar: UndoSnackbar = { id, message, onUndo, durationMs };
      setUndoSnackbar(snackbar);

      undoTimer.current = setTimeout(() => {
        setUndoSnackbar((prev) => (prev?.id === id ? null : prev));
        undoTimer.current = null;
      }, durationMs);
    },
    [],
  );

  const value: ToastContextValue = {
    toasts,
    undoSnackbar,
    showToast,
    showUndo,
    dismiss,
  };

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
