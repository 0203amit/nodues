# Quickstart: Daily Push Notifications

**Feature**: Daily Push Notifications (Phase 11)
**Date**: 2026-05-31

---

## Prerequisites

- Node.js 18+, npm
- Phases 1–13 complete (through PWA support)
- Branch: `011-daily-push-notifications`
- Vercel account (Hobby tier) with the project deployed
- Google Cloud project with a Service Account (needed for Chunk 2)

## Dev Server

```bash
npm run dev
```

## Build Check

```bash
npm run build
```

## One-Time Setup

### Before Chunk 1 (client-side development)

No external setup needed. The VAPID public key is required at runtime but can be deferred — the Notifications page gracefully handles a missing key by showing an error.

For local testing of the subscription flow, generate VAPID keys and set the Vite env var:

```bash
npx web-push generate-vapid-keys
```

Create a `.env.local` file (gitignored):
```
VITE_VAPID_PUBLIC_KEY=<your-vapid-public-key>
```

### Before Chunk 2 (Vercel serverless function)

#### 1. Google Service Account

1. Go to Google Cloud Console > IAM & Admin > Service Accounts > Create
2. Grant scope: Google Sheets API (read/write)
3. Create and download a JSON key file
4. Share the NoDues Google Sheet with the service account's email address (Editor access)
5. Stringify the JSON: `cat key.json | jq -c .`

#### 2. VAPID Keys

```bash
npx web-push generate-vapid-keys
```

Save both the public key and private key.

#### 3. Vercel Environment Variables

Add to Vercel project settings (Settings > Environment Variables):

| Variable | Value | Scope |
|----------|-------|-------|
| `VAPID_PUBLIC_KEY` | *(from step 2)* | Server |
| `VITE_VAPID_PUBLIC_KEY` | *(same as VAPID_PUBLIC_KEY)* | Client (Vite-prefixed) |
| `VAPID_PRIVATE_KEY` | *(from step 2)* | Server only |
| `VAPID_SUBJECT` | `mailto:your-email@example.com` | Server only |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | *(stringified JSON from step 1)* | Server only |
| `NODUES_SHEET_ID` | *(your spreadsheet ID from the Sheet URL)* | Server only |

### Before Chunk 3 (GitHub Actions cron)

#### 4. CRON_SECRET

Generate a random secret:
```bash
openssl rand -hex 32
```

Add it in two places:
- **Vercel**: Settings > Environment Variables > `CRON_SECRET`
- **GitHub**: Repo Settings > Secrets and variables > Actions > New repository secret > Name: `CRON_SECRET`

#### 5. VERCEL_NOTIFY_URL

- GitHub repo Settings > Secrets and variables > Actions > **Variables** tab (not Secrets)
- Add variable `VERCEL_NOTIFY_URL` with value: `https://your-app.vercel.app/api/notify`

---

## Files to Create

| File | Purpose |
|---|---|
| `src/services/pushSubscriptionsService.ts` | CRUD for PushSubscriptions sheet tab + lazy tab creation |
| `src/pages/NotificationsPage.tsx` | Notifications settings page (toggle, time picker, test button) |
| `api/notify.ts` | Vercel serverless function for reading overdue items + sending pushes |
| `.github/workflows/notify.yml` | GitHub Actions hourly cron that POSTs to the Vercel endpoint |

## Files to Modify

| File | Changes |
|---|---|
| `src/types/index.ts` | Add `PushSubscription` interface, extend `ActionType` + `ActivityEntityType` |
| `src/config/schema.ts` | Add `'PushSubscriptions'` to `TAB_NAMES` + `HEADER_DEFINITIONS` |
| `src/services/sheetsService.ts` | Add `addSheet()` helper function |
| `src/utils/activityLabels.ts` | Add `push_enabled` / `push_disabled` labels + `Bell` icon |
| `src/pages/SettingsPage.tsx` | Enable Notifications card (remove disabled state, add link) |
| `src/App.tsx` | Add `/settings/notifications` route |
| `public/sw.js` | Add `push` + `notificationclick` event handlers |
| `eslint.config.js` | Add `api/` to `globalIgnores` |
| `package.json` | Add `web-push`, `google-auth-library`, `@vercel/node`, `@types/web-push` |

