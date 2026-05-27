# NoDues — Personal Bill & Property Tax Tracker

## Project Overview
**NoDues** is a web application for an individual property owner in India to track recurring maintenance bills and property tax payments across multiple owned properties — and to maintain a long-term, searchable archive of bills and payment receipts. The name references the Indian "no dues certificate" — the document a society or municipality issues to certify that all payments are settled. The app's core purpose is producing exactly that kind of proof on demand. The owner currently uses a Google Sheet to record monthly payments but cannot attach bill copies or payment receipts to it. The result: when the society or municipal authority later disputes whether a bill was paid two or three years ago, there is no quick way to produce proof. NoDues replaces the spreadsheet with a structured system that stores both the bill and the payment receipt together in Google Drive, links them to a row in Google Sheets, sends reminders before due dates, and lets the owner retrieve any past payment in seconds. The app is also extended with a general-purpose **to-do list** for non-bill events (insurance renewals, AGM meetings, document submissions) so all recurring obligations live in one place.

### Primary Objective: Never Miss a Bill, Always Have Proof
**The core purpose of this app is twofold: timely payment and dispute-proof archival.** Every design decision should prioritize:
- **Reminders that actually work:** Push notifications + Google Calendar events so a bill is never silently missed
- **Permanence:** Records and receipts must survive 5+ years without loss or corruption
- **Retrievability:** Find any past bill within seconds, even after years of history
- **Shareability:** Produce a receipt instantly when a society/municipality questions a payment
- **Family-shared but personally owned:** 2–4 family members can use the app on shared data, but the data lives in the owner's own Google account
- **Zero ongoing cost:** No hosting fees, no storage fees, no API fees — runs indefinitely on free tiers

### Business Context
- **User:** The owner of multiple properties (initially: a shop in Mira Road, a flat in Mira Road, and a chawl room with its own electricity bill) plus 2–4 family members who help with payments
- **Use case:** Tracking monthly maintenance bills, annual property tax, electricity bills, and ad-hoc to-dos like insurance renewal
- Multiple properties → each with its own bill types (Maintenance, Property Tax, Electricity, etc.)
- Different properties may have bills issued by different societies/municipalities, each with their own numbering and schedule
- Payment is typically made via UPI (GPay, PhonePe), net banking, or NEFT
- Typical dispute timeline: 6 months to 3 years after payment
- Common dispute: "You didn't pay Mira flat maintenance for March 2025" → owner must produce proof

### Real-World Scenario This App Solves
```
Day 1 (5 February 2026):
  - Mira flat society issues maintenance bill for ₹1,100, due 15 February 2026
  - Owner opens the app, taps "Add bill", picks property "Mira Flat" and bill type "Maintenance"
  - Snaps a photo of the paper bill with the phone camera → uploads with the record
  - App creates a Google Calendar reminder 3 days before due date
  - App sends a push notification on the phone 3 days before due date
  - Takes 30 seconds total

Day 10 (15 February 2026):
  - Owner pays ₹1,100 via GPay
  - Opens the app, taps the pending bill, taps "Mark Paid"
  - Enters paid date, payment mode (GPay), UTR/transaction reference
  - Uploads a screenshot of the GPay confirmation
  - App deletes the Calendar reminder automatically
  - Takes 30 seconds total

Day 730 (2 years later, February 2028):
  - Mira flat society sends a notice: "Maintenance for Feb 2026 is unpaid"
  - Owner opens app, filters by Property = "Mira Flat", Month = Feb 2026
  - Finds record instantly with: original bill image, GPay screenshot, UTR number, payment date
  - Shares both images via WhatsApp with the society's secretary
  - Dispute resolved with clear evidence
```

## Branding & App Identity

The app is the owner's personal financial tool. Branding is therefore minimal and configurable rather than tied to a business name.

### App Identity
```
1. App name: "NoDues"
   - References the Indian "no dues certificate" concept — the certificate
     that proves all payments are settled. The app's core purpose is
     producing this proof on demand.
   - Configurable via a single constant so the owner can rename it later
     if desired (e.g., "Sharma Family Bills", "My Property Bills")

2. Browser tab title:
   "NoDues · Dashboard" (default)
   "NoDues · Bills" (on bills list page)
   "NoDues · To-Dos" (on to-do page)
   etc.

3. Navbar (top of every page):
   - Logo icon + "NoDues" wordmark on the left
   - Below the wordmark, small subtitle: "Proof of every payment"

4. Sign-in page:
   - Headline: "NoDues"
   - Subhead: "Never miss a payment. Always have proof."

5. Browser favicon:
   - Custom favicon (a checkmark or "ND" monogram)

6. CSV export filename:
   - nodues_export_<YYYY-MM-DD>.csv

7. Full backup ZIP filename:
   - nodues_backup_<YYYY-MM-DD>.zip

8. Drive folder name (created on first sign-in):
   - /NoDues/
       /<PropertyName>/<Year>/<Month>/<BillType>/
       /Todos/<Year>/

9. Google Sheet name (created on first sign-in):
   - "NoDues - Database"

10. Google Calendar name (created on first sign-in):
    - "NoDues Reminders"

11. README and documentation:
    - Project name in docs: "NoDues - Personal Bills & Property Tax Manager"
```

### Branding as a Configurable Constant
```
The app name and related strings live in a single constant for easy future change:

  // src/config/branding.js
  export const APP_NAME = "NoDues";
  export const APP_TAGLINE = "Proof of every payment";
  export const APP_TITLE_SUFFIX = "NoDues";
  export const DRIVE_FOLDER_NAME = "NoDues";
  export const SHEET_NAME = `${APP_NAME} - Database`;
  export const CALENDAR_NAME = `${APP_NAME} Reminders`;

Every component that displays the app name should import from this file.
If the owner ever rebrands the app, only this file changes.
```

### Visual Identity Suggestions (Optional Polish)
```
- Color palette: calm, trustworthy tones suitable for a personal finance app
  * Primary: deep teal (#0F766E) or indigo (#4338CA)
  * Accent: warm amber (#D97706) for pending / overdue highlights
  * Success: emerald (#059669) for paid status
  * Danger: red (#DC2626) for overdue
- Logo: a simple calendar-with-check icon (a Lucide/Tabler icon works for v1)
- Tone of UI text: friendly, no jargon, Hindi-friendly term choices
  (e.g., "Property" rather than "Asset", "Trader/Society" rather than "Vendor")
```

## Technology Stack

- Frontend: React 18 (with Vite), Tailwind CSS, React Router
- PWA: vite-plugin-pwa (manifest, service worker, install-to-home-screen)
- Offline cache: IndexedDB via the `idb` library (cached bills + to-dos for offline browsing)
- Push notifications: Web Push API (browser-native) + Firebase Cloud Messaging (free tier)
- Authentication: Google OAuth 2.0 (@react-oauth/google)
- Database: Google Sheets (via Sheets API v4)
- File Storage: Google Drive (via Drive API v3)
- Calendar Integration: Google Calendar (via Calendar API v3)
- Scheduled Reminder Dispatcher: Vercel Cron or GitHub Actions (free tier) — runs once daily, reads the Sheet, dispatches Web Push
- Hosting: Vercel (free tier)
- Version Control: Git + GitHub
- Architecture: Serverless / no backend — React talks directly to Google APIs using the user's OAuth token

### Design System Tooling (Development-Time Only)
The project uses [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), an AI skill for Claude Code / Cursor / Windsurf that generates a coherent, industry-appropriate design system before any UI code is written. It is a **development-time tool only** — it does not add any runtime dependencies, does not ship to production, and does not affect the deployed bundle size. Its role is to guide the AI coding assistant (Claude Code, Cursor, etc.) so that all 18+ UI pages in this app share consistent colors, typography, spacing, and interaction patterns from day one.

```
What it does at development time:
- Generates design-system/MASTER.md (global design source of truth)
- Optionally generates design-system/pages/<page>.md (per-page overrides)
- Auto-injects design rules into the AI assistant's coding prompts
- Validates output against 99 UX guidelines and anti-patterns

What it does NOT do:
- It does NOT add any npm package to the React app
- It does NOT bundle anything into the production build
- It does NOT run in the user's browser
- It does NOT incur any cost (MIT licensed, runs locally via Python 3)

Recommended product-type query for our app:
  "personal finance bill tracker family shared"
  → Generates a calm, trustworthy palette suitable for personal finance
    with appropriate font pairings and anti-patterns to avoid
    (e.g., avoids "AI purple/pink gradients" that don't fit finance)
  → Pass `-p "NoDues"` to brand the generated MASTER.md with the app name
```

## Architecture Decision: No Backend

This application deliberately uses a **client-side-only architecture** with no backend server. All data operations (read, write, search, filter) happen either in the browser or directly against Google APIs.

**Why this works:**
- User volume is small: ~10–20 bills/month across all properties + a handful of to-dos = ~150–250 records/year
- Even after 10 years (~2,500 records), all data fits comfortably in browser memory
- Search and filter are instant (in-memory JavaScript operations)
- Google Sheets API handles bulk reads efficiently (1–2 seconds for thousands of rows)

