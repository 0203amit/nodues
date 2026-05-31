# Feature Specification: Daily Push Notifications for Overdue Items

**Feature Branch**: `011-daily-push-notifications`

**Created**: 2026-05-31

**Status**: Draft

**Input**: User description: "Daily push notifications for overdue items — Phase 11 of the NoDues Build Order. Introduces server-side code (Vercel cron function) and extends the existing PWA service worker to receive and display push notifications summarizing overdue bills and todos."

## Clarifications

### CL-001: Cron Mechanism — GitHub Actions instead of Vercel Cron

**Original spec assumed Vercel cron**. We discovered Vercel's Hobby tier
restricts cron jobs to once-per-day frequency (verified at
vercel.com/docs/cron-jobs/usage-and-pricing). Our architecture requires
hourly cron so the function can match against any user-configured
delivery_hour (e.g., a user choosing 14:00 IST delivery time).

**Switching to GitHub Actions cron** for these reasons:
- Free for private repos (2,000 minutes/month, our cron run is ~5
  seconds — effectively unlimited).
- Supports hourly cadence: `cron: "0 * * * *"` is allowed.
- The Vercel serverless function (api/notify.ts) is unchanged in
  responsibility. Only the scheduler changes.

**Trade-off / caveat**: GitHub Actions scheduled workflows can be delayed
under high load (up to 15-30 minutes in rare cases). This is similar to
Vercel cron's "anywhere within the hour" behavior. Acceptable for a
"morning summary at ~8 AM" use case.

**Additional caveat**: GitHub auto-disables scheduled workflows in repos
with no activity for 60 days. NoDues will have regular commits as we use
it, so this is a non-issue. If activity ever stops for 60+ days, any
commit re-activates the workflow.

#### Architecture

GitHub Actions (cron schedule) → HTTP POST request → Vercel /api/notify
→ reads Sheet via Service Account → sends pushes via web-push

#### Files affected by this clarification

1. NEW: `.github/workflows/notify.yml` — GitHub Actions workflow that runs
   hourly (`cron: "0 * * * *"`) and makes a POST to the Vercel notify
   endpoint.
2. REMOVED: any reference to vercel.json cron config (Vercel cron is NOT
   used).
3. NEW shared secret: `CRON_SECRET` — stored in both GitHub Actions
   repository secrets AND Vercel environment variables. The Vercel
   function (api/notify.ts) verifies the request header `Authorization:
   Bearer ${CRON_SECRET}` and rejects unauthorized requests with 401.
   This prevents anyone with the public URL from spamming the endpoint.

#### Setup steps added to the manual one-time setup section

Insert the following after the existing "Generate VAPID keys" step in
the One-Time Setup section:

- Generate a random secret for cron auth: any string ~32+ chars, e.g.
  `openssl rand -hex 32` or just type a long password.
- Add the secret to Vercel env vars as `CRON_SECRET`.
- Add the same secret to GitHub repo Settings → Secrets and variables
  → Actions → New repository secret. Name: `CRON_SECRET`.
- Add the Vercel deployment URL as a GitHub Actions variable. Name:
  `VERCEL_NOTIFY_URL`. Value: the full URL like
  `https://nodues-virid.vercel.app/api/notify`.
- Add `.github/workflows/notify.yml` to the repo (see template below).

#### GitHub Actions workflow template

The workflow file (.github/workflows/notify.yml) will look like:

```yaml
name: Daily Push Notification Cron
on:
  schedule:
    # Runs hourly at minute 0 (UTC). Approximate 60-min window for
    # matching user delivery times.
    - cron: '0 * * * *'
  workflow_dispatch:  # Allows manual triggering for testing

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Call NoDues notify endpoint
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json" \
            -f \
            ${{ vars.VERCEL_NOTIFY_URL }}
```

The `workflow_dispatch` trigger lets us manually fire the cron from
GitHub UI for testing — useful during development.

#### Environment variables (full updated list)

