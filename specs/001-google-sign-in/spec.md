# Feature Specification: Google Sign-In

**Feature Branch**: `001-google-sign-in`

**Created**: 2026-05-27

**Status**: Draft

**Input**: User description: "Implement Google OAuth 2.0 sign-in for NoDues using @react-oauth/google. Request drive.file, spreadsheets, calendar, openid, email, profile scopes. Store access token in memory only. Provide AuthContext/useAuth for user info and signOut. Protect authenticated routes. Show user identity in navbar. Temporary dashboard welcome message for verification."

## Clarifications

### Session 2026-05-27

- Q: How should error messages be presented to the user on the landing page? → A: Inline banner below the sign-in button, persistent until dismissed or retry.
- Q: What accessibility compliance level should the sign-in feature target? → A: WCAG 2.1 AA (keyboard nav, focus management, screen reader labels, 4.5:1 contrast).
- Q: What mobile navigation pattern should be used for authenticated pages? → A: Collapsible top navbar that expands vertically below the header on tap.
- Q: What should happen if the browser blocks the Google consent popup? → A: Show an inline banner asking the user to allow popups and retry.
- Q: When a user closes the Google consent popup without completing sign-in, should the app show any feedback? → A: Silent — no message, landing page remains as-is.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign In with Google (Priority: P1)

A household member visits NoDues for the first time (or after signing out). They see the landing page with the app name, tagline, and a single "Sign in with Google" button. They click the button, a Google consent popup appears requesting permission to access Drive files, Sheets, and Calendar. After granting consent, the popup closes and the user is taken to the dashboard, which greets them by name and confirms their email address.

**Why this priority**: Without sign-in, no other feature in the app can function. This is the foundational gate for all authenticated functionality.

**Independent Test**: Can be fully tested by clicking "Sign in with Google" on the landing page, completing the Google consent flow, and verifying the dashboard displays the user's name and email.

**Acceptance Scenarios**:

1. **Given** the user is not signed in, **When** they visit the app, **Then** they see the landing page with the app name "NoDues", tagline "Proof of every payment", and a "Sign in with Google" button.
2. **Given** the user is on the landing page, **When** they click "Sign in with Google" and complete the Google consent flow, **Then** they are redirected to the dashboard which displays "Welcome, {name}" and "Signed in as {email}".
3. **Given** the user is on the landing page, **When** they click "Sign in with Google" and the consent popup requests permissions, **Then** the requested permissions include access to Drive files, Sheets, and Calendar along with basic profile information.

---

### User Story 2 - Route Protection (Priority: P1)

A user who is not signed in attempts to navigate directly to an authenticated page (dashboard, bills, to-dos, or settings) by typing the URL. The system redirects them to the landing page instead of showing the protected content.

**Why this priority**: Without route protection, unauthenticated users could reach pages that depend on user identity and access tokens, causing errors and a broken experience. This is co-equal with sign-in itself.

**Independent Test**: Can be tested by entering a protected URL (e.g., /dashboard) directly in the browser while not signed in and verifying redirection to the landing page.

**Acceptance Scenarios**:

1. **Given** the user is not signed in, **When** they navigate to /dashboard, **Then** they are redirected to the landing page.
2. **Given** the user is not signed in, **When** they navigate to /bills, /todos, or /settings, **Then** they are redirected to the landing page for each.
3. **Given** the user is signed in, **When** they navigate to /dashboard, **Then** the dashboard page loads normally.

---

### User Story 3 - Signed-In User Identity in Navigation (Priority: P2)

A signed-in user sees their profile picture and name displayed in the navigation bar on every authenticated page. This provides a visual confirmation that they are signed into the correct account — important in a family-shared app where multiple household members may use different Google accounts.

**Why this priority**: Identity display builds trust and prevents accidental actions under the wrong account, but the app still functions without it.

**Independent Test**: Can be tested by signing in and verifying the navbar displays the user's Google profile picture and name on any authenticated page.

**Acceptance Scenarios**:

1. **Given** the user is signed in, **When** they view any authenticated page, **Then** the navigation bar displays their profile picture and name.
2. **Given** the user is signed in on a mobile device, **When** they tap the navbar toggle to expand the collapsible top navigation, **Then** their profile picture, name, and email are visible in the expanded section.

---

### User Story 4 - Sign Out (Priority: P2)

A signed-in user clicks the "Sign out" button in the navigation bar. The system clears their identity and access credentials from memory and returns them to the landing page. This is important for family-shared devices where one member may need to sign out so another can sign in with a different Google account.

**Why this priority**: Sign-out is essential for multi-user households sharing a device, but secondary to the ability to sign in.

**Independent Test**: Can be tested by signing in, clicking "Sign out" in the navbar, and verifying the user is returned to the landing page with no residual identity displayed.

**Acceptance Scenarios**:

1. **Given** the user is signed in, **When** they click "Sign out" in the navigation bar, **Then** their identity and access credentials are cleared from memory and they are redirected to the landing page.
2. **Given** the user has signed out, **When** they try to navigate to /dashboard, **Then** they are redirected to the landing page.
3. **Given** the user is signed in on mobile, **When** they expand the collapsible top navbar and tap "Sign out", **Then** the same sign-out behavior occurs.

---

### User Story 5 - Landing Page Redirect for Signed-In Users (Priority: P3)

A user who is already signed in navigates to the landing page (root URL). Instead of seeing the sign-in button again, they are automatically redirected to the dashboard. This prevents confusion and saves a click.

**Why this priority**: A convenience improvement — the app works without this redirect, but it avoids a confusing dead-end for already-authenticated users.

**Independent Test**: Can be tested by signing in, then navigating to the root URL, and verifying automatic redirection to /dashboard.

**Acceptance Scenarios**:

