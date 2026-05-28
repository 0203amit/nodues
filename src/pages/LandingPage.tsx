import { APP_NAME, APP_TAGLINE } from "../config/branding";
import { useAuth } from "../contexts/AuthContext";
import ErrorBanner from "../components/auth/ErrorBanner";

const clientIdConfigured = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function LandingPage() {
  const { signIn, isLoading, error, clearError } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-semibold text-slate-900">{APP_NAME}</h1>
        <p className="mt-1 text-sm text-slate-500">{APP_TAGLINE}</p>

        <button
          type="button"
          onClick={signIn}
          disabled={isLoading || !clientIdConfigured}
          className="mt-8 w-full cursor-pointer rounded-lg bg-indigo-700 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? "Signing in\u2026" : "Sign in with Google"}
        </button>

        {!clientIdConfigured && (
          <div className="mt-4">
            <ErrorBanner
              message="Google sign-in is not configured. Contact the app administrator."
              dismissible={false}
            />
          </div>
        )}

        {error && (
          <div className="mt-4">
            <ErrorBanner
              message={error}
              dismissible
              onDismiss={clearError}
            />
          </div>
        )}
      </div>
    </div>
  );
}