| Variable                    | Scope          | Description                                |
|-----------------------------|----------------|--------------------------------------------|
| VAPID_PUBLIC_KEY            | Vercel server  | VAPID public key                           |
| VITE_VAPID_PUBLIC_KEY       | Vercel client  | Same VAPID public key (Vite bundles it)    |
| VAPID_PRIVATE_KEY           | Vercel server  | VAPID private key                          |
| VAPID_SUBJECT               | Vercel server  | Contact URI (mailto:...)                   |
| GOOGLE_SERVICE_ACCOUNT_JSON | Vercel server  | Service account credentials JSON           |
| NODUES_SHEET_ID             | Vercel server  | Hardcoded sheet ID for v1                  |
| **CRON_SECRET**             | **Vercel + GH**| **Shared secret for cron auth (NEW)**      |
| **VERCEL_NOTIFY_URL**       | **GH variable**| **Vercel endpoint URL (NEW)**              |

#### What does NOT change in the rest of the spec

- The api/notify.ts function logic (Service Account auth, idempotency,
  410 Gone handling, body construction, etc.) is unchanged.
- The PushSubscriptions schema is unchanged.
- The client-side subscription flow is unchanged.
- The service worker upgrade is unchanged.
- All other Design Decisions (DD-2 through DD-7) remain valid.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enable Push Notifications (Priority: P1)

A user navigates to Settings > Notifications and enables push notifications by toggling "Enable push notifications" ON. The system requests browser notification permission, subscribes to Web Push, and stores the subscription in their Google Sheet.

**Why this priority**: This is the core enablement flow without which no notifications can be delivered. It gates all other functionality.

**Independent Test**: Can be fully tested by toggling the switch ON and verifying a PushSubscriptions row is written to the Sheet. Delivers value by confirming the subscription pipeline works end-to-end.

**Acceptance Scenarios**:

1. **Given** the user is on /settings/notifications and notifications are currently disabled, **When** they toggle "Enable push notifications" ON, **Then** the browser requests notification permission (if not already granted), subscribes to Web Push using the VAPID public key, writes subscription details to the PushSubscriptions sheet tab, logs a 'push_enabled' activity, and the toggle shows ON with a "Subscribed" status indicator.
2. **Given** the user has previously denied notification permission at the browser level, **When** they toggle "Enable push notifications" ON, **Then** the system displays a message explaining that notifications are blocked and instructions to unblock in browser settings, and the toggle reverts to OFF.
3. **Given** the user has already granted permission and has an active subscription, **When** they visit /settings/notifications, **Then** the toggle shows ON, the status shows "Subscribed", and the last notification time is displayed.

---

### User Story 2 - Receive Daily Overdue Summary Push (Priority: P1)

The system automatically sends a push notification at the user's configured delivery time each day, summarizing overdue bills and todos. The notification appears on their phone/desktop even when the app is closed.

**Why this priority**: This is the core value proposition — proactive daily reminders about overdue items without the user needing to open the app.

**Independent Test**: Can be tested by configuring a delivery time, waiting for the cron to fire (or triggering it manually), and verifying the push notification arrives with correct content on the device.

**Acceptance Scenarios**:

1. **Given** the user has an active subscription with delivery_hour=8 (IST) and there are 2 overdue bills and 1 overdue todo, **When** the hourly cron runs at 08:00 IST (02:30 UTC), **Then** a push notification is sent with title "NoDues" and body "3 overdue: Maintenance — Mira Flat, Property Tax — Mira Shop, Renew insurance".
2. **Given** the user has an active subscription and there are 5 overdue items, **When** the cron fires at their delivery time, **Then** the notification body shows "5 overdue: <item1>, <item2>, <item3>... and 2 more".
3. **Given** the user has an active subscription and there are 0 overdue items, **When** the cron fires at their delivery time, **Then** no push notification is sent (no "all clear" message).
4. **Given** a push was already sent within the past 23 hours (idempotency check), **When** the cron runs again within that window, **Then** no duplicate push is sent.

---

### User Story 3 - Configure Delivery Time (Priority: P2)

The user selects what time of day they want to receive the overdue summary notification, using a time picker on the Notifications settings page.

