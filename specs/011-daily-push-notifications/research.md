# Research: Daily Push Notifications

**Feature**: Daily Push Notifications (Phase 11)
**Date**: 2026-05-31

---

## R-001: web-push vs Higher-Level Push Libraries

**Decision**: Use the `web-push` npm package directly for sending Web Push notifications from the Vercel serverless function.

**Rationale**: web-push is the de facto standard Node.js implementation of the Web Push Protocol (RFC 8030) and VAPID (RFC 8292). It handles VAPID key signing (ES256), payload encryption (aes128gcm per RFC 8188), and HTTP request construction to push service endpoints (FCM, Mozilla, Apple). It has 160k+ weekly npm downloads and is actively maintained.

Higher-level libraries like `push-notifications-node` or `onesignal-node` are wrappers that add queue management, batching, analytics, and multi-provider abstraction. For a single-user app with <5 subscriptions, these features add complexity without benefit. web-push is the lowest-level library that still abstracts away the cryptographic details.

**Alternatives considered**:
- `push-notifications-node` — wraps web-push with provider abstraction (FCM, APNS, web-push). We only use web-push endpoints. Extra dependency for no gain.
- Firebase Cloud Messaging SDK — Google-specific, requires Firebase project setup, heavier integration. Web Push Protocol is cross-browser and provider-agnostic.
- OneSignal / Pushover / similar SaaS — external service dependency, cost, overkill for a personal app.

---

## R-002: google-auth-library vs Full googleapis Package

**Decision**: Use `google-auth-library` for Service Account JWT authentication, combined with direct `fetch()` calls to the Sheets API. Do NOT use the full `googleapis` package.

**Rationale**: The `googleapis` package includes generated client libraries for every Google API (~400MB installed size). We need exactly one thing: Service Account authentication to read/write Google Sheets. `google-auth-library` (~10MB) provides the `GoogleAuth` class for JWT auth and automatic token refresh. Once we have an access token, we make raw Sheets API calls via `fetch()` — the same pattern already used by the client-side `sheetsService.ts` and `googleApi.ts`.

Benefits:
- Vercel function bundle stays small (well within the 250MB uncompressed limit)
- Consistent with existing codebase patterns (direct fetch to `https://sheets.googleapis.com/v4/spreadsheets/...`)
- Faster cold starts (smaller package = less code to parse on function init)
- No generated API surface to learn — reuse the Sheets API URL patterns already in the project

The trade-off is constructing raw Sheets API URLs instead of calling `sheets.spreadsheets.values.get()`. Since the project already has this pattern in `sheetsService.ts`, it's familiar and proven.

**Alternatives considered**:
- Full `googleapis` package — works, but adds massive dependency for a single API. Vercel's tree-shaking helps but cold starts are still slower with the extra module surface.
- `google-spreadsheet` (npm) — convenience wrapper for Sheets API with Service Account support. Adds another abstraction layer we don't need. ~33k weekly downloads vs google-auth-library's ~13M.
- No external auth library (manual JWT signing) — possible with `jsonwebtoken` + raw RSA key handling, but google-auth-library handles token refresh, retry, and key rotation correctly out of the box.

---

## R-003: Return 200 on Per-Subscription Failures

**Decision**: The Vercel function (api/notify.ts) always returns HTTP 200 with a summary object `{ subscriptionsChecked, pushesSent, pushesSkipped, errors }`, even when individual push sends fail.

**Rationale**: GitHub Actions cron interprets non-2xx responses as step failures (due to `curl -f`). If the function returned 500 because one subscription had a stale endpoint (410 Gone), the cron step would be marked as failed in GitHub Actions, triggering unnecessary alerting and cluttering the workflow run history.

The summary object provides full visibility into what happened during the run:
- `subscriptionsChecked`: total active subscriptions evaluated this hour
- `pushesSent`: number of successful push deliveries
- `pushesSkipped`: skipped due to idempotency (`last_pushed_at` < 23h) or no overdue items
- `errors`: array of `{ endpoint (truncated), status, message }` for failed sends

The function returns non-200 ONLY for systemic failures that prevent any processing:
- Missing or invalid `CRON_SECRET` → 401
- Can't authenticate Service Account → 500
- Can't read spreadsheet at all → 500
- Invalid HTTP method → 405

Individual push failures (410 Gone, 429 rate limit, transient 5xx from a push service) are handled per-subscription and reported in the summary. 410s trigger automatic soft-deletion of the stale row.

