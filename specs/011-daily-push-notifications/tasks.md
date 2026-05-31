# Tasks: Daily Push Notifications

**Feature**: Daily Push Notifications (Phase 11)
**Branch**: `011-daily-push-notifications`
**Generated**: 2026-06-01

---

## Chunk 1: Schema + Types + Client Subscription Flow + SW + Settings UI

**Goal**: User can toggle notifications ON/OFF, subscription is written to/removed from Sheet, test notification works locally, service worker handles push events. All client-side work, testable without the cron.

### T001: Add PushSubscription type to `src/types/index.ts`

**File**: `src/types/index.ts`
**FR**: FR-005

After the Dashboard Types section (after line ~364), add a new `// --- Push Subscription Types ---` section with the `PushSubscription` interface.

Fields: `_rowIndex: number`, `id: string`, `userEmail: string`, `endpoint: string`, `p256dhKey: string`, `authKey: string`, `deliveryHour: number`, `deliveryMinute: number`, `timezone: string`, `enabled: boolean`, `createdAt: string`, `lastPushedAt: string`, `deletedAt: string`.

**Before**: File ends after Dashboard Types section (`MoneyThisMonth`, `AttentionItem`, `PropertyMoneySummary`).
**After**: File has a new `PushSubscription` interface after the Dashboard Types section.

**Done when**: `npm run build` compiles. `PushSubscription` type is importable from `../types`.

---

### T002: Extend ActionType and ActivityEntityType in `src/types/index.ts`

**File**: `src/types/index.ts`
**FR**: FR-023

1. Add `| 'push_enabled' | 'push_disabled'` to the `ActionType` union (line ~313).
2. Add `| 'push_subscription'` to `ActivityEntityType` (line ~315).

**Before**:
```typescript
// ActionType ends with:
  | 'category_added' | 'category_updated' | 'category_deleted' | 'category_restored';
// ActivityEntityType:
export type ActivityEntityType = 'bill' | 'todo' | 'property' | 'billtype' | 'category';
```
**After**:
```typescript
// ActionType ends with:
  | 'category_added' | 'category_updated' | 'category_deleted' | 'category_restored'
  | 'push_enabled' | 'push_disabled';
// ActivityEntityType:
export type ActivityEntityType = 'bill' | 'todo' | 'property' | 'billtype' | 'category' | 'push_subscription';
```

**Done when**: `npm run build` compiles. New action/entity types are part of the union.

---

### T003: Add PushSubscriptions to `src/config/schema.ts`

**File**: `src/config/schema.ts`
**FR**: FR-005, FR-022

1. Add `'PushSubscriptions'` to the `TAB_NAMES` array (insert after `'ActivityLog'`, before `'Config'`).
2. Add a new entry to `HEADER_DEFINITIONS` (before the Config entry, ~line 73) with `tabName: 'PushSubscriptions'` and headers: `['id', 'user_email', 'endpoint', 'p256dh_key', 'auth_key', 'delivery_hour', 'delivery_minute', 'timezone', 'enabled', 'created_at', 'last_pushed_at', 'deleted_at']`.

**Before**: `TAB_NAMES` has 9 entries ending with `'ActivityLog', 'Config'`. `HEADER_DEFINITIONS` has 9 entries (ActivityLog then Config).
**After**: `TAB_NAMES` has 10 entries with `'PushSubscriptions'` between `'ActivityLog'` and `'Config'`. `HEADER_DEFINITIONS` has 10 entries with PushSubscriptions before Config.

**Done when**: `npm run build` compiles. New tab name and headers are registered in schema.

---

### T004: Add `addSheet` helper to `src/services/sheetsService.ts`

**File**: `src/services/sheetsService.ts`
**FR**: FR-022

Add a new exported function:

```typescript
export async function addSheet(
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
): Promise<void>
```

Calls `POST /spreadsheets/{spreadsheetId}:batchUpdate` with body `{ requests: [{ addSheet: { properties: { title: tabName } } }] }`. Uses existing `googleApiFetch` + `withRetry` pattern from the same file.