**Data flow:**
```
Browser (React PWA) ─OAuth token─► Google OAuth
                  ─upload image──► Google Drive API
                  ─append row────► Google Sheets API
                  ─create event──► Google Calendar API
                  ─fetch all─────► Google Sheets API (on app load)
                  [in-memory search/filter] ◄── instant results

Scheduled dispatcher (Vercel Cron, daily):
  reads Sheet for due reminders → sends Web Push notification to device
```

**Benefits:**
- Zero hosting costs (Vercel free tier serves static files)
- No server to maintain, patch, or secure
- All user data stays in the user's own Google account
- Search is faster than a backend approach (no network round-trip per query)
- Works offline (read-only) after initial data load

**Trade-offs accepted:**
- Family-shared via a Google Drive folder share (2–4 family members) — each signs in with their own Google account but reads/writes the same underlying Sheet and Drive folder
- Initial page load fetches all records (acceptable for < 50,000 records)
- Push notifications require a tiny scheduled function (Vercel Cron / GitHub Actions) — still free tier
- Offline mode is read-only; writes (add bill, mark paid) require connectivity

## User Roles & Permissions

### 1. Owner (Primary)
The Google account that first sets up the app. Has full read/write access to all data and all settings.

**Access Rights:**
- Sign in with own Google account
- Manage properties, bill types, recurrence patterns, to-do categories
- Add bills and to-dos, mark paid/done, postpone, soft-delete, restore
- Configure reminders and notifications
- Add or remove family members in Settings → Family Access
- Export data, generate proof packets, download backups

### 2. Family Members (2–4 additional users)
Family members the owner adds to the Drive folder share + the `allowed_user_emails` list in Settings.

**Access Rights:**
- Sign in with their own Google account
- View and add bills and to-dos
- Mark items paid/done, upload receipts
- View activity log to see who did what
- Cannot manage properties, bill types, recurrence patterns, or family access (read-only on those Settings sub-pages)

**Cannot (any user):**
- Access another household's data — data is isolated by Google Drive folder + Sheet ownership
- Permanently delete records via the app UI (only soft-delete + 90-day recovery is offered)

## Core Features

### 1. Authentication

#### Google Sign-In
- **Sign-In Flow**
  ```
  - "Sign in with Google" button on landing page
  - OAuth 2.0 consent screen requests scopes:
    * https://www.googleapis.com/auth/drive.file
    * https://www.googleapis.com/auth/spreadsheets
    * https://www.googleapis.com/auth/calendar
    * openid, email, profile
  - On first sign-in by the owner, app creates:
    * Folder in Drive: /NoDues/
    * Subfolders are created on demand per property/year/month
    * Spreadsheet: NoDues - Database (with all required tabs)
    * Google Calendar: NoDues Reminders
  - Seeds initial data:
    * Properties: "Mira Shop", "Mira Flat", "Chawl"
    * Bill Types: Maintenance + Property Tax (Shop & Flat), Electricity (Chawl)
    * To-Do Categories: Insurance, Tax, Society, Maintenance
    * Config: currency = INR, timezone = Asia/Kolkata
  - Access token stored in memory only (not localStorage)
  - Refresh token handled by Google client library
  ```

- **Family Member Sign-In**
  ```
  - When a family member signs in for the first time:
    * App checks if their email is in Config.allowed_user_emails
    * If yes: they get write access to the existing Sheet + Drive folder
      (the owner must have separately shared the Drive folder with them)
    * If no: friendly message "Ask the owner to add your email in Settings → Family Access"
  - Each family member sees the same data and the same activity log
  ```

- **Sign-Out**
  ```
  - Revoke access token
  - Clear in-memory state and IndexedDB cache
  - Redirect to landing page
  ```

### 2. Properties (Multi-Property Support)

Each property the owner manages is a first-class entity. Bill types are scoped to a property so the same name ("Maintenance") can exist independently for Mira Shop, Mira Flat, and any future property.

- **Property Definition**
  ```
  A property has:
  - id (UUID)
  - name (e.g., "Mira Shop", "Mira Flat", "Chawl")
  - address (free-text, optional — society name, building, etc.)
  - notes (free-text, optional — society contact, registration number)
  - active flag
  - deleted_at (soft-delete marker)
  ```

- **Initial Seed (on first sign-in)**
  ```
  The owner's three known properties are seeded automatically:
  - Mira Shop (with Bill Types: Maintenance, Property Tax)
  - Mira Flat (with Bill Types: Maintenance, Property Tax)
  - Chawl (with Bill Type: Electricity)
  
  The owner can rename, add, or deactivate any of these at any time
  via Settings → Properties.
  ```

- **Adding a New Property Later**
  ```
  Settings → Properties → "Add Property"
  → Enter name, address (optional), notes (optional)
  → Save
  → Property immediately appears in:
    * "Add Bill Type" form (as a Property dropdown option)
    * "Add Bill" form (as a Property dropdown option)
    * Filter dropdowns on Dashboard and Bills List
  → Drive folder /NoDues/<PropertyName>/ is created on the
    first bill or file upload for that property
  ```

- **Deactivating a Property**
  ```
  Settings → Properties → Edit → toggle "Active" off
  → Property is hidden from "Add Bill" dropdowns
  → All historical bills under that property remain visible and searchable
  → Re-activating the property restores it to the dropdowns
  
  Useful when: the owner sells a property but wants to keep historical
  records for tax/proof purposes.
  ```

### 3. Bill Types (Configurable Categories per Property)

Bill types let the owner define what kinds of bills each property generates and how to remind for them.

- **Bill Type Definition**
  ```
  A bill type has:
  - id (UUID)
  - name (e.g., "Maintenance", "Property Tax", "Electricity", "Water")
  - property_id (FK to Properties — which property this bill type belongs to)
  - default_amount (optional, used to pre-fill the Add Bill form)
  - default_due_day (optional, day of month, 1-31)
  - frequency (monthly / quarterly / annual / one-time)
  - reminder_offsets_days (CSV of integers, e.g., "7,3,1" → remind 7, 3, and 1 day before due date)
  - active flag
  - deleted_at (soft-delete marker)
  ```

- **Reminder Offsets Are User-Configurable**
  ```
  The owner explicitly requested that reminder timing be configurable per
  bill type, not hardcoded:
  
  - Monthly maintenance: reminder_offsets_days = "3,1" 
    (remind 3 days before, then 1 day before)
  - Annual property tax: reminder_offsets_days = "30,7,1"
    (remind 30 days, 7 days, and 1 day before)
  - Electricity: reminder_offsets_days = "5,1"
  
  Each offset triggers BOTH a Google Calendar reminder event AND a
  Web Push notification on the same day.
  ```

- **Initial Seed (on first sign-in)**
  ```
  Mira Shop → "Maintenance" (monthly, due day 5, offsets 3,1)
  Mira Shop → "Property Tax" (annual, due day 1 of June, offsets 30,7,1)
  Mira Flat → "Maintenance" (monthly, due day 5, offsets 3,1)
  Mira Flat → "Property Tax" (annual, due day 1 of June, offsets 30,7,1)
  Chawl → "Electricity" (monthly, due day 15, offsets 5,1)
  ```

- **Adding a New Bill Type Later**
  ```
  Settings → Bill Types → "Add Bill Type"
  → Pick Property (dropdown)
  → Enter name, default_amount, default_due_day, frequency, reminder offsets
  → Save
  → New bill type immediately appears in the Add Bill dropdown for that property
  ```

### 4. Adding a Bill

Bills are individual instances of a bill type for a specific month/year.

- **Add Bill Flow**
  ```
  Step 1: User taps "Add Bill" on Dashboard or Bills page
  Step 2: Select Property (dropdown, only active properties shown)
  Step 3: Select Bill Type (dropdown, filtered to that property's active bill types)
  Step 4: Enter Month/Year (defaults to current month)
  Step 5: Enter Amount (defaults to bill type's default_amount if set)
  Step 6: Enter Due Date (defaults based on default_due_day of bill type)
  Step 7: Optionally upload bill image/PDF (Take Photo, Browse Files, Drag & Drop)
  Step 8: Optionally add notes
  Step 9: App checks for duplicates (see Duplicate Detection below)
  Step 10: User clicks "Save Bill"
  Step 11: Row appended to Sheet; if file uploaded, it's stored in Drive
  Step 12: Google Calendar events created for each reminder offset
  Step 13: Activity log entry written ("Created Mira Flat Maintenance Feb 2026")
  Step 14: Success toast + return to Dashboard
  ```