**Why this priority**: Personalization of delivery time increases engagement (user wants it before their morning routine, not at midnight). But the feature works with a sensible default (08:00 IST) even without this.

**Independent Test**: Can be tested by changing the delivery time from 08:00 to 20:00, verifying the PushSubscriptions row updates, and confirming the next push arrives at 20:00 IST instead.

**Acceptance Scenarios**:

1. **Given** the user is on /settings/notifications with notifications enabled, **When** they change the delivery time from 08:00 to 20:00, **Then** the PushSubscriptions row updates delivery_hour to 20 and delivery_minute to 0, and the next push arrives at 20:00 IST.
2. **Given** the user has not changed the default, **When** they enable notifications for the first time, **Then** delivery time defaults to 08:00 IST.

---

### User Story 4 - Disable Push Notifications (Priority: P2)

The user toggles "Enable push notifications" OFF, immediately stopping all future push notifications.

**Why this priority**: Users must have a clear, accessible way to opt-out. Required for user trust and potentially for app store/PWA compliance.

**Independent Test**: Can be tested by toggling OFF, verifying browser unsubscription occurs, the Sheet row is soft-deleted, and no further pushes arrive.

**Acceptance Scenarios**:

1. **Given** the user has notifications enabled, **When** they toggle OFF, **Then** the browser push subscription is unsubscribed, the PushSubscriptions row is soft-deleted (deleted_at is set), a 'push_disabled' activity is logged, and the status indicator shows "Not subscribed".
2. **Given** the user has disabled notifications, **When** the cron fires at their former delivery time, **Then** no push is sent (row has deleted_at set).

---

### User Story 5 - Test Notification (Priority: P3)

The user taps "Test notification" on the settings page to immediately receive a sample notification, verifying their setup works without waiting for the next scheduled delivery.

**Why this priority**: Reduces support friction. Users want instant feedback that their setup works. Lower priority because it's a convenience/debugging feature, not core delivery.

**Independent Test**: Can be tested by tapping "Test notification" and verifying a local notification appears within seconds on the device.

**Acceptance Scenarios**:

1. **Given** the user has notifications enabled and permission granted, **When** they tap "Test notification", **Then** a notification appears immediately with title "NoDues" and body "Test notification — push is working!".
2. **Given** notifications are disabled (toggle OFF), **When** the "Test notification" button state is checked, **Then** the button is disabled/hidden.

---

### User Story 6 - Tap Notification to Open Dashboard (Priority: P3)

When the user taps a received notification, it opens (or focuses) the NoDues app on the Dashboard page.

**Why this priority**: Natural UX expectation. Tapping a notification should take you to where you can act on it. Low effort to implement within the service worker.

**Independent Test**: Can be tested by receiving a push notification, tapping it, and verifying the app opens to /dashboard (or an existing tab is focused).

**Acceptance Scenarios**:

1. **Given** a push notification is displayed and the app is not open, **When** the user taps the notification, **Then** the app opens in a new tab/window at the root URL (which redirects to /dashboard for authenticated users).
2. **Given** a push notification is displayed and the app is already open in a tab, **When** the user taps the notification, **Then** the existing tab is focused.

---

### User Story 7 - Handle Invalid Subscriptions (Priority: P3)

When a user reinstalls the app, changes phones, or the browser revokes the push subscription, the server detects the invalid endpoint and automatically cleans it up.

**Why this priority**: Required for long-term hygiene. Without this, the cron would repeatedly fail on stale endpoints, wasting resources and obscuring logs.

**Independent Test**: Can be tested by manually invalidating a subscription endpoint (deleting it from the push service), triggering the cron, and verifying the row is soft-deleted with a 410 response.

**Acceptance Scenarios**:

1. **Given** a subscription endpoint has become invalid (returns 410 Gone), **When** the cron attempts to send a push, **Then** the cron soft-deletes that subscription row (sets deleted_at) and does not retry it in future runs.
2. **Given** the push service returns a transient error (5xx), **When** the cron attempts to send, **Then** the error is logged but the subscription is NOT deleted (will retry next cycle).

---

### Edge Cases

