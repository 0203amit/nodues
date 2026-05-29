# Quickstart: Dashboard

**Feature**: Dashboard (Phase 10)
**Date**: 2026-05-29

---

## Prerequisites

- Node.js 18+, npm
- Phases 1–9 complete (sign-in, bootstrapping, properties, bill types, bills, attachments, calendar, postpone, todos, activity log)
- Branch: `010-dashboard`

## Dev Server

```bash
npm run dev
```

## Build Check

```bash
npm run build
```

## Files to Create

| File | Purpose |
|---|---|
| `src/utils/activityLabels.ts` | Shared `ACTION_LABELS` and `ENTITY_ICONS` constants |
| `src/components/shared/ActivityRow.tsx` | Shared activity entry row component |

## Files to Modify

| File | Changes |
|---|---|
| `src/types/index.ts` | Add `PropertyMoneySummary`, `MoneyThisMonth`, `AttentionItem` |
| `src/pages/ActivityLogPage.tsx` | Import from `activityLabels.ts`, use `ActivityRow`, remove inline constants |
| `src/pages/DashboardPage.tsx` | Full rewrite — three sections, data loading, refresh |
| `src/App.tsx` | Root route renders DashboardPage; remove `/dashboard` route |
| `src/components/shared/Navbar.tsx` | Dashboard link → `to="/"`, brand → `to="/"`, add `end` prop |
| `src/pages/BillsPage.tsx` | Read URL search params, focusedId state, highlight effect |
| `src/pages/TodosPage.tsx` | registerTodoRef, read URL search params, focusedId, highlight |
| `src/components/todos/TodoCard.tsx` | Convert to `forwardRef` |

## Implementation Order (3 Chunks)

### Chunk 1: Foundation
1. Add new types to `src/types/index.ts`
2. Create `src/utils/activityLabels.ts`
3. Create `src/components/shared/ActivityRow.tsx`
4. Update `ActivityLogPage.tsx` to use shared module
5. Update `App.tsx` routing
6. Update `Navbar.tsx` links
7. Run `npm run build` — verify clean compile

### Chunk 2: Clickthrough Support
1. Convert `TodoCard.tsx` to `forwardRef`
2. Add `registerTodoRef` to `TodosPage.tsx`
3. Add URL search param reading + filter application to `BillsPage.tsx`
4. Add URL search param reading + filter application to `TodosPage.tsx`
5. Add `focusedId` state and `isFocused` prop to both pages
6. Add highlight effect (ring-2 ring-indigo-300) with 1.5s timeout
7. Test: navigate to `/bills?focus=<billId>` manually

### Chunk 3: DashboardPage
1. Implement data loading (two-phase Promise.allSettled)
2. Implement Money This Month section
3. Implement Needs Attention section
4. Implement Recent Activity section
5. Implement Refresh button + auto-refresh on visibility change
6. End-to-end test: sign in → dashboard → click overdue → clickthrough

## Manual Testing

1. Sign in → should land on `/` with Dashboard content
2. Verify Money This Month shows correct sums for current month
3. Verify Needs Attention shows overdue items sorted oldest-first
4. Click an overdue bill → should navigate to BillsPage with filters + highlight
5. Click an overdue todo → should navigate to TodosPage with filters + highlight
6. Click Refresh → data reloads with spinning icon
7. Navigate away, wait 30+ seconds, return → auto-refresh fires
8. Verify Navbar Dashboard link shows active state on `/`
9. Verify `/dashboard` no longer routes (404 or no content)