---

## Implementation Order (3 Chunks)

### Chunk 1: Client-Side (Schema + UI + Service Worker)

All client-side work. Testable with `npm run dev` and manual toggle testing.

1. Add `PushSubscription` type to `src/types/index.ts`
2. Extend `ActionType` with `push_enabled` / `push_disabled`
3. Extend `ActivityEntityType` with `push_subscription`
4. Add PushSubscriptions to `TAB_NAMES` + `HEADER_DEFINITIONS` in `src/config/schema.ts`
5. Add `addSheet()` helper to `src/services/sheetsService.ts`
6. Create `src/services/pushSubscriptionsService.ts`
7. Upgrade `public/sw.js` with push + notificationclick handlers
8. Create `src/pages/NotificationsPage.tsx`
9. Update `src/pages/SettingsPage.tsx` (enable Notifications card)
10. Update `src/App.tsx` (add `/settings/notifications` route)
11. Add labels to `src/utils/activityLabels.ts`
12. Run `npm run build` — verify clean compile

### Chunk 2: Server-Side (Vercel Serverless Function)

Requires one-time setup steps 1-3 (Service Account, VAPID keys, Vercel env vars).

1. Add dependencies: `web-push`, `google-auth-library`, `@vercel/node`, `@types/web-push`
2. Add `api/` to eslint `globalIgnores`
3. Create `api/notify.ts`
4. Deploy to Vercel, test with curl

### Chunk 3: Scheduling (GitHub Actions Cron)

Requires one-time setup steps 4-5 (CRON_SECRET, VERCEL_NOTIFY_URL).

1. Create `.github/workflows/notify.yml`
2. Push to GitHub to register the workflow
3. End-to-end test (manual trigger + automated cron)

---

## Manual Testing

### Chunk 1 Tests

1. Navigate to Settings > Notifications card should be clickable (not greyed out)
2. Click > navigates to `/settings/notifications` > page renders
3. If browser doesn't support Push: informational message shown, toggle disabled
4. Toggle "Enable" ON > browser permission prompt appears
5. Grant permission > toggle shows ON, status shows "Subscribed"
6. Check Google Sheet > PushSubscriptions tab exists with a new row containing endpoint, keys, delivery_hour=8
7. Tap "Test notification" button > notification appears immediately on device
8. Change delivery time from 08:00 to 20:00 > Sheet row's `delivery_hour` updates to 20
9. Toggle "Enable" OFF > Sheet row gets `deleted_at` timestamp, browser unsubscribes
10. Check ActivityLog tab > `push_enabled` and `push_disabled` entries present with `push_subscription` entity type
11. Re-visit page > toggle shows OFF, status shows "Not subscribed"

### Chunk 2 Tests

1. Deploy updated code to Vercel
2. `curl -X POST https://your-app.vercel.app/api/notify` > 401 (no auth)
3. `curl -X GET -H "Authorization: Bearer $CRON_SECRET" .../api/notify` > 405 (wrong method)
4. `curl -X POST -H "Authorization: Bearer $CRON_SECRET" .../api/notify` > 200 with JSON summary
5. If device is subscribed and has overdue items > push notification appears
6. Check Sheet > `last_pushed_at` column is updated with current timestamp
7. Re-run curl immediately > `pushesSkipped` should be non-zero (idempotency: last push < 23h)
8. If no overdue items > summary shows `pushesSent: 0`, no notification sent

### Chunk 3 Tests

1. Manually trigger GitHub Actions workflow: Actions tab > "Daily Push Notification Cron" > Run workflow
2. Verify workflow run succeeds (green check mark)
3. Push notification arrives on subscribed device (if overdue items exist)
4. Wait for next automated hourly cron run > verify it fires and logs succeed
5. Disable notifications on device > next cron run shows `pushesSkipped` or `subscriptionsChecked: 0`
6. Test 410 cleanup: invalidate a subscription (clear browser data), trigger cron > row should get `deleted_at` set