- **Input Methods for Bill Image (Three Ways)**
  ```
  Each upload zone offers THREE input methods:
  
  1. Drag & Drop (desktop primary)
     - Drag image/PDF file from file explorer into the zone
     - Zone highlights when file is hovering over it
  
  2. Browse Files (universal)
     - Click "Browse" button or zone itself
     - Opens OS file picker
     - Filter by image/PDF types (JPG, PNG, PDF)
  
  3. Take Photo with Camera (mobile primary, also works on desktop with webcam)
     - "Take Photo" button opens device camera
     - Implementation: HTML <input type="file" accept="image/*" capture="environment">
     - The capture="environment" attribute hints to use rear camera (best for paper bills)
     - Falls back to file picker on devices without a camera
     - On desktop: button is hidden or gracefully falls back to file picker
  ```

- **Camera UX Details**
  ```
  - Mobile browsers natively handle camera permission prompt — no custom UI needed
  - On first "Take Photo" click:
    * Browser asks user for camera permission
    * If denied: friendly message "Camera access needed. Use Browse instead, or
      enable camera in browser settings."
    * If allowed: native camera UI opens (full screen, with shutter button)
  - After photo capture:
    * Image preview appears in the zone
    * User can retake (clicks "Take Photo" again) or "Remove"
    * No image editing/cropping in v1 (use device's built-in cropping if needed)
  - Image quality:
    * Use device's native resolution (usually 8-12 MP)
    * Compress to JPEG quality ~85% before upload (reduces size by ~60%)
    * Auto-rotate based on EXIF orientation data
  ```

- **Image Optimization Before Upload**
  ```
  Before sending to Drive:
  - Read image as data URL or blob
  - If file > 2 MB: apply mild compression using browser-image-compression
    * Target: ~500 KB to 1 MB, quality 0.85, max width 2000px
    * NEVER compress so aggressively that text becomes illegible
    * Goal: reduce Drive quota use + faster upload on slow mobile networks
  - Strip EXIF metadata except orientation (privacy + smaller file)
  - Convert HEIC to JPEG (iOS photos sometimes come as HEIC)
  - Resulting file is what gets uploaded to Drive
  ```

- **Multiple Files per Bill**
  ```
  A bill can have multiple files attached:
  - Bill copy (original from society/municipality)
  - A follow-up notice or correction
  - The payment receipt (once paid)
  - Any other supporting document
  
  All stored in /NoDues/<Property>/<Year>/<Month>/<BillType>/
  with filenames including bill type, month, and a suffix (bill, receipt, notice, etc.)
  ```

### 5. "Bill Not Yet Generated" Status

A bill can exist in the system before its physical bill has been issued. This is useful when the owner wants to track that a bill is expected but it hasn't arrived from the society yet.

- **Status Values**
  ```
  - not_yet_generated: bill is expected but not yet received from society
  - pending: bill has been received, amount and due date known, not yet paid
  - paid: bill has been paid; receipt typically attached
  - skipped: bill was waived or doesn't apply this period
  ```

- **Behavior When Status = not_yet_generated**
  ```
  - amount and due_date are nullable
  - No Calendar event is created (there's no due date to remind for)
  - Dashboard shows "Bill not received yet" for this bill type/month
  - Doesn't count as overdue
  
  When the bill arrives:
  - User opens the row, fills in amount and due_date, saves
  - Status auto-flips to "pending"
  - Calendar events created based on the bill type's reminder offsets
  ```

- **Why This Matters**
  ```
  Distinguishes two very different situations:
  - "I forgot to pay this" (status = pending, due date past) → red overdue alert
  - "The society hasn't issued the bill yet" (status = not_yet_generated) → just a placeholder
  
  Without this, the owner would either:
  - See false overdue warnings every month before the society issues bills, or
  - Have no record that a bill is expected, making it easy to forget
  ```

### 6. Marking a Bill as Paid

When the owner pays a bill, the app records the payment details and removes the upcoming reminders.

- **Mark Paid Flow**
  ```
  Step 1: User taps a pending bill (from Dashboard or Bills List)
  Step 2: Taps "Mark Paid"
  Step 3: Enter Paid Date (defaults to today)
  Step 4: Select Payment Method (GPay / PhonePe / NEFT / Net Banking / Cash / Other)
  Step 5: Enter Transaction Reference / UTR Number (optional but recommended)
  Step 6: Upload Receipt image/PDF (screenshot of payment confirmation)
          - Same three input methods as bill image (Camera, Browse, Drag & Drop)
  Step 7: Optionally add notes
  Step 8: Save
  Step 9: Row status updated to "paid" in Sheet; receipt file uploaded to Drive
  Step 10: All future Calendar reminder events for this bill are DELETED automatically
  Step 11: Activity log entry written ("Marked Mira Flat Maintenance Feb 2026 as paid")
  Step 12: Success toast + return to previous view
  ```

- **Auto-Delete Calendar Event on Payment**
  ```
  Why delete instead of marking [Paid]:
  - The owner explicitly chose "delete completely" over "keep in history" during spec discussion
  - Once paid, there's no need to be reminded — the event would just be visual noise
  - Google Calendar already has the deletion record in its own history if needed
  
  Implementation:
  - When a bill is marked paid, look up its calendar_event_id (if not null)
  - Call Google Calendar API: events.delete(calendarId, eventId)
  - If deletion fails (e.g., offline, transient error):
    * Bill is still saved as paid in the Sheet
    * A retry is queued in a small "pending_calendar_ops" tab
    * User sees a non-blocking notice: "Bill saved. Calendar reminder will be removed when you're online."
    * Background sync retries on next app open with connectivity
  ```

### 7. Postpone (Reschedule) Pending Bills and To-Dos

Sometimes the owner can't pay on time and needs to push a bill to a later date — without losing track of when it was originally due.

- **Postpone Options**
  ```
  On any pending bill or to-do, a "Postpone" button is shown.
  
  Tapping it offers three options:
  
  1. Postpone by 1 day → due_date += 1 day
  2. Postpone by 1 week → due_date += 7 days
  3. Pick a specific date → date picker, must be in the future
  
  Plus an optional "Reason" free-text field (e.g., "salary not credited yet",
  "waiting for receipt from vendor").
  ```

- **Effect on Calendar Reminders**
  ```
  - The existing Google Calendar event for this bill is UPDATED (same event ID,
    new date) — reminders re-fire relative to the new date
  - No new event is created; no event is deleted
  - This preserves the linkage between the bill and its reminder event
  ```

- **Postpone History Is Preserved**
  ```
  Every postponement is recorded:
  
  - On the Bills/Todos row:
    * due_date is updated to the new date
    * original_due_date is captured on first save and NEVER overwritten
  
  - In the PostponeLog sheet tab, a new row is appended for EACH postponement:
    * id (UUID)
    * item_type (bill / todo)
    * item_id (FK to Bills.id or Todos.id)
    * from_date (the due date before this postponement)
    * to_date (the new due date)
    * reason (free-text, nullable)
    * postponed_by (email of the family member who did it)
    * postponed_at (timestamp)
  
  The Bill/To-Do detail page shows the full timeline:
    Original due: 2026-02-05
    → Postponed to 2026-02-08 on 2026-02-04 by ramesh@... (reason: salary delayed)
    → Postponed to 2026-02-10 on 2026-02-08 by ramesh@... (reason: vendor receipt pending)
    Current due: 2026-02-10
  ```

- **What Postpone Does NOT Do**
  ```
  - Postpone is only offered on pending items (status = pending). Paid bills,
    done to-dos, and not_yet_generated bills do not show the Postpone button.
  - For recurring to-dos, postponing affects only the current occurrence.
    The recurrence pattern's next-scheduled occurrence is unchanged.
  ```

### 8. To-Dos (General Reminders)

The to-do feature is for any reminder that isn't a bill — insurance renewals, AGM meetings, document submissions, water tank cleaning, etc. The owner explicitly requested this as a separate-but-integrated capability.

- **To-Do Definition**
  ```
  A to-do has:
  - id (UUID)
  - title (e.g., "Renew flat insurance", "Submit Form 15G to bank")
  - description (free-text, optional)
  - category_id (FK to TodoCategories, optional)
  - due_date (the current target date; may have been postponed)
  - original_due_date (the very first due date, never overwritten)
  - status (pending / done / skipped)
  - done_date (nullable)
  - recurrence_pattern_id (FK to RecurrencePatterns, optional — for recurring to-dos)
  - parent_todo_id (links recurring occurrences to the original; nullable)
  - reminder_offsets_days (CSV, e.g., "30,7,1"; optional)
  - attachment_file_ids (CSV of Google Drive file IDs, optional)
  - calendar_event_id (nullable)
  - notes (free-text, optional)
  - created_at, updated_at, deleted_at
  ```

- **Dashboard Integration**
  ```
  The owner explicitly wanted to-dos to appear BOTH in their own tab AND
  mixed into the Dashboard pending list. So:
  
  - Dashboard pending list shows bills + to-dos mixed, sorted by due date
  - Each item has a small visual tag distinguishing bill vs to-do
  - Clicking a to-do opens the To-Do detail page, not the Bill detail page
  
  - To-Dos tab is a dedicated list page with filters by category, status, date range
  ```