**Before**: `sheetsService.ts` has `readAllRows`, `updateRow`, `updateCell`, `appendRows`, `readValues`, `writeHeaders` — no `addSheet`.
**After**: `sheetsService.ts` exports `addSheet(token, ssId, tabName)`.

**Done when**: `npm run build` compiles. `addSheet` is importable from `sheetsService`.

---

### T005: Create `src/services/pushSubscriptionsService.ts`

**File**: `src/services/pushSubscriptionsService.ts` (NEW)
**FR**: FR-005, FR-006, FR-022

New file exporting:

1. `ensurePushSubscriptionsTab(token, ssId)` — tries `readValues(token, ssId, "'PushSubscriptions'!A1:L1")`. On success with data → tab exists, return. On success with empty data → write headers. On 400 error (tab missing) → `addSheet` then `writeHeaders`. On other error → throw. Uses `GoogleApiRequestError` for error discrimination.
2. `readPushSubscriptions(token, ssId)` — calls `readAllRows`, parses rows to `PushSubscription[]` (mirrors billsService/todosService pattern). Filters out rows where `deletedAt !== ''`.
3. `findActiveSubscriptionByEndpoint(token, ssId, endpoint)` — reads all, finds matching active subscription by endpoint URL.
4. `createPushSubscription(token, ssId, data)` — builds row array (uuid for id, `'user'` for userEmail, `'Asia/Kolkata'` for timezone, `'TRUE'` for enabled, ISO timestamp for createdAt, empty for lastPushedAt/deletedAt), calls `appendRows`.
5. `softDeletePushSubscription(token, ssId, rowIndex)` — calls `updateCell` to set deleted_at column (index 11) to current ISO timestamp.
6. `updateDeliveryTime(token, ssId, rowIndex, hour, minute)` — calls `updateCell` for delivery_hour (index 5) and delivery_minute (index 6).

Imports: `sheetsService` (readValues, readAllRows, appendRows, updateCell, writeHeaders, addSheet), `googleApi` (GoogleApiRequestError), `../types` (PushSubscription), `../config/schema`.

**Before**: File does not exist.
**After**: File exists with 6 exported functions following existing service patterns.

**Done when**: `npm run build` compiles. All 6 functions are importable.

---

### T006: Upgrade `public/sw.js` with push + notificationclick handlers

**File**: `public/sw.js`
**FR**: FR-009, FR-010, FR-011

Add after the existing `fetch` handler (line 14):

1. `self.addEventListener('push', ...)`: Parse `event.data.json()` for `{ title, body }`. Call `event.waitUntil(self.registration.showNotification(title, { body, icon: '/icons/icon-192x192.png', badge: '/icons/icon-192x192.png', tag: 'nodues-daily-overdue' }))`. Fallback if `event.data` is null: show notification with body "You have overdue items".
2. `self.addEventListener('notificationclick', ...)`: `event.notification.close()`. `event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(...))` — find existing window and focus it, or open new window at `'/'`.

**Before**: `sw.js` has 14 lines — install (skipWaiting), activate (clients.claim), and pass-through fetch handlers only.
**After**: `sw.js` has two additional event listeners (push, notificationclick). Existing handlers at lines 1–14 are unchanged.

**Done when**: `sw.js` has push and notificationclick handlers. Existing PWA installability is preserved (install/activate/fetch untouched).

---

### T007: Create `src/pages/NotificationsPage.tsx`

**File**: `src/pages/NotificationsPage.tsx` (NEW)
**FR**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-023

New page component with:

1. **Mount**: Set document title `NoDues · Notifications`. Call `ensurePushSubscriptionsTab`. Load existing subscription via `readPushSubscriptions`. Check `'PushManager' in window` for browser support. Check `Notification.permission` for current state.
2. **Unsupported browser**: If no `PushManager` or no `serviceWorker`, render info card: "Push notifications are not supported in this browser. Try opening NoDues in Chrome or Safari."
3. **Enable toggle ON**: `Notification.requestPermission()`. If `'granted'`: get SW registration via `navigator.serviceWorker.ready`, subscribe with VAPID key (`VITE_VAPID_PUBLIC_KEY`), extract endpoint + keys, write to Sheet, log `push_enabled` activity. If `'denied'`: show guidance, revert toggle. If `'default'`: revert toggle.
4. **Enable toggle OFF**: `registration.pushManager.getSubscription()`, call `.unsubscribe()`. Soft-delete Sheet row. Log `push_disabled` activity.
5. **Delivery time picker**: `<input type="time">` defaulting to "08:00". On change → `updateDeliveryTime`. Only visible when enabled.
6. **Status indicator**: "Subscribed" with green dot when active. "Not subscribed" when off. Shows `lastPushedAt` with `formatRelativeTime` if available.
7. **Test notification button**: Calls `registration.showNotification('NoDues', { body: 'Test notification — push is working!', tag: 'nodues-test' })`. Disabled when notifications are off.
8. **Permission denied guidance**: When `Notification.permission === 'denied'`, show amber info box with browser-unblock instructions.
9. **Layout**: `px-4 py-6 sm:px-6 lg:px-8 max-w-3xl mx-auto`. Back link to /settings. Cards use `bg-white border border-slate-200 rounded-lg p-4`.
10. **Helper**: `urlBase64ToUint8Array(base64String)` — converts VAPID key from URL-safe base64 to Uint8Array for `applicationServerKey`.

**Before**: File does not exist.
**After**: Full notifications settings page with toggle, time picker, test button, status indicator, and permission handling.

**Done when**: `npm run build` compiles. Page renders at `/settings/notifications` with all interactive elements.

---

### T008: Update `src/pages/SettingsPage.tsx`

**File**: `src/pages/SettingsPage.tsx`
**FR**: FR-001

In the CARDS array, update the Notifications entry (lines 39–45):

**Before**:
```typescript
{
  label: 'Notifications',
  description: 'Coming soon',
  icon: Bell,
  to: null,
  disabled: true,
},
```
**After**:
```typescript
{
  label: 'Notifications',
  description: 'Daily overdue reminders',
  icon: Bell,
  to: '/settings/notifications',
},
```

Remove `disabled: true` and `to: null`.

**Done when**: Settings page shows Notifications card as clickable link to `/settings/notifications` with description "Daily overdue reminders".

---

### T009: Update `src/App.tsx` with notifications route

**File**: `src/App.tsx`
**FR**: FR-001

1. Import `NotificationsPage` from `./pages/NotificationsPage`.
2. Add route inside the BootstrapLayout group (after the activity-log route, ~line 53):
   ```tsx
   <Route path="/settings/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
   ```

**Before**: 4 settings sub-routes (properties, bill-types, categories, activity-log). No notifications route.
**After**: 5 settings sub-routes. `/settings/notifications` renders `NotificationsPage` inside `ProtectedRoute`.

**Done when**: `npm run build` compiles. Navigating to `/settings/notifications` renders the NotificationsPage.

---

### T010: Add push action labels to `src/utils/activityLabels.ts`

**File**: `src/utils/activityLabels.ts`
**FR**: FR-023

1. Add `Bell` to the lucide-react import (line 2).
2. Add to `ACTION_LABELS`: `push_enabled: 'Push enabled'` and `push_disabled: 'Push disabled'` (after the last category entry).
3. Add to `ENTITY_ICONS`: `push_subscription: Bell` (after `category: Tags`).

**Before**: `ACTION_LABELS` has entries for bill/todo/property/billtype/category actions. `ENTITY_ICONS` maps 5 entity types.
**After**: `ACTION_LABELS` includes `push_enabled` and `push_disabled`. `ENTITY_ICONS` maps 6 entity types (adds `push_subscription: Bell`).

**Done when**: `npm run build` compiles. Activity log renders push_enabled/push_disabled entries with Bell icon.

