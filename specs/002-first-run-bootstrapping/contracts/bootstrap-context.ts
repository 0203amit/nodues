/**
 * Contract: BootstrapContext
 *
 * Provides bootstrapping state and actions to the component tree.
 * Wraps authenticated routes to ensure Google resources exist before
 * the user reaches the dashboard.
 */

// --- Bootstrap Step Enum ---

export type BootstrapStep =
  | 'detect'
  | 'folder'
  | 'spreadsheet'
  | 'headers'
  | 'calendar'
  | 'seed'
  | 'config';

// --- Bootstrap Status ---

export type BootstrapStatus =
  | 'idle'
  | 'detecting'
  | 'bootstrapping'
  | 'complete'
  | 'error';

// --- Error ---

export interface BootstrapError {
  step: BootstrapStep;
  message: string;
  isRetryable: boolean;
  httpStatus: number | null;
}

// --- Setup Result ---

export interface SetupResult {
  folderId: string;
  spreadsheetId: string;
  calendarId: string;
  timezone: string;
  currency: string;
}

// --- Bootstrap State ---

export interface BootstrapState {
  status: BootstrapStatus;
  currentStep: BootstrapStep | null;
  completedSteps: BootstrapStep[];
  error: BootstrapError | null;
  setupResult: SetupResult | null;
}

// --- Context Value ---

export interface BootstrapContextValue extends BootstrapState {
  /** Run detection + bootstrapping. Called automatically on mount. */
  run: () => Promise<void>;
  /** Retry from the failed step. Only available when status === 'error'. */
  retry: () => Promise<void>;
}
