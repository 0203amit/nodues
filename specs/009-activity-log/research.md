# Research: Activity Log

**Feature**: Activity Log (Phase 9) | **Date**: 2026-05-29

## R-001: Best-Effort Wrapping Strategy

**Decision**: `appendActivityLogSafe()` — a wrapper function inside `activityLogService.ts` that catches and warns.

**Rationale**: Three options were evaluated:
- **(a) Duplicate try/catch at every call site**: Honest but produces ~25 nearly identical try/catch blocks across 5 pages. Increases code bulk without adding clarity.
- **(b) `useActivityLog()` hook returning `logActivity(...)`**: Clean API, but requires React context. The hook would close over `accessToken` and `spreadsheetId`, but these are already available at every call site. The hook adds a layer of indirection for no real benefit.
- **(c) `appendActivityLogSafe()` in the service**: Puts the try/catch once in the service layer. Call sites just call `await appendActivityLogSafe(...)` without any wrapping. Minimal API surface. No React dependency. Matches the "service handles its own concerns" pattern.

**Alternatives rejected**: (a) and (b) above. Option (c) is cleanest — each call site is a single `await` statement.

## R-002: Postpone Summary Date Formatting

**Decision**: Reuse `formatDueDate` from `calendarReminders.ts` for the `toDay` (includes year). Add a small `formatShortDate` helper in `activityLogService.ts` for the `fromDay` (no year).

**Rationale**: The spec requires postpone summaries like "5 Jun → 12 Jun 2026" — year only on the `toDay`. `formatDueDate` already produces "12 Jun 2026". A new `formatShortDate` producing "5 Jun" is a 3-line function. Importing `formatDueDate` from `calendarReminders.ts` is already done by `BillsPage` and `TodosPage`, so no new dependency.

**Alternative rejected**: Using `formatDueDate` for both sides and stripping the year from the `fromDay` — fragile string manipulation.

## R-003: relativeTime Utility Location

**Decision**: `src/utils/relativeTime.ts` — standalone module.

**Rationale**: The `formatRelativeTime` function is a pure utility with no React dependency. Placing it in `src/utils/` follows the project convention (the `utils` directory doesn't exist yet but is a standard location). It allows deterministic testing via the `now` parameter and potential reuse by the Phase 10 Dashboard widget.

**Alternative rejected**: Inlining in `ActivityLogPage.tsx` — acceptable but less testable and less reusable.

## R-004: relativeTime Implementation Approach

**Decision**: Custom function (not `Intl.RelativeTimeFormat`).

**Rationale**: `Intl.RelativeTimeFormat` requires the caller to compute the unit and value upfront — it doesn't do boundary detection. The custom function handles boundary logic ("Just now" for < 60s, singular/plural for minutes/hours, "Yesterday" special case) in ~20 lines. The spec's exact wording maps directly to the custom function's output.

**Alternative rejected**: `Intl.RelativeTimeFormat` — would still need the same boundary logic, plus adds locale complexity for no benefit in this single-locale app.

## R-005: ACTION_LABELS and ENTITY_ICONS Location

**Decision**: Module-level constants inside `ActivityLogPage.tsx`.

**Rationale**: Both maps are small (26 entries for labels, 5 entries for icons) and only consumed by the viewer page. Extracting them to a separate file adds a file for no reuse benefit. If Phase 10 Dashboard needs them, a 30-second move to a shared location suffices.

**Alternative rejected**: Placing in `activityLogService.ts` — mixes UI concerns (icon components) with service logic.

## R-006: Return Value Capture in Add Handlers

**Decision**: Capture the return value of `addProperty`, `addBillType`, and `addCategory` to access the new entity's `id` for the activity log.

**Rationale**: The existing add handlers in PropertiesPage, BillTypesPage, and CategoriesPage call `await addProperty(...)` etc. without capturing the return. The services DO return the new entity (verified in service code). Capturing is a one-word change (`const newProp = await addProperty(...)`) and provides the `id` needed for `entityId`.

**Alternative rejected**: Using a sentinel or refetching to find the new entity by name — unnecessarily complex.

## R-007: bill_paid Summary — Amount Formatting

**Decision**: Use `formatCurrency` from `billsService.ts` (already imported in BillsPage). Conditionally include the amount: if `amount !== null`, append ` · ₹1,100`; otherwise omit.

**Rationale**: `formatCurrency` already uses `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })` per MASTER.md. The spec says empty amount omits the ₹ suffix.

## R-008: ActivityLogPage Entry Row Design

**Decision**: Two-row card layout per entry. First row: icon + label + relative time (right-aligned). Second row: summary text (indented under label). Each entry is a `<div>` with `py-3` and `border-b border-slate-100` separator (not a card with shadow — too heavy for a dense list).

**Rationale**: A flat list with subtle separators is more scannable than individual cards for a dense log. The icon provides entity-type context at a glance. Label and time are on the first line for quick scanning. Summary wraps on the second line for context.
