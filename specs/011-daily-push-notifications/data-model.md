# Data Model: Daily Push Notifications

**Feature**: Daily Push Notifications (Phase 11)
**Date**: 2026-05-31

---

## New Sheet Tab: PushSubscriptions

### Schema

| Column | Sheet Header | TypeScript Field | Type | Description |
|--------|-------------|-----------------|------|-------------|
| A | id | id | string (UUID) | Unique row identifier |
| B | user_email | userEmail | string | Who the subscription belongs to (hardcoded `'user'` in v1) |
| C | endpoint | endpoint | string (URL) | Push service endpoint URL (~200 chars) |
| D | p256dh_key | p256dhKey | string (base64) | Public encryption key from browser PushSubscription |
| E | auth_key | authKey | string (base64) | Auth secret from browser PushSubscription |
| F | delivery_hour | deliveryHour | number (0–23) | Hour to send push (in user's local timezone, IST) |
| G | delivery_minute | deliveryMinute | number (0–59) | Minute (default 0; approximate due to hourly cron) |
| H | timezone | timezone | string | IANA timezone (`"Asia/Kolkata"` hardcoded for v1) |
| I | enabled | enabled | boolean | Whether subscription is active (stored as `"TRUE"` / `"FALSE"`) |
| J | created_at | createdAt | string (ISO 8601) | When the subscription was created |
| K | last_pushed_at | lastPushedAt | string (ISO 8601 or `""`) | Last successful push time (for idempotency check) |
| L | deleted_at | deletedAt | string (ISO 8601 or `""`) | Soft-delete marker |

### Header Definition (added to `src/config/schema.ts`)

```typescript
{
  tabName: 'PushSubscriptions',
  headers: [
    'id', 'user_email', 'endpoint', 'p256dh_key', 'auth_key',
    'delivery_hour', 'delivery_minute', 'timezone', 'enabled',
    'created_at', 'last_pushed_at', 'deleted_at',
  ],
}
```

### Column Index Constants (used in pushSubscriptionsService.ts)

```typescript
const COL = {
  ID: 0,
  USER_EMAIL: 1,
  ENDPOINT: 2,
  P256DH_KEY: 3,
  AUTH_KEY: 4,
  DELIVERY_HOUR: 5,
  DELIVERY_MINUTE: 6,
  TIMEZONE: 7,
  ENABLED: 8,
  CREATED_AT: 9,
  LAST_PUSHED_AT: 10,
  DELETED_AT: 11,
} as const;
```

---

## New Types (added to `src/types/index.ts`)

### PushSubscription

Represents a browser push subscription row from the PushSubscriptions sheet tab.

| Field | Type | Description |
|---|---|---|
| `_rowIndex` | `number` | 1-based Sheet row index for targeting updates |
| `id` | `string` | UUID |
| `userEmail` | `string` | Always `'user'` in v1 |
| `endpoint` | `string` | Push service endpoint URL |
| `p256dhKey` | `string` | Base64-encoded P-256 public key |
| `authKey` | `string` | Base64-encoded auth secret |
| `deliveryHour` | `number` | 0–23, default 8 |
| `deliveryMinute` | `number` | 0–59, default 0 |
| `timezone` | `string` | IANA timezone string |
| `enabled` | `boolean` | Active flag |
| `createdAt` | `string` | ISO 8601 timestamp |
| `lastPushedAt` | `string` | ISO 8601 timestamp or empty string |
| `deletedAt` | `string` | ISO 8601 timestamp or empty string |

```typescript
export interface PushSubscription {
  _rowIndex: number;
  id: string;
  userEmail: string;
  endpoint: string;
  p256dhKey: string;
  authKey: string;
  deliveryHour: number;
  deliveryMinute: number;
  timezone: string;
  enabled: boolean;
  createdAt: string;
  lastPushedAt: string;
  deletedAt: string;
}
```

### Extended ActionType

```typescript
// Existing union (lines 307–313) extended with:
| 'push_enabled' | 'push_disabled'
```

### Extended ActivityEntityType

```typescript
// Existing union (line 315) extended with:
| 'push_subscription'
```

---

## Extended Constants

### ACTION_LABELS additions (in `src/utils/activityLabels.ts`)

```typescript
push_enabled: 'Push enabled',
push_disabled: 'Push disabled',
```

### ENTITY_ICONS addition (in `src/utils/activityLabels.ts`)

```typescript
import { Bell } from 'lucide-react';
// ...
push_subscription: Bell,
```

---

## Existing Types (used, not modified)

| Type | Source | Used By |
|---|---|---|
| `BillWithDisplay` | `src/types/index.ts` | api/notify.ts (overdue computation) |
| `BillDisplayStatus` | `src/types/index.ts` | api/notify.ts (overdue filter) |
| `BillType` | `src/types/index.ts` | api/notify.ts (bill type name + property lookup) |
| `Property` | `src/types/index.ts` | api/notify.ts (property name lookup) |
| `TodoWithDisplay` | `src/types/index.ts` | api/notify.ts (overdue computation) |
| `TodoDisplayStatus` | `src/types/index.ts` | api/notify.ts (overdue filter) |
| `ActivityLogEntry` | `src/types/index.ts` | Activity logging for push_enabled/disabled |
| `RowWithIndex` | `src/types/index.ts` | pushSubscriptionsService row parsing |
| `HeaderDefinition` | `src/config/schema.ts` | PushSubscriptions header definition |

---

## Data Flow Diagrams

### Client-Side: Enable Push Notifications

```
User toggles "Enable" ON
  |
  +-- Notification.requestPermission()
  |     +-- "granted" ----------------------------------------+
  |     +-- "denied" -> show guidance message, revert toggle  |
  |     +-- "default" -> user dismissed prompt, revert        |
  |                                                            |
  +-- registration.pushManager.subscribe({                     |
  |     userVisibleOnly: true,                                 |
  |     applicationServerKey: VITE_VAPID_PUBLIC_KEY            |
  |   })                                                       |
  |   -> PushSubscription { endpoint, keys: { p256dh, auth } }|
  |                                                            |
  +-- pushSubscriptionsService.createPushSubscription()        |
  |   -> appendRows to PushSubscriptions tab                   |
  |                                                            |
  +-- activityLogService.logActivity('push_enabled',           |
        'push_subscription', subscriptionId)                   |
```

### Client-Side: Disable Push Notifications

```
User toggles "Disable" OFF
  |
  +-- pushSubscription.unsubscribe()
  |   -> browser unsubscribes from push service
  |
  +-- pushSubscriptionsService.softDeletePushSubscription()
  |   -> set deleted_at column on the Sheet row
  |
  +-- activityLogService.logActivity('push_disabled',
        'push_subscription', subscriptionId)
```

### Server-Side: Cron Notification Flow

```
GitHub Actions cron (hourly at :00 UTC)
  |
  +-- POST /api/notify
  |   Header: Authorization: Bearer CRON_SECRET
  |
  +-- api/notify.ts handler
      |
      +-- Verify CRON_SECRET --- 401 if missing/invalid
      |
      +-- Authenticate Service Account (google-auth-library)
      |   -> JWT -> access_token for Sheets API
      |
      +-- Read PushSubscriptions tab from NODUES_SHEET_ID
      |   Filter: enabled="TRUE", deleted_at="",
      |           delivery_hour = currentISTHour
      |   Idempotency: skip where last_pushed_at < 23 hours ago
      |
      +-- Read Bills + BillTypes + Properties + Todos tabs
      |   Compute display status for each item
      |   Filter to overdue items only (exclude soft-deleted)
      |
      +-- If 0 overdue items -> skip all pushes (no "all clear")
      |
      +-- Build notification body:
      |   "N overdue: {item1}, {item2}, {item3}... and M more"
      |   Bills: "{billTypeName} -- {propertyName}"
      |   Todos: "{title}"
      |
      +-- For each matching subscription:
      |   +-- webpush.sendNotification(sub, payload)
      |   +-- On success -> update last_pushed_at cell
      |   +-- On 410 Gone -> soft-delete row (set deleted_at)
      |   +-- On other error -> log to errors[]
      |
      +-- Return 200 {
           subscriptionsChecked,
           pushesSent,
           pushesSkipped,
           errors
         }
```

### Service Worker: Push Event Handling

```
Push service delivers message to browser
  |
  +-- sw.js 'push' event listener
      |
      +-- Parse event.data.json() -> { title, body }
      |
      +-- self.registration.showNotification(title, {
           body,
           icon: '/icons/icon-192x192.png',
           badge: '/icons/icon-192x192.png',
           tag: 'nodues-daily-overdue'
         })

User taps the notification
  |
  +-- sw.js 'notificationclick' event listener
      |
      +-- event.notification.close()
      |
      +-- clients.matchAll({ type: 'window', includeUncontrolled: true })
          +-- existing window found -> window.focus()
          +-- no window -> clients.openWindow('/')
```

---

## Notification Payload Schema

The JSON payload sent via web-push to the service worker:

```typescript
interface NotificationPayload {
  title: string;  // Always "NoDues"
  body: string;   // "N overdue: item1, item2, item3... and M more"
}
```

**Body format examples**:
- 1 item: `"1 overdue: Maintenance — Mira Flat"`
- 3 items: `"3 overdue: Maintenance — Mira Flat, Property Tax — Mira Shop, Renew insurance"`
- 5 items: `"5 overdue: Maintenance — Mira Flat, Property Tax — Mira Shop, Renew insurance... and 2 more"`

**Item description format**:
- Bills: `"{billTypeName} — {propertyName}"`
- Todos: `"{title}"`

---

## Environment Variables

| Variable | Scope | Type | Description |
|----------|-------|------|-------------|
| `VAPID_PUBLIC_KEY` | Vercel server | string | VAPID public key for web-push signing |
| `VITE_VAPID_PUBLIC_KEY` | Vite client bundle | string | Same VAPID public key (via `import.meta.env.VITE_VAPID_PUBLIC_KEY`) |
| `VAPID_PRIVATE_KEY` | Vercel server only | string | VAPID private key (never exposed to client) |
| `VAPID_SUBJECT` | Vercel server only | string | Contact URI (`mailto:` or `https://`) for VAPID identity |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Vercel server only | JSON string | Stringified service account credentials JSON |
| `NODUES_SHEET_ID` | Vercel server only | string | Spreadsheet ID for the single-user v1 sheet |
| `CRON_SECRET` | Vercel + GitHub Actions | string | Shared secret for cron auth (~32 hex chars) |
| `VERCEL_NOTIFY_URL` | GitHub Actions variable | URL string | Full endpoint URL (e.g., `https://nodues-virid.vercel.app/api/notify`) |

---

## Row Parsing Pattern (pushSubscriptionsService.ts)

Following the existing pattern from billsService/todosService, each row from `readAllRows` is parsed:

```typescript
function parsePushSubscription(row: RowWithIndex): PushSubscription {
  const v = row.values;
  return {
    _rowIndex: row.rowIndex,
    id: v[0],
    userEmail: v[1],
    endpoint: v[2],
    p256dhKey: v[3],
    authKey: v[4],
    deliveryHour: parseInt(v[5], 10) || 8,
    deliveryMinute: parseInt(v[6], 10) || 0,
    timezone: v[7] || 'Asia/Kolkata',
    enabled: v[8] === 'TRUE',
    createdAt: v[9],
    lastPushedAt: v[10] || '',
    deletedAt: v[11] || '',
  };
}
```