- **To-Do Categories (User-Managed)**
  ```
  Categories are CRUD-able via Settings → To-Do Categories. Seeded with:
  - Insurance
  - Tax
  - Society
  - Maintenance
  
  Each category has a name and an optional color (hex code) for UI badges.
  The owner can add, rename, recolor, or deactivate categories.
  ```

- **Recurrence Patterns (User-Managed, Reusable)**
  ```
  The owner explicitly requested fully user-defined recurrence patterns,
  not hardcoded "monthly/yearly" options.
  
  A recurrence pattern has:
  - id (UUID)
  - name (e.g., "Every 3 months on the 1st", "Annually on June 15")
  - interval_value (e.g., 3)
  - interval_unit (days / weeks / months / years)
  - anchor_day (day of month for monthly/yearly intervals, optional)
  - end_condition (never / after_n / until_date)
  - end_value (N for after_n, ISO date for until_date, nullable)
  - active flag
  
  Patterns are reusable: create once in Settings → Recurrence Patterns,
  then pick from a dropdown when adding any to-do.
  
  Example patterns the owner might create:
  - "Every 3 months on the 1st" — for water tank cleaning
  - "Annually on June 15" — for insurance renewal
  - "Every 6 months" — for fire-extinguisher service
  ```

- **Adding a To-Do**
  ```
  Step 1: To-Dos page → "Add To-Do"
  Step 2: Enter title, description (optional)
  Step 3: Pick category (optional)
  Step 4: Enter due date
  Step 5: Pick recurrence pattern from dropdown (optional)
  Step 6: Enter reminder offsets (optional, defaults to "7,1")
  Step 7: Optionally attach files (PDF, image)
  Step 8: Save
  Step 9: Row added to Todos tab; if attachments, they go to
          /NoDues/Todos/<Year>/
  Step 10: Google Calendar events created for each reminder offset
  Step 11: Activity log entry written
  ```

- **Marking a To-Do as Done**
  ```
  Step 1: Tap a pending to-do
  Step 2: Tap "Mark Done"
  Step 3: Enter done date (defaults to today)
  Step 4: Optionally add notes
  Step 5: Save
  Step 6: Status updated to "done"; Calendar event(s) DELETED automatically
  Step 7: If the to-do has a recurrence pattern:
          - Calculate the next occurrence date based on the pattern
          - Create a new Todos row with status = pending, parent_todo_id = original
          - Create new Calendar events for the next occurrence
  Step 8: Activity log entry written
  ```

### 9. Reminders & Notifications

The owner wanted to be reminded about bills via Google Calendar AND through phone notifications. Three reminder channels work together:

- **Channel 1: Google Calendar Events**
  ```
  When a bill is created (or moves from not_yet_generated to pending):
  - For each offset in the bill type's reminder_offsets_days:
    * Create a Google Calendar event titled "[Pending] <Property> <BillType> — <Month Year>"
    * Date: (due_date - offset_days)
    * Reminders attached to event: popup notification at event start time
  - Event IDs are stored in the bill row (calendar_event_id)
  
  Same logic for to-dos:
  - Event title: "[To-Do] <Title>"
  - Date: (due_date - offset_days)
  
  Calendar reminders work even when the app is closed because they're
  native Google Calendar events on the user's phone.
  ```

- **Channel 2: Web Push Notifications (PWA)**
  ```
  When the user installs the app to their phone home screen, they're prompted
  to allow push notifications. Once allowed:
  
  - A scheduled function (Vercel Cron or GitHub Actions, runs daily) reads
    the Sheet for any reminders due today
  - For each due reminder, dispatches a Web Push message to all family
    members' devices
  - Notification appears in the phone's notification tray exactly like
    WhatsApp or SMS — even if the app is closed
  - Tapping the notification opens the app directly to the relevant
    bill/to-do detail page
  
  Notification content (configurable in Settings → Notifications):
  - Default: "Bill reminder: Mira Shop Maintenance due tomorrow"
  - With amounts: "Bill reminder: Mira Shop Maintenance ₹2,587 due tomorrow"
  - "Hide details" mode: "Bill reminder" (useful if family members share lock screens)
  
  Independent of Calendar reminders — user can toggle either channel off
  in Settings.
  ```

- **Channel 3: PWA Install Banner (Onboarding)**
  ```
  On first visit on a phone, a dismissible banner appears:
    "Install this app to your home screen for reminders"
  
  Tapping it guides the user through "Add to Home Screen" in their browser.
  Once installed, the app opens full-screen (no browser bar) and is
  eligible for push notifications.
  
  The owner explicitly wanted push notifications to feel like WhatsApp
  notifications — this is the path to that.
  ```

- **Why Not WhatsApp Notifications**
  ```
  The owner asked whether free WhatsApp notifications are possible.
  After research:
  - Official WhatsApp Business API has no realistic free tier for
    personal use (₹0.78 per message in India for utility messages)
  - Unofficial libraries (whatsapp-web.js, Baileys) violate WhatsApp ToS
    and risk permanent ban of the owner's personal WhatsApp number
  
  PWA push notifications fully cover the "notifications like WhatsApp"
  need without ToS risk or cost.
  ```

### 10. PWA (Progressive Web App) + Offline Browsing

The app is built as a PWA so it can be installed to the phone's home screen and used like a native app. Same single React codebase covers Android, iOS, and desktop — there is no separate Android Studio project, no Play Store, no Kotlin/Swift.

- **Install to Home Screen**
  ```
  - On first visit, Chrome/Edge/Safari shows an "Install" prompt
    (or the user picks "Add to Home Screen" from the browser menu)
  - Once installed, the app opens full-screen with its own icon, no browser bar
  - Looks and feels like a native app
  - Requires:
    * manifest.json (app name, icon, theme color, display: standalone)
    * Service worker (registered by vite-plugin-pwa)
    * HTTPS (free from Vercel)
  ```

- **Offline Behavior (Level 2: Cached Bills for Offline Browsing)**
  ```
  The app shell (UI, layout, fonts, icons) is cached by the service worker
  so the app loads instantly even with no internet.
  
  Data cached locally in IndexedDB:
  - Last 6 months of bills + all of the current year
  - All to-dos (typically a small set)
  - All Properties, BillTypes, TodoCategories, RecurrencePatterns
    (small data, always cached)
  
  Offline capabilities:
  - Browse cached bills and to-dos
  - View metadata, search history
  - View receipt/bill files ONLY IF previously tapped "Download to device"
    (Drive files are not auto-cached to save phone storage)
  
  NOT available offline:
  - Adding new bills, marking paid, postponing, file uploads
  - These actions show: "Offline — try again when connected"
  
  Sync on reconnect:
  - When connectivity returns, the app refreshes data from the Sheet
    in the background
  - User sees a small badge if anything changed while offline
  
  Older bills (>6 months + previous years) are fetched on demand from
  the Sheet — also works as long as there's connectivity at that moment.
  ```

- **Why Level 2, Not Full Offline Writes**
  ```
  The owner asked how offline works given that everything lives in
  Google Drive. The answer: the offline cache is a READ-ONLY mirror.
  All writes still go to Drive/Sheet when connectivity returns.
  
  Full offline writes (queue + sync + conflict resolution) is significantly
  more complex and reserved for a future enhancement. For 95% of usage,
  the owner has internet anyway (they need it to pay bills via GPay).
  ```

### 11. Soft Delete & Recovery

Nothing in the app is ever permanently destroyed by accident. Every "Delete" action is a soft delete that can be recovered.

- **Soft Delete Behavior**
  ```
  Deletions on Bills, Todos, BillTypes, Properties, TodoCategories set
  deleted_at to the current timestamp instead of removing the row.
  
  All views filter out rows where deleted_at IS NOT NULL.
  
  Drive files associated with a soft-deleted bill are NOT deleted
  (file IDs stay in the row).
  ```

- **Undo Snackbar (10-Second Window)**
  ```
  Immediately after any delete:
  - A snackbar appears at the bottom: "Bill deleted. Undo"
  - Tapping Undo within 10 seconds restores the row to its previous state
  - If 10 seconds pass without Undo, the soft delete persists
  ```

- **Recycle Bin (90-Day Recovery)**
  ```
  Settings → Recycle Bin shows everything soft-deleted in the last 90 days.
  
  Per-item options:
  - Restore: sets deleted_at back to null, item reappears in the app
  - Permanently delete: removes the row entirely from the Sheet
    (Drive files are NOT auto-deleted; an optional checkbox offers
    "also delete the associated Drive files")
  
  After 90 days, items are still in the Sheet (deleted_at remains set)
  but the UI no longer shows them in Recycle Bin. Permanent purge is
  manual (a button in Settings) — no auto-purge in v1.
  ```

- **Cascading Confirmation for Properties**
  ```
  Deleting a Property triggers a confirmation:
  "This will hide N bill types and M bills under this property. Continue?"
  
  On confirm:
  - Only the Property row is marked deleted_at
  - Child bill types and bills remain queryable (status unchanged)
  - Restoring the property automatically restores its children to visibility
  ```

