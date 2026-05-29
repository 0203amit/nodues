# Quickstart: Activity Log

**Feature**: Activity Log (Phase 9) | **Date**: 2026-05-29

## Prerequisites

- Phases 1–8 complete (sign-in, bootstrap, properties, bill types, bills, attachments, calendar reminders, postpone, to-dos)
- ActivityLog sheet tab exists with headers: `id, timestamp, user_email, action, entity_type, entity_id, summary` (created during bootstrap Phase 2)
- Branch: `009-activity-log`

## Implementation Order

### Chunk 1: Write Side (types + service + integration)

**Step 1**: Add types to `src/types/index.ts`

Append at end of file:
```typescript
// --- Activity Log Types ---
export type ActionType = 'bill_added' | 'bill_updated' | ... ; // all 26 members
export type ActivityEntityType = 'bill' | 'todo' | 'property' | 'billtype' | 'category';
export interface ActivityLogEntry { _rowIndex, id, timestamp, userEmail, action, entityType, entityId, summary }
```

**Step 2**: Create `src/services/activityLogService.ts`

Mirror `postponeLogService.ts`:
1. Derive `COL` from `HEADER_DEFINITIONS` for `'ActivityLog'` tab
2. `parseRow(row)` → `ActivityLogEntry | null` (null if no id)
3. `serializeRow(entry)` → `string[]` in column order
4. `fetchActivityLog(accessToken, spreadsheetId)` → parse + sort by timestamp desc
5. `appendActivityLog(accessToken, spreadsheetId, entry)` → serialize + `appendRows`
6. `appendActivityLogSafe(...)` → try/catch wrapper with `console.warn`
7. `formatShortDate(dateStr)` → "5 Jun" (no year) for postpone summaries

**Step 3**: Integrate into all 5 pages

For each page, add imports:
```typescript
import { v4 as uuidv4 } from 'uuid';
import { appendActivityLogSafe } from '../services/activityLogService';
```

Then add `await appendActivityLogSafe(...)` calls at each handler endpoint (AFTER critical-path write + calendar best-effort). See `plan.md` Layer 5 for exact placement and summary expressions at each of the 25 call sites.

**Key patterns**:
- Properties/BillTypes/Categories: capture `addEntity` return value (`const newEntity = await addProperty(...)`)
- Bills: use `btInfo?.name`, `btInfo?.propertyName`, `formatMonth`, `formatCurrency`
- Todos: use `todo.title`, `formatDueDate`, `formatShortDate` for postpone
- Postpone summaries: `formatShortDate(fromDate) → formatDueDate(toDate)`

**Verify**: `npx tsc --noEmit` — compile clean.

### Chunk 2: Read Side (viewer page + utility + settings card + route)

**Step 4**: Create `src/utils/relativeTime.ts`

Single export: `formatRelativeTime(isoTimestamp: string, now?: Date): string`

Boundaries: < 60s → "Just now", 1-59 min → "N minutes ago", 1-23 hr → "N hours ago", 1 day → "Yesterday", 2-7 days → "N days ago", > 7 days → formatted date.

**Step 5**: Create `src/pages/ActivityLogPage.tsx`

Mirror `PropertiesPage.tsx` shell. Module-level constants for `ACTION_LABELS` and `ENTITY_ICONS`. Fetch on mount, cap at 100 entries, display with entity icon + label + summary + relative time. Empty state with History icon.

**Step 6**: Add Settings card to `src/pages/SettingsPage.tsx`

In `CARDS` array, after Categories, before Notifications:
```typescript
{ label: 'Activity Log', description: 'View recent actions', icon: History, to: '/settings/activity-log' }
```

Import `History` from `lucide-react`.

**Step 7**: Add route to `src/App.tsx`

```tsx
import ActivityLogPage from './pages/ActivityLogPage';
// Inside BootstrapLayout routes:
<Route path="/settings/activity-log" element={<ProtectedRoute><ActivityLogPage /></ProtectedRoute>} />
```

**Verify**: Browser — Settings → Activity Log → see entries from Chunk 1.

## Key Files Reference

| File | Role |
|---|---|
| `src/services/postponeLogService.ts` | Template for activityLogService |
| `src/pages/PropertiesPage.tsx` | Template for ActivityLogPage shell |
| `src/services/calendarReminders.ts` | `formatDueDate` reused for summaries |
| `src/services/billsService.ts` | `formatMonth`, `formatCurrency` reused for summaries |
| `src/config/schema.ts` | `HEADER_DEFINITIONS` → ActivityLog column order |

## Common Pitfalls

1. **Don't forget to capture add return values**: `addProperty`, `addBillType`, `addCategory` return the new entity. Capture it to get `id` for `entityId`.
2. **todo_recurrence_created uses the NEW todo's id**: Not the parent's. The call goes inside the `if (nextTodo)` block, referencing `nextTodo.id`.
3. **Postpone summary date format**: `fromDay` has no year ("5 Jun"), `toDay` has year ("12 Jun 2026").
4. **bill_paid amount is conditional**: Only append ` · ₹1,100` when `amount !== null`.
5. **Activity log fires AFTER calendar**: The ordering is critical-path → calendar → activity log. Place `appendActivityLogSafe` calls after all calendar work resolves.
6. **Never show a toast for activity log failures**: `appendActivityLogSafe` handles this — it catches and warns silently.
