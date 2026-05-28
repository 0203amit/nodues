import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from "react";
import {
  useGoogleLogin,
  googleLogout,
  hasGrantedAllScopesGoogle,
  type TokenResponse,
} from "@react-oauth/google";

// --- Entities ---

export interface User {
  name: string;
  email: string;
  picture: string;
}

// --- Auth State ---

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// --- Auth Actions ---

type AuthAction =
  | { type: "SIGN_IN_START" }
  | { type: "SIGN_IN_SUCCESS"; payload: { user: User; accessToken: string } }
  | { type: "SIGN_IN_ERROR"; payload: { error: string } }
  | { type: "SIGN_OUT" }
  | { type: "CLEAR_ERROR" };

// --- Context Value ---

export interface AuthContextValue extends AuthState {
  signIn: () => void;
  signOut: () => void;
  clearError: () => void;
}

// --- Constants ---

const REQUIRED_API_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/calendar",
] as const;

const OAUTH_SCOPE_STRING = REQUIRED_API_SCOPES.join(" ");

const GOOGLE_USERINFO_URL =
  "https://www.googleapis.com/oauth2/v3/userinfo";

// --- Reducer ---

const initialState: AuthState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "SIGN_IN_START":
      return { ...state, isLoading: true, error: null };
    case "SIGN_IN_SUCCESS":
      return {
        user: action.payload.user,
        accessToken: action.payload.accessToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case "SIGN_IN_ERROR":
      return {
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload.error,
      };
    case "SIGN_OUT":
      return initialState;
    case "CLEAR_ERROR":
      return { ...state, error: null };
  }
}

// --- Context ---

const AuthContext = createContext<AuthContextValue | null>(null);

// --- Provider ---

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const handleSuccess = useCallback(
    async (
      tokenResponse: Omit<
        TokenResponse,
        "error" | "error_description" | "error_uri"
      >,
    ) => {
      // Verify all required API scopes were granted
      const allGranted = hasGrantedAllScopesGoogle(
        tokenResponse as TokenResponse,
        REQUIRED_API_SCOPES[0],
        REQUIRED_API_SCOPES[1],
        REQUIRED_API_SCOPES[2],
      );

      if (!allGranted) {
        dispatch({
          type: "SIGN_IN_ERROR",
          payload: {
            error:
              "NoDues requires access to Drive, Sheets, and Calendar to function. Please grant all permissions when signing in.",
          },
        });
        return;
      }

      // Fetch user profile from Google userinfo endpoint
      try {
        const res = await fetch(GOOGLE_USERINFO_URL, {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });

        if (!res.ok) {
          throw new Error("Failed to fetch user info");
        }

        const profile: { name: string; email: string; picture: string } =
          await res.json();

        dispatch({
          type: "SIGN_IN_SUCCESS",
          payload: {
            user: {
              name: profile.name,
              email: profile.email,
              picture: profile.picture,
            },
            accessToken: tokenResponse.access_token,
          },
        });
      } catch {
        dispatch({
          type: "SIGN_IN_ERROR",
          payload: {
            error:
              "A network error occurred during sign-in. Please check your connection and try again.",
          },
        });
      }
    },
    [],
  );

  const login = useGoogleLogin({
    scope: OAUTH_SCOPE_STRING,
    onSuccess: handleSuccess,
    onError: (errorResponse) => {
      dispatch({
        type: "SIGN_IN_ERROR",
        payload: {
          error:
            errorResponse.error_description ||
            "An error occurred during sign-in. Please try again.",
        },
      });
    },
    onNonOAuthError: (nonOAuthError) => {
      if (nonOAuthError.type === "popup_failed_to_open") {
        dispatch({
          type: "SIGN_IN_ERROR",
          payload: {
            error:
              "Your browser blocked the sign-in popup. Please allow popups for this site and try again.",
          },
        });
      }
      // popup_closed → silent (no action per spec)
    },
  });

  const signIn = useCallback(() => {
    dispatch({ type: "SIGN_IN_START" });
    login();
  }, [login]);

  const signOut = useCallback(() => {
    dispatch({ type: "SIGN_OUT" });
    googleLogout();
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signIn,
        signOut,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// --- Hook ---

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
