/**
 * Auth Context Contract — Google Sign-In Feature
 *
 * This file defines the TypeScript interfaces for the authentication
 * context that the rest of the application depends on. Any component
 * can call `useAuth()` to access these types.
 *
 * NOTE: This is a design contract, not runtime code. The implementation
 * in src/contexts/AuthContext.tsx must conform to these interfaces.
 */

// --- Entities ---

/** Signed-in user identity from Google userinfo endpoint */
export interface User {
  /** Full display name (e.g., "Jane Doe") */
  name: string;
  /** Email address (e.g., "jane@gmail.com") */
  email: string;
  /** Profile photo URL from Google */
  picture: string;
}

// --- Auth State ---

/** Application-wide authentication state */
export interface AuthState {
  /** Current user identity, null when signed out */
  user: User | null;
  /** OAuth access token, null when signed out */
  accessToken: string | null;
  /** Whether a user is currently signed in */
  isAuthenticated: boolean;
  /** Whether the auth state is being resolved (sign-in in progress) */
  isLoading: boolean;
  /** Error message for inline banner, null when no error */
  error: string | null;
}

// --- Auth Actions (reducer) ---

export type AuthAction =
  | { type: "SIGN_IN_START" }
  | { type: "SIGN_IN_SUCCESS"; payload: { user: User; accessToken: string } }
  | { type: "SIGN_IN_ERROR"; payload: { error: string } }
  | { type: "SIGN_OUT" }
  | { type: "CLEAR_ERROR" };

// --- Context Value ---

/** Value provided by AuthContext to consumers via useAuth() */
export interface AuthContextValue extends AuthState {
  /** Trigger Google sign-in flow (opens consent popup) */
  signIn: () => void;
  /** Sign out: clear all state, redirect to landing page */
  signOut: () => void;
  /** Clear the current error message */
  clearError: () => void;
}

// --- Constants ---

/** Google API scopes requested during sign-in */
export const REQUIRED_API_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/calendar",
] as const;

/**
 * All scopes requested (API scopes only — openid, profile, email
 * are auto-prepended by @react-oauth/google)
 */
export const OAUTH_SCOPE_STRING = REQUIRED_API_SCOPES.join(" ");

/** Google userinfo endpoint for fetching profile data */
export const GOOGLE_USERINFO_URL =
  "https://www.googleapis.com/oauth2/v3/userinfo";

// --- Component Contracts ---

/** Props for the ProtectedRoute wrapper component */
export interface ProtectedRouteProps {
  /** The route content to render when authenticated */
  children: React.ReactNode;
}

/** Props for the ErrorBanner component */
export interface ErrorBannerProps {
  /** The error message to display */
  message: string;
  /** Whether the banner can be dismissed by the user */
  dismissible?: boolean;
  /** Callback when the user dismisses the banner */
  onDismiss?: () => void;
}
