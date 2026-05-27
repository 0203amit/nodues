import { APP_NAME, APP_TAGLINE } from "../config/branding";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-semibold text-slate-900">{APP_NAME}</h1>
        <p className="mt-1 text-sm text-slate-500">{APP_TAGLINE}</p>

        <button
          type="button"
          className="mt-8 w-full rounded-lg bg-indigo-700 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Sign in with Google
        </button>
        <p className="mt-3 text-xs text-slate-500">
          OAuth not yet implemented — Phase 1, Step 3
        </p>
      </div>
    </div>
  );
}
