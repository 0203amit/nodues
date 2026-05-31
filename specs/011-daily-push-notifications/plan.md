# Implementation Plan: Daily Push Notifications

**Branch**: `011-daily-push-notifications` | **Date**: 2026-05-31 | **Spec**: `specs/011-daily-push-notifications/spec.md`

**Input**: Feature specification from `specs/011-daily-push-notifications/spec.md`

## Summary

Add daily push notifications for overdue bills and todos. Client-side: new Notifications settings page with enable/disable toggle, delivery time picker, test notification button; upgrade service worker with push + notificationclick handlers; new PushSubscriptions sheet tab via lazy bootstrap. Server-side: Vercel serverless function (api/notify.ts) that authenticates via Google Service Account, reads overdue items from the Sheet, and sends Web Push notifications using the web-push library. Scheduling via GitHub Actions hourly cron that POSTs to the Vercel endpoint with a shared CRON_SECRET.

## Technical Context

**Language/Version**: TypeScript 5.x (client: React 19 + Vite; server: Node.js Vercel serverless)

**Primary Dependencies**: React Router v6, Tailwind CSS v3, Lucide React (existing); web-push (new, server-side), google-auth-library (new, server-side)

**Storage**: Google Sheets via existing service layer (client-side, OAuth token) + Google Sheets via Service Account (server-side, google-auth-library)

**Testing**: Manual testing; `npm run build` for type checking; `curl` for serverless function verification

**Target Platform**: Web PWA (mobile-first, primary viewport 375px) + Vercel serverless function (Node.js)

**Project Type**: SPA with serverless API function (first server-side code in the project)

**Performance Goals**: Single user with few subscriptions; well within Vercel Hobby 10s function limit; push delivery within 60 minutes of configured time

**Constraints**: Vercel Hobby tier (10s function execution, 250MB bundle), GitHub Actions free tier (2000 min/month), single-user v1

**Scale/Scope**: 3 new files (client), 1 new file (server), 1 new file (CI), 7 modified files, ~25 functional requirements

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution is not configured (template only). No gates to evaluate. Proceeding.

## Project Structure

### Documentation (this feature)

```text
specs/011-daily-push-notifications/
├── plan.md              # This file
├── research.md          # Phase 0 output — 8 research decisions
├── data-model.md        # Phase 1 output — PushSubscription schema, new types
├── quickstart.md        # Phase 1 output — dev setup, implementation order, testing
└── spec.md              # Feature specification (25 FRs, 1 CL, 7 DDs)
```

### Source Code (repository root)

```text
src/
├── types/
│   └── index.ts                              # MODIFY — +PushSubscription, +ActionType extensions
├── config/
│   └── schema.ts                             # MODIFY — +PushSubscriptions tab/headers
├── services/
│   ├── sheetsService.ts                      # MODIFY — +addSheet helper
│   └── pushSubscriptionsService.ts           # NEW — CRUD for PushSubscriptions tab
├── utils/
│   └── activityLabels.ts                     # MODIFY — +push_enabled/disabled labels
├── pages/
│   ├── NotificationsPage.tsx                 # NEW — full notifications settings page
│   └── SettingsPage.tsx                      # MODIFY — enable Notifications card
└── App.tsx                                   # MODIFY — +/settings/notifications route

public/
└── sw.js                                     # MODIFY — +push, +notificationclick handlers

api/
└── notify.ts                                 # NEW — Vercel serverless function

.github/workflows/
└── notify.yml                                # NEW — GitHub Actions hourly cron
```

**Structure Decision**: Existing SPA structure extended. First server-side file (api/notify.ts) follows Vercel conventions. No new directories needed in src/.

---

## Key Design Decisions