---

### T011: Chunk 1 build verification

**Action**: Run `npm run build`. Verify clean compile.

**Manual test sequence**:
- Open /settings → Notifications card is clickable (no longer "Coming soon")
- /settings/notifications page renders
- Toggle ON → permission prompt appears
  - If user clicks "Allow" → subscription row appears in Sheet, `push_enabled` logged, status shows "Subscribed"
  - If user clicks "Block" → toggle reverts to OFF, amber guidance appears
  - If user dismisses prompt → toggle reverts to OFF cleanly
- Test notification button → notification appears within 5 seconds
- Delivery time picker → changing it updates the Sheet row
- Toggle OFF → browser unsubscribe + soft-delete row + `push_disabled` logged + status shows "Not subscribed"

**FR**: FR-001 through FR-008, FR-022, FR-023
**Done when**: `npm run build` passes with zero errors. All manual test scenarios pass.

---

## Chunk 2: Vercel Serverless Function + Dependencies

**Goal**: `api/notify.ts` can be triggered via curl and sends real push notifications to subscribed devices.

### T012: Add server-side dependencies to `package.json`

**File**: `package.json`
**FR**: FR-012

1. Add to `dependencies`: `"web-push": "^3.6.7"`, `"google-auth-library": "^9.15.1"`.
2. Add to `devDependencies`: `"@vercel/node": "^5.1.8"`, `"@types/web-push": "^3.6.4"`.
3. Run `npm install`.

**Before**: `dependencies` has 6 entries (react, react-dom, react-router-dom, lucide-react, @react-oauth/google, uuid). No server-side packages.
**After**: `dependencies` adds `web-push` and `google-auth-library`. `devDependencies` adds `@vercel/node` and `@types/web-push`.

**Done when**: `npm install` succeeds. `npm run build` still compiles (no breaking changes).

---

### T013: Add `api/` to eslint globalIgnores

**File**: `eslint.config.js`
**FR**: (D-006 design decision)

Change `globalIgnores(['dist'])` to `globalIgnores(['dist', 'api'])` (line 9).

**Before**: `globalIgnores(['dist'])`
**After**: `globalIgnores(['dist', 'api'])`

**Done when**: ESLint ignores `api/` directory. `npm run build` still compiles.

---

### T014: Create `api/notify.ts`

**File**: `api/notify.ts` (NEW)
**FR**: FR-012, FR-013, FR-014, FR-015, FR-016, FR-017, FR-018, FR-019, FR-020, FR-021, FR-024, FR-025

Vercel serverless function with:

1. **Imports**: `VercelRequest`, `VercelResponse` from `@vercel/node`. `GoogleAuth` from `google-auth-library`. `webpush` from `web-push`.
2. **Constants**: `SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'`. `IST_OFFSET_MINUTES = 330`.
3. **Auth check**: Only `POST` allowed (405 otherwise). Verify `req.headers.authorization === 'Bearer ' + process.env.CRON_SECRET` (401 if not).
4. **VAPID setup**: `webpush.setVapidDetails(...)` with env vars.
5. **Service Account auth**: `new GoogleAuth({ credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!), scopes: ['https://www.googleapis.com/auth/spreadsheets'] })`. Get access token.
6. **Helpers**: `sheetsGet(token, range)` and `sheetsUpdate(token, range, values)` — thin fetch wrappers for Sheets API.
7. **Compute IST hour**: `const now = new Date(); const utcMin = now.getUTCHours() * 60 + now.getUTCMinutes(); const istMin = (utcMin + 330) % 1440; const currentISTHour = Math.floor(istMin / 60);`
8. **Read PushSubscriptions**: Fetch all rows. Parse. Filter: `enabled === 'TRUE'`, `deleted_at === ''`, `Number(delivery_hour) === currentISTHour`. Skip where `last_pushed_at` is within 23 hours (idempotency).
9. **Read overdue items**: Fetch Bills + BillTypes + Properties + Todos. Compute overdue using duplicated `computeDisplayStatus` logic (comment: `// Duplicates computeDisplayStatus from src/services/billsService.ts and todosService.ts — keep in sync`). Overdue = `status === 'pending'` AND effective due date (`_postponedUntil` or `due_date`) is before IST today. Exclude soft-deleted rows.
10. **Skip if zero overdue**: Return summary with `pushesSent: 0`.
11. **Build notification body**: Format first 3 items (bills as `"{billTypeName} — {propertyName}"`, todos as `"{title}"`). If > 3, append `"... and {N-3} more"`. Prefix with `"N overdue: "`. Truncate at 200 chars at word boundary with `'…'`.
12. **Send pushes**: `webpush.sendNotification(sub, payload)`. On success → update `last_pushed_at`. On 410 → soft-delete. On error → push to errors array.
13. **Response**: `return res.status(200).json({ subscriptionsChecked, pushesSent, pushesSkipped, errors })`.

