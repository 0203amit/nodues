import { CheckCircle2, Loader2, Circle, AlertCircle } from 'lucide-react';
import { useBootstrap } from '../../contexts/BootstrapContext';
import { useAuth } from '../../contexts/AuthContext';
import type { BootstrapStep } from '../../../specs/002-first-run-bootstrapping/contracts/bootstrap-context';
import type { ReactNode } from 'react';

// --- Step definitions with UI labels (from data-model.md) ---

const BOOTSTRAP_STEPS: { key: BootstrapStep; label: string }[] = [
  { key: 'detect', label: 'Checking existing setup...' },
  { key: 'folder', label: 'Creating Drive folder...' },
  { key: 'spreadsheet', label: 'Setting up database...' },
  { key: 'headers', label: 'Configuring database tables...' },
  { key: 'calendar', label: 'Creating calendar...' },
  { key: 'seed', label: 'Seeding starter data...' },
  { key: 'config', label: 'Saving configuration...' },
];

// --- Step status indicator ---

function StepIndicator({
  step,
  currentStep,
  completedSteps,
}: {
  step: { key: BootstrapStep; label: string };
  currentStep: BootstrapStep | null;
  completedSteps: BootstrapStep[];
}) {
  const isCompleted = completedSteps.includes(step.key);
  const isCurrent = step.key === currentStep;

  if (isCompleted) {
    return (
      <li className="flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" aria-hidden="true" />
        <span className="text-sm text-slate-700">{step.label}</span>
      </li>
    );
  }

  if (isCurrent) {
    return (
      <li className="flex items-center gap-3">
        <Loader2
          className="w-5 h-5 text-indigo-700 animate-spin motion-reduce:animate-none flex-shrink-0"
          aria-hidden="true"
        />
        <span className="text-sm font-medium text-indigo-700">{step.label}</span>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3">
      <Circle className="w-5 h-5 text-slate-300 flex-shrink-0" aria-hidden="true" />
      <span className="text-sm text-slate-400">{step.label}</span>
    </li>
  );
}

// --- BootstrapGuard ---

export default function BootstrapGuard({ children }: { children: ReactNode }) {
  const { status, currentStep, completedSteps, error, retry } = useBootstrap();
  const { signOut, isAuthenticated } = useAuth();

  // Not authenticated: pass through so ProtectedRoute can redirect to "/"
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  // Complete: render children immediately (no success screen)
  if (status === 'complete') {
    return <>{children}</>;
  }

  // Progress: detecting or bootstrapping
  if (status === 'detecting' || status === 'bootstrapping') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div
          className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm max-w-md w-full"
          role="status"
          aria-live="polite"
          aria-label="Setting up your workspace"
        >
          <h1 className="text-lg font-semibold text-slate-900 mb-6 text-center">
            Setting up your workspace
          </h1>
          <ul className="space-y-4" aria-label="Setup progress">
            {BOOTSTRAP_STEPS.map((step) => (
              <StepIndicator
                key={step.key}
                step={step}
                currentStep={currentStep}
                completedSteps={completedSteps}
              />
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // Error state
  if (status === 'error' && error) {
    const failedStepDef = BOOTSTRAP_STEPS.find((s) => s.key === error.step);
    const isRetryable = error.isRetryable;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" aria-hidden="true" />
          <h1 className="text-lg font-semibold text-slate-900 mb-2">
            Setup could not complete
          </h1>
          <p className="text-sm text-slate-600 mb-3">
            {error.message}
          </p>
          {failedStepDef && (
            <p className="text-xs text-slate-500 mb-6">
              Failed step: {failedStepDef.label.replace('...', '')}
            </p>
          )}
          <button
            type="button"
            onClick={isRetryable ? retry : signOut}
            className="bg-indigo-700 hover:bg-indigo-800 text-white font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer min-h-11 min-w-11 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            {isRetryable ? 'Retry Setup' : 'Sign In Again'}
          </button>
        </div>
      </div>
    );
  }

  // Idle state: transitional, render nothing
  return null;
}