### 12. Duplicate Detection

Prevents accidentally entering the same bill twice (a common mistake when juggling 2–4 family members entering data).

- **Uniqueness Rule**
  ```
  At most one non-deleted bill per:
    (property_id, bill_type_id, month)
  
  Where "month" is the YYYY-MM string (e.g., "2026-02").
  ```

- **Warning Modal**
  ```
  When the user tries to add a bill that duplicates an existing one:
  
    Modal:
    "A bill for <Property> <BillType> for <Month Year> already exists
     (₹<amount>, marked <status> on <date>)."
    
    Options:
    - "Open existing" → navigates to the existing bill's detail page
    - "Add anyway" → forces save (rare case: genuine re-issue), logged in ActivityLog
    - "Cancel" → returns to the Add Bill form, no changes
  ```

- **Where Detection Runs**
  ```
  - In the Add Bill form: checks before save and shows the modal
  - On the Bills List: a soft warning indicator on any row that has a
    duplicate (in case duplicates exist from before this feature was added)
  ```

### 13. Activity Log (Family Transparency)

For a family-shared app, knowing "did you pay this?" / "I thought you did" is a real problem. The Activity Log solves it.

- **What Gets Logged**
  ```
  Every meaningful action writes a row to the ActivityLog sheet tab:
  - created (a bill, to-do, property, bill type, category, or recurrence pattern)
  - updated
  - paid (a bill marked paid)
  - marked_done (a to-do marked done)
  - postponed
  - deleted (soft-delete)
  - restored
  - file_uploaded
  
  Each row captures:
  - id (UUID)
  - timestamp
  - user_email (who did it)
  - action (the enum above)
  - entity_type (bill, todo, bill_type, property, todo_category, recurrence_pattern)
  - entity_id (FK to the relevant row)
  - summary (human-readable, e.g., "Marked Mira Flat Maintenance Feb 2026 as paid")
  ```

- **Dashboard Widget**
  ```
  A "Recent Activity" card on the Dashboard shows the latest 10 entries.
  Example display:
    Wife — Marked Mira Flat Maintenance Feb 2026 as paid — 4 hours ago
    Owner — Added Chawl Electricity Feb 2026 — yesterday
    Wife — Uploaded receipt for Mira Shop Maintenance Feb 2026 — 2 days ago
  
  No need to ask "did you pay this?" — already answered.
  ```

- **Full Log View**
  ```
  Settings → Activity Log:
  - Searchable, filterable list of all entries
  - Filters: by user, action type, entity type, date range
  - Read-only (the Sheet itself is editable but discouraged)
  ```

- **Growth Considerations**
  ```
  The Activity Log grows continuously. For v1, no auto-archival.
  At ~20 actions/month per family of 4 = ~1,000 entries/year, it will
  remain small for years. If it ever crosses 10,000 entries (a decade
  of heavy use), a v1.1 feature can archive older entries to a separate
  sheet tab.
  ```

### 14. Proof Generation (Society / Municipality Disputes)

The original problem: when the society or municipality says "you didn't pay this 2 years ago", the owner needs to produce proof in seconds. This is the v1 baseline; a richer "Audit Pack" feature is deferred to post-v1.

- **Quick Proof (v1 Baseline)**
  ```
  From any paid bill's detail page:
  - "Download Bill" → downloads the original bill image/PDF from Drive
  - "Download Receipt" → downloads the payment receipt from Drive
  - "Copy Payment Details" → copies plain-text summary to clipboard:
  
    ----
    Payment proof for Mira Flat Maintenance — Feb 2026
    Property: Mira Flat
    Amount: ₹1,100
    Paid via: GPay
    UTR/Reference: 412345678901
    Paid on: 15 February 2026
    Bill and receipt images attached separately.
    ----
  
  The owner shares the downloaded files + this summary via WhatsApp/email
  with the disputing party. Total time: ~30 seconds.
  ```

- **Audit Pack (Future Enhancement, Not in v1)**
  ```
  A "Generate Audit Pack" button that:
  - Takes a date range and property/bill type filter
  - Zips all matching bills + receipts together
  - Includes a summary CSV/PDF
  - Returns a single Drive shareable link
  
  Useful for: tax filing, multi-bill disputes, year-end reviews.
  Deferred to v1.1 to keep the v1 scope tight.
  ```

### 15. Currency Support

The owner is in India, default is INR. But hardcoding ₹ everywhere creates lock-in.

- **Single-Currency v1**
  ```
  Config.currency stores the ISO 4217 code (default "INR").
  All amounts display formatted per the user's locale:
  - INR: ₹1,100 (with Indian comma grouping: ₹1,00,000)
  - USD: $1,100.00
  - EUR: €1.100,00
  
  Configurable in Settings → Preferences.
  
  No per-bill currency override in v1 — all bills use Config.currency.
  ```

## Data Model

### Google Sheet Structure

The application uses a single Google Sheet named `NoDues - Database` with the following tabs. Each tab is a "table" in the no-backend architecture.

#### Tab: Properties
```
- id (string, UUID, IMMUTABLE)
- name (string, e.g., "Mira Shop", "Mira Flat", "Chawl")
- address (string, nullable, free-text)
- notes (string, nullable, e.g., society contact)
- active (boolean)
- created_at (ISO 8601 timestamp, IMMUTABLE)
- deleted_at (ISO 8601 timestamp, nullable — soft-delete marker)
```

#### Tab: BillTypes
```
- id (string, UUID, IMMUTABLE)
- property_id (string, FK to Properties.id)
- name (string, e.g., "Maintenance", "Property Tax", "Electricity")
- default_amount (decimal, nullable)
- default_due_day (integer, 1-31, nullable)
- frequency (enum: monthly, quarterly, annual, one-time)
- reminder_offsets_days (string, CSV of integers, e.g., "7,3,1")
- active (boolean)
- created_at (timestamp, IMMUTABLE)
- deleted_at (timestamp, nullable)
```

#### Tab: Bills
```
- id (string, UUID, IMMUTABLE)
- bill_type_id (string, FK to BillTypes.id)
- month (string, YYYY-MM format, e.g., "2026-02")
- amount (decimal, nullable when status = not_yet_generated)
- due_date (YYYY-MM-DD, nullable when not_yet_generated; current due date, may have been postponed)
- original_due_date (YYYY-MM-DD, the first due date ever set; IMMUTABLE after first save)
- status (enum: not_yet_generated, pending, paid, skipped)
- paid_date (YYYY-MM-DD, nullable)
- payment_method (string, free-text from dropdown: GPay, PhonePe, NEFT, Net Banking, Cash, Other)
- transaction_ref (string, nullable, UTR or transaction reference)
- bill_file_ids (string, CSV of Drive file IDs, nullable — multiple files allowed)
- receipt_file_ids (string, CSV of Drive file IDs, nullable — multiple files allowed)
- calendar_event_ids (string, CSV of Calendar event IDs, nullable — one per reminder offset)
- notes (string, nullable)
- created_at (timestamp, IMMUTABLE)
- updated_at (timestamp)
- deleted_at (timestamp, nullable)

-- Composite uniqueness key (for duplicate detection):
- composite_key (string, computed: property_id + "|" + bill_type_id + "|" + month)
  Example: "abc-123|def-456|2026-02"
  Used for fast O(1) duplicate lookup before save.
```

#### Tab: TodoCategories
```
- id (string, UUID)
- name (string, e.g., "Insurance", "Tax", "Society", "Maintenance")
- color (string, optional hex code for UI badge)
- active (boolean)
- deleted_at (timestamp, nullable)
```

#### Tab: RecurrencePatterns
```
- id (string, UUID)
- name (string, e.g., "Every 3 months on the 1st")
- interval_value (integer, e.g., 3)
- interval_unit (enum: days, weeks, months, years)
- anchor_day (integer, day of month for monthly/yearly, nullable)
- end_condition (enum: never, after_n, until_date)
- end_value (string, N for after_n, ISO date for until_date, nullable)
- active (boolean)
```

#### Tab: Todos
```
- id (string, UUID)
- title (string)
- description (string, nullable)
- category_id (string, FK to TodoCategories.id, nullable)
- due_date (YYYY-MM-DD, may have been postponed)
- original_due_date (YYYY-MM-DD, IMMUTABLE after first save)
- status (enum: pending, done, skipped)
- done_date (YYYY-MM-DD, nullable)
- recurrence_pattern_id (string, FK to RecurrencePatterns.id, nullable)
- parent_todo_id (string, FK to Todos.id, nullable — links recurring instances)
- reminder_offsets_days (string, CSV, e.g., "30,7,1", nullable)
- attachment_file_ids (string, CSV of Drive file IDs, nullable)
- calendar_event_ids (string, CSV, nullable)
- notes (string, nullable)
- created_at (timestamp, IMMUTABLE)
- updated_at (timestamp)
- deleted_at (timestamp, nullable)
```