- What happens when the user enables notifications on a second device? A new subscription row is created. Both devices receive the daily push independently.
- What happens if the cron function times out before processing all subscriptions? The function returns a partial summary; unprocessed subscriptions get pushed on the next hourly run (idempotency check uses last_pushed_at per subscription).
- What happens if the PushSubscriptions tab doesn't exist yet? The bootstrap flow creates it when the user first visits the Notifications page. The cron skips sheets where the tab doesn't exist.
- What happens when the Google Service Account token expires mid-cron? The googleapis library handles automatic token refresh for service accounts. If refresh fails, the function logs the error and returns a 500 summary.
- What happens if the user's browser does not support Web Push (e.g., some in-app browsers)? The Notifications page detects missing `PushManager` API support and shows a message: "Push notifications are not supported in this browser. Try opening NoDues in Chrome or Safari."

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a Notifications settings page at /settings/notifications accessible from the Settings hub.
- **FR-002**: System MUST display a toggle to enable/disable push notifications, a time picker for delivery time (HH:MM format, default 08:00), and a status indicator showing subscription state and last push timestamp.
- **FR-003**: System MUST request browser notification permission ONLY when the user explicitly toggles "Enable" ON (never aggressively on page load or sign-in).
- **FR-004**: System MUST subscribe to Web Push using the VAPID public key (from VITE_VAPID_PUBLIC_KEY environment variable) when the user enables notifications and permission is granted.
- **FR-005**: System MUST write subscription details (endpoint, p256dh_key, auth_key, delivery_hour, delivery_minute, timezone, enabled, created_at) to a PushSubscriptions tab in the user's Google Sheet.
- **FR-006**: System MUST unsubscribe from Web Push and soft-delete the subscription row (set deleted_at) when the user disables notifications.
- **FR-007**: System MUST provide a "Test notification" button that triggers an immediate local notification to verify the subscription works.
- **FR-008**: System MUST display contextual guidance when permission is denied at the browser level, explaining how to unblock notifications in browser settings.
- **FR-009**: The service worker MUST listen for 'push' events, parse the JSON payload (title, body), and display the notification using showNotification with appropriate icon and badge.
- **FR-010**: The service worker MUST listen for 'notificationclick' events and open/focus the NoDues Dashboard (root URL).
- **FR-011**: The service worker upgrade MUST preserve existing install/activate/fetch handlers so PWA installability is not broken for users who decline notifications.
- **FR-012**: System MUST provide a Vercel serverless function (api/notify.ts) that runs on an hourly cron schedule.
- **FR-013**: The cron function MUST authenticate as a Google Service Account using credentials from the GOOGLE_SERVICE_ACCOUNT_JSON environment variable.
- **FR-014**: The cron function MUST read the PushSubscriptions tab for each configured sheet, filter active subscriptions where the current IST hour matches the subscription's delivery_hour.
- **FR-015**: The cron function MUST read Bills and Todos, compute display status, and filter to overdue items only.
- **FR-016**: The cron function MUST build a notification body: "N overdue: <item1>, <item2>, <item3>" capped at 3 item descriptions, appending "... and N more" when there are more than 3.
- **FR-017**: The cron function MUST NOT send a notification when there are zero overdue items (no "all clear" push).
- **FR-018**: The cron function MUST implement idempotency by skipping subscriptions where last_pushed_at is within the past 23 hours.
- **FR-019**: The cron function MUST handle 410 Gone responses by soft-deleting the corresponding subscription row.
- **FR-020**: The cron function MUST update last_pushed_at on successful push delivery.
- **FR-021**: The cron function MUST return a 200 response with a summary object: { subscriptionsChecked, pushesSent, pushesSkipped, errors }.
- **FR-022**: The bootstrap flow MUST create the PushSubscriptions tab (idempotent — skip if exists) when the Notifications page is first visited.
- **FR-023**: System MUST log 'push_enabled' and 'push_disabled' actions to the ActivityLog when the user enables or disables notifications.
- **FR-024**: Notification item descriptions MUST use the format: Bills as "{billTypeName} — {propertyName}", Todos as "{title}".
- **FR-025**: The cron function MUST use a 60-minute match window: send when the current IST hour equals the subscription's delivery_hour (minute precision is approximate since cron runs hourly).

