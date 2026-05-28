# Tasks: Google Sign-In

**Input**: Design documents from `/specs/001-google-sign-in/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/auth-context.ts

**Tests**: Not requested — manual testing via acceptance scenarios per quickstart.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Install new dependency and configure environment variable documentation

- [ ] T001 Install `@react-oauth/google` dependency via `npm install @react-oauth/google`
- [ ] T002 [P] Create `.env.example` at project root with `VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com` placeholder

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core authentication infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Create `src/contexts/AuthContext.tsx` with User/AuthState/AuthAction types, useReducer (SIGN_IN_START, SIGN_IN_SUCCESS, SIGN_IN_ERROR, SIGN_OUT, CLEAR_ERROR actions), AuthProvider component, useAuth hook, signIn (useGoogleLogin with scopes, hasGrantedAllScopesGoogle verification, userinfo fetch), signOut (googleLogout + state reset), and clearError — conforming to contracts/auth-context.ts interface
- [ ] T004 [P] Create `src/components/auth/ErrorBanner.tsx` with inline dismissible error banner component per ErrorBannerProps contract (message, dismissible flag, onDismiss callback, WCAG 2.1 AA: 4.5:1 contrast, keyboard dismiss, screen reader role="alert")
- [ ] T005 Update `src/main.tsx` to wrap the app with `GoogleOAuthProvider` (clientId from `import.meta.env.VITE_GOOGLE_CLIENT_ID`) and `AuthProvider` per component architecture in plan.md

**Checkpoint**: Foundation ready — AuthContext provides auth state, ErrorBanner handles errors, providers wrap the app. User story implementation can now begin.

---

## Phase 3: User Story 1 — Sign In with Google (Priority: P1) 🎯 MVP

**Goal**: A user can click "Sign in with Google" on the landing page, complete the Google consent flow, and land on the dashboard which greets them by name and email.

**Independent Test**: Click "Sign in with Google" on the landing page, complete consent, verify dashboard displays "Welcome, {name}" and "Signed in as {email}".

### Implementation for User Story 1

- [ ] T006 [US1] Update `src/pages/LandingPage.tsx` to integrate sign-in: use useAuth to call signIn on button click, display ErrorBanner for auth errors (missing client ID, blocked popup, denied scopes, network error, generic OAuth error), and handle silent popup_closed per spec edge cases
- [ ] T007 [US1] Update `src/App.tsx` to replace hardcoded `isAuthenticated` with `useAuth` hook and implement "/" route conditional rendering (`isAuthenticated ? <Navigate to="/dashboard" /> : <LandingPage />`)
- [ ] T008 [P] [US1] Update `src/pages/DashboardPage.tsx` to display "Welcome, {name}" and "Signed in as {email}" using user data from useAuth hook

**Checkpoint**: User Story 1 is fully functional — users can sign in with Google and see their identity on the dashboard.

---

## Phase 4: User Story 2 — Route Protection (Priority: P1)

**Goal**: Unauthenticated users attempting to access any protected page (/dashboard, /bills, /todos, /settings) are redirected to the landing page. A loading spinner displays while auth state resolves.

**Independent Test**: While signed out, navigate directly to /dashboard, /bills, /todos, /settings — each should redirect to the landing page.

### Implementation for User Story 2

- [ ] T009 [US2] Create `src/components/auth/ProtectedRoute.tsx` — if `isLoading` show loading spinner, if `!isAuthenticated` render `<Navigate to="/" replace />`, otherwise render children (per ProtectedRouteProps contract)
- [ ] T010 [US2] Update `src/App.tsx` to wrap `/dashboard`, `/bills`, `/todos`, `/settings` routes with `<ProtectedRoute>` component

**Checkpoint**: User Stories 1 AND 2 are both functional — sign-in works and protected routes redirect unauthenticated users.

---

## Phase 5: User Story 3 — Signed-In User Identity in Navigation (Priority: P2)

**Goal**: The navigation bar displays the signed-in user's profile picture and name on every authenticated page, providing visual account confirmation.

**Independent Test**: Sign in and verify the navbar shows the user's Google profile picture and name on any authenticated page. On mobile (375px), expand the navbar and verify picture, name, and email are visible.

### Implementation for User Story 3

- [ ] T011 [US3] Update `src/components/shared/Navbar.tsx` to display user avatar (32x32 rounded-full `<img>` with initials fallback for missing picture) and display name in desktop view using useAuth, and show avatar, name, and email in the mobile expanded collapsible menu

**Checkpoint**: User Stories 1, 2, AND 3 are functional — sign-in works, routes are protected, and the navbar displays user identity.

---

## Phase 6: User Story 4 — Sign Out (Priority: P2)

**Goal**: A signed-in user can click "Sign out" in the navigation bar to clear credentials from memory and return to the landing page.

**Independent Test**: Sign in, click "Sign out" in the navbar, verify redirect to landing page with no residual identity. Attempt to navigate to /dashboard — should redirect to landing page.

### Implementation for User Story 4

- [ ] T012 [US4] Add sign-out button to `src/components/shared/Navbar.tsx` — desktop: ghost-style text button aligned right; mobile: button in expanded menu below user identity — calling `signOut()` from useAuth, with 44x44px minimum touch target on mobile

**Checkpoint**: User Stories 1–4 are functional — full sign-in/sign-out cycle works with identity display and route protection.

---

## Phase 7: User Story 5 — Landing Page Redirect for Signed-In Users (Priority: P3)

**Goal**: Already-authenticated users navigating to the root URL are automatically redirected to /dashboard instead of seeing the sign-in button.

**Independent Test**: Sign in, navigate to `/` — should auto-redirect to /dashboard.

### Implementation for User Story 5

- [ ] T013 [US5] Verify "/" route logic in `src/App.tsx` correctly redirects authenticated users to /dashboard via `<Navigate to="/dashboard" />` — ensure no flash of landing page content before redirect

**Checkpoint**: All user stories (1–5) are independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility, responsiveness, and final validation across all user stories

- [ ] T014 [P] Verify WCAG 2.1 AA compliance across all new/modified components: keyboard navigation (sign-in button, sign-out button, error banner dismiss), focus management after sign-in/sign-out transitions, screen reader labels (aria-label on buttons, role="alert" on error banners), and 4.5:1 minimum color contrast ratio
- [ ] T015 [P] Verify mobile responsiveness at 375px viewport width: collapsible navbar layout, 44x44px minimum touch targets on sign-in button, sign-out button, and error banner dismiss, landing page layout
- [ ] T016 Run full quickstart.md validation: sign-in flow, route protection, navbar identity, sign-out, landing page redirect, and all error scenarios (missing client ID, blocked popup, denied scopes, cancelled consent)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T001 must complete for @react-oauth/google imports) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 completion
- **US2 (Phase 4)**: Depends on Phase 2 completion; can proceed in parallel with US1 (but full testing requires US1 for sign-in)
- **US3 (Phase 5)**: Depends on Phase 2 completion; benefits from US1 for testing (need signed-in user)
- **US4 (Phase 6)**: Depends on Phase 2 completion and US3 (same file: Navbar.tsx — identity display should be in place before adding sign-out)
- **US5 (Phase 7)**: Depends on US1 (redirect logic is in same file and route structure)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependencies on other stories
- **US2 (P1)**: Can start after Phase 2 — independent implementation, full testing benefits from US1
- **US3 (P2)**: Can start after Phase 2 — requires signed-in user for testing (US1)
- **US4 (P2)**: Depends on US3 (same file Navbar.tsx — add sign-out after identity display)
- **US5 (P3)**: Depends on US1 (redirect logic in App.tsx; verification requires sign-in)

### Within Each User Story

- Models/types before services/logic
- Core implementation before UI integration
- Error handling included in each implementation task
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1**: T001 and T002 are independent (T002 can run in parallel)
- **Phase 2**: T003 and T004 target different files (T004 is parallelizable)
- **Phase 3**: T008 (DashboardPage) is parallelizable — different file from T006/T007
- **Phase 8**: T014 and T015 are independent audits (both parallelizable)
- **Cross-story**: US1 and US2 can be implemented in parallel after Phase 2 (different files)

---

## Parallel Example: User Story 1

```bash
# After Phase 2 completes, launch in parallel:
Task: T006 "Update LandingPage.tsx with sign-in integration"
Task: T008 "Update DashboardPage.tsx with welcome message"

