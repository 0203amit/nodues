# Research: Google Sign-In

**Branch**: `001-google-sign-in` | **Date**: 2026-05-27

## R-001: @react-oauth/google Library Selection

**Decision**: Use `@react-oauth/google` with `useGoogleLogin` hook (implicit flow)

**Rationale**:
- Spec explicitly names this library
- Thin wrapper around Google Identity Services (GIS) SDK
- Provides `useGoogleLogin` hook returning a trigger function — gives full control over button styling (required to match MASTER.md design system)
- Exports `hasGrantedAllScopesGoogle` utility for scope verification (FR-014)
- Handles popup lifecycle with distinct callbacks: `onSuccess`, `onError`, `onNonOAuthError`
- React peer dependency `>=16.8.0` — compatible with React 19
- Latest version: 0.13.x

**Alternatives Considered**:
- `GoogleLogin` pre-built button component — rejected because it renders Google's branded button, cannot be styled to match the NoDues design system
- Raw GIS SDK (`google.accounts.oauth2.initTokenClient`) — rejected because @react-oauth/google already wraps this with React hooks and context, avoiding manual script loading
- Authorization code flow — rejected because there is no backend server; implicit flow returns access_token directly to the client

## R-002: OAuth Flow Architecture

**Decision**: Implicit flow via popup with in-memory token storage

**Rationale**:
- Spec requires credentials stored "in application memory only" (FR-003) — rules out localStorage, sessionStorage, cookies
- Implicit flow returns `access_token` directly in the popup callback — no backend exchange needed
- `useGoogleLogin` defaults to `flow: 'implicit'` with popup UX
- Token stored in React state (via AuthContext) — cleared on page refresh, tab close, or sign-out, exactly matching spec assumptions

**Alternatives Considered**:
- Authorization code flow with PKCE — rejected because it requires a backend token exchange endpoint; NoDues has no backend
- Redirect flow (instead of popup) — rejected because it causes a full page reload, losing any in-memory state; popup flow is seamless

## R-003: Scope Request Strategy

**Decision**: Request all 6 scopes upfront via `scope` parameter; do NOT use `overrideScope: true`

**Rationale**:
- The library auto-prepends `openid profile email` to the `scope` parameter
- Only the 3 API scopes need to be specified: `drive.file`, `spreadsheets`, `calendar`
- This avoids duplication and is the simpler pattern
- Google's granular consent (since June 2024) will show users individual scope checkboxes
- Use `prompt: 'consent'` to ensure all scopes are shown on every sign-in (since tokens are memory-only, no prior consent is remembered)

**Scopes requested**:
- Auto-prepended: `openid`, `profile`, `email`
- Explicit: `https://www.googleapis.com/auth/drive.file`, `https://www.googleapis.com/auth/spreadsheets`, `https://www.googleapis.com/auth/calendar`

## R-004: Scope Verification After Consent

**Decision**: Use `hasGrantedAllScopesGoogle` from @react-oauth/google to verify all 3 API scopes are granted

**Rationale**:
- The `TokenResponse` includes a `scope` field (space-delimited string of granted scopes)
- `hasGrantedAllScopesGoogle(tokenResponse, ...scopes)` wraps `google.accounts.oauth2.hasGrantedAllScopes` and compares against the `scope` field
- Only need to verify the 3 API scopes (`drive.file`, `spreadsheets`, `calendar`) — `openid`, `email`, `profile` are always granted when sign-in succeeds
- If any required scope is missing: treat as sign-in failure, clear partial state, show inline error banner (FR-014)

**Scope alias consideration**: Google may return `email` as `https://www.googleapis.com/auth/userinfo.email` and `profile` as `https://www.googleapis.com/auth/userinfo.profile`. The `hasGrantedAllScopesGoogle` function handles these aliases internally via the GIS SDK.

**Alternatives Considered**:
- Calling `tokeninfo` endpoint — rejected for production use; Google warns it may be throttled and is intended for debugging only
- Manual string parsing of `scope` field — rejected because `hasGrantedAllScopesGoogle` already handles aliases and edge cases

## R-005: User Profile Retrieval

**Decision**: Fetch user info from Google's userinfo endpoint after successful sign-in