#### Tab: PostponeLog
```
- id (string, UUID)
- item_type (enum: bill, todo)
- item_id (string, FK to Bills.id or Todos.id)
- from_date (YYYY-MM-DD, due date before this postponement)
- to_date (YYYY-MM-DD, due date after this postponement)
- reason (string, free-text, nullable)
- postponed_by (string, email of the user who postponed)
- postponed_at (timestamp)
```

#### Tab: ActivityLog
```
- id (string, UUID)
- timestamp (ISO 8601)
- user_email (string)
- action (enum: created, updated, paid, marked_done, postponed, deleted, restored, file_uploaded)
- entity_type (enum: bill, todo, bill_type, property, todo_category, recurrence_pattern)
- entity_id (string, FK to the relevant row)
- summary (string, human-readable description)
```

#### Tab: Config
```
Single-row settings (key-value style):
- drive_root_folder_id (string, Drive folder ID for /NoDues/)
- calendar_id (string, Google Calendar ID for "NoDues Reminders")
- timezone (string, default "Asia/Kolkata")
- currency (string, ISO 4217, default "INR")
- allowed_user_emails (string, CSV of family member emails with write access)
- notification_show_amounts (boolean, default true)
- push_notifications_enabled (boolean, default false until user grants permission)
- calendar_reminders_enabled (boolean, default true)
```

### Google Drive Structure

Property-first hierarchy so each property's documents are self-contained.

```
NoDues/
├── MiraShop/
│   └── 2026/
│       ├── 02-February/
│       │   ├── Maintenance/
│       │   │   ├── bill_2026-02.pdf
│       │   │   └── receipt_2026-02.jpg
│       │   └── PropertyTax/
│       └── 03-March/
├── MiraFlat/
│   └── 2026/...
├── Chawl/
│   └── 2026/...
└── Todos/
    ├── 2026/
    │   └── insurance_renewal_2026-06.pdf
    └── 2027/
```

File naming convention: `<type>_<YYYY-MM>.<ext>` where `<type>` is `bill`, `receipt`, `notice`, etc. To-do attachments use `<slug>_<YYYY-MM>.<ext>`.

## Google APIs & Configuration

### Required Google Cloud Setup

1. **Create Google Cloud Project**
   - Project name: `nodues` (or any name)
   - Billing: not strictly required (no paid APIs used) but enable it anyway to raise free-tier quotas if needed

2. **Enable APIs**
   ```
   - Google Drive API
   - Google Sheets API
   - Google Calendar API
   ```

3. **Create OAuth 2.0 Credentials**
   ```
   - Application type: Web application
   - Authorized JavaScript origins:
     * http://localhost:5173 (Vite dev)
     * https://<your-app>.vercel.app (production)
   - Authorized redirect URIs: same as above
   - Copy Client ID → store in .env as VITE_GOOGLE_CLIENT_ID
   ```

4. **Configure OAuth Consent Screen**
   ```
   - User type: External
   - Scopes:
     * .../auth/drive.file
     * .../auth/spreadsheets
     * .../auth/calendar
     * openid, email, profile
   - Test users: add the owner's Gmail + family members' Gmails (up to 100 — way more than needed)
   - No verification submission needed for personal/family use
   ```

5. **Set Up Web Push (Firebase Cloud Messaging)**
   ```
   - Create a Firebase project (free)
   - Enable Firebase Cloud Messaging
   - Generate VAPID key pair (web push)
   - Store public key in .env as VITE_VAPID_PUBLIC_KEY
   - Store private key as a Vercel environment variable (used by the scheduled function)
   ```

### Environment Variables (.env)
```
VITE_GOOGLE_CLIENT_ID=<your-oauth-client-id>.apps.googleusercontent.com
VITE_GOOGLE_PROJECT_ID=<your-gcp-project-id>
VITE_APP_NAME="NoDues"
VITE_DRIVE_FOLDER_NAME="NoDues"
VITE_SHEET_NAME="NoDues - Database"
VITE_CALENDAR_NAME="NoDues Reminders"
VITE_VAPID_PUBLIC_KEY=<base64-vapid-public-key>

# Server-side env vars (Vercel project settings, not in .env):
VAPID_PRIVATE_KEY=<base64-vapid-private-key>
VAPID_SUBJECT=mailto:owner@example.com
```

## Application Architecture

### Folder Structure
```
nodues/
├── public/
│   ├── favicon.svg
│   ├── icon-192.png
│   ├── icon-512.png
│   └── manifest.json (generated by vite-plugin-pwa)
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── SignInButton.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   ├── bills/
│   │   │   ├── BillForm.jsx
│   │   │   ├── BillDetail.jsx
│   │   │   ├── BillsList.jsx
│   │   │   ├── MarkPaidForm.jsx
│   │   │   └── PostponeDialog.jsx
│   │   ├── todos/
│   │   │   ├── TodoForm.jsx
│   │   │   ├── TodoDetail.jsx
│   │   │   ├── TodosList.jsx
│   │   │   └── MarkDoneForm.jsx
│   │   ├── upload/
│   │   │   ├── FileDropzone.jsx
│   │   │   └── CameraCapture.jsx
│   │   ├── dashboard/
│   │   │   ├── PendingList.jsx
│   │   │   ├── CurrentMonthStatus.jsx
│   │   │   ├── QuickStats.jsx
│   │   │   ├── RecentActivity.jsx
│   │   │   └── DashboardPage.jsx
│   │   ├── settings/
│   │   │   ├── PropertiesSettings.jsx
│   │   │   ├── BillTypesSettings.jsx
│   │   │   ├── TodoCategoriesSettings.jsx
│   │   │   ├── RecurrencePatternsSettings.jsx
│   │   │   ├── NotificationsSettings.jsx
│   │   │   ├── PreferencesSettings.jsx
│   │   │   ├── RecycleBin.jsx
│   │   │   ├── ActivityLog.jsx
│   │   │   └── FamilyAccess.jsx
│   │   └── shared/
│   │       ├── Navbar.jsx
│   │       ├── Toast.jsx
│   │       ├── UndoSnackbar.jsx
│   │       ├── InstallPrompt.jsx
│   │       └── LoadingSpinner.jsx
│   ├── services/
│   │   ├── googleAuth.js
│   │   ├── driveService.js
│   │   ├── sheetsService.js
│   │   ├── calendarService.js
│   │   ├── pushService.js
│   │   ├── cacheService.js (IndexedDB)
│   │   └── recordService.js (high-level orchestration)
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useBills.js
│   │   ├── useTodos.js
│   │   ├── useProperties.js
│   │   ├── useOnlineStatus.js
│   │   └── useUpload.js
│   ├── utils/
│   │   ├── imageProcessor.js
│   │   ├── duplicateDetector.js
│   │   ├── recurrenceCalculator.js
│   │   ├── csvExporter.js
│   │   ├── currencyFormatter.js
│   │   └── dateHelpers.js
│   ├── context/
│   │   ├── AuthContext.jsx
│   │   └── ConfigContext.jsx
│   ├── config/
│   │   └── branding.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── api/
│   └── push-dispatcher.js (Vercel serverless function, runs daily via Vercel Cron)
├── .env
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.js
├── vercel.json (cron schedule)
└── README.md
```

### Service Modules

#### googleAuth.js
```
Responsibilities:
- Initialize Google OAuth client
- Handle sign-in / sign-out for owner and family members
- Provide access token to other services
- Refresh token when expired
- Check if signed-in email is in allowed_user_emails for write access
```

#### driveService.js
```
Functions:
- ensureAppFolder()                                 → Creates /NoDues/ if missing
- ensurePropertyFolder(propertyName)                → Creates /NoDues/<Property>/
- ensureMonthFolder(propertyName, year, month, billTypeName) 
                                                    → Creates nested year/month/billtype folder
- uploadFile(file, folderPath, filename)            → Uploads, returns Drive file ID + webViewLink
- getFileUrl(fileId)                                → Returns webViewLink for displaying file
- downloadFile(fileId)                              → For offline-available files
- deleteFile(fileId)                                → Deletes file from Drive (used only on permanent purge)
```

#### sheetsService.js
```
Functions:
- ensureAppSheet()                                  → Creates the Sheet with all tabs if missing
- ensureTab(tabName, columns)                       → Creates a missing tab with header row
- appendRow(tabName, row)                           → Appends a row
- getAllRows(tabName, filter)                       → Returns all non-deleted rows (filter optional)
- updateRow(tabName, rowId, fields)                 → Updates matching row by id
- softDeleteRow(tabName, rowId)                     → Sets deleted_at on the row
- restoreRow(tabName, rowId)                        → Clears deleted_at
- findByCompositeKey(tabName, compositeKey)         → For duplicate detection on Bills
```

#### calendarService.js
```
Functions:
- ensureAppCalendar()                               → Creates "NoDues Reminders" calendar if missing
- createReminderEvent(billOrTodo, offsetDays)       → Creates one Calendar event
- updateReminderEvent(eventId, newDate)             → Used during Postpone
- deleteReminderEvent(eventId)                      → Used when bill is paid / to-do is done
- batchDeleteEvents(eventIds)                       → Used when multiple reminders need clearing
```