1. **Given** the user is signed in, **When** they navigate to the root URL (/), **Then** they are automatically redirected to /dashboard.

---

### Edge Cases

- What happens when the user closes the Google consent popup without completing sign-in? The app remains on the landing page with no error message — the user can try again.
- What happens when the network fails during sign-in (after consent but before fetching user info)? The sign-in fails and an inline banner below the sign-in button explains the network error; the user remains on the landing page and can retry.
- What happens when the Google OAuth configuration is missing (no client ID)? The landing page displays an inline banner indicating the configuration is missing, rather than silently failing.
- What happens when the user refreshes the page after signing in? Since credentials are stored in memory only (not persisted), the user is signed out and returned to the landing page. This is expected behavior for this phase.
- What happens when the user navigates directly to a protected route while the sign-in process is in progress (loading state)? A loading indicator is shown until the authentication state resolves.
- What happens when the user grants only some of the requested OAuth scopes (e.g., approves email/profile but denies Calendar)? The app treats this as a sign-in failure and displays an inline banner below the sign-in button stating that all requested permissions are required for NoDues to function. The user remains on the landing page and can retry.
- What happens when the browser blocks the Google consent popup? The app displays an inline banner below the sign-in button asking the user to allow popups for this site and retry.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a "Sign in with Google" action on the landing page that initiates a Google OAuth 2.0 consent flow.
- **FR-002**: System MUST request the following permission scopes during sign-in: access to Drive files, Sheets, Calendar, plus basic identity (openid, email, profile).
- **FR-003**: System MUST store the access credential in application memory only — never in browser persistent storage.
- **FR-004**: System MUST retrieve and display the signed-in user's name, email address, and profile picture after successful sign-in.
- **FR-005**: System MUST provide a shared authentication state that any part of the application can read to determine the current user's identity, access credential, and sign-in status.
- **FR-006**: System MUST redirect unauthenticated users to the landing page when they attempt to access any protected page (dashboard, bills, to-dos, settings).
- **FR-007**: System MUST redirect already-signed-in users from the landing page to the dashboard.
- **FR-008**: System MUST display the user's profile picture and name in the navigation bar on all authenticated pages.
- **FR-009**: System MUST provide a "Sign out" action in the navigation bar that clears the user's identity and access credentials from memory and redirects to the landing page.
- **FR-010**: System MUST handle sign-in failures gracefully — cancelled consent popups, blocked popups, network errors, and missing configuration — by displaying an inline banner below the sign-in button that persists until the user dismisses it or retries sign-in. The app MUST NOT crash or show a blank screen.
- **FR-015**: System MUST detect when the browser blocks the consent popup and display an inline banner instructing the user to allow popups for the site and retry.
- **FR-011**: System MUST show a loading indicator on protected pages while the authentication state is being resolved.
- **FR-012**: System MUST display a temporary verification message on the dashboard showing "Welcome, {name}" and "Signed in as {email}" to confirm the auth flow is working.
- **FR-013**: System MUST display an inline banner on the landing page with a descriptive error message if the Google OAuth client identifier is not configured.
- **FR-014**: System MUST verify that ALL requested OAuth scopes are granted after sign-in. If any required scope (drive.file, spreadsheets, calendar) is denied, the system MUST treat sign-in as failed, clear any partial state, and display an inline banner below the sign-in button explaining that all permissions are required.

### Key Entities

- **User**: Represents the currently signed-in person. Attributes: email address, display name, profile picture URL. Null when no one is signed in.
- **Access Credential**: The OAuth token granting permission to Google APIs. Exists only while the user is signed in and only in application memory. Null when signed out.
- **Authentication State**: The combination of user identity, access credential, sign-in/sign-out actions, and loading status. Shared across the entire application.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete the full sign-in flow (click button → consent → dashboard with name displayed) in under 30 seconds on a standard broadband connection.
- **SC-002**: 100% of attempts to access a protected page while signed out result in a redirect to the landing page (no unprotected route leaks).
- **SC-003**: After signing out, zero pieces of user identity or access credentials remain in application memory.
- **SC-004**: The sign-in flow succeeds on the first attempt for users who grant all requested permissions, with no additional clicks or retries needed.
- **SC-005**: The app starts without errors when the OAuth client identifier is correctly configured, and fails with a human-readable error when it is missing.
- **SC-006**: All interactive elements (sign-in button, navigation bar user display, sign-out button) MUST meet WCAG 2.1 AA compliance: keyboard navigable, screen reader labeled, focus-managed, 4.5:1 minimum color contrast ratio, and usable on mobile screens (375px width) with touch targets minimum 44x44px.
- **SC-007**: Users who deny any required OAuth scope during consent are returned to the landing page with a clear error message, never reaching any authenticated page.

## Assumptions

- The Google Cloud project is already configured with the correct OAuth client ID, authorized JavaScript origins, and API scopes enabled. This feature does not set up Google Cloud infrastructure.
- Users have a stable internet connection during sign-in. Offline sign-in is not supported.
- Only one user is signed in at a time per browser tab. Multi-account support within a single session is not needed.
- Page refresh or tab close will sign the user out (credentials are memory-only). Persistent sessions are a future enhancement.
- Token refresh logic is out of scope. When the access token expires (after ~1 hour), the user will need to sign in again. Automatic refresh will be added in a later phase.
- Family member email validation (checking against an allowlist in the Config sheet) is out of scope. Any Google account can sign in for now. The allowlist check will be added once the Sheets integration is built.
- No Google API calls (Drive, Sheets, Calendar) are made in this feature. The scopes are requested during consent so they are available when those features are implemented later.
- The design system defined in MASTER.md is the visual source of truth. All UI elements follow its color palette, typography, icon set, and accessibility rules.