**Rationale**:
- `useGoogleLogin` with implicit flow returns an `access_token`, not an `id_token`
- User profile data (name, email, picture) must be fetched from `https://www.googleapis.com/oauth2/v3/userinfo` with `Authorization: Bearer <token>`
- Response shape: `{ sub, name, given_name, family_name, picture, email, email_verified }`
- This is the standard approach documented by Google for the token model

**Alternatives Considered**:
- Using `GoogleLogin` component which returns a `credential` JWT — rejected because it doesn't allow custom button styling and doesn't support requesting API scopes
- Decoding an id_token client-side — not applicable; implicit flow doesn't return id_token

## R-006: Error Handling Taxonomy

**Decision**: Map all error scenarios to distinct error types displayed via inline banner

**Rationale**: The spec defines 6 error scenarios (FR-010, FR-013, FR-014, FR-015) that must be handled with inline banners. The @react-oauth/google library provides three callbacks that map cleanly to these scenarios:

| Callback | `type` / trigger | Spec Requirement | App Behavior |
|----------|-----------------|------------------|-------------|
| `onNonOAuthError` | `popup_failed_to_open` | FR-015 | Banner: "Allow popups for this site and retry" |
| `onNonOAuthError` | `popup_closed` | Edge case | Silent — no message (per clarification) |
| `onError` | OAuth error | FR-010 | Banner: descriptive error message |
| `onSuccess` | Scope check fails | FR-014 | Banner: "All permissions are required" |
| `onSuccess` | Network error fetching userinfo | FR-010 | Banner: "Network error, please retry" |
| App init | Missing `VITE_GOOGLE_CLIENT_ID` | FR-013 | Banner: "Configuration missing" |

## R-007: AuthContext Architecture

**Decision**: React Context + useReducer for auth state management

**Rationale**:
- Spec requires a "shared authentication state that any part of the application can read" (FR-005)
- AuthContext provides: `user` (name, email, picture), `accessToken`, `isAuthenticated`, `isLoading`, `signOut()`, `error`
- `useReducer` over `useState` because auth state has multiple interdependent fields (user, token, loading, error) that change together
- Context wraps the entire app (inside `GoogleOAuthProvider`) to make auth state available everywhere
- `signOut()` clears all state and calls `googleLogout()` from the library (clears One Tap state)
- No persistence — state resets on page refresh (per spec assumptions)

**Alternatives Considered**:
- Zustand or other state library — rejected as unnecessary; React Context is sufficient for a single global auth state object
- Redux — rejected as over-engineered for this use case
- Passing props down — rejected because auth state is needed in Navbar, route guards, and multiple pages

## R-008: Route Protection Pattern

**Decision**: `ProtectedRoute` wrapper component that checks AuthContext

**Rationale**:
- Each protected route (`/dashboard`, `/bills`, `/todos`, `/settings`) is wrapped in `<ProtectedRoute>`
- If `isLoading` is true: render a loading spinner (FR-011)
- If `isAuthenticated` is false: redirect to `/` via `<Navigate to="/" replace />`
- If `isAuthenticated` is true: render the child route
- This pattern is standard React Router 6 and keeps route protection declarative

**Alternatives Considered**:
- Layout route with `<Outlet />` — viable but less explicit; wrapping each route is clearer
- `useNavigate` in each page — rejected because it duplicates guard logic across every page

## R-009: Environment Variable for Client ID

**Decision**: Use `VITE_GOOGLE_CLIENT_ID` environment variable

**Rationale**:
- Vite exposes env vars prefixed with `VITE_` to client code via `import.meta.env`
- Client ID is not a secret (it's embedded in the HTML of any Google OAuth app)
- At app init, check if `import.meta.env.VITE_GOOGLE_CLIENT_ID` is defined and non-empty
- If missing: show inline banner on landing page (FR-013); do not render GoogleOAuthProvider
- Add `.env.example` with placeholder for developer onboarding

## R-010: Navbar User Identity Display

**Decision**: Add user avatar + name to Navbar, with sign-out button

**Rationale**:
- Desktop: profile picture (32x32, rounded-full) + display name + "Sign out" text button in the right side of the navbar
- Mobile: in the expanded mobile menu, show profile picture + name + email + "Sign out" button
- Profile picture uses `<img>` with `alt={user.name}` for accessibility
- Fallback for missing picture: initials in a colored circle
- Sign-out button follows MASTER.md ghost button style
- Touch target ≥ 44x44px for mobile (WCAG 2.1 AA / SC-006)