### Key Entities *(include if feature involves data)*

- **PushSubscription**: Represents a browser push subscription linked to a user's sheet. Contains the push endpoint URL, cryptographic keys (p256dh, auth), preferred delivery time, subscription lifecycle timestamps, and enabled/soft-delete state. One user may have multiple subscriptions (multiple devices).
- **Notification Payload**: The JSON sent via Web Push to the service worker. Contains title ("NoDues") and body (the overdue summary string).
- **Cron Summary**: The response object from the serverless function reporting what happened during execution (subscriptions checked, pushes sent/skipped, errors encountered).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users who enable notifications receive a daily overdue summary at their configured time, every day that they have overdue items, with no action required on their part.
- **SC-002**: Notifications arrive within 60 minutes of the user's configured delivery time (bounded by hourly cron granularity).
- **SC-003**: Users can enable and configure notifications in under 30 seconds (toggle + optional time change).
- **SC-004**: Zero duplicate notifications are sent within a 23-hour window per subscription (idempotency guarantee).
- **SC-005**: Invalid subscriptions (410 Gone) are automatically cleaned up, preventing recurring errors in subsequent cron runs.
- **SC-006**: The notification permission prompt appears only when the user explicitly opts in (never unsolicited), preserving user trust and avoiding browser permission fatigue.
- **SC-007**: Users who disable notifications stop receiving pushes immediately (next cron cycle respects the disabled state).
- **SC-008**: The "Test notification" feature confirms a working subscription within 5 seconds of tapping the button.

## Assumptions

- The user has a modern browser that supports the Push API and Service Workers (Chrome Android, Safari 16.4+ iOS, desktop Chrome/Firefox/Edge). Unsupported browsers will see a graceful degradation message.
- ~~The app is deployed on Vercel's Hobby tier, which supports cron jobs. Hourly cron (once per hour, 24 per day) is within Hobby tier limits for cron invocations.~~ **Superseded by CL-001: switched from Vercel cron to GitHub Actions cron.**
- The user's Google Sheet is shared with the Google Service Account (one-time manual setup step). Without this, the cron cannot read sheet data.
- IST (UTC+5:30) is the only timezone for v1. The schema includes a timezone column for future multi-timezone support, but the cron logic hardcodes IST offset computation.
- This is a single-user app in v1. The cron processes one hardcoded sheet ID (from NODUES_SHEET_ID env var). The schema supports multiple users but the cron iterates only one sheet initially.
- VAPID keys are generated once and stored in Vercel environment variables. They do not rotate.
- The service worker does not have access to the user's OAuth access token. All sheet reads/writes for subscription management happen from the client-side page (using the user's token). The server-side cron uses a separate Service Account credential.
- The existing minimal service worker (install/activate/fetch pass-through) must remain intact — push handlers are additive.
- Activity log entries for push_enabled/push_disabled use 'user' as the user_email (consistent with existing activity logging in the app).
- Vercel serverless functions have a 10-second execution limit on Hobby tier. For a single user with a few subscriptions, this is more than adequate.

## One-Time Setup (Manual Steps)

The following steps must be performed once by the app owner before the cron function will work:

1. Create a Google Cloud Service Account in the NoDues project (Console > IAM > Service Accounts > Create).
2. Grant it the following API scopes: Google Sheets API (read/write), Google Drive API (read-only, to list files shared with it).
3. Download the JSON key file.
4. Share the NoDues Google Sheet with the service account's email address (Editor access, so it can update last_pushed_at).
5. Generate VAPID keys locally: `npx web-push generate-vapid-keys`.
6. Add all environment variables to Vercel: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, GOOGLE_SERVICE_ACCOUNT_JSON, NODUES_SHEET_ID.
7. Also add VITE_VAPID_PUBLIC_KEY (same value as VAPID_PUBLIC_KEY) so Vite exposes it to the client bundle.