| ID | Decision | Rationale |
|---|---|---|
| D-001 | web-push over higher-level push libraries | web-push is the de facto Node.js standard for RFC 8030. Handles VAPID signing, payload encryption, and HTTP request. Higher-level wrappers add batching/queuing we don't need for single-user. See R-001. |
| D-002 | google-auth-library instead of full googleapis | googleapis includes all Google API surfaces (~400MB). We only need Service Account JWT auth + raw Sheets API fetch. google-auth-library (~10MB) + direct fetch mirrors client-side sheetsService pattern. See R-002. |
| D-003 | Return 200 on per-subscription failures | Function returns 200 with summary `{ subscriptionsChecked, pushesSent, pushesSkipped, errors }`. Only systemic failures return 500. Prevents GitHub Actions from treating per-push 410s as cron failures. See R-003. |
| D-004 | IST hour matching via UTC offset arithmetic | `istHour = floor((utcHours * 60 + utcMinutes + 330) % 1440 / 60)`. At 3:00 UTC → istHour = 8, matching delivery_hour=8. Deterministic, no locale dependency. See R-004. |
| D-005 | skipWaiting + clients.claim preserved | Existing SW already uses both. Push handlers are purely additive. New SW code takes effect on next page load without requiring tab closure. See R-005. |
| D-006 | api/ added to eslint globalIgnores | api/notify.ts is Node.js, not browser code. React plugins don't apply. Simpler than separate override for one file. See R-006. |
| D-007 | PushSubscriptions added to TAB_NAMES + HEADER_DEFINITIONS | New users get tab during bootstrap. Existing users get it via lazy `ensurePushSubscriptionsTab()` on first visit to Notifications. No changes to bootstrapService. See R-007. |
| D-008 | Tab-exists check: if exists with any headers → skip | If PushSubscriptions tab exists but has wrong columns, log console.warn and proceed. Don't auto-migrate. Only create + write headers if tab doesn't exist or has no header row. See R-007. |

---

## Implementation Chunks

### Chunk 1: Schema + Types + Client Subscription Flow + SW + Settings UI

**Goal**: User can toggle notifications ON/OFF, subscription is written to/removed from Sheet, test notification works locally, service worker handles push events. All client-side work, testable without the cron.

**Tasks**:

#### T001: Add PushSubscription type to `src/types/index.ts`
- **FR**: FR-005
- **Action**: After the Dashboard Types section (after line 364), add a new `// --- Push Subscription Types ---` section with the `PushSubscription` interface. Fields: `_rowIndex`, `id`, `userEmail`, `endpoint`, `p256dhKey`, `authKey`, `deliveryHour` (number), `deliveryMinute` (number), `timezone`, `enabled` (boolean), `createdAt`, `lastPushedAt`, `deletedAt`.

#### T002: Extend ActionType and ActivityEntityType in `src/types/index.ts`
- **FR**: FR-023
- **Action**: Add `| 'push_enabled' | 'push_disabled'` to the ActionType union (line 313). Add `| 'push_subscription'` to ActivityEntityType (line 315).

#### T003: Add PushSubscriptions to `src/config/schema.ts`
- **FR**: FR-005, FR-022
- **Action**:
  1. Add `'PushSubscriptions'` to the TAB_NAMES array (insert after `'ActivityLog'`, before `'Config'`).
  2. Add a new entry to HEADER_DEFINITIONS (before the Config entry) with tabName `'PushSubscriptions'` and headers: `['id', 'user_email', 'endpoint', 'p256dh_key', 'auth_key', 'delivery_hour', 'delivery_minute', 'timezone', 'enabled', 'created_at', 'last_pushed_at', 'deleted_at']`.

#### T004: Add `addSheet` helper to `src/services/sheetsService.ts`
- **FR**: FR-022
- **Action**: Add a function `addSheet(accessToken: string, spreadsheetId: string, tabName: string): Promise<void>` that calls `POST /spreadsheets/{id}:batchUpdate` with request body `{ requests: [{ addSheet: { properties: { title: tabName } } }] }`. Uses existing `googleApiFetch` + `withRetry` pattern.

