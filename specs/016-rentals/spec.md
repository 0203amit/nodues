# Feature Specification: Rentals

**Feature Branch**: `016-rentals`

**Created**: 2026-06-04

**Status**: Draft

**Input**: User description: "Rentals — tenant + rent collection tracking with monthly auto-generation (Phase 16 of NoDues)"

---

## User Scenarios & Testing

### User Story 1 — Manage Tenancies (Priority: P1)

The property owner navigates to the Rentals page (`/rentals`) and sees all non-deleted tenancies grouped by property. Each tenancy represents a tenant occupying a unit within a property. One property can have multiple active tenancies (e.g., "Chawl" with Room 1, Room 2, Room 3). The owner can add a new tenancy linked to an active property, specifying the tenant's name, an optional unit label (e.g., "Room 1", "Flat 3A", or left empty for single-unit properties), optional contact information (phone, email — v1 additions for future use), monthly rent amount, security deposit, the day of the month rent is due, lease start date, an optional lease end date, and notes. They can edit, toggle active/inactive, and soft-delete with undo.

**Why this priority**: Tenancies are the foundational entity for the entire Rentals module. Without tenancies, there are no rent collection records to generate or track.

**Independent Test**: Navigate to the Rentals page. Add a tenancy for "Chawl" with unit label "Room 1", tenant name "Ramesh", rent ₹5,000, due day 5, lease start 2026-01-01. Add a second tenancy for "Chawl" with unit label "Room 2", tenant name "Suresh", rent ₹6,000. Verify both appear under "Chawl". Edit Ramesh's rent to ₹5,500. Toggle Suresh inactive. Soft-delete and undo.

**Acceptance Scenarios**:

1. **Given** the owner is on the Rentals page, **When** they tap "Add Tenancy", **Then** a form appears with fields: property (dropdown of active non-deleted properties, required), unit label (optional, text — e.g., "Room 1", "Flat 3A"), name (required), phone (optional, text — v1 addition), email (optional, text — v1 addition), rent amount (required, numeric > 0), security deposit (optional, numeric ≥ 0), rent due day (required, integer 1–31, default: 1), lease start date (required), lease end date (optional), notes (optional).

2. **Given** the owner fills in all required fields and submits, **Then** a new tenancy is created and appears in the list immediately under the selected property, showing the unit label (if provided) alongside the tenant name.

3. **Given** the owner taps edit on a tenancy, **Then** a form appears pre-filled with current values. Property is displayed read-only (immutable after creation). All other fields — including unit label — are editable. Saving persists the changes.

4. **Given** a tenancy is active, **When** the owner toggles it to inactive, **Then** the tenancy shows an "Inactive" badge. Rent auto-generation stops for this tenancy. Existing rent collection records remain unaffected.

5. **Given** the owner soft-deletes a tenancy, **Then** it disappears from the list immediately, an undo snackbar appears for 10 seconds, and tapping "Undo" restores it.

6. **Given** a property already has an active tenancy, **When** the owner adds another tenancy for the same property (e.g., a different room in a multi-unit building), **Then** both tenancies coexist with their own unit label, rent amount, and independent rent collection records. No warning or restriction is shown — multiple tenancies per property is the default behavior.

7. **Given** the owner enters a rent amount of 0 or a negative number, **When** they submit, **Then** validation prevents submission with an error message.

8. **Given** the owner leaves the name or rent amount empty, **When** they submit, **Then** validation prevents submission with field-level error messages.

---

### User Story 2 — View Rent Collection Status (Priority: P1)

The owner navigates to the Rentals page and sees a monthly overview of all rent collection records for the selected month, grouped by property. Under each property heading, all active tenancies are listed with their unit label, tenant name, expected rent, due date, and a color-coded status badge (received, partial, pending, overdue). A summary header shows totals across all properties: total expected, total received, total outstanding, and count of entries pending or partially received. The page defaults to the current month, and the owner can navigate to other months. Each tenancy row is expandable to show the past 3–6 months of collection history for that tenancy.

**Why this priority**: The rent collection view is the primary screen for the owner to understand who has paid and who hasn't across all properties and tenancies. It is the core value of the Rentals feature.

**Independent Test**: After adding tenancies for two properties (Chawl with 2 tenants, Mira Shop with 1 tenant) and waiting for the daily cron to run (or triggering it manually), verify all three entries appear grouped under their respective properties with "Pending" status and the summary header shows correct totals. Record a full payment for one and verify status changes to "Received" and summary updates.

**Acceptance Scenarios**:

1. **Given** active tenancies exist with rent collection records for the current month, **When** the owner navigates to the Rentals page, **Then** they see records grouped by property. Under each property heading, each tenancy's record shows: unit label (if any), tenant name, expected amount (formatted as ₹ with Indian number formatting), due date, total received so far (sum of payment events), and status badge.

2. **Given** a property "Chawl" has three active tenancies (Room 1, Room 2, Room 3), **Then** all three appear under the "Chawl" heading with their individual unit labels, rent amounts, and statuses.

3. **Given** a rent collection record with no payment events and the current month has not ended, **Then** it shows an amber "Pending" badge.

4. **Given** a rent collection record where sum of payment events > 0 but < expected amount, **Then** it shows a blue "Partial" badge with the remaining balance displayed.

5. **Given** a rent collection record where sum of payment events ≥ expected amount, **Then** it shows a green "Received" badge.

