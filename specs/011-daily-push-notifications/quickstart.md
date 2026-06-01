# Quickstart: Daily Push Notifications

**Feature**: Daily Push Notifications (Phase 11)
**Date**: 2026-05-31

---

## Prerequisites

- Node.js 18+, npm
- Phases 1–13 complete (through PWA support)
- Branch: `011-daily-push-notifications`
- Vercel account (Hobby tier) with the project deployed
- Google Cloud project with a Service Account (needed for the serverless function)
- GitHub repo with Actions enabled

## Dev Server

```bash
npm run dev
```

## Build Check

```bash
npm run build
```

---

## Complete One-Time Setup

Everything below is done once. After setup, daily push notifications
run automatically with no manual intervention.

### Step 1: Generate VAPID Keys

VAPID (Voluntary Application Server Identification) keys are used to
authenticate your server with the browser push service.

```bash
npx web-push generate-vapid-keys
```

Save both the **public key** and **private key**. You'll need them in
Steps 3 and 6.

### Step 2: Create a Google Service Account

The Vercel serverless function uses a Service Account to read/write
the Google Sheet (it can't use the user's OAuth token).

1. Go to [Google Cloud Console](https://console.cloud.google.com/) >
   **IAM & Admin** > **Service Accounts** > **Create Service Account**
2. Name it something like `nodues-push-cron`
3. No roles needed at the project level (Sheet access is granted via
   sharing, not IAM roles)
4. Click **Create Key** > JSON > Download the key file
5. Share the NoDues Google Sheet with the service account's email
   address (the `client_email` field in the JSON key file). Grant
   **Editor** access so it can update `last_pushed_at`.
6. Stringify the JSON for use as an env var:
   ```bash
   cat key.json | jq -c .
   ```
   Copy the single-line output.

> **Security note**: The JSON key file contains a private key. Never
> commit it to the repo. Store it only in Vercel env vars.

### Step 3: Generate CRON_SECRET

A shared secret that authenticates the GitHub Actions cron request to
the Vercel function, preventing unauthorized access.

```bash
openssl rand -hex 32
```

Save the output. You'll add it to both Vercel and GitHub.

### Step 4: Set Vercel Environment Variables

Go to Vercel project **Settings** > **Environment Variables** and add
all 8 variables:

| Variable | Value | Sensitive? | Notes |
|----------|-------|------------|-------|
| `VAPID_PUBLIC_KEY` | *(from Step 1)* | No | Server-side VAPID public key |
| `VITE_VAPID_PUBLIC_KEY` | *(same as VAPID_PUBLIC_KEY)* | No | Client-side (Vite-prefixed, bundled into the app) |
| `VAPID_PRIVATE_KEY` | *(from Step 1)* | **Yes** | Never expose to client |
| `VAPID_SUBJECT` | `mailto:your-email@example.com` | No | Contact URI for VAPID identification |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | *(stringified JSON from Step 2)* | **Yes** | Full service account credentials |
| `NODUES_SHEET_ID` | *(spreadsheet ID from the Sheet URL)* | No | The part between `/d/` and `/edit` in the Sheet URL |
| `CRON_SECRET` | *(from Step 3)* | **Yes** | Shared secret for cron authentication |
| `VITE_GOOGLE_CLIENT_ID` | *(already set from earlier phases)* | No | Existing — listed for completeness |

> **Tip**: The spreadsheet ID is in the URL:
> `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit`

### Step 5: Set GitHub Repository Secret and Variable

Go to the GitHub repo **Settings** > **Secrets and variables** >
**Actions**.

**Secret** (encrypted, not visible after saving):

| Name | Value |
|------|-------|
| `CRON_SECRET` | *(same value as the Vercel CRON_SECRET from Step 3)* |

**Variable** (visible, not encrypted — this is just a URL):

| Name | Value |
|------|-------|
| `VERCEL_NOTIFY_URL` | `https://nodues-virid.vercel.app/api/notify` |

> **Important**: `CRON_SECRET` goes under the **Secrets** tab.
> `VERCEL_NOTIFY_URL` goes under the **Variables** tab. They are
> different sections on the same page.

### Step 6: The Workflow File

The file `.github/workflows/notify.yml` is already in the repo
(added in Chunk 3). It runs hourly at minute 0 UTC via GitHub Actions
cron and calls the Vercel notify endpoint with the `CRON_SECRET`.

The workflow becomes active as soon as the file is pushed to the
default branch (`main`).

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

Key details:
- `cron: '0 * * * *'` — runs at the top of every hour (UTC)
- `workflow_dispatch` — allows manual triggering from the GitHub UI
- `-f` flag on curl — makes the job fail (red) on non-2xx responses
- `secrets.CRON_SECRET` — injected from repo secrets (Step 5)
- `vars.VERCEL_NOTIFY_URL` — injected from repo variables (Step 5)

### Step 7: Verify with Manual Trigger

After pushing the workflow file to `main`:

1. Go to the GitHub repo > **Actions** tab
2. Click **"Daily Push Notification Cron"** in the left sidebar
3. Click **"Run workflow"** dropdown (top right)
4. Select the default branch and click **"Run workflow"**
5. Watch the workflow run — it should complete with a green check
6. If you have an active subscription + overdue items + matching
   delivery hour: a push notification arrives on your device
7. Check the PushSubscriptions tab in the Sheet — `last_pushed_at`
   should be updated

---

## Architecture Summary

```
GitHub Actions (hourly cron)
  → HTTP POST with Bearer CRON_SECRET
    → Vercel /api/notify
      → Google Sheets API (via Service Account)
        → Read PushSubscriptions (filter by hour + enabled)
        → Read Bills + Todos (compute overdue)
        → web-push sendNotification()
          → Browser push service
            → Device notification
```

---

## Files Created/Modified

### New Files

| File | Purpose |
|------|---------|
| `src/services/pushSubscriptionsService.ts` | CRUD for PushSubscriptions sheet tab + lazy tab creation |
| `src/pages/NotificationsPage.tsx` | Notifications settings page (toggle, time picker, test button) |
| `api/notify.ts` | Vercel serverless function for reading overdue items + sending pushes |
| `.github/workflows/notify.yml` | GitHub Actions hourly cron that POSTs to the Vercel endpoint |

### Modified Files

| File | Changes |
|------|---------|
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

## Troubleshooting

**Workflow doesn't appear in Actions tab**: Make sure the `.yml` file
is on the default branch (`main`). Workflows on feature branches don't
show up for `workflow_dispatch` until merged.

**Workflow runs but fails**: Check the run logs. Common causes:
- `CRON_SECRET` not set in repo secrets (401 from Vercel)
- `VERCEL_NOTIFY_URL` not set in repo variables (curl fails)
- Vercel function not deployed (404)

**No push notification arrives**: The function only sends when ALL of:
- At least one active subscription exists (enabled=TRUE, deleted_at empty)
- `delivery_hour` matches the current IST hour
- `last_pushed_at` is older than 23 hours (or empty)
- There is at least one overdue bill or todo

**GitHub disables the scheduled workflow**: GitHub auto-disables
scheduled workflows in repos with no activity for 60 days. Any commit
re-activates it.