#### pushService.js (client-side)
```
Functions:
- requestPermission()                               → Asks user for notification permission
- subscribeToPush()                                 → Registers device with Firebase, stores subscription in Sheet
- unsubscribeFromPush()                             → Removes subscription
```

#### push-dispatcher.js (server-side, Vercel function, runs daily via Vercel Cron)
```
Responsibilities:
- Reads Sheet for any bills/to-dos with reminders due today
- For each due reminder, dispatches a Web Push message to all subscribed devices
- Uses VAPID private key for signing
- Logs dispatches to a "PushDispatchLog" tab (for debugging)
```

#### cacheService.js
```
Functions:
- cacheBills(bills)                                 → Stores bills in IndexedDB
- getCachedBills(filter)                            → Reads from IndexedDB (used when offline)
- cacheTodos(todos)
- getCachedTodos(filter)
- clearCache()                                      → Used on sign-out
- isCacheStale(maxAgeMinutes)                       → Helper to decide whether to refetch
```

#### recordService.js (high-level orchestration)
```
Functions:
- createBill(billData, billFile)                    → Combines Drive upload + Sheet append + Calendar create
- markBillPaid(billId, paidData, receiptFile)       → Receipt upload + Sheet update + Calendar delete
- postponeBill(billId, newDate, reason)             → Sheet update + Calendar update + PostponeLog append
- softDeleteBill(billId)                            → Sheet update + ActivityLog append (no Drive deletion)
- createTodo(todoData, attachmentFiles)
- markTodoDone(todoId, doneData)                    → If recurring, also creates next occurrence
- ... (similar for properties, bill types, categories, patterns)
```

## UI / Pages

### Page List
```
- / (Landing)                       → Sign-in screen if not authenticated, else redirect to /dashboard
- /dashboard                        → Pending list + current-month status + quick stats + recent activity
- /bills                            → Bills list with search, filters, sort
- /bills/:billId                    → Bill detail (view, edit, mark paid, postpone, delete)
- /bills/new                        → Add bill form
- /todos                            → To-Dos list with filters
- /todos/:todoId                    → To-Do detail (view, edit, mark done, postpone, delete)
- /todos/new                        → Add to-do form
- /settings                         → Settings hub
- /settings/properties              → CRUD for properties
- /settings/bill-types              → CRUD for bill types
- /settings/todo-categories         → CRUD for to-do categories
- /settings/recurrence-patterns     → CRUD for recurrence patterns
- /settings/notifications           → Toggle push, calendar reminders, "hide amounts" mode
- /settings/preferences             → Currency, timezone, date format, app name
- /settings/recycle-bin             → Soft-deleted items (last 90 days)
- /settings/activity-log            → Full activity log with filters
- /settings/family-access           → Manage allowed_user_emails
```

### Navbar
```
- Logo / app name (left)
- Links: Dashboard | Bills | To-Dos | Settings (center, hidden behind hamburger on mobile)
- User avatar + email (right, dropdown with Sign Out)
- Offline indicator (subtle banner if no internet)
```

### Design System
```
- Tailwind CSS utility classes
- Color palette:
  * Primary: indigo-600 (#4338CA)
  * Success: emerald-600 (paid status)
  * Warning: amber-500 (pending, near due)
  * Danger: red-600 (overdue, delete actions)
  * Neutral: slate (50-900)
- Typography: system font stack
- Rounded corners: rounded-lg (8px)
- Shadows: shadow-sm for cards, shadow-md on hover
- Mobile-responsive: phone is the primary use case (capture bill → upload → mark paid)
```

## Build Order (Recommended Implementation Sequence)

Build in this order so each step is independently testable:

```
Phase 0: Design System Setup (BEFORE writing any UI code)
0a. Install Node.js, Python 3.x, and the UI UX Pro Max CLI:
      npm install -g uipro-cli
      python3 --version  # verify Python 3 is available
0b. Create the project folder (Phase 1 step 1 below) so there's a project to install into
0c. Install the skill for Claude Code (or whichever AI assistant is being used):
      cd /path/to/nodues
      uipro init --ai claude   # or --ai cursor, --ai windsurf, etc.
    This creates .claude/skills/ui-ux-pro-max/ in the project.
0d. Generate the project-wide design system (MASTER.md):
      python3 .claude/skills/ui-ux-pro-max/scripts/search.py \
        "personal finance bill tracker family shared" \
        --design-system --persist -p "NoDues"
    This creates design-system/MASTER.md — a single source of truth for
    colors, typography, spacing, components, anti-patterns.
0e. (Optional) Generate per-page overrides for pages with distinct needs:
      python3 .claude/skills/ui-ux-pro-max/scripts/search.py \
        "dashboard analytics pending bills" \
        --design-system --persist -p "NoDues" --page "dashboard"
    Useful for: Dashboard (data-dense), Settings (form-heavy), Bill Detail (image preview).
0f. Commit design-system/ to git so the design source of truth is versioned with the code
0g. In every subsequent coding prompt, instruct the AI assistant to read MASTER.md
    (and the relevant page override) before generating UI code. Example prompt template:
      "Read design-system/MASTER.md and design-system/pages/<page>.md if it exists.
       Now build the <page name> page following section <X> of spec.md.
       Use React, Tailwind, and follow the design system strictly."

Phase 1: Project Setup
1. Create Vite + React project, install Tailwind, set up routing
2. Set up Google Cloud project, enable APIs, create OAuth credentials
3. Implement Google sign-in flow
4. Verify sign-in works → see user email displayed

Phase 2: Sheet & Drive Bootstrapping
5. Implement ensureAppSheet() — creates all tabs with header rows
6. Implement ensureAppFolder() — creates /NoDues/
7. On first sign-in, seed Properties, BillTypes, TodoCategories, Config

Phase 3: Properties + Bill Types CRUD
8. Build Settings → Properties page (list, add, edit, soft-delete)
9. Build Settings → Bill Types page (with Property dropdown)
10. Verify CRUD works end-to-end against the Sheet

Phase 4: Bills Core Loop
11. Build "Add Bill" form (Property, BillType, Month, Amount, Due Date)
12. Implement duplicate detection via composite_key
13. Build Bills List with sort + simple filters
14. Build Bill Detail page (view + edit)
15. Implement "Mark Paid" with payment details + receipt upload

Phase 5: File Uploads
16. Build FileDropzone with drag-drop, browse, and camera capture
17. Implement image optimization (compression, EXIF, HEIC conversion)
18. Test on phone: take photo → upload → see file in Drive

Phase 6: Calendar Integration
19. Implement ensureAppCalendar() — creates "NoDues Reminders" calendar
20. Implement createReminderEvent() — for each offset on bill creation
21. Implement deleteReminderEvent() — when bill marked paid
22. Implement updateReminderEvent() — for postpone
23. Verify events appear in user's Google Calendar

Phase 7: Postpone + Soft Delete
24. Build Postpone dialog (+1 day, +1 week, pick date, reason)
25. Implement PostponeLog tab writes
26. Implement soft-delete with undo snackbar
27. Build Settings → Recycle Bin

Phase 8: To-Dos
28. Build To-Do Categories settings page
29. Build Recurrence Patterns settings page
30. Build Add To-Do form + To-Dos list + Detail page
31. Implement recurrence: marking a recurring to-do done creates the next occurrence

Phase 9: Activity Log
32. Wire ActivityLog writes into all create/update/delete actions
33. Build Dashboard "Recent Activity" widget
34. Build Settings → Activity Log page with filters

Phase 10: Dashboard
35. Build pending list (bills + to-dos mixed, sorted by due date)
36. Build current-month status grid
37. Build quick stats (total pending, overdue count, total paid this year)

Phase 11: PWA + Push Notifications
38. Install vite-plugin-pwa, configure manifest.json
39. Verify "Install to home screen" works on Android + iOS
40. Implement service worker caching of app shell
41. Implement IndexedDB cache of bills/to-dos
42. Set up Firebase Cloud Messaging, generate VAPID keys
43. Implement client-side push permission flow + subscription
44. Build /api/push-dispatcher.js serverless function
45. Configure Vercel Cron to run dispatcher daily
46. Test end-to-end: bill with reminder → push notification arrives on phone

Phase 12: Family Access
47. Build Settings → Family Access (manage allowed_user_emails)
48. Test second family member signing in and using the app

Phase 13: Polish & Deploy
49. Add CSV export
50. Add basic Proof generation (download bill + receipt + copy summary)
51. Mobile responsive polish
52. Deploy to Vercel
53. Update OAuth credentials with production URL
54. Run final acceptance criteria checklist
```

### Why Phase 0 Matters