6. **Given** a rent collection record with status "pending" or "partial" and the month has ended (past the last day of the record's month), **Then** it shows a red "Overdue" badge.

7. **Given** the owner selects a different month from the month navigator, **Then** the view updates to show rent collection records for that month.

8. **Given** no rent collection records exist for the selected month, **Then** an empty state is shown with an appropriate message.

9. **Given** the owner filters by a specific property, **Then** only that property's tenancies and their collection records are shown.

10. **Given** the Rentals page, **Then** a summary header shows: total expected rent for the month (across all properties and tenancies), total received so far, total outstanding (expected minus received), and count of entries still pending or partially received.

11. **Given** the rent collection list within each property group, **Then** entries are sorted: overdue first (oldest due date first), then pending (soonest due date first), then partial (soonest due date first), then received (most recently received first).

12. **Given** a tenancy row on the Rentals page, **When** the owner expands it, **Then** the past 3–6 months of collection history are shown with month, expected amount, received amount, and status for each.

---

### User Story 3 — Monthly Rent Auto-Generation via Cron (Priority: P1)

The daily cron job (`api/notify.ts`) checks whether rent collection records exist for the current month for every active, non-deleted tenancy whose lease has started (lease start date ≤ today), whose lease has not expired, and whose property is non-deleted. For each tenancy missing a current-month record, one is auto-created with the tenancy's configured rent amount, a due date computed from the tenancy's rent due day, and status "pending". Auto-generation iterates over all active tenancies independently — not one per property. The client never auto-creates records; only the cron does.

**Why this priority**: Auto-generation is central to the feature's value — the owner should not need to manually create rent entries every month for every tenancy across every property. Cron-driven generation ensures records exist even if the owner doesn't open the app, and enables push notification of overdue rents.

**Independent Test**: Add three active tenancies across two properties. Wait for the cron to fire (or trigger `api/notify.ts` manually). Verify three rent collection records are auto-created with correct amounts and due dates. Trigger the cron again — verify no duplicates are created.

**Acceptance Scenarios**:

1. **Given** three active tenancies exist (Chawl Room 1: ₹5,000 due day 5; Chawl Room 2: ₹6,000 due day 5; Mira Shop: ₹10,000 due day 1) and no records exist for June 2026, **When** the cron runs, **Then** the system auto-creates three records — one per tenancy — each with the correct expected amount, due date, and pending status.

2. **Given** a record for Chawl Room 1 already exists for the current month, **When** the cron runs, **Then** no duplicate is created for Chawl Room 1. Only missing records (Room 2 and Mira Shop) are created.

3. **Given** all records already exist for the current month, **Then** the cron completes without creating any new records.

4. **Given** a tenancy is inactive, **When** the cron runs, **Then** no record is created for that tenancy.

5. **Given** a tenancy has been soft-deleted, **When** the cron runs, **Then** no record is created for that tenancy.

6. **Given** a tenancy has a lease end date of 2026-05-31 (expired), **When** the cron runs for June 2026, **Then** no record is created for that tenancy.

7. **Given** a tenancy with rent due day 31 and the current month is February 2026, **When** the cron runs, **Then** the due date is clamped to 2026-02-28.

8. **Given** auto-generation fails for one tenancy due to a write error, **Then** records for the remaining tenancies are still created.

9. **Given** a tenancy is linked to a property that has been soft-deleted, **When** the cron runs, **Then** no record is created for that tenancy.

10. **Given** a tenancy with lease start date 2026-07-01 and the cron runs in June 2026, **Then** no record is created for that tenancy (lease hasn't started yet).

---

### User Story 4 — Mark Received Full (Priority: P2)

The owner taps "Mark Received Full" on a pending, partial, or overdue rent collection record. A quick form asks for the payment method (required) and defaults the date to today. On submit, a single PaymentEvent is created for the remaining balance (expected amount minus sum of existing payment events). The record status recomputes to "received".

**Why this priority**: Depends on the collection view (P1) existing. Recording full receipt is the primary action on the Rentals page — it closes the monthly rent loop for each tenancy.

**Independent Test**: Open a pending record for ₹10,000 (Mira Shop tenant). Tap "Mark Received Full". Select payment method "GPay". Save. Verify a PaymentEvent of ₹10,000 is created, the status changes to "Received" (green badge), and the summary totals update.

**Acceptance Scenarios**:

1. **Given** a rent collection record with status "pending" (no payment events), **When** the owner taps "Mark Received Full", **Then** a form appears with: payment date (pre-filled with today, editable), payment method (dropdown: GPay, PhonePe, NEFT, Net Banking, Cash, Other — required), notes (optional).

2. **Given** the owner saves, **Then** a PaymentEvent is created with amount = expected amount (the full remaining balance), the record status recomputes to "received", a green "Received" badge is shown, and a success toast confirms the action.

3. **Given** a rent collection record with status "partial" (some payment events exist, sum < expected), **When** the owner taps "Mark Received Full", **Then** a PaymentEvent is created for the remaining balance (expected minus sum of existing events). The record status recomputes to "received".

4. **Given** a record already at status "received" (sum of events ≥ expected), **Then** the "Mark Received Full" action is not available.

5. **Given** the save fails due to a write error, **Then** an error toast appears and the record remains in its previous state.

---

### User Story 5 — Mark Received Partial (Priority: P2)

The owner taps "Mark Received Partial" on a pending, partial, or overdue rent collection record. A modal appears where the owner enters the amount received, selects a payment method, optionally adjusts the date (default today), and adds notes. On save, a PaymentEvent is created and the record status recomputes.

**Why this priority**: Depends on the collection view (P1). Partial payment tracking is essential for tenants who pay in installments or make advance partial payments.

**Independent Test**: Open a pending record for ₹10,000. Tap "Mark Received Partial". Enter ₹4,000, payment method "Cash". Save. Verify a PaymentEvent of ₹4,000 is created, status changes to "Partial" (blue badge) showing ₹6,000 remaining. Tap "Mark Received Partial" again with ₹6,000, method "GPay". Verify status changes to "Received".

**Acceptance Scenarios**:

1. **Given** a rent collection record with status "pending" or "partial" or display status "overdue", **When** the owner taps "Mark Received Partial", **Then** a modal appears with: amount (required, numeric > 0), payment date (pre-filled with today, editable), payment method (dropdown: GPay, PhonePe, NEFT, Net Banking, Cash, Other — required), notes (optional).

2. **Given** the owner enters ₹4,000 against a ₹10,000 expected rent, **Then** a PaymentEvent of ₹4,000 is created. The record status recomputes to "partial". A blue "Partial" badge is shown with the remaining balance (₹6,000).

3. **Given** the owner enters a partial amount that brings the sum of all events to ≥ expected amount, **Then** the record status recomputes to "received" and shows a green "Received" badge.

4. **Given** a record at status "received", **Then** the "Mark Received Partial" action is not available.

5. **Given** the owner enters an amount of 0 or negative, **Then** validation prevents submission.

6. **Given** the save fails due to a write error, **Then** an error toast appears and the record remains in its previous state.

---

### User Story 6 — View Payment History for a Rent Collection Record (Priority: P2)

The owner can view all payment events associated with a rent collection record. Each payment event shows the amount, date, payment method, and notes.

**Why this priority**: With partial payment tracking, the owner needs to see the breakdown of how rent was received over multiple payments.

**Independent Test**: After making two partial payments (₹4,000 + ₹6,000) on a ₹10,000 record, expand the record's payment history. Verify both events are listed with correct amounts, dates, and methods.

**Acceptance Scenarios**:

1. **Given** a rent collection record with one or more payment events, **When** the owner views the record details, **Then** all payment events are listed in reverse chronological order showing: amount, date, payment method, and notes.

2. **Given** a rent collection record with no payment events, **Then** an empty state message is shown (e.g., "No payments recorded yet").

3. **Given** multiple payment events, **Then** the total received (sum of all events) is displayed alongside the expected amount.

---

### User Story 7 — Activity Log for Rent Actions (Priority: P2)

All rent-related actions are logged in the Activity Log. This provides an audit trail consistent with the existing Bills and Todos modules.

**Why this priority**: Depends on core rent tracking (P1). Activity logging is a consistency requirement — all other modules log their actions, and Rentals should follow the same pattern.

**Independent Test**: Add a tenancy and verify an activity log entry appears. Wait for the cron to run (auto-generation) and verify log entries appear. Record a payment and verify a log entry appears.

**Acceptance Scenarios**:

1. **Given** the owner adds a new tenancy, **Then** an activity log entry is created with a summary including the tenant name, unit label (if any), and property (e.g., "Tenant added: Ramesh (Room 1) — Chawl").

2. **Given** rent collection records are auto-generated by the cron, **Then** an activity log entry is created for each auto-generated record with a summary like "Rent auto-generated: Ramesh (Room 1) — Chawl Jun 2026".

3. **Given** the owner records a payment (full or partial), **Then** an activity log entry is created with a summary including the tenant name, unit label, property, amount, and month (e.g., "Rent received: Ramesh (Room 1) — Chawl ₹5,000 Jun 2026").

4. **Given** the owner edits a tenancy, **Then** an activity log entry is created with a summary noting the change.

---

### User Story 8 — Push Notifications for Overdue Rents (Priority: P2)

The existing daily push notification (`api/notify.ts`) is extended to include overdue rent collections alongside overdue bills and todos. The notification body combines all overdue items into a single message truncated at 200 characters.

**Why this priority**: Depends on rent auto-generation (P1) and the existing push notification infrastructure (Phase 11). Ensures the owner is alerted about uncollected rent without needing to open the app.

**Independent Test**: Set up tenancies with rent due day 1. Wait until the 2nd of the month with uncollected rent. Verify the push notification includes overdue rents. If overdue bills also exist, verify the combined format.

**Acceptance Scenarios**:

1. **Given** overdue bills AND overdue rents exist, **When** the cron sends a push notification, **Then** the body reads: "{N} bills + {M} rents pending: Maintenance Mira Shop, Bob (Mira Room 1), ..." truncated at 200 characters.

2. **Given** only overdue rents exist (no overdue bills or todos), **When** the cron sends a push notification, **Then** the body reads: "{N} rents pending: Bob (Mira Room 1), Alice (Mira Room 2)" truncated at 200 characters.

3. **Given** overdue bills AND overdue todos AND overdue rents exist, **Then** all are included in the notification body with counts by type.

4. **Given** no overdue rents and no overdue bills/todos, **Then** no push notification is sent (existing behavior preserved).

---

### User Story 9 — Dashboard Integration (Priority: P2)

The existing Dashboard page is extended with rent data. The "Money This Month" card gains a "Rent Collected This Month" subsection. The "Needs Attention" card includes overdue rent collection records, clickable to navigate to `/rentals`.

**Why this priority**: Depends on rent collection data (P1) existing. Dashboard integration gives the owner a unified view of both bills and rent without switching pages.

**Independent Test**: With active tenancies and auto-generated records for the current month, open the Dashboard. Verify the "Rent Collected" subsection shows correct totals. Mark some rent as overdue (let due date pass) and verify they appear in "Needs Attention". Click an overdue rent item and verify navigation to `/rentals`.

**Acceptance Scenarios**:

1. **Given** rent collection records exist for the current month, **When** the owner opens the Dashboard, **Then** the "Money This Month" card includes a "Rent Collected This Month" subsection showing: total expected rent, total received, total outstanding.

2. **Given** the "Rent Collected This Month" subsection, **Then** a per-property breakdown shows each property with its expected and received totals (only properties with active tenancies are listed).

3. **Given** overdue rent collection records exist (status overdue), **When** the owner views the "Needs Attention" card, **Then** overdue rent items appear alongside overdue bills and todos, sorted by due date ascending.

4. **Given** an overdue rent item in "Needs Attention" shows: tenant name (unit label) — property name, with an "Overdue" badge, **When** the owner taps it, **Then** they navigate to `/rentals`.

5. **Given** no overdue rent and no overdue bills/todos, **Then** the "Needs Attention" card shows the existing "All clear" empty state.

---

### User Story 10 — First-Run Empty State (Priority: P3)

When the owner navigates to the Rentals page and no tenancies exist, they see an empty state that explains the feature and provides a call-to-action to add their first tenant.

**Why this priority**: First-run experience is important for discoverability but not critical for functionality.

**Independent Test**: Navigate to the Rentals page with no tenancies. Verify the empty state message and "Add Tenancy" button. Add a tenancy. Return to the Rentals page and verify auto-generation occurred after the next cron run.

**Acceptance Scenarios**:

1. **Given** no tenancies exist, **When** the owner navigates to the Rentals page, **Then** an empty state is shown with a message like "No tenants yet. Add a tenant to start tracking rent collection." and a prominent "Add Tenancy" action.

2. **Given** the owner uses the "Add Tenancy" action from the empty state, **Then** the tenancy creation form opens on the same page.

---

### Edge Cases

- **Tenant's lease has expired** (lease end date is in the past but tenancy is still marked active): Rent is NOT auto-generated for expired tenancies. A visual indicator (e.g., "Lease expired" label) warns the owner to deactivate the tenancy or update the lease end date.
- **Property soft-deleted after tenancies were added**: Tenancies remain visible on the Rentals page with the property name shown with a "deleted" indicator. No new rent collection records are auto-generated for tenancies of deleted properties.
- **Property deactivated**: Tenancies under inactive properties still appear on the Rentals page but rent auto-generation is skipped for them.
- **Owner changes tenancy rent amount mid-month**: Existing rent collection records for the current month are unaffected. The updated rent amount applies to future auto-generated records only.
- **Rent collection record deleted by owner**: If the owner soft-deletes a record and the cron runs again, the system re-creates it — deleted records are excluded from the idempotency check, matching the bills recurrence pattern.
- **Due date clamping**: A tenancy with due day 31 in February gets due date Feb 28 (or 29 in a leap year). Same clamping logic as existing bills.
- **Backdated tenancy**: If a tenancy is added mid-month (e.g., June 15) with due day 1, the next cron run creates a June record with due date June 1 (already past). The record appears as "Overdue" immediately if the month end has passed. The owner can adjust or delete it manually if needed.
- **No active properties**: The "Add Tenancy" form shows an empty property dropdown with a message like "No active properties. Add a property first." and the form cannot be submitted.
- **Multiple tenancies same property, same unit label**: The system does not enforce unique unit labels within a property. The owner is responsible for using distinct labels. Duplicate labels are allowed (though inadvisable).
- **Multiple browser tabs**: Last write wins, consistent with the rest of the app.
- **Payment events exceed expected amount**: If the sum of payment events exceeds the expected rent amount (e.g., advance payment), the record status is still "received". The overpayment is visible in the payment history but no special handling is applied.
- **Soft-deleting a payment event**: Payment events support soft-delete with undo. Deleting a payment event recomputes the rent collection status (e.g., "received" may revert to "partial" or "pending").
- **Cron runs before owner adds tenancies**: No records are created. On the next cron run after tenancies are added, records are created for the current month if eligible.

---

## Design Decisions

### DD-001: One Page, Not Two (CHOSEN)

**Decision**: The `/rentals` page handles BOTH tenancy management AND rent collection display. There is no separate "Settings → Tenants" page.

**Rationale**: Tenancies and their collection records are tightly coupled — the owner always wants to see them together. A separate settings page would force unnecessary navigation between "manage tenants" and "see their rent status." The `/rentals` page groups tenancies under properties, shows current-month collection status inline, and provides "Add Tenancy" at the top. Expanding a tenancy reveals past collection history.

**Alternatives rejected**:
- **Separate Settings → Tenants page**: Adds navigation friction. The owner would need to jump between Settings and Rentals constantly. The existing Settings hub is for infrequently-changed configuration (properties, bill types), while tenancy management is closely tied to daily rent tracking.

### DD-002: Partial Payment via PaymentEvent Entity (CHOSEN)

**Decision**: Rent collection uses a separate PaymentEvent entity (0..N per RentCollection). RentCollection does NOT store `collected_amount` or `collected_date` — those are computed from the sum of PaymentEvent rows.

**Rationale**: Real-world rent collection often happens in installments. A tenant may pay ₹5,000 of ₹10,000 rent on the 5th and the remaining ₹5,000 on the 15th. Storing a single `collected_amount` on RentCollection cannot represent this. PaymentEvent rows provide a complete audit trail of individual payments with their own dates, methods, and notes.

**Alternatives rejected**:
- **Single collected_amount on RentCollection**: Cannot track multiple partial payments. Would require "last write wins" semantics that lose payment history.
- **Overwrite collected_amount with running total**: Loses the breakdown of when and how each payment was made.

### DD-003: Computed Status from PaymentEvents (CHOSEN)

**Decision**: RentCollection status is computed, not stored. The computation is:
- `pending`: No payment events (sum = 0)
- `partial`: Sum of payment events > 0 but < expected amount
- `received`: Sum of payment events ≥ expected amount
- `overdue`: Status is "pending" or "partial" AND the month has ended (past last day of the record's month)

**Rationale**: Storing status separately from payment events would create consistency risks — a payment event could be added or deleted without the status being updated. Computing status from the source of truth (payment events + calendar) eliminates this class of bugs.

**Alternatives rejected**:
- **Stored status field**: Requires manual synchronization with payment events on every add/delete. Risk of drift.
- **Due-date-based overdue**: Using `dueDate` instead of month-end for overdue would penalize tenants who pay on the due day itself. Month-end is a more forgiving threshold.

### DD-004: Cron-Driven Auto-Generation, Not Page-Load (CHOSEN)

**Decision**: Rent collection records are auto-generated by the daily cron job (`api/notify.ts`), not on client page load. The client never creates rent collection records automatically.

**Rationale**: Cron-driven generation ensures records exist even if the owner doesn't open the app for days. This is critical for push notifications — the cron needs to know which rents are overdue, which requires the records to already exist. Page-load generation would mean overdue notifications can't fire until the owner opens the app, defeating the purpose.

**Alternatives rejected**:
- **Page-load generation**: Records wouldn't exist until the owner opens the Rentals page. Push notifications for overdue rents would be impossible. If the owner doesn't open the app until the 15th, all rents due on the 1st–14th would be invisible to the notification system.

### DD-005: Extend api/notify.ts for Rent Generation + Overdue Notifications (CHOSEN)

**Decision**: The existing `api/notify.ts` Vercel cron function is extended with two new responsibilities: (1) auto-generate missing rent collection records for the current month, and (2) include overdue rent collections in the daily push notification body.

**Rationale**: Reuses the existing cron infrastructure, authentication, and Google Sheets access. No new serverless function, no new cron schedule. The function already reads Properties and Bills — adding Tenancies and RentCollections is incremental.

**Alternatives rejected**:
- **Separate cron function**: Would duplicate authentication, Sheets setup, and scheduling. Unnecessary complexity for a closely related concern.
- **Client-side generation with separate notification cron**: Splits responsibility awkwardly. The cron would need records to exist to check for overdue, but records would only exist after the client creates them.

### DD-006: Dashboard Integration — Rent in Money Summary + Needs Attention (CHOSEN)

**Decision**: The Dashboard's "Money This Month" card gains a "Rent Collected This Month" subsection. The "Needs Attention" card includes overdue rent collection records alongside overdue bills and todos.

**Rationale**: The Dashboard is the owner's daily landing page. Bills show outgoing money; rent shows incoming money. Both belong in the Money Summary for a complete financial picture. Overdue rents are just as urgent as overdue bills — they should appear in the same attention list.

**Alternatives rejected**:
- **Separate Rent Dashboard**: Fragmenting the owner's attention across multiple dashboards. The whole point of a dashboard is a unified view.
- **Defer to Phase 17+**: The Dashboard is already reading bills and todos. Adding rent is incremental — deferring would mean the owner has no visibility into rent from the Dashboard for an entire phase.

### DD-007: Push Notification Combined Format (CHOSEN)

**Decision**: The push notification body combines overdue bills, todos, and rents into a single message. Format: "{N} bills + {M} rents pending: Item1, Item2, ..." truncated at 200 characters.

**Rationale**: A single notification with all overdue items is less intrusive than separate notifications per category. The existing 200-character limit and truncation logic are reused. Adding rent items to the existing notification body is a minimal change.

**Alternatives rejected**:
- **Separate notification per category**: Multiple daily notifications would be annoying and violate the Phase 11 design of a single daily digest.
- **Rent-only notification**: Would miss the combined picture. An owner with 3 overdue bills and 2 overdue rents should see "3 bills + 2 rents pending" in one message.

### DD-008: Overdue Threshold — Month End, Not Due Date (CHOSEN)

**Decision**: A rent collection record becomes "overdue" when the month has ended (past the last day of the record's month) AND the record is not fully received. The `dueDate` field is informational (shown to the owner) but does not drive the overdue computation.

**Rationale**: Rent due day is a soft target — many tenants pay a few days late but within the same month. Marking rent "overdue" on the due day itself would create false urgency and noisy notifications. Month-end is the practical threshold: if the month is over and rent isn't fully collected, it's genuinely overdue.

**Alternatives rejected**:
- **Due-date-based overdue**: Would mark rent overdue the day after the due date (e.g., due day 5, overdue on day 6). Too aggressive for typical landlord-tenant dynamics.
- **Configurable grace period**: Over-engineering for v1. Month-end is a reasonable default.

### DD-009: Rent Is Separate from Bills (CHOSEN)

**Decision**: Rent tracking is a completely separate module from Bills. Bills track outgoing payments the owner makes. Rents track incoming payments the owner collects. They share payment method options but nothing else.

**Rationale**: Bills and rents have fundamentally different workflows. Bills: owner pays → marks paid → recurrence creates next bill. Rents: cron creates records → tenants pay → owner records receipt. Mixing them in one entity would require awkward "direction" flags and confuse the UI.

**Alternatives rejected**:
- **Bills with "incoming" flag**: Would complicate every bill query, filter, and display with direction-awareness. Bills and rents have different fields (bills have attachments, postpone; rents have tenancy, unit label, payment events).

### DD-010: Phone and Email as Optional v1 Additions (CHOSEN)

**Decision**: The Tenancy entity includes `phone` and `email` as optional fields. They are stored but not actively used in any workflow (no SMS, no email notifications). Flagged as v1 additions for future use.

**Rationale**: Contact information is useful metadata for the owner's reference (e.g., calling a tenant about late rent). Including the fields now avoids a schema migration later. Marking them as v1 additions sets expectations that no automated contact features are built yet.

**Alternatives rejected**:
- **Omit entirely**: Would require a schema change when contact features are eventually added.
- **Build contact workflows now**: Out of scope. No SMS or email sending infrastructure exists.

---

## Requirements

### Functional Requirements

#### Tenancy Management

- **FR-001**: The Rentals page (`/rentals`) MUST display all non-deleted tenancies grouped by property, each showing: unit label (if any), tenant name, property name, rent amount, rent due day, lease dates, active/inactive badge.
- **FR-002**: The system MUST allow the owner to add a new tenancy from the Rentals page with the following fields: property (required, dropdown of active non-deleted properties), unit label (optional, text — e.g., "Room 1", "Flat 3A"), name (required, text), phone (optional, text — v1 addition), email (optional, text — v1 addition), rent amount (required, numeric > 0), security deposit (optional, numeric ≥ 0), rent due day (required, integer 1–31, default 1), lease start date (required, date), lease end date (optional, date), notes (optional, text).
- **FR-003**: The system MUST allow the owner to edit a tenancy. The property field is immutable after creation and shown read-only. All other fields — including unit label — are editable.
- **FR-004**: The system MUST allow the owner to toggle a tenancy between active and inactive states. The change persists immediately.
- **FR-005**: The system MUST support soft-delete with a 10-second undo window for tenancies, using optimistic UI (disappears immediately, reappears on undo or write failure).
- **FR-006**: A property MUST support zero or more active tenancies simultaneously. Adding a tenancy to a property that already has active tenancies is allowed without restriction or warning.

#### Navigation

- **FR-007**: The application navigation MUST include a "Rentals" entry as a top-level page alongside "Bills" and "To-Dos".
- **FR-008**: The router MUST define a route for the Rentals page (`/rentals`). It is a protected route within the existing authentication and bootstrap guards.

#### Rent Collection View

- **FR-009**: The Rentals page MUST display all non-deleted rent collection records for a selected month, defaulting to the current month, grouped by property.
- **FR-010**: Under each property heading, all tenancies with records for the selected month MUST be listed. Each record shows: unit label (if any), tenant name, expected amount (formatted as ₹ with Indian number formatting), due date, total received (sum of non-deleted payment events), remaining balance, and a status badge.
- **FR-011**: The rent collection display status MUST be computed as follows:
  - Sum of payment events ≥ expected amount → green "Received" badge
  - Sum of payment events > 0 but < expected amount AND month has not ended → blue "Partial" badge
  - No payment events AND month has not ended → amber "Pending" badge
  - Status is "pending" or "partial" AND the month has ended (past last day of the record's month) → red "Overdue" badge
- **FR-012**: The Rentals page MUST show a summary header with: total expected rent for the month (across all properties and tenancies), total received so far, total outstanding (expected minus received), and number of records still pending or partially received.
- **FR-013**: The Rentals page MUST provide a month navigator to view different months' rent collection records.
- **FR-014**: The Rentals page MUST provide a property filter to show only a selected property's tenancies and their records.
- **FR-015**: Within each property group, records MUST be sorted: overdue first (oldest due date first), then pending (soonest due date first), then partial (soonest due date first), then received (most recently received first).
- **FR-016**: Each tenancy row on the Rentals page MUST be expandable to show the past 3–6 months of collection history for that tenancy, displaying month, expected amount, total received, and status for each.

#### Rent Auto-Generation (Cron)

- **FR-017**: The `api/notify.ts` cron function MUST read the Tenancies sheet and RentCollections sheet alongside existing Bills, Todos, and Properties data.
- **FR-018**: For each tenancy that is active, non-deleted, linked to a non-deleted property, whose lease has started (lease start date ≤ today), and whose lease has not expired (lease end date is empty or ≥ first day of current month): if no non-deleted RentCollection record exists for that tenancy + current month composite key, the cron MUST create one with expected amount from the tenancy's rent amount, due date from the current month and the tenancy's rent due day (clamped to the month's last day), and zero payment events.
- **FR-019**: Auto-generation MUST be idempotent — if a non-deleted record already exists for a tenancy and month (matching composite key of tenancy ID + YYYY-MM), no duplicate is created.
- **FR-020**: Auto-generation MUST iterate over all eligible tenancies independently. A property with three active tenancies produces three separate records.
- **FR-021**: If auto-generation fails for a specific tenancy, the cron MUST continue generating for remaining tenancies and log the error.
- **FR-022**: The cron MUST write an activity log entry for each auto-generated rent collection record.

#### Mark Received Full

- **FR-023**: Each rent collection record with computed status "pending", "partial", or "overdue" MUST provide a "Mark Received Full" action.
- **FR-024**: The Mark Received Full form MUST include: payment date (default: today, required), payment method (required, dropdown: GPay, PhonePe, NEFT, Net Banking, Cash, Other), notes (optional, text).
- **FR-025**: On save, a PaymentEvent MUST be created with amount equal to the remaining balance (expected amount minus sum of existing non-deleted payment events). The record's computed status updates to "received".
- **FR-026**: A record with computed status "received" MUST NOT show the "Mark Received Full" action.

#### Mark Received Partial

- **FR-027**: Each rent collection record with computed status "pending", "partial", or "overdue" MUST provide a "Mark Received Partial" action.
- **FR-028**: The Mark Received Partial modal MUST include: amount (required, numeric > 0), payment date (default: today, required), payment method (required, dropdown: GPay, PhonePe, NEFT, Net Banking, Cash, Other), notes (optional, text).
- **FR-029**: On save, a PaymentEvent MUST be created with the specified amount. The record's computed status recomputes based on the new sum of all non-deleted payment events vs. expected amount.
- **FR-030**: A record with computed status "received" MUST NOT show the "Mark Received Partial" action.

#### Payment Event Management

- **FR-031**: The owner MUST be able to view all non-deleted payment events for a rent collection record, listed in reverse chronological order.
- **FR-032**: The system MUST support soft-delete with a 10-second undo window for payment events, using optimistic UI. Deleting a payment event recomputes the rent collection record's status.

#### Edit and Delete Rent Collection Records

- **FR-033**: The owner MUST be able to edit a rent collection record's expected amount, due date, and notes. The tenancy, month, and payment events are not editable through the edit form.
- **FR-034**: The system MUST support soft-delete with a 10-second undo window for rent collection records, using optimistic UI consistent with the existing pattern. Deleting a rent collection record also logically removes its associated payment events from status computations.

#### Activity Log

- **FR-035**: The system MUST log activity entries for: tenancy added, tenancy updated, tenancy deleted, rent auto-generated (by cron), payment received (full or partial), and payment deleted.
- **FR-036**: Activity log summaries MUST include the tenant name, unit label (if any), property name, and relevant context (e.g., month, amount) for traceability.

#### Push Notification Extension

- **FR-037**: The `api/notify.ts` cron MUST compute overdue rent collections (computed status "overdue": month has ended AND sum of payment events < expected amount) and include them in the daily push notification body.
- **FR-038**: The push notification body format MUST be:
  - If overdue bills AND overdue rents: "{N} bills + {M} rents pending: {descriptions}" truncated at 200 characters.
  - If only overdue rents (no overdue bills or todos): "{N} rents pending: {descriptions}" truncated at 200 characters.
  - If only overdue bills/todos (no overdue rents): existing format unchanged.
  - Rent descriptions use the format: "{tenantName} ({unitLabel}) — {propertyName}" or "{tenantName} — {propertyName}" if no unit label.
- **FR-039**: If no overdue items exist (bills, todos, or rents), no push notification is sent (existing behavior preserved).

#### Dashboard Extension

- **FR-040**: The Dashboard "Money This Month" card MUST include a "Rent Collected This Month" subsection showing: total expected rent for the current month, total received (sum of all payment events), total outstanding (expected minus received).
- **FR-041**: The "Rent Collected This Month" subsection MUST include a per-property breakdown showing each property with active tenancies and its expected/received totals.
- **FR-042**: The Dashboard "Needs Attention" card MUST include overdue rent collection records alongside overdue bills and todos, sorted by due date ascending. Rent items appear with tenant name, unit label, and property name, and are clickable to navigate to `/rentals`.
- **FR-043**: Overdue rent items in "Needs Attention" MUST use a distinct icon (differentiable from bills and todos) and show an "Overdue" badge.

#### Validation

- **FR-044**: Tenant name MUST be non-empty.
- **FR-045**: Rent amount MUST be a positive number (> 0).
- **FR-046**: Rent due day MUST be an integer between 1 and 31 inclusive.
- **FR-047**: Lease start date MUST be a valid date.
- **FR-048**: Security deposit, if provided, MUST be a non-negative number (≥ 0).
- **FR-049**: Payment event amount MUST be a positive number (> 0).
- **FR-050**: Payment date is required for all payment events and MUST be a valid date.
- **FR-051**: Payment method is required for all payment events.

#### Cross-Cutting

- **FR-052**: All list views MUST show a loading indicator while data is being fetched.
- **FR-053**: All write operations MUST show a loading state on the triggering control (disabled with spinner).
- **FR-054**: All data operation failures MUST display an error toast with a human-readable message. The UI MUST remain functional.
- **FR-055**: Soft-delete operations for tenancies, rent collection records, and payment events MUST use optimistic UI with rollback on write failure.

### Key Entities

- **Tenancy**: A rental arrangement linking a tenant to a unit within a property. One property can have zero or more active tenancies. Key attributes: linked property (immutable after creation), unit label (e.g., "Room 1", "Flat 3A", or empty for single-unit properties), tenant name, phone (optional, v1 addition), email (optional, v1 addition), monthly rent amount, security deposit, rent due day (1–31), lease start date, lease end date (optional), active status, notes, timestamps (created_at, updated_at), soft-delete support (deleted_at).
- **Rent Collection**: A monthly rent record for a specific tenancy. Each tenancy generates its own records independently via cron. Key attributes: linked tenancy, month (YYYY-MM), expected amount, due date, notes, composite key (tenancy ID + month for uniqueness), timestamps (created_at, updated_at), soft-delete support (deleted_at). Status is COMPUTED from PaymentEvent rows, not stored. Does NOT store collected_amount or collected_date.
- **Payment Event**: An individual payment received against a rent collection record. Each RentCollection has 0..N PaymentEvent rows. Key attributes: id, collection_id (FK to RentCollection), amount, payment_date, payment_method, notes, timestamps (created_at, updated_at), soft-delete support (deleted_at).

---

## Cron Extension — api/notify.ts

The existing `api/notify.ts` Vercel cron function (Phase 11) is extended with the following responsibilities:

### New Data Sources

The cron reads two additional Google Sheets tabs alongside existing Bills, BillTypes, Properties, Todos, and PushSubscriptions:
- **Tenancies** sheet: Read all rows. Build a `tenancyMap` keyed by tenancy ID.
- **RentCollections** sheet: Read all rows. Build a lookup set of existing composite keys (tenancy ID + month) for non-deleted records.
- **PaymentEvents** sheet: Read all rows. Group by collection_id and compute sum per collection for status determination.

### Auto-Generation Logic (runs before overdue computation)

```
For each tenancy row:
  1. Skip if deleted_at is set
  2. Skip if is_active !== true
  3. Skip if linked property is deleted (lookup in propertyMap)
  4. Skip if lease_start_date > today (lease hasn't started)
  5. Skip if lease_end_date is set AND lease_end_date < first day of current month (lease expired)
  6. Compute composite key: tenancyId + currentMonth (YYYY-MM)
  7. If composite key exists in RentCollections lookup (non-deleted): skip (idempotent)
  8. Otherwise: append a new RentCollection row with:
     - id: generated UUID
     - tenancy_id: tenancyId
     - month: currentMonth (YYYY-MM)
     - expected_amount: tenancy.rent_amount
     - due_date: currentMonth year + month + tenancy.rent_due_day (clamped to month's last day)
     - notes: empty
     - composite_key: tenancyId + currentMonth
     - created_at / updated_at: ISO now
     - deleted_at: empty
  9. Write activity log entry: "Rent auto-generated: {name} ({unitLabel}) — {property} {month}"
```

### Overdue Rent Computation (runs after auto-generation)

```
For each non-deleted RentCollection where month < currentMonth (month has ended):
  1. Sum all non-deleted PaymentEvents for this collection_id
  2. If sum < expected_amount: mark as overdue
  3. Build description: "{tenantName} ({unitLabel}) — {propertyName}" or "{tenantName} — {propertyName}" if no unit label
```

### Push Notification Body Extension

The existing body builder combines overdue bills + todos into a single message. Extended logic:

```
const overdueBillCount = overdueBills.length;
const overdueRentCount = overdueRents.length;
const overdueTodoCount = overdueTodos.length;

// Build prefix
if (overdueBillCount > 0 && overdueRentCount > 0) {
  prefix = `${overdueBillCount} bills + ${overdueRentCount} rents pending`;
} else if (overdueRentCount > 0) {
  prefix = `${overdueRentCount} rents pending`;
} else {
  prefix = `${total} overdue`; // existing format
}

// Descriptions: combine all, truncate at 200 chars
const allDescriptions = [...billDescriptions, ...rentDescriptions, ...todoDescriptions];
body = `${prefix}: ${first3(allDescriptions)}...`;
truncateAt200Chars(body);
```

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: After adding a tenancy linked to a property, the tenancy appears in the Rentals page under the correct property (with unit label if provided) immediately without a page reload.
- **SC-002**: A property with multiple tenancies (e.g., Chawl with Room 1, Room 2, Room 3) shows all tenancies independently, each with their own rent amount and collection status.
- **SC-003**: After the daily cron runs, current-month rent collection records exist for every eligible tenancy — no manual creation required.
- **SC-004**: Auto-generated records display the correct expected amount and due date matching each tenancy's configuration.
- **SC-005**: The rent collection summary accurately reflects total expected, total received, and total outstanding amounts across all properties and tenancies for the selected month.
- **SC-006**: Recording a payment (full or partial) updates the record status and the summary totals immediately.
- **SC-007**: Auto-generation is idempotent — the cron never creates duplicate records for the same tenancy and month.
- **SC-008**: Inactive, deleted, or lease-expired tenancies do not receive auto-generated rent collection records.
- **SC-009**: All rent-related actions (tenancy CRUD, rent generation, payment recording) appear in the Activity Log with accurate summaries including unit labels.
- **SC-010**: The Rentals page groups records by property, then lists all tenancies within each property, providing a clear overview of multi-unit collection status.
- **SC-011**: Partial payments are tracked via individual PaymentEvent records. A tenant paying ₹4,000 then ₹6,000 against ₹10,000 rent shows both events and a "Received" status.
- **SC-012**: The Dashboard "Money This Month" includes a "Rent Collected" subsection with correct expected/received/outstanding totals.
- **SC-013**: Overdue rent items appear in the Dashboard "Needs Attention" card, clickable to navigate to `/rentals`.
- **SC-014**: Push notifications include overdue rents alongside overdue bills when applicable, using the combined format.

---

## Assumptions

- Phases 1–15 are complete: sign-in, bootstrapping, properties, bill types, bills CRUD, file attachments, calendar reminders, bill postpone, todos, activity log, dashboard, push notifications, and bills recurrence are all functional.
- The existing Property entity is reused — tenancies are linked to properties via property ID. No changes to the Property entity are required.
- One property supports zero or more simultaneous active tenancies. Multi-tenancy per property is the default behavior, not an edge case.
- Rent tracking is separate from the existing Bills system. Bills track outgoing payments the owner needs to make (electricity, maintenance, etc.). Rents track incoming payments the owner collects from tenants.
- Payment method options for rent collection are the same as the existing bill payment methods (GPay, PhonePe, NEFT, Net Banking, Cash, Other).
- Due date clamping logic (for months with fewer days than the configured due day) reuses the same pattern already established for bills.
- Auto-generation runs daily via the existing `api/notify.ts` cron. Past months are not backfilled automatically.
- The main navigation gains a "Rentals" entry as a top-level page alongside "Bills" and "To-Dos".
- The existing `api/notify.ts` cron function is extended — no new serverless function is created.
- The Dashboard page is extended with rent data — no new dashboard page is created.
- Phone and email fields on Tenancy are stored for reference only — no automated contact workflows (SMS, email) are built in this phase.
- No calendar reminders for rent due dates in this phase.

---

## Out of Scope

- **Rent receipts / invoices**: Generating printable or shareable rent receipts for tenants is not included.
- **Tenant-facing portal**: Tenants do not have their own login or app view. The app is owner-only.
- **Automatic rent escalation**: No built-in annual rent increase logic. The owner manually edits the tenancy's rent amount when it changes.
- **Deposit management**: Security deposit is stored as a reference field on the tenancy. Deposit deductions, returns, and interest tracking are not included.
- **Calendar reminders for rent**: No Google Calendar events for rent due dates in this phase.
- **Rent backfilling**: Auto-generation creates records for the current month only. Past months are not backfilled automatically.
- **Lease renewal workflow**: No automated lease renewal prompts or workflows.
- **File attachments for rent records**: No bill/receipt file attachment support for rent collection records in this phase.
- **Unit label uniqueness enforcement**: The system does not enforce unique unit labels within a property. The owner is responsible for distinct labels.
- **Automated tenant contact**: Phone and email are stored but not used for SMS, email, or WhatsApp notifications in this phase.