**Alternatives considered**:
- Return 500 on any error — GitHub Actions treats it as failure, cron appears broken. But retrying on the next hour won't help for 410 Gone endpoints. Creates false noise.
- Return 207 Multi-Status — semantically interesting but uncommon for simple JSON endpoints, and `curl -f` still treats 2xx as success.

---

## R-004: UTC-to-IST Hour Matching Logic

**Decision**: Compute the current IST hour using deterministic UTC offset arithmetic, not locale-dependent date parsing.

**Implementation**:
```typescript
const now = new Date();
const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
const istMinutes = (utcMinutes + 330) % 1440; // IST = UTC + 5h30m = 330 minutes
const currentISTHour = Math.floor(istMinutes / 60);
```

**Matching rule**: `subscription.delivery_hour === currentISTHour`. Since cron runs at minute 0 of each UTC hour:

| UTC Time | utcMinutes | istMinutes | istHour | IST Time | Matches delivery_hour |
|----------|-----------|------------|---------|----------|----------------------|
| 02:00    | 120       | 450        | 7       | 07:30    | 7                    |
| 03:00    | 180       | 510        | 8       | 08:30    | 8                    |
| 18:00    | 1080      | 1410       | 23      | 23:30    | 23                   |
| 23:00    | 1380      | 270        | 4       | 04:30+1  | 4                    |

A user setting delivery_hour=8 (wanting a push around 8 AM IST) will receive it when the 3:00 UTC cron fires, which is 8:30 IST. This is within the spec's 60-minute match window and acceptable for a "morning summary" use case.

**Why not `toLocaleString`**: The `new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })` approach requires parsing a locale-formatted string back into date components. This is fragile — the output format varies across runtimes and Node.js versions. Direct arithmetic on the fixed UTC offset is deterministic, has no locale/runtime dependency, and is trivially verifiable.

**Edge cases verified**:
- Day boundary (18:30 UTC → midnight IST): `(1110 + 330) % 1440 = 0` → istHour = 0. Correct.
- Late night (23:00 UTC → 4:30 IST next day): `(1380 + 330) % 1440 = 270` → istHour = 4. Correct.
- Midnight UTC (00:00 → 5:30 IST): `(0 + 330) % 1440 = 330` → istHour = 5. Correct.

**Alternatives considered**:
- `Intl.DateTimeFormat` with `hour` field and `timeZone: 'Asia/Kolkata'` — cleaner API but requires `formatToParts()` parsing, which still has runtime variability.
- Hardcoded lookup table mapping UTC hours to IST hours — fragile, doesn't account for the :30 offset correctly since IST doesn't align to whole UTC hours.

---

## R-005: Service Worker Update Strategy

**Decision**: Maintain the existing `skipWaiting()` + `clients.claim()` pattern. Push handlers are purely additive — no changes to install/activate/fetch handlers.

**Rationale**: The current sw.js (13 lines) already calls `self.skipWaiting()` on install and `self.clients.claim()` on activate. This means:
- New SW code activates immediately when installed (no waiting for existing tabs to close)
- The new SW claims all open pages (they start using it right away)
- Push events are handled by the new SW as soon as it activates

The push and notificationclick event listeners are separate event types from fetch — they don't interfere with the existing pass-through fetch handler. The existing install/activate handlers remain byte-for-byte identical.

**Scope**: sw.js is registered from the root (`/sw.js`), giving it scope over the entire origin. No scope changes are needed.

**Update propagation**: When the user loads any page, the browser checks for sw.js file changes (byte comparison). If the file has changed (push handlers added), the browser installs the new SW. `skipWaiting()` in the install handler activates it immediately. On the next navigation or refresh, the new SW is fully active and ready to receive push events.

**Alternatives considered**:
- Remove `skipWaiting()` and use a manual "Update available" prompt — more cautious but unnecessary for this additive change. Would delay push notification readiness.
- Cache-versioned SW — not applicable since we're not caching any assets. The SW is purely a push handler.

---

## R-006: ESLint Strategy for api/notify.ts

**Decision**: Add `api/` to `globalIgnores` in eslint.config.js.

**Rationale**: The current eslint config applies three rulesets that are browser/React-specific:
- `globals.browser` (line 18) — api/notify.ts runs in Node.js
- `reactHooks.configs.flat.recommended` (line 15) — api/notify.ts has no React code
- `reactRefresh.configs.vite` (line 16) — api/notify.ts isn't a Vite module

Creating a separate eslint config block for `api/**/*.ts` with `globals.node` and without React plugins would be correct but is over-engineered for a single ~150-line file. Adding `api/` to `globalIgnores` is a one-line change.