```
Without a design system established up front, each of the 18+ UI pages
gets generated with slightly different colors, spacing, and component
choices — even when the same AI assistant builds them all. This leads to
the classic "AI-built app that looks like an AI built it" feel: technically
working but visually inconsistent.

Phase 0 takes ~10 minutes. The output (design-system/MASTER.md) acts as a
contract between the spec and the AI assistant: every UI prompt for the
remaining phases references this file, so all pages share one coherent
visual language from the first component to the last.

The skill itself does NOT modify any code or run any background process.
It only generates the MASTER.md file once and lets the AI assistant read
it when prompted. There is no lock-in: the skill can be removed at any
time and the generated design-system/ folder remains usable.
```

## Deliverables

1. **Source Code**
   - React + Vite project with PWA support
   - All components, services, hooks, utils as per folder structure
   - Tailwind CSS configured
   - Environment variables documented in `.env.example`

2. **Documentation**
   - `README.md` — setup, run locally, deploy
   - `spec.md` — this file (project spec)
   - `GOOGLE_CLOUD_SETUP.md` — step-by-step GCP + Firebase setup with screenshots
   - Inline JSDoc comments on all service functions

3. **Testing Data**
   - 5 sample bill images for testing (variety: maintenance receipt, property tax notice, electricity bill)
   - 5 sample payment screenshots (GPay, PhonePe, NEFT)
   - Manual test plan covering the 12 user flows in the Build Order

4. **Deployment**
   - Live URL on Vercel
   - OAuth credentials configured for both localhost and production
   - Firebase Cloud Messaging configured and reachable
   - Vercel Cron schedule configured
   - First-time sign-in tested end-to-end (owner + 1 family member)

## Success Criteria

- ✅ Owner can sign in with Google account
- ✅ Browser tab title shows "NoDues · <page name>"
- ✅ Navbar displays "NoDues" wordmark on every page
- ✅ App auto-creates `/NoDues/` folder structure in Drive on first sign-in
- ✅ App auto-creates `NoDues - Database` spreadsheet with all required tabs on first sign-in
- ✅ App auto-creates `NoDues Reminders` Google Calendar on first sign-in
- ✅ Properties (Mira Shop, Mira Flat, Chawl) are seeded on first sign-in
- ✅ Bill Types are seeded under their respective properties on first sign-in
- ✅ To-Do Categories (Insurance, Tax, Society, Maintenance) are seeded on first sign-in
- ✅ Config.currency defaults to INR, Config.timezone to Asia/Kolkata
- ✅ Owner can add, rename, deactivate, and soft-delete Properties
- ✅ Owner can add, rename, deactivate, and soft-delete Bill Types (scoped to Property)
- ✅ Each Bill Type has user-configurable reminder offsets (e.g., "7,3,1")
- ✅ Adding a Bill checks for duplicates via composite key (property + bill type + month)
- ✅ Duplicate detection shows a modal with "Open existing / Add anyway / Cancel" options
- ✅ Bill can be saved with status = not_yet_generated, no amount, no due date
- ✅ When amount + due date are added to a not_yet_generated bill, it auto-flips to pending and Calendar events are created
- ✅ User can attach multiple files to a bill (bill PDF, follow-up notice, etc.)
- ✅ User can take a photo with device camera for bill image (mobile)
- ✅ User can take a photo with device camera for receipt image (mobile)
- ✅ User can choose existing image from device gallery / file system
- ✅ User can drag & drop files on desktop browsers
- ✅ Camera defaults to rear (environment) camera for bill capture
- ✅ Images > 2 MB are auto-compressed before upload without losing legibility
- ✅ HEIC images (iOS) are auto-converted to JPEG
- ✅ Images auto-rotate based on EXIF orientation data
- ✅ When a bill is marked paid, all its Calendar reminder events are deleted automatically
- ✅ When deletion of a Calendar event fails (offline), the bill is still saved as paid and retry is queued
- ✅ When a to-do is marked done, its Calendar reminder events are deleted automatically
- ✅ Pending bills and to-dos can be postponed by +1 day, +1 week, or to a user-picked future date
- ✅ Postponing updates the existing Calendar event date (does not delete + recreate)
- ✅ Each postponement is logged in PostponeLog with from/to dates, reason, user email, timestamp
- ✅ original_due_date is captured on first save and never overwritten by postpone
- ✅ Bill/To-Do detail page shows the full postponement history
- ✅ Postpone is not offered on paid bills, done to-dos, or not_yet_generated bills
- ✅ To-Dos appear on the Dashboard pending list mixed with bills, sorted by due date
- ✅ To-Dos also have their own dedicated tab with filters
- ✅ User can define custom recurrence patterns in Settings (interval value, unit, anchor day, end condition)
- ✅ Recurrence patterns can be applied to to-dos
- ✅ Marking a recurring to-do done auto-creates the next occurrence with parent_todo_id linkage
- ✅ To-Dos support optional file attachments (PDF, image) stored in /NoDues/Todos/<Year>/
- ✅ App can be installed to phone home screen on Android (Chrome) and iOS (Safari)
- ✅ Installed app opens full-screen with no browser bar
- ✅ After granting notification permission, push notifications are delivered at each configured reminder offset
- ✅ Push notifications appear in phone notification tray even when the app is closed
- ✅ Tapping a push notification opens the relevant bill/to-do detail page
- ✅ Notification content can be set to "hide amounts" in Settings (lock-screen privacy)
- ✅ Scheduled dispatcher (Vercel Cron) runs daily and sends push notifications for due reminders
- ✅ Both push notifications and Google Calendar reminders can be toggled independently in Settings
- ✅ With airplane mode on, the installed app loads instantly (cached app shell)
- ✅ With airplane mode on, the user can browse cached bills (last 6 months + current year) and to-dos
- ✅ With airplane mode on, attempting to write (add, edit, mark paid) shows "offline — try again when connected"
- ✅ When connectivity returns, the cache is refreshed automatically without user action
- ✅ All deletions are soft (set deleted_at); no item is permanently removed via the UI
- ✅ Undo snackbar appears for 10 seconds after any delete
- ✅ Settings → Recycle Bin shows soft-deleted items from the last 90 days with Restore action
- ✅ Deleting a Property triggers cascade confirmation but only marks the Property as deleted (children unaffected)
- ✅ Every meaningful action writes a row to ActivityLog with timestamp, user, action, entity, summary
- ✅ Dashboard "Recent Activity" widget shows the latest 10 ActivityLog entries
- ✅ Settings → Activity Log shows the full log with filter by user/action/entity/date
- ✅ Owner can add family member emails in Settings → Family Access
- ✅ Family members with their email in allowed_user_emails get write access; others see a friendly "ask the owner" message
- ✅ All monetary amounts display formatted per Config.currency (default INR with Indian comma grouping)
- ✅ Search box on Bills list finds records by property, bill type, month, transaction reference
- ✅ Filters (date range, status, payment mode, amount range, property) combine with AND logic
- ✅ Multiple filters shown as removable chips above the list
- ✅ Records remain searchable and retrievable 3+ years after creation
- ✅ Bill detail page offers "Download Bill", "Download Receipt", "Copy Payment Details" for quick proof generation
- ✅ App runs entirely on free tiers (Vercel, Google APIs, Firebase Cloud Messaging) for ~250 records/year volume
- ✅ Responsive on mobile (capture bill with phone → upload → mark paid)
- ✅ No backend server required (Vercel serverless function for push dispatch only)
- ✅ Deployed and accessible via public URL
- ✅ Project includes a `design-system/MASTER.md` file generated by UI UX Pro Max before any UI code was written
- ✅ All UI pages (Dashboard, Bills, To-Dos, Settings, etc.) share consistent colors, typography, spacing, and components as defined in MASTER.md
- ✅ UI UX Pro Max is documented as a development-time tool only (no production runtime dependencies, no npm packages added to the React bundle)

## Out of Scope (Explicitly Not Building)

To keep v1 focused, the following are **not** part of v1:
- Audit Pack generation (zip multiple bills + receipts for a date range with a summary) — deferred to v1.1
- Annual summary / yearly report PDF export — deferred
- Bill amount change alerts (warn if new amount differs >20% from previous month) — deferred
- Late fee tracking on overdue bills — deferred
- Quick-pay UPI deep links (tap to open GPay/PhonePe with amount pre-filled) — deferred
- Full backup download button (Sheet + all Drive files as a zip) — deferred
- Receipt OCR to auto-fill amount, date, UTR — deferred
- Bulk CSV import of historical bills — owner explicitly chose to start fresh
- WhatsApp notifications — no realistic free path exists for personal use
- Email notifications — Calendar + push notifications cover the need
- Full offline write support with sync queue — current offline is read-only
- Multi-currency per bill — single currency (Config.currency) for v1
- Admin dashboard / role hierarchy beyond owner + family members
- Backend server / database beyond Google Sheets
- Mobile native app (PWA covers the "feels like a native app" need with one codebase)
- Automatic bill fetching from utility providers
- Bank account integration / auto-import
- Email parsing of e-bills
- Tax categorization / GST handling
- Notification system beyond push + Calendar (no SMS, no WhatsApp, no email)

These can be considered for future versions once v1 is stable.
