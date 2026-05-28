# Implementation Plan: Google Sign-In

**Branch**: `001-google-sign-in` | **Date**: 2026-05-27 | **Spec**: [spec.md](specs/001-google-sign-in/spec.md)

**Input**: Feature specification from `/specs/001-google-sign-in/spec.md`

## Summary

Implement Google OAuth 2.0 sign-in for NoDues using `@react-oauth/google` with the implicit flow. The sign-in requests `drive.file`, `spreadsheets`, `calendar`, `openid`, `email`, and `profile` scopes. Access tokens are stored in React state (memory only). An `AuthContext` provides user identity, access token, and `signOut()` to the entire app. Protected routes redirect unauthenticated users to the landing page. The navbar displays user identity and a sign-out action. A temporary dashboard welcome message verifies the auth flow.

## Technical Context

**Language/Version**: TypeScript ~6.0.2 / React 19.2.6

**Primary Dependencies**: React 19, React Router 6.30.3, Tailwind CSS 3.4.19, Lucide React 1.16.0, Vite 8.0.12, `@react-oauth/google` (to be added)

**Storage**: Memory only — React state via AuthContext. No localStorage, sessionStorage, or cookies.

**Testing**: Not yet configured (no test framework in package.json). Manual testing via acceptance scenarios.

**Target Platform**: Web browser (mobile-first SPA, 375px primary breakpoint)

**Project Type**: Single-page web application (client-only, no backend)

**Performance Goals**: Sign-in flow < 30 seconds on standard broadband (SC-001)

**Constraints**: Memory-only credentials (no persistent storage), WCAG 2.1 AA compliance, no backend server

**Scale/Scope**: Single-user per browser tab, household app (< 10 users total)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution is not yet ratified (template placeholders only). No gates to enforce. Proceeding with standard engineering best practices.

**Post-Phase 1 re-check**: No constitution violations — constitution remains unratified.

## Project Structure

### Documentation (this feature)

```text
specs/001-google-sign-in/
├── plan.md              # This file
├── research.md          # Phase 0 output — technology decisions
├── data-model.md        # Phase 1 output — entity definitions
├── quickstart.md        # Phase 1 output — developer setup guide
├── contracts/           # Phase 1 output — interface contracts
│   └── auth-context.ts  # AuthContext TypeScript interface
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
src/
├── App.tsx                          # Root component — wraps with GoogleOAuthProvider + AuthProvider
├── main.tsx                         # Entry point — BrowserRouter
├── index.css                        # Tailwind imports
├── config/
│   └── branding.ts                  # App name, tagline constants
├── contexts/
│   └── AuthContext.tsx              # NEW — AuthProvider, useAuth hook, auth state management
├── components/
│   ├── shared/
│   │   └── Navbar.tsx               # MODIFIED — add user identity display + sign-out button
│   └── auth/
│       ├── ProtectedRoute.tsx       # NEW — route guard with loading state
│       └── ErrorBanner.tsx          # NEW — inline dismissible error banner
└── pages/
    ├── LandingPage.tsx              # MODIFIED — Google sign-in integration + error banners
    ├── DashboardPage.tsx            # MODIFIED — welcome message with user name/email
    ├── BillsPage.tsx                # Unchanged
    ├── TodosPage.tsx                # Unchanged
    └── SettingsPage.tsx             # Unchanged
```

**Structure Decision**: Single-project SPA structure. No backend, no separate frontend directory. All source lives under `src/` following the existing convention. New directories: `src/contexts/` for React context providers, `src/components/auth/` for authentication-specific components.

### New Files (6)

| File | Purpose |
|------|---------|
| `src/contexts/AuthContext.tsx` | Auth state provider, `useAuth` hook, sign-in/sign-out logic |
| `src/components/auth/ProtectedRoute.tsx` | Route guard — redirect if unauthenticated, show loader if resolving |
| `src/components/auth/ErrorBanner.tsx` | Reusable inline error banner with dismiss button |
| `.env.example` | Documents `VITE_GOOGLE_CLIENT_ID` env var |

### Modified Files (4)

| File | Changes |
|------|---------|
| `src/main.tsx` | Wrap app with `GoogleOAuthProvider` |
| `src/App.tsx` | Replace hardcoded `isAuthenticated` with `useAuth`, wrap routes with `ProtectedRoute` |
| `src/components/shared/Navbar.tsx` | Add user avatar, name, sign-out button; mobile identity in expanded menu |
| `src/pages/LandingPage.tsx` | Add `useGoogleLogin` sign-in handler, scope verification, error banners |
| `src/pages/DashboardPage.tsx` | Add "Welcome, {name}" and "Signed in as {email}" |

### New Dependency (1)

| Package | Version | Purpose |
|---------|---------|---------|
| `@react-oauth/google` | latest | Google Identity Services wrapper for React |

## Component Architecture

```text
<StrictMode>
  <BrowserRouter>
    <GoogleOAuthProvider clientId={VITE_GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <App>
          ├── "/" → isAuthenticated ? <Navigate to="/dashboard"> : <LandingPage />
          ├── "/dashboard" → <ProtectedRoute><DashboardPage /></ProtectedRoute>
          ├── "/bills" → <ProtectedRoute><BillsPage /></ProtectedRoute>
          ├── "/todos" → <ProtectedRoute><TodosPage /></ProtectedRoute>
          └── "/settings" → <ProtectedRoute><SettingsPage /></ProtectedRoute>
          └── <Navbar /> (rendered inside App when authenticated)
        </App>
      </AuthProvider>
    </GoogleOAuthProvider>
  </BrowserRouter>
</StrictMode>
```

## Auth State Flow

```text
1. User clicks "Sign in with Google"
   └── useGoogleLogin() triggers Google popup

2. Popup outcomes:
   ├── User completes consent → onSuccess(tokenResponse)
   │   ├── hasGrantedAllScopesGoogle() → false → set error "All permissions required"
   │   └── hasGrantedAllScopesGoogle() → true
   │       ├── fetch userinfo endpoint → success → dispatch SIGN_IN (user + token)
   │       └── fetch userinfo endpoint → fail → set error "Network error"
   ├── User closes popup → onNonOAuthError(popup_closed) → silent (no action)
   ├── Popup blocked → onNonOAuthError(popup_failed_to_open) → set error "Allow popups"
   └── OAuth error → onError(error) → set error with description

3. Sign-out:
   └── signOut() → dispatch SIGN_OUT → googleLogout() → navigate to "/"

4. Route protection:
   ├── isLoading → show loading spinner
   ├── !isAuthenticated → <Navigate to="/" />
   └── isAuthenticated → render children
```

## Error Banner Scenarios

| Trigger | Message | Dismissible |
|---------|---------|-------------|
| Missing `VITE_GOOGLE_CLIENT_ID` | "Google sign-in is not configured. Contact the app administrator." | No |
| Browser blocks popup | "Your browser blocked the sign-in popup. Please allow popups for this site and try again." | Yes (dismiss or retry clears) |
| User denies required scopes | "NoDues requires access to Drive, Sheets, and Calendar to function. Please grant all permissions when signing in." | Yes |
| Network error fetching profile | "A network error occurred during sign-in. Please check your connection and try again." | Yes |
| Generic OAuth error | "{error_description}" or "An error occurred during sign-in. Please try again." | Yes |
| User closes popup | No banner (silent) | N/A |

## Complexity Tracking

No constitution violations to justify — constitution is unratified.