#### T005: Create `src/services/pushSubscriptionsService.ts`
- **FR**: FR-005, FR-006, FR-022
- **Action**: New file with functions:
  - `ensurePushSubscriptionsTab(token, ssId)` — tries `readValues(token, ssId, "'PushSubscriptions'!A1:L1")`. On success with data → tab exists with headers, return. On success with empty data → write headers. On 400 error (tab missing) → `addSheet(token, ssId, 'PushSubscriptions')` then write headers via `writeHeaders`. On other error → throw.
  - `readPushSubscriptions(token, ssId)` — calls `readAllRows`, parses each row to `PushSubscription` objects (same parsing pattern as billsService/todosService). Filters out rows where `deletedAt !== ''`.
  - `findActiveSubscriptionByEndpoint(token, ssId, endpoint)` — reads all, finds matching active subscription by endpoint URL.
  - `createPushSubscription(token, ssId, data)` — builds row array from PushSubscription fields (uuid for id, `'user'` for userEmail, `'Asia/Kolkata'` for timezone, `'TRUE'` for enabled, ISO timestamp for createdAt, empty for lastPushedAt/deletedAt), calls `appendRows`.
  - `softDeletePushSubscription(token, ssId, rowIndex)` — calls `updateCell` to set the deleted_at column (index 11) to current ISO timestamp.
  - `updateDeliveryTime(token, ssId, rowIndex, hour, minute)` — calls `updateCell` for delivery_hour (index 5) and delivery_minute (index 6).
- **Pattern**: Mirrors existing service patterns — imports from `sheetsService`, `googleApi`, `../types`, `../config/schema`. Uses `GoogleApiRequestError` for error discrimination.

#### T006: Upgrade `public/sw.js` with push + notificationclick handlers
- **FR**: FR-009, FR-010, FR-011
- **Action**: Add after the existing `fetch` handler (line 13):
  1. `self.addEventListener('push', ...)`: Parse `event.data.json()` for `{ title, body }`. Call `event.waitUntil(self.registration.showNotification(title, { body, icon: '/icons/icon-192x192.png', badge: '/icons/icon-192x192.png', tag: 'nodues-daily-overdue' }))`. Fallback if `event.data` is null: show notification with body "You have overdue items".
  2. `self.addEventListener('notificationclick', ...)`: `event.notification.close()`. `event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(...))` — find existing window and focus it, or open new window at `'/'`.
- **Preserves**: Existing install/activate/fetch handlers unchanged (lines 1–13).

#### T007: Create `src/pages/NotificationsPage.tsx`
- **FR**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-023
- **Action**: New page component with:
  1. **Mount**: Set document title `NoDues · Notifications`. Call `ensurePushSubscriptionsTab`. Load existing subscription from Sheet via `readPushSubscriptions`. Check `'PushManager' in window` for browser support. Check `Notification.permission` for current state.
  2. **Unsupported browser**: If no `PushManager` or no `serviceWorker`, render info card: "Push notifications are not supported in this browser. Try opening NoDues in Chrome or Safari."
  3. **Enable toggle**: On toggle ON → `Notification.requestPermission()`. If `'granted'`: get SW registration via `navigator.serviceWorker.ready`, subscribe with VAPID key, extract endpoint + keys, write to Sheet, log `push_enabled` activity. If `'denied'`: show guidance, revert. If `'default'`: revert.
  4. **Enable toggle**: On toggle OFF → `registration.pushManager.getSubscription()`, call `.unsubscribe()`. Soft-delete Sheet row. Log `push_disabled` activity.
  5. **Delivery time picker**: `<input type="time">` defaulting to "08:00". On change → `updateDeliveryTime`. Only visible when enabled.
  6. **Status indicator**: "Subscribed" with green dot when active. "Not subscribed" when off. Shows `lastPushedAt` with `formatRelativeTime` if available.
  7. **Test notification button**: Calls `registration.showNotification('NoDues', { body: 'Test notification — push is working!', tag: 'nodues-test' })`. Disabled when notifications are off.
  8. **Permission denied guidance**: When `Notification.permission === 'denied'`, show amber info box with instructions.
  9. **Layout**: `px-4 py-6 sm:px-6 lg:px-8 max-w-3xl mx-auto`. Back link to /settings. Cards use `bg-white border border-slate-200 rounded-lg p-4`.
  10. **Helper**: `urlBase64ToUint8Array(base64String)` — converts VAPID key from URL-safe base64 to Uint8Array for `applicationServerKey`.

#### T008: Update `src/pages/SettingsPage.tsx`
- **FR**: FR-001
- **Action**: In the CARDS array, change the Notifications entry (line 40–45):
  - `description: 'Daily overdue reminders'` (was `'Coming soon'`)
  - `to: '/settings/notifications'` (was `null`)
  - Remove `disabled: true`