TypeScript compilation (via Vercel's build system) catches type errors in the function. Manual review catches logic issues.

**Alternatives considered**:
- Separate eslint config override for `api/**/*.ts` with `globals.node` — technically correct but adds 10+ lines of config for one file.
- Inline `// eslint-disable` at the top of api/notify.ts — works but less discoverable than the global config.
- No change (let eslint try to lint it with browser globals) — would produce false positives about undefined `process`, `Buffer`, etc.

---

## R-007: PushSubscriptions Tab Bootstrap Strategy

**Decision**: Add PushSubscriptions to both `TAB_NAMES` and `HEADER_DEFINITIONS` in schema.ts. Add `ensurePushSubscriptionsTab()` in pushSubscriptionsService.ts for existing users.

**Rationale**:
- **New users**: When `createSpreadsheet` runs during initial bootstrap, it creates all tabs from `TAB_NAMES`, now including PushSubscriptions (10 tabs total). Headers are written for all tabs via `HEADER_DEFINITIONS`. The tab is ready before the user ever visits Notifications.
- **Existing users**: Their spreadsheet was created with 9 tabs (before PushSubscriptions existed). The main `bootstrap()` function detects their complete setup (`headersWritten=true`, `seedDataWritten=true`, `configWritten=true`) and returns early (bootstrapService.ts line 194–219) without running any creation steps. The PushSubscriptions tab doesn't exist, but no one touches it during bootstrap.
- **Lazy creation**: When the user first visits `/settings/notifications`, `NotificationsPage` calls `ensurePushSubscriptionsTab()`. This function detects the missing tab, creates it via `addSheet`, and writes headers. From that point on, the tab is available.

**ensurePushSubscriptionsTab logic**:
1. Try `readValues(token, ssId, "'PushSubscriptions'!A1:L1")`
2. Success with data → tab exists and has a header row → return (do nothing)
3. Success with empty/null data → tab exists but no header row → call `writeHeaders` for PushSubscriptions definition only
4. Catch `GoogleApiRequestError` with status 400 ("Unable to parse range") → tab doesn't exist → call `addSheet(token, ssId, 'PushSubscriptions')`, then call `writeHeaders` for PushSubscriptions definition only
5. Any other error → rethrow (let caller handle)

**If tab exists with wrong columns**: Log `console.warn('PushSubscriptions tab has unexpected headers')` and proceed without modification. Don't attempt auto-migration. The subscription CRUD functions use column indices to read/write values, so mismatched headers would cause data misalignment — but this is a rare manual-fix scenario rather than something we auto-correct.

**Alternatives considered**:
- Keep PushSubscriptions out of TAB_NAMES/HEADER_DEFINITIONS entirely — requires writing custom readAllRows/updateRow equivalents in pushSubscriptionsService since the generic versions look up HEADER_DEFINITIONS. More code for the same result.
- Modify bootstrapService to detect and create missing tabs — risky change to a proven bootstrap flow, affects all users, not just push notification users.
- Only add to HEADER_DEFINITIONS (not TAB_NAMES) — `createSpreadsheet` uses TAB_NAMES for tab creation, so the tab wouldn't be created for new users, then `writeHeaders` would fail trying to write to a non-existent tab. Inconsistent.

---

## R-008: TypeScript Configuration for api/ Directory

**Decision**: Do not create a separate tsconfig for the api/ directory at this stage. Let Vercel handle TypeScript compilation at deploy time. Revisit if IDE support becomes problematic.

**Rationale**: Vercel's build system compiles TypeScript files in the `api/` directory using its own default TypeScript configuration (targeting Node.js 18+ with ESM support). No `tsconfig` file is needed for deployment.

The existing tsconfig setup:
- `tsconfig.app.json` covers `src/` with browser libs and JSX
- `tsconfig.node.json` covers `vite.config.ts` with Node.js libs
- Neither is appropriate for `api/` (which needs Node.js libs without browser DOM or JSX)

For local development, `vercel dev` handles compilation and hot-reload. VSCode provides basic TypeScript IntelliSense for the file even without a dedicated tsconfig.

If IDE red squiggles become an issue during development, add a minimal `tsconfig.api.json` and reference it from the root `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "es2023",
    "lib": ["ES2023"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "types": ["node"],
    "skipLibCheck": true,
    "noEmit": true,
    "esModuleInterop": true
  },
  "include": ["api"]
}
```

**Alternatives considered**:
- Create `tsconfig.api.json` immediately — premature optimization. Vercel handles compilation, and we can add it if needed.
- Add `api/` to `tsconfig.node.json`'s `include` — conflates Vite config with serverless functions. Better to keep them separate if/when a tsconfig is needed.
