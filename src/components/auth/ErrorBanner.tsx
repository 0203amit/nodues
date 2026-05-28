import { AlertCircle, X } from "lucide-react";

interface ErrorBannerProps {
  message: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}

export default function ErrorBanner({
  message,
  dismissible = true,
  onDismiss,
}: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3"
    >
      <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
      <p className="flex-1 text-sm text-red-700">{message}</p>
      {dismissible && onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="flex-shrink-0 rounded p-1 text-red-600 transition-colors hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label="Dismiss error"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
