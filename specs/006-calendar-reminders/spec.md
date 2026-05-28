# Feature Specification: Calendar Reminders for Bills

**Feature Branch**: `006-calendar-reminders`

**Created**: 2026-05-28

**Status**: Draft

**Input**: User description: "Calendar Reminders for Bills — create/update/delete Google Calendar reminder events from bill due dates (Phase 6 of the Build Order). When a bill has a due date, create one all-day Google Calendar event per reminder offset from the bill type's reminder_offsets_days on the 'NoDues Reminders' calendar. Events are managed automatically as a side effect of bill add/edit/mark-paid/delete. Best-effort: a bill must never fail to save because a calendar operation failed."

## Clarifications

**Q1: All-day events vs timed events?**
All-day events. The main project spec mentions "popup notification at event start time", which implies timed events. However, since the app doesn't collect a specific time-of-day for due dates (only dates), all-day events are the correct choice. Google Calendar's default reminder settings for all-day events will trigger a notification (typically the evening before or morning of the event day), which is sufficient for bill reminders. The user's phone will surface these via the standard Google Calendar notification tray.

**Q2: Event title format?**
The main spec suggests `[Pending] <Property> <BillType> — <Month Year>`. This feature uses a simplified variant: `{BillTypeName} — {PropertyName} due {formatted due date}` (e.g., "Maintenance — Mira Flat due 5 Jun 2026"). The "[Pending]" prefix is omitted because all reminder events are inherently for pending bills — once paid, events are deleted. The description body includes the amount if known.

**Q3: Undo-delete behavior — recreate events or leave none?**
Recreate. When a soft-deleted bill is restored via undo, reminder events are recreated from the bill's due date and bill type offsets. Rationale: the user undid the delete because they want the bill active again; leaving it without reminders would silently degrade the experience. The recreation is best-effort (same as initial creation).

**Q4: Calendar ID source — setupResult or Config tab read?**
`setupResult.calendarId` from `useBootstrap()`. The bootstrap flow already reads the Config tab's `calendar_id` key during detection and returns it in `SetupResult`. No additional Config read is needed. This is confirmed by `bootstrapService.ts` which stores `calendar_id` in Config and returns `calendarId` in `SetupResult`.

**Q5: Empty reminder_offsets_days — create a due-date event or no events?**
No events. If a bill type has no `reminder_offsets_days` (empty array), no calendar events are created. The offsets are the sole driver of event creation. A bill type with no offsets explicitly means "no reminders wanted for this bill type."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reminder events created when a bill is added with a due date (Priority: P1)

The owner adds a new bill for a bill type that has `reminder_offsets_days` configured (e.g., "7,3,1"). The bill has a due date. Upon saving the bill, the system automatically creates one all-day Google Calendar event for each reminder offset on the "NoDues Reminders" calendar — 7 days before due, 3 days before due, and 1 day before due. The event IDs are stored in the bill's `calendar_event_ids` column.

**Why this priority**: Creating reminder events is the core purpose of this feature. Without this, no reminders exist.

**Independent Test**: Add a new bill for a bill type with offsets "7,3,1" and a due date of 2026-06-15. Verify that 3 events appear on the "NoDues Reminders" Google Calendar on June 8, June 12, and June 14. Verify that the bill's `calendar_event_ids` column in the Sheet contains 3 comma-separated event IDs.

**Acceptance Scenarios**:

1. **Given** a bill type with `reminder_offsets_days` = "7,3,1" and the owner adds a bill with due date 2026-06-15, **When** the bill is saved, **Then** 3 all-day events are created on the "NoDues Reminders" calendar on June 8, June 12, and June 14 respectively.
2. **Given** a bill type with `reminder_offsets_days` = "3,1" and the owner adds a bill with due date 2026-06-05, **When** the bill is saved, **Then** 2 all-day events are created on June 2 and June 4.
3. **Given** event creation succeeds, **Then** each event's title is "{BillTypeName} — {PropertyName} due {formatted due date}" (e.g., "Maintenance — Mira Flat due 5 Jun 2026"), and the description includes the amount if known (e.g., "Amount: Rs.1,100").
4. **Given** a bill with status `not_yet_generated` (no due date), **When** the bill is saved, **Then** no calendar events are created and `calendar_event_ids` remains empty.
5. **Given** a bill type with empty `reminder_offsets_days`, **When** a bill is added with a due date, **Then** no calendar events are created.
6. **Given** a reminder offset would produce a date in the past relative to today, **Then** the event is still created (Google Calendar allows past-date events; it simply won't fire a notification).
7. **Given** event creation fails (network error, API error), **Then** the bill is still saved successfully. A toast informs the owner: "Bill saved, but reminders couldn't be set." The `calendar_event_ids` column contains only the IDs of events that were successfully created (partial success is preserved).

---

### User Story 2 - Reminder events updated when a bill's due date changes (Priority: P1)

The owner edits a bill and changes its due date (or month, which changes the computed due date). The system deletes the old reminder events and creates new ones based on the new due date, then replaces the `calendar_event_ids` column with the new event IDs.

**Why this priority**: Due dates change frequently (e.g., a bill arrives late). Without updating reminders, the calendar events become stale and misleading.

**Independent Test**: Add a bill with due date June 15 (creates events). Edit the bill to change due date to June 20. Verify that the old events are gone from the calendar and new events appear on the dates computed from June 20. Verify `calendar_event_ids` in the Sheet contains only the new event IDs.

**Acceptance Scenarios**:

1. **Given** a bill with existing reminder events (3 event IDs in `calendar_event_ids`) and the owner changes the due date, **When** the edit is saved, **Then** the 3 old events are deleted from the calendar, 3 new events are created for the new due date, and `calendar_event_ids` is replaced with the new IDs.
2. **Given** a bill with status `not_yet_generated` (no due date, no events) and the owner edits it to add a due date, **When** the edit is saved, **Then** reminder events are created and `calendar_event_ids` is populated.
3. **Given** a bill with a due date and reminder events, and the owner edits it to remove the due date (reverts to `not_yet_generated`), **When** the edit is saved, **Then** existing events are deleted and `calendar_event_ids` is cleared.
4. **Given** the owner edits a bill but does NOT change the due date (only changes amount or notes), **Then** no calendar operations occur — existing events are left unchanged.
5. **Given** deleting old events partially fails (1 of 3 returns 404), **Then** the 404 is treated as already gone, the remaining deletions proceed, and new events are created normally.
6. **Given** creating new events fails after old events were deleted, **Then** the bill edit still saves. A toast notes "Bill updated, but reminders couldn't be set." `calendar_event_ids` contains only successfully created new event IDs (may be empty).

---

### User Story 3 - Reminder events deleted when a bill is marked paid (Priority: P1)

The owner marks a bill as paid. Future reminder events are noise for a paid bill, so the system deletes all reminder events for that bill and clears `calendar_event_ids`.

**Why this priority**: Paid bills should not trigger reminders. This is essential to avoid alert fatigue.

**Independent Test**: Add a bill with reminders. Mark it as paid. Verify that the events are gone from the calendar and `calendar_event_ids` is empty in the Sheet.

**Acceptance Scenarios**:

1. **Given** a bill with 3 reminder events in `calendar_event_ids`, **When** the owner marks it as paid, **Then** all 3 events are deleted from the calendar and `calendar_event_ids` is set to empty string.
2. **Given** a bill with no reminder events (empty `calendar_event_ids`), **When** it is marked paid, **Then** no calendar operations occur.
3. **Given** deleting events fails (network error), **Then** the bill is still marked as paid successfully. A toast notes "Bill marked paid, but calendar reminders couldn't be removed." The stale event IDs may remain in `calendar_event_ids` (they will be cleaned on next interaction or are harmless since the event dates have passed or will pass).
4. **Given** one event deletion returns 404 (event was manually deleted from Calendar), **Then** that ID is treated as already gone, other deletions proceed, and `calendar_event_ids` is cleared.

---

### User Story 4 - Reminder events deleted when a bill is soft-deleted; recreated on undo (Priority: P2)

The owner deletes a bill (soft-delete). The system deletes all reminder events and clears `calendar_event_ids`. If the owner taps "Undo" within the 10-second window, the bill is restored and reminder events are recreated from the bill's due date and bill type offsets.

**Why this priority**: Consistent cleanup on delete prevents orphaned calendar events. Undo recreation ensures restored bills behave identically to active bills.

**Independent Test**: Add a bill with reminders. Delete it. Verify events are gone. Tap undo. Verify events reappear on the calendar and `calendar_event_ids` is repopulated.

**Acceptance Scenarios**:

1. **Given** a bill with reminder events, **When** the owner deletes it, **Then** all events are deleted from the calendar and `calendar_event_ids` is cleared (as part of the soft-delete flow).
2. **Given** event deletion fails during soft-delete, **Then** the bill is still soft-deleted. A toast notes "Bill deleted, but calendar reminders couldn't be removed."
3. **Given** a soft-deleted bill is restored via undo, **When** the undo completes, **Then** the system recreates reminder events from the bill's due date and bill type offsets (same logic as initial creation). The new event IDs are stored in `calendar_event_ids`.
4. **Given** event recreation fails on undo, **Then** the bill is still restored. A toast notes "Bill restored, but reminders couldn't be recreated."
5. **Given** a bill had no reminder events before deletion (no due date or no offsets), **When** it is restored via undo, **Then** no events are created.

---

### User Story 5 - Bell indicator on BillCard for bills with active reminders (Priority: P2)

The BillCard shows a small bell icon when a bill has active calendar reminders (non-empty `calendar_event_ids`). This gives the owner a quick visual signal that reminders are set without opening any detail view.

**Why this priority**: A visual indicator improves at-a-glance awareness but is not required for the core reminder functionality to work.

**Independent Test**: Add bills with and without reminders. View the bills list. Verify that bills with non-empty `calendar_event_ids` show a bell icon; bills without do not.

**Acceptance Scenarios**:

1. **Given** a bill with non-empty `calendar_event_ids`, **When** it is displayed on the bills list, **Then** a Bell icon appears on the BillCard (in the actions row, near the existing Paperclip indicator).
2. **Given** a bill with empty `calendar_event_ids`, **Then** no bell icon is shown.
3. **Given** a bill's reminders are cleared (e.g., bill marked paid), **Then** the bell icon disappears from the BillCard after the state update.
4. **Given** the bell icon is displayed, **Then** it is non-interactive (no tap action — it is purely an indicator, not a button). It uses the Lucide `Bell` icon at the standard indicator size.

---

### User Story 6 - Graceful handling of calendar API failures (Priority: P2)

All calendar operations are best-effort. The bill's primary operation (add, edit, mark paid, delete) always succeeds even if the calendar API call fails. Errors are communicated via toast notifications.

**Why this priority**: Reliability of bill data is paramount. Calendar events are a convenience feature that must never block core data operations.

**Independent Test**: Simulate a network failure during bill creation. Verify the bill is saved correctly. Verify a toast appears explaining that reminders couldn't be set. Verify the UI remains usable.

**Acceptance Scenarios**:

1. **Given** any calendar API call fails (create, delete), **Then** the parent bill operation (add/edit/mark-paid/delete) completes successfully.
2. **Given** event creation partially succeeds (2 of 3 events created before a failure), **Then** the 2 successfully created event IDs are stored in `calendar_event_ids`. A toast notes the partial failure.
3. **Given** an event deletion returns 404 or 410 (event not found / gone), **Then** this is treated as a successful deletion — the event was already removed.
4. **Given** any calendar failure, **Then** a descriptive toast is shown (e.g., "Bill saved, but reminders couldn't be set") and the UI remains fully usable.
5. **Given** a 401 auth error during calendar operations, **Then** the error is not retried (consistent with `withRetry` behavior) and the toast advises the user to re-sign in if the issue persists.

---

### Edge Cases

- **Reminder offset produces a date before the bill's creation date**: The event is still created. Google Calendar handles past dates gracefully (no notification fires, but the event exists for reference).
- **Bill type offsets changed after bill creation**: Existing bills keep their current events. Only new bills or edited bills use the updated offsets. There is no bulk retroactive sync.
- **Multiple rapid edits to the same bill**: Each edit triggers delete-old + create-new. If edits overlap (unlikely in a single-user app), the last write wins for `calendar_event_ids`.
- **Very large offset (e.g., 365 days)**: The computed reminder date may fall far in the past or in a different year. This is acceptable — the event is created on the computed date regardless.
- **Due date on the same day as a reminder offset (offset = 0)**: The event is created on the due date itself. This is valid and expected (a "same-day reminder").
- **Stale event IDs in `calendar_event_ids`**: If the user manually deletes a calendar event via Google Calendar, the ID becomes stale. On the next bill edit or mark-paid, the delete call returns 404, which is silently treated as "already gone." The ID is cleaned from the column.
- **Bill type with no offsets created later (after bill already exists)**: Existing bills for that type won't retroactively gain reminders. Only new bills or edited bills consult the current offsets.
- **Token expiration mid-operation**: Calendar API calls via `withRetry` will fail on 401 (not retried). The bill operation succeeds; the toast notes the calendar failure.
- **Calendar not found (deleted externally)**: If the "NoDues Reminders" calendar was deleted from Google Calendar, event creation will fail with 404. The bill saves; the toast explains the failure. The user would need to re-bootstrap or manually recreate the calendar to restore reminder functionality.

## Requirements *(mandatory)*

### Functional Requirements

#### Service Layer — Calendar Event Operations

- **FR-001**: `calendarService.ts` MUST be extended with a function to create an all-day event on a specified calendar. The function accepts: access token, calendar ID, event date (YYYY-MM-DD), title (string), and description (string). It calls the Google Calendar API v3 events.insert endpoint (`POST /calendar/v3/calendars/{calendarId}/events`) with `start.date` and `end.date` set to the event date (single all-day event). It returns the created event's ID.
- **FR-002**: `calendarService.ts` MUST be extended with a function to delete a calendar event by ID. The function accepts: access token, calendar ID, and event ID. It calls `DELETE /calendar/v3/calendars/{calendarId}/events/{eventId}`. If the event is not found (404 or 410), the function succeeds silently (the event is already gone). Non-404/410 errors are propagated.
- **FR-003**: Both new calendar functions MUST use `withRetry` from `googleApi.ts` for retry with exponential backoff, consistent with existing calendar functions (`findCalendar`, `createCalendar`).
- **FR-004**: Both new calendar functions MUST use `googleApiFetch` from `googleApi.ts` for authenticated JSON requests, consistent with the existing pattern in `calendarService.ts`.

#### Service Layer — Reminder Orchestration

- **FR-005**: A reminder orchestration function MUST be provided that, given a bill's due date and the bill type's `reminder_offsets_days` array, computes the list of reminder dates (due date minus each offset in days) and creates one all-day calendar event per date. It returns the array of created event IDs.
- **FR-006**: The orchestration function MUST handle partial failures: if creating event 2 of 3 fails, event 1's ID is preserved. The function returns whatever event IDs were successfully created and indicates whether all events succeeded.
- **FR-007**: A cleanup function MUST be provided that, given a list of event IDs (from `calendar_event_ids`), deletes each event from the calendar. 404/410 responses are treated as already deleted. The function does not fail if some deletions fail — it cleans up as many as possible.

#### Service Layer — Bill calendar_event_ids Management

- **FR-008**: `billsService.ts` MUST be extended with helper functions for `calendar_event_ids` that mirror the `parseFileIds`/`serializeFileIds` pattern: `parseEventIds(csv)` returns `string[]` and `serializeEventIds(ids)` returns a comma-separated string. These may reuse or alias the existing `parseFileIds`/`serializeFileIds` functions since the format is identical.
- **FR-009**: `billsService.ts` MUST be extended with a function to replace a bill's `calendar_event_ids` with a new set of IDs using full-row-safety (spread existing bill, overwrite `calendarEventIds`, bump `updatedAt`, write full row via `updateRow`).
- **FR-010**: `billsService.ts` MUST be extended with a function to clear a bill's `calendar_event_ids` (set to empty string) using full-row-safety.

#### Integration with Bill Lifecycle

- **FR-011**: When a bill is added (`addBill`) with a due date and the bill type has non-empty `reminder_offsets_days`, reminder events MUST be created after the bill row is written. Event IDs MUST be stored in the bill's `calendar_event_ids` column. If event creation fails, the bill is still saved.
- **FR-012**: When a bill is edited (`updateBill`) and the due date has changed, the existing reminder events (from `calendar_event_ids`) MUST be deleted and new events created for the new due date. The `calendar_event_ids` column MUST be replaced with the new event IDs.
- **FR-013**: When a bill's due date is edited to empty (reverts to `not_yet_generated`), existing reminder events MUST be deleted and `calendar_event_ids` MUST be cleared.
- **FR-014**: When a bill is edited but the due date has NOT changed, no calendar operations occur.
- **FR-015**: When a bill is marked paid (`markBillPaid`), all reminder events MUST be deleted and `calendar_event_ids` MUST be cleared.
- **FR-016**: When a bill is soft-deleted (`softDeleteBill`), all reminder events MUST be deleted and `calendar_event_ids` MUST be cleared.
- **FR-017**: When a soft-deleted bill is restored via undo (`undoDeleteBill`), reminder events MUST be recreated from the bill's due date and the bill type's `reminder_offsets_days`. The new event IDs MUST be stored in `calendar_event_ids`.
- **FR-018**: All calendar operations in FR-011 through FR-017 are best-effort. If they fail, the primary bill operation (add/edit/mark-paid/delete/undo) MUST still complete. A toast notification MUST inform the owner of the calendar failure.

#### Calendar Event Content

- **FR-019**: Each reminder event MUST be an all-day event. The `start.date` and `end.date` fields use the computed reminder date in `YYYY-MM-DD` format (no time component).
- **FR-020**: Each reminder event's title MUST follow the format: `{BillTypeName} — {PropertyName} due {formatted due date}` where the due date is formatted as `D MMM YYYY` (e.g., "5 Jun 2026").
- **FR-021**: Each reminder event's description MUST include the bill amount if known (e.g., "Amount: Rs.1,100") and the bill month (e.g., "Month: Jun 2026"). If the amount is not set, only the month is included.
- **FR-022**: Reminder events MUST have a Google Calendar reminder (popup notification) configured on the event itself, using the Calendar API's `reminders.useDefault: false` and `reminders.overrides: [{ method: 'popup', minutes: 0 }]` to trigger a notification at the start of the event day.

#### Calendar ID Source

- **FR-023**: The "NoDues Reminders" calendar ID MUST be read from `setupResult.calendarId` (provided by `useBootstrap()`). No additional Config tab read is required.

#### BillCard Indicator

- **FR-024**: `BillCard` MUST display a Bell icon (Lucide `Bell`) when the bill's `calendar_event_ids` is non-empty. The icon appears in the actions/indicators area of the card, near the existing Paperclip attachment indicator.
- **FR-025**: The bell icon is a passive indicator (not a button). It does not trigger any action on tap. It uses the same sizing and color conventions as the Paperclip indicator (`w-4 h-4`, `text-slate-400`).
- **FR-026**: When `calendar_event_ids` is empty, no bell icon is shown.

#### Cross-Cutting

- **FR-027**: All calendar API calls MUST use `withRetry` for exponential backoff on retryable errors (429, 500, 502, 503) and MUST NOT retry auth errors (401) or permission errors (403), consistent with the existing `googleApi.ts` behavior.
- **FR-028**: All calendar event ID column updates MUST use the full-row-safety pattern (read-modify-write entire row) consistent with `updateBill`, `markBillPaid`, `addFileIdToBill`, and `removeFileIdFromBill`.
- **FR-029**: Toast messages for calendar failures MUST be `'error'` severity and MUST clearly distinguish the primary operation's success from the calendar side-effect's failure (e.g., "Bill saved, but reminders couldn't be set").
- **FR-030**: All new UI elements MUST follow MASTER.md: Lucide icons, slate neutrals, no emoji as icons, minimum 44px touch targets for interactive elements, visible focus rings, WCAG AA contrast.

### Non-Functional Requirements

- **NFR-001**: Calendar operations MUST NOT block or delay the bill save operation beyond the time needed for the calendar API calls. If calendar calls are slow, the bill is already persisted in the Sheet — the calendar update is a post-save side effect.
- **NFR-002**: All new service functions MUST follow the existing patterns in `calendarService.ts` and `googleApi.ts`: `withRetry` wrapper, `googleApiFetch` for JSON requests, `GoogleApiRequestError` for error classification.
- **NFR-003**: The bell indicator on `BillCard` MUST be responsive and render correctly at 375px width without displacing existing elements.
- **NFR-004**: New types (if any) MUST be defined in `src/types/index.ts` alongside existing types.

### Key Entities

- **Calendar Reminder Event**: An all-day Google Calendar event on the "NoDues Reminders" calendar, representing a reminder for an upcoming bill due date. Created at `due_date - offset_days` for each offset in the bill type's `reminder_offsets_days`. Contains the bill type name, property name, due date, and amount in its title and description.
- **calendar_event_ids**: A comma-separated string stored in the Bills Sheet column, containing the Google Calendar event IDs for all active reminder events associated with a bill. Managed via full-row-safety updates. Empty string when no reminders are active.
- **reminder_offsets_days**: A property of BillType, stored as a comma-separated string of integers (e.g., "7,3,1") in the Sheet and parsed to `number[]` in the TypeScript type. Each integer represents "N days before due date" when a reminder event should be created.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After adding a bill with a due date and a bill type with 3 reminder offsets, exactly 3 events appear on the "NoDues Reminders" Google Calendar on the correct dates, and the bill's `calendar_event_ids` column contains 3 event IDs.
- **SC-002**: After editing a bill's due date, the old events are removed from the calendar and new events appear on dates relative to the new due date. `calendar_event_ids` contains only the new IDs.
- **SC-003**: After marking a bill as paid, all associated reminder events are removed from the calendar and `calendar_event_ids` is empty.
- **SC-004**: After deleting a bill, its reminder events are removed. After undoing the delete, events are recreated on the correct dates.
- **SC-005**: A bill save (add/edit/mark-paid) always succeeds even when the Google Calendar API is unavailable. A toast informs the user that reminders could not be set.
- **SC-006**: Bills with active reminders show a bell icon on their card; bills without reminders show no bell icon.
- **SC-007**: Deleting an event that no longer exists in Google Calendar (404/410) does not cause errors — the stale ID is cleaned silently.
- **SC-008**: Partial event creation failures preserve the IDs of successfully created events in `calendar_event_ids`.

## Assumptions

- Phases 1-5 are complete: sign-in, bootstrapping (including "NoDues Reminders" calendar creation), Properties & Bill Types CRUD, Bills core loop, and file attachments all work on master.
- The `accessToken` from `useAuth()` has the Google Calendar scope granted during sign-in (the calendar scope was added in Phase 2 for calendar creation and is reused here for event management).
- The `calendarId` from `useBootstrap().setupResult` points to the existing "NoDues Reminders" calendar created during bootstrapping. The calendar exists and is accessible.
- The `calendar_event_ids` column already exists in the Bills tab (column index 12, 0-indexed) and is currently empty for all bills. It is preserved by full-row-safety in `updateBill` and `markBillPaid`.
- `BillType.reminderOffsetsDays` is already parsed as `number[]` in the TypeScript type (confirmed in `src/types/index.ts`).
- The Google Calendar API v3 events endpoints (`events.insert`, `events.delete`) are available and work with the user's access token.
- No concurrent-write protection is needed for `calendar_event_ids`. For a single-user household app, this is an acceptable trade-off.
- The Postpone feature (Phase 7) will handle its own calendar event updates. This phase's edit-triggered delete-and-recreate approach is correct for general due date edits but will be supplemented by Phase 7's in-place event update for postponements.
- The Google Calendar API's `events.delete` returns 404 for events that have already been deleted and 410 for events that have been permanently removed. Both are treated as "already gone."