## Key Design Decisions

1. **Cron schedule + 60-minute match window**: The cron runs every hour at the top of the hour (UTC). It matches subscriptions where current_IST_hour === delivery_hour. Pushes may arrive up to 59 minutes after the configured minute. This is an acceptable tradeoff for Hobby-tier cron simplicity.
2. **Idempotency via last_pushed_at**: If last_pushed_at is within the past 23 hours, the subscription is skipped. This prevents double-sends if cron fires twice and also means missed pushes stay missed (no catchup delivery).
3. **410 Gone auto-cleanup**: When the push service returns 410, the subscription is permanently invalid (user uninstalled, revoked, or switched devices). The cron soft-deletes the row to prevent retrying forever.
4. **Permission prompt timing**: The system NEVER prompts for notification permission unsolicited. Permission is requested only when the user explicitly toggles "Enable" on the Notifications settings page. This respects user autonomy and avoids the aggressive permission prompt anti-pattern.
5. **Service worker additive upgrade**: Push and notificationclick handlers are added to the existing sw.js without removing the install/activate/fetch handlers. Users who decline notifications still get PWA installability.
6. **No "all clear" push**: When there are zero overdue items, no notification is sent. Notifications are for actionable information only — reducing notification fatigue.
7. **Notification tag for deduplication**: The service worker uses tag: 'nodues-daily-overdue' so that if a second notification arrives before the user dismisses the first, it replaces rather than stacks.

## Out of Scope

- Multiple notification times per day
- Per-property or per-category filtering of notifications
- Notifications for non-overdue states ("due tomorrow", "due this week")
- "Quiet days" (skip weekends or specific days)
- Push notifications triggered by actions (bill_added, todo_added) — only daily overdue summary
- iOS-specific push optimizations (the feature works if the browser supports Web Push, but no iOS-specific testing or workarounds)
- Multi-user cron management (iterating multiple sheet IDs) — schema supports it, cron handles one hardcoded sheet
- Custom notification icons per entity type (bills vs todos)
- Notification history/log visible in the app
- Rich notification actions (action buttons in the notification itself)

## New Sheet Tab Schema: PushSubscriptions

| Column          | Type                    | Description                                              |
| --------------- | ----------------------- | -------------------------------------------------------- |
| id              | UUID                    | Unique row identifier                                    |
| user_email      | string                  | Who the subscription belongs to (hardcoded 'user' in v1) |
| endpoint        | URL (string)            | Push service endpoint URL (~200 chars)                   |
| p256dh_key      | base64 string           | Public encryption key from PushSubscription              |
| auth_key        | base64 string           | Auth secret from PushSubscription                        |
| delivery_hour   | integer (0-23)          | Hour to send push (in user's local timezone, IST)        |
| delivery_minute | integer (0-59)          | Minute (default 0; approximate due to hourly cron)       |
| timezone        | string                  | IANA timezone ("Asia/Kolkata" hardcoded for v1)          |
| enabled         | TRUE/FALSE              | Whether subscription is active                           |
| created_at      | ISO 8601 timestamp      | When the subscription was created                        |
| last_pushed_at  | ISO 8601 timestamp or "" | Last successful push time (for idempotency)             |
| deleted_at      | ISO 8601 timestamp or "" | Soft-delete marker                                      |

## Environment Variables

| Variable                    | Scope       | Description                                             |
| --------------------------- | ----------- | ------------------------------------------------------- |
| VAPID_PUBLIC_KEY            | Server      | VAPID public key for Web Push signing                   |
| VITE_VAPID_PUBLIC_KEY       | Client      | Same VAPID public key, exposed to Vite client bundle    |
| VAPID_PRIVATE_KEY           | Server only | VAPID private key (never exposed to client)             |
| VAPID_SUBJECT               | Server only | Contact URI (mailto: or https://) for VAPID             |
| GOOGLE_SERVICE_ACCOUNT_JSON | Server only | Full service account credentials JSON (stringified)     |
| NODUES_SHEET_ID             | Server only | The spreadsheet ID for the single-user v1 sheet         |