#### T009: Update `src/App.tsx` with notifications route
- **FR**: FR-001
- **Action**: Import `NotificationsPage` from `./pages/NotificationsPage`. Add route inside the BootstrapLayout group (after the activity-log route, line 53):
  ```
  <Route path="/settings/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
  ```

#### T010: Add push action labels to `src/utils/activityLabels.ts`
- **FR**: FR-023
- **Action**:
  1. Add `Bell` to the lucide-react import (line 2).
  2. Add to ACTION_LABELS: `push_enabled: 'Push enabled'` and `push_disabled: 'Push disabled'` (after `category_restored`).
  3. Add to ENTITY_ICONS: `push_subscription: Bell` (after `category: Tags`).

#### T011: Build verification
- **Action**: Run `npm run build`. Verify clean compile.
- **Manual test sequence**:
  - Open /settings → Notifications card is clickable (no longer 'Coming soon')
  - /settings/notifications page renders
  - Toggle ON → permission prompt appears
    - If user clicks 'Allow' → subscription row appears in Sheet, 'push_enabled' logged, status shows 'Subscribed'
    - If user clicks 'Block' → toggle reverts to OFF, amber guidance appears explaining how to unblock in browser settings
    - If user dismisses prompt (closes it) → toggle reverts to OFF cleanly with no error state
  - Test notification button → notification appears within 5 seconds
  - Delivery time picker → changing it updates the Sheet row
  - Toggle OFF → browser unsubscribe + soft-delete row + 'push_disabled' logged + status shows 'Not subscribed'
  - Revoke permission in browser settings (DevTools → Application → Notifications → revoke) → page state syncs on next mount (or shows appropriate banner)

---

### Chunk 2: Vercel Serverless Function + Dependencies

**Goal**: api/notify.ts can be triggered via curl and sends real push notifications to subscribed devices.

**Tasks**:

#### T012: Add server-side dependencies to `package.json`
- **Action**:
  - Add to `dependencies`: `"web-push": "^3.6.7"`, `"google-auth-library": "^9.15.1"`.
  - Add to `devDependencies`: `"@vercel/node": "^5.1.8"`, `"@types/web-push": "^3.6.4"`.
  - Run `npm install`.

#### T013: Add `api/` to eslint globalIgnores
- **Action**: In `eslint.config.js` line 9, change `globalIgnores(['dist'])` to `globalIgnores(['dist', 'api'])`.