# Then sequentially (depends on T006):
Task: T007 "Update App.tsx with useAuth and route logic"
```

## Parallel Example: Phase 2 Foundational

```bash
# Launch in parallel (different files):
Task: T003 "Create AuthContext.tsx"
Task: T004 "Create ErrorBanner.tsx"

# Then sequentially (depends on T003):
Task: T005 "Update main.tsx with providers"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (install dependency, create .env.example)
2. Complete Phase 2: Foundational (AuthContext, ErrorBanner, providers)
3. Complete Phase 3: User Story 1 (sign-in flow, landing page, dashboard welcome)
4. **STOP and VALIDATE**: Test sign-in → consent → dashboard with name/email
5. Deploy/demo if ready — users can sign in and see their identity

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Add US1 → Test sign-in independently → **MVP!**
3. Add US2 → Test route protection → Protected app
4. Add US3 + US4 → Test identity display + sign-out → Full auth cycle
5. Add US5 → Test landing redirect → Polished experience
6. Phase 8 → Accessibility + responsiveness audit → Production ready

### Recommended Execution Order (Single Developer)

1. T001 → T002 (parallel) → **Setup done**
2. T003 + T004 (parallel) → T005 → **Foundation done**
3. T006 + T008 (parallel) → T007 → **US1 done (MVP)**
4. T009 → T010 → **US2 done**
5. T011 → T012 → **US3 + US4 done**
6. T013 → **US5 done**
7. T014 + T015 (parallel) → T016 → **Polish done**

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- No test tasks included — spec uses manual testing via quickstart.md acceptance scenarios
- All auth state is memory-only (no localStorage/sessionStorage/cookies per FR-003)
- Token refresh is out of scope per spec assumptions
- MASTER.md design system is the visual source of truth for all UI components
