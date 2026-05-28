# Data Model: Google Sign-In

**Branch**: `001-google-sign-in` | **Date**: 2026-05-27

## Entities

### User

Represents the currently signed-in person. Null when no one is signed in.

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `name` | `string` | Google userinfo `name` | Full display name |
| `email` | `string` | Google userinfo `email` | Email address |
| `picture` | `string` | Google userinfo `picture` | Profile photo URL |

**Validation Rules**:
- All three fields are required (guaranteed by Google userinfo endpoint when `profile` and `email` scopes are granted)
- `picture` is a URL string; if empty or invalid, the UI renders initials fallback
- No client-side persistence — exists only in React state

**Source**: `GET https://www.googleapis.com/oauth2/v3/userinfo` with `Authorization: Bearer <access_token>`

---

### AccessCredential

The OAuth access token granting permission to Google APIs. Exists only while the user is signed in and only in React state.

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `accessToken` | `string` | `TokenResponse.access_token` | Bearer token for Google API calls |
| `expiresIn` | `number` | `TokenResponse.expires_in` | Token lifetime in seconds (~3600) |

**Validation Rules**:
- `accessToken` must be a non-empty string
- Token is NOT refreshed automatically (per spec assumptions — user must re-sign-in after expiry)
- Never written to localStorage, sessionStorage, cookies, or any persistent storage

---

### AuthState

The application-level authentication state. Managed by `useReducer` in `AuthContext`.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `user` | `User \| null` | `null` | Current user identity |
| `accessToken` | `string \| null` | `null` | OAuth access token |
| `isAuthenticated` | `boolean` | `false` | Whether a user is signed in |
| `isLoading` | `boolean` | `false` | Whether auth state is being resolved |
| `error` | `string \| null` | `null` | Error message for inline banner |

**State Transitions**:

```text
                        ┌──────────────┐
                        │   INITIAL    │
                        │ user: null   │
                        │ loading: false│
                        └──────┬───────┘
                               │
                        SIGN_IN_START
                               │
                        ┌──────▼───────┐
                        │   LOADING    │
                        │ user: null   │
                        │ loading: true│
                        └──────┬───────┘
                               │
                    ┌──────────┼──────────┐
                    │          │          │
              SIGN_IN_SUCCESS  │    SIGN_IN_ERROR
                    │          │          │
             ┌──────▼───────┐  │   ┌──────▼───────┐
             │ AUTHENTICATED│  │   │    ERROR      │
             │ user: User   │  │   │ user: null    │
             │ loading: false│ │   │ error: string │
             └──────┬───────┘  │   └──────┬───────┘
                    │          │          │
                SIGN_OUT    CLEAR_ERROR   │
                    │          │          │
                    └──────────┼──────────┘
                               │
                        ┌──────▼───────┐
                        │   INITIAL    │
                        └──────────────┘
```

**Reducer Actions**:

| Action | Payload | Effect |
|--------|---------|--------|
| `SIGN_IN_START` | none | Set `isLoading: true`, clear error |
| `SIGN_IN_SUCCESS` | `{ user: User, accessToken: string }` | Set user, token, `isAuthenticated: true`, `isLoading: false` |
| `SIGN_IN_ERROR` | `{ error: string }` | Set error, clear user/token, `isAuthenticated: false`, `isLoading: false` |
| `SIGN_OUT` | none | Reset to initial state |
| `CLEAR_ERROR` | none | Set `error: null` |

---

### ErrorBanner (UI Entity)

Represents an inline error message displayed on the landing page.

| Field | Type | Description |
|-------|------|-------------|
| `message` | `string` | Human-readable error text |
| `dismissible` | `boolean` | Whether the user can dismiss the banner |

**Derived from**: `AuthState.error` field. Non-null error renders the banner.

---

## Relationships

```text
AuthContext (1) ──provides──▶ AuthState (1)
AuthState (1) ──contains──▶ User (0..1)
AuthState (1) ──contains──▶ AccessCredential (0..1)
AuthState (1) ──contains──▶ ErrorBanner (0..1)
```

- `User` and `AccessCredential` are always set/cleared together (atomic sign-in/sign-out)
- `ErrorBanner` is independent — can exist when user is null (sign-in errors) or be cleared without affecting auth state