#### T014: Create `api/notify.ts`
- **FR**: FR-012 through FR-025
- **Action**: Vercel serverless function with the following structure:
  1. **Imports**: `VercelRequest`, `VercelResponse` from `@vercel/node`. `GoogleAuth` from `google-auth-library`. `webpush` default import from `web-push`.
  2. **Constants**: `SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'`. `IST_OFFSET_MINUTES = 330`.
  3. **Auth check**: `if (req.method !== 'POST') return res.status(405).json(...)`. Verify `req.headers.authorization === 'Bearer ' + process.env.CRON_SECRET`, return 401 if not.
  4. **VAPID setup**: `webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!)`.
  5. **Service Account auth**: `const auth = new GoogleAuth({ credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!), scopes: ['https://www.googleapis.com/auth/spreadsheets'] })`. Get access token via `auth.getAccessToken()`.
      - Note on scopes: Only 'spreadsheets' scope is needed for v1 since NODUES_SHEET_ID is hardcoded. The Drive scope (mentioned in the spec's One-Time Setup step 2 as 'Google Drive API read-only') is NOT needed in v1 — it was intended for the multi-user future where the cron would 'list all sheets shared with the service account'. The plan deliberately omits Drive scope to keep credentials minimal. Update spec's One-Time Setup step 2 accordingly: 'Grant it the Google Sheets API (read/write) scope only.'
  6. **Helpers**: `sheetsGet(token, range)` and `sheetsUpdate(token, range, values)` — thin fetch wrappers for Sheets API (mirrors client-side sheetsService pattern).
  7. **Compute IST hour**: `const now = new Date(); const utcMin = now.getUTCHours() * 60 + now.getUTCMinutes(); const istMin = (utcMin + 330) % 1440; const currentISTHour = Math.floor(istMin / 60);`
  8. **Read PushSubscriptions**: Fetch all rows. Parse. Filter: `enabled === 'TRUE'`, `deleted_at === ''`, `Number(delivery_hour) === currentISTHour`. Skip where `last_pushed_at` is within 23 hours. Use strict-equal with explicit `Number()` coercion; loose-equal could be fooled by edge cases like leading-zero strings or trailing whitespace from Sheets. Mirrors the parsing pattern used in billsService.ts for numeric fields.
  9. **Read overdue items**: Fetch Bills + BillTypes + Properties + Todos rows. Compute overdue items:
      - The server needs to replicate the EXACT overdue-determination logic used by the client in src/services/billsService.ts `computeDisplayStatus()` and src/services/todosService.ts `computeDisplayStatus()`. Specifically:
        * A bill/todo is overdue when status === 'pending' AND the effective due date is in the past (compared against IST today).
        * The effective due date is `_postponedUntil` if set, otherwise `due_date`.
        * 'IST today' is computed as `new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })` yielding 'YYYY-MM-DD'.
        * Paid bills/todos are never overdue regardless of dates.
        * Soft-deleted rows (`deleted_at !== ''`) are excluded entirely.
      - Approach: Copy the `computeDisplayStatus` logic into api/notify.ts as a local helper function (e.g. `isBillOverdue`, `isTodoOverdue`). Do NOT try to share the function across src/ and api/ — the Vercel build boundary makes import paths fragile. Add a code comment: `// Duplicates computeDisplayStatus from src/services/billsService.ts and todosService.ts — keep in sync if the overdue rules change.`
  10. **Skip if zero overdue**: Return summary with `pushesSent: 0`.
  11. **Build notification body**: Format first 3 items (bills as `"{billTypeName} — {propertyName}"`, todos as `"{title}"`). If > 3, append `"... and {N-3} more"`. Full: `"N overdue: item1, item2, item3... and M more"`.
      - Truncate the final body at 200 characters with ellipsis '…' appended. Web Push allows ~4KB encrypted payloads, but Android/iOS notification UI typically truncates around 200 chars. Safer to truncate explicitly than rely on platform behavior. If body truncation occurs, ensure the truncated text still ends at a word boundary (not mid-word).
  12. **Send pushes**: `webpush.sendNotification(sub, payload)`. On success → update `last_pushed_at`. On 410 → soft-delete. On error → push to errors array.
  13. **Response**: `return res.status(200).json({ subscriptionsChecked, pushesSent, pushesSkipped, errors })`.
- **Env vars**: `CRON_SECRET`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `NODUES_SHEET_ID`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

#### T015: Manual verification
- **Action**: Deploy to Vercel. Test:
  ```bash
  curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/notify
  ```
  Verify: 200 with summary, push appears on device, Sheet updated.

---

### Chunk 3: GitHub Actions Cron + End-to-End

**Goal**: Automated hourly cron triggers the Vercel function. Full end-to-end push delivery at the configured time.

**Tasks**:

#### T016: Create `.github/workflows/notify.yml`
- **FR**: CL-001
- **Action**: Create workflow file per spec template:
  ```yaml
  name: Daily Push Notification Cron
  on:
    schedule:
      - cron: '0 * * * *'
    workflow_dispatch:
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
  `-f` flag makes curl fail on non-2xx. `workflow_dispatch` allows manual triggering.

#### T017: Document setup steps
- **Action**: Verify quickstart.md covers CRON_SECRET generation, Vercel env var, GitHub secret + variable setup, workflow registration.

#### T018: End-to-end test
- **Action**: Full manual test:
  1. Enable push on device via /settings/notifications
  2. Verify subscription row in Sheet
  3. Manually trigger GitHub Actions workflow (workflow_dispatch)
  4. Verify push notification arrives with correct body
  5. Verify `last_pushed_at` updated in Sheet
  6. Disable → verify no push on next trigger
  7. Re-enable with different delivery_hour → verify time matching
  8. Test with zero overdue items → verify no push sent

---

## Complexity Tracking

No constitution violations to justify. All changes follow existing patterns. The api/notify.ts file is the first server-side code but uses familiar patterns (Google Sheets API, JWT auth, direct fetch).