**Env vars required**: `CRON_SECRET`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `NODUES_SHEET_ID`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

**Before**: `api/` directory does not exist.
**After**: `api/notify.ts` is a complete Vercel serverless function handling cron-triggered push notifications.

**Done when**: `npm run build` compiles (api/ is eslint-ignored). File exports a default handler accepting `VercelRequest`/`VercelResponse`.

---

### T015: Chunk 2 manual verification

**Action**: Deploy to Vercel. Test with curl:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/notify
```

**FR**: FR-012 through FR-025
**Done when**: curl returns 200 with summary JSON `{ subscriptionsChecked, pushesSent, pushesSkipped, errors }`. Push notification appears on subscribed device. `last_pushed_at` updated in Sheet.

---

## Chunk 3: GitHub Actions Cron + End-to-End

**Goal**: Automated hourly cron triggers the Vercel function. Full end-to-end push delivery at the configured time.

### T016: Create `.github/workflows/notify.yml`

**File**: `.github/workflows/notify.yml` (NEW)
**FR**: CL-001

Create GitHub Actions workflow file:

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

`-f` flag makes curl fail on non-2xx responses. `workflow_dispatch` allows manual triggering for testing.

**Before**: `.github/workflows/` directory may not exist.
**After**: Workflow file exists. Hourly cron triggers POST to Vercel notify endpoint with CRON_SECRET auth.

**Done when**: Workflow file is committed. Manual `workflow_dispatch` from GitHub UI succeeds and triggers the Vercel function.

---

### T017: Document setup steps

**File**: `specs/011-daily-push-notifications/quickstart.md` (verify/update)
**FR**: (documentation)

Verify `quickstart.md` covers:
- CRON_SECRET generation (`openssl rand -hex 32`)
- Vercel env var setup (all 6 server-side vars + 1 client-side var)
- GitHub Actions secret (`CRON_SECRET`) and variable (`VERCEL_NOTIFY_URL`) setup
- Google Service Account creation and Sheet sharing
- VAPID key generation (`npx web-push generate-vapid-keys`)
- Workflow file registration

**Before**: `quickstart.md` exists with dev setup instructions.
**After**: `quickstart.md` is complete and accurate for all one-time setup steps.

**Done when**: A new developer can follow `quickstart.md` to set up the full push notification pipeline from scratch.

---

### T018: End-to-end test

**Action**: Full manual end-to-end test:

1. Enable push on device via /settings/notifications
2. Verify subscription row in Sheet
3. Manually trigger GitHub Actions workflow (workflow_dispatch)
4. Verify push notification arrives with correct body
5. Verify `last_pushed_at` updated in Sheet
6. Disable → verify no push on next trigger
7. Re-enable with different delivery_hour → verify time matching
8. Test with zero overdue items → verify no push sent

**FR**: All FRs (FR-001 through FR-025), CL-001
**Done when**: All 8 test steps pass. Full pipeline works: GitHub Actions → Vercel function → Sheet read → Web Push → device notification.
