import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import {
  bootstrap,
  BootstrapError as ServiceBootstrapError,
} from '../services/bootstrapService';
import type {
  BootstrapStep,
  BootstrapStatus,
  BootstrapError,
  BootstrapState,
  BootstrapContextValue,
  SetupResult,
} from '../../specs/002-first-run-bootstrapping/contracts/bootstrap-context';

// --- Context ---

const BootstrapContext = createContext<BootstrapContextValue | null>(null);

// --- Provider ---

export function BootstrapProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth();

  const [state, setState] = useState<BootstrapState>({
    status: 'idle',
    currentStep: null,
    completedSteps: [],
    error: null,
    setupResult: null,
  });

  // StrictMode double-invocation guard.
  // React 19 StrictMode double-mounts components in development. Without this
  // ref, the bootstrap effect would fire twice, potentially creating duplicate
  // Google resources (folders, sheets, calendars). The ref persists across
  // StrictMode's double-mount cycle because React reuses the same fiber.
  const hasStarted = useRef(false);

  const run = useCallback(async () => {
    if (!accessToken) return;

    setState((prev) => ({
      ...prev,
      status: 'detecting' as BootstrapStatus,
      currentStep: 'detect' as BootstrapStep,
      completedSteps: [],
      error: null,
    }));

    try {
      let previousStep: BootstrapStep | null = null;

      const result: SetupResult = await bootstrap(
        accessToken,
        (step: BootstrapStep) => {
          setState((prev) => {
            const completed = previousStep
              ? [...prev.completedSteps, previousStep]
              : prev.completedSteps;

            // Transition from 'detecting' to 'bootstrapping' once past the detect step
            const status: BootstrapStatus =
              step === 'detect' ? 'detecting' : 'bootstrapping';

            return {
              ...prev,
              status,
              currentStep: step,
              completedSteps: completed,
            };
          });
          previousStep = step;
        },
      );

      setState({
        status: 'complete',
        currentStep: null,
        completedSteps: [
          'detect',
          'folder',
          'spreadsheet',
          'headers',
          'calendar',
          'seed',
          'config',
        ],
        error: null,
        setupResult: result,
      });
    } catch (error) {
      const bootstrapError = mapError(error);
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: bootstrapError,
      }));
    }
  }, [accessToken]);

  const retry = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      error: null,
    }));
    await run();
  }, [run]);

  // Auto-trigger bootstrap when accessToken is available and status is idle
  useEffect(() => {
    if (accessToken && state.status === 'idle' && !hasStarted.current) {
      hasStarted.current = true;
      run();
    }
  }, [accessToken, state.status, run]);

  return (
    <BootstrapContext.Provider
      value={{
        ...state,
        run,
        retry,
      }}
    >
      {children}
    </BootstrapContext.Provider>
  );
}

// --- Hook ---

export function useBootstrap(): BootstrapContextValue {
  const context = useContext(BootstrapContext);
  if (!context) {
    throw new Error('useBootstrap must be used within a BootstrapProvider');
  }
  return context;
}

// --- Error mapping ---

function mapError(error: unknown): BootstrapError {
  if (error instanceof ServiceBootstrapError) {
    return {
      step: error.step as BootstrapStep,
      message: error.message,
      isRetryable: error.isRetryable,
      httpStatus: error.httpStatus,
    };
  }

  // Fallback for unexpected errors
  return {
    step: 'detect',
    message:
      error instanceof Error
        ? error.message
        : 'An unexpected error occurred.',
    isRetryable: false,
    httpStatus: null,
  };
}
