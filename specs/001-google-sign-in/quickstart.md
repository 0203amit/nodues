# Quickstart: Google Sign-In

**Branch**: `001-google-sign-in` | **Date**: 2026-05-27

## Prerequisites

- Node.js 18+ installed
- A Google Cloud project with OAuth 2.0 Client ID configured
  - Application type: Web application
  - Authorized JavaScript origins: `http://localhost:5173`
  - APIs enabled: Google Drive API, Google Sheets API, Google Calendar API

## Setup

### 1. Clone and checkout the feature branch

```bash
git checkout 001-google-sign-in
```

### 2. Install dependencies

```bash
npm install
```

This will install the new `@react-oauth/google` dependency along with existing packages.

### 3. Configure environment variable

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and add your Google OAuth Client ID:

```env
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

**Where to get the Client ID**: [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → OAuth 2.0 Client IDs → Web application → Client ID.

### 4. Start the development server

```bash
npm run dev
```

The app starts at `http://localhost:5173`.

## Verification

### Sign-in flow (FR-001, FR-002, FR-004, FR-012)

1. Open `http://localhost:5173` — you should see the landing page with "NoDues", "Proof of every payment", and a "Sign in with Google" button
2. Click "Sign in with Google" — a Google consent popup appears
3. Grant all requested permissions (Drive files, Sheets, Calendar, profile)
4. After consent, you are redirected to `/dashboard` showing "Welcome, {your name}" and "Signed in as {your email}"

### Route protection (FR-006, FR-011)

1. Sign out (or open a new incognito window)
2. Navigate directly to `http://localhost:5173/dashboard` — you should be redirected to the landing page
3. Repeat for `/bills`, `/todos`, `/settings`

### Navbar identity (FR-008, FR-009)

1. Sign in
2. Check the navbar: your profile picture and name should appear
3. Click "Sign out" — you should be returned to the landing page
4. Verify you cannot access `/dashboard` after sign-out

### Landing page redirect (FR-007)

1. Sign in
2. Navigate to `http://localhost:5173/` — you should be automatically redirected to `/dashboard`

### Error scenarios (FR-010, FR-013, FR-014, FR-015)

1. **Missing client ID**: Remove `VITE_GOOGLE_CLIENT_ID` from `.env`, restart dev server — landing page should show a configuration error banner
2. **Blocked popup**: Use a browser with popup blocker enabled — banner should ask to allow popups
3. **Denied scopes**: During consent, uncheck one of the API permissions — banner should explain all permissions are required
4. **Cancelled consent**: Close the Google popup without completing sign-in — the landing page should remain as-is (no error message)

### Mobile responsiveness

1. Open browser dev tools, set viewport to 375px width
2. Sign in — verify the collapsible navbar shows your identity when expanded
3. Verify touch targets are at least 44x44px

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_GOOGLE_CLIENT_ID` | Yes | Google OAuth 2.0 Client ID for web application |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run build` | TypeScript check + production build |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build locally |

## Troubleshooting

### "Google sign-in is not configured" banner
- Ensure `.env` file exists with `VITE_GOOGLE_CLIENT_ID` set
- Restart the dev server after creating/editing `.env` (Vite requires restart for env changes)

### Popup opens but is blank
- Ensure `http://localhost:5173` is in the Authorized JavaScript origins of your Google Cloud OAuth client
- Check that the Google Identity Services script can load (no CSP blocking `accounts.google.com`)

### Sign-in succeeds but scopes are denied
- Google's granular consent allows users to uncheck individual permissions
- NoDues requires all 3 API scopes — the app will reject partial consent

### Token expires after ~1 hour
- Expected behavior for this phase — token refresh is out of scope
- User will need to sign in again
