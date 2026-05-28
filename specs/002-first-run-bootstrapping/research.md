# Research: First-Run Bootstrapping — Google API Patterns

**Date**: 2026-05-28 | **Feature**: 002-first-run-bootstrapping

All examples use `fetch()` with Bearer token authentication. No Google client libraries.

---

## R-001: Google Drive API v3 — Creating a Folder

### REST Endpoint

```
POST https://www.googleapis.com/drive/v3/files
```

### Creating a Folder at Drive Root

To create a folder, use `files.create` with `mimeType` set to `application/vnd.google-apps.folder`. If `parents` is omitted, the folder is placed in the user's My Drive root.

```typescript
interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  createdTime?: string;
  modifiedTime?: string;
}

async function createFolder(
  accessToken: string,
  name: string
): Promise<DriveFile> {
  const response = await fetch(
    'https://www.googleapis.com/drive/v3/files',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to create folder: ${response.status}`);
  }

  return response.json();
}
```

**Request body** (minimal):
```json
{
  "name": "NoDues",
  "mimeType": "application/vnd.google-apps.folder"
}
```

**Response** (relevant fields):
```json
{
  "kind": "drive#file",
  "id": "1aBcDeFgHiJkLmNoPqRsTuVwXyZ",
  "name": "NoDues",
  "mimeType": "application/vnd.google-apps.folder"
}
```

### Searching for Existing Folders

Use `files.list` with the `q` query parameter. The query syntax uses field operators:

```
GET https://www.googleapis.com/drive/v3/files?q=<query>&fields=files(id,name,mimeType)
```

**Query syntax operators:**

| Operator | Example | Description |
|----------|---------|-------------|
| `=` | `name = 'NoDues'` | Exact match |
| `!=` | `mimeType != 'image/jpeg'` | Not equal |
| `contains` | `name contains 'NoDues'` | Partial text match |
| `in` | `'folderId' in parents` | Membership in collection |
| `and` | `name = 'NoDues' and trashed = false` | Combine conditions |

**Search for the NoDues folder:**

```typescript
async function findFolder(
  accessToken: string,
  folderName: string
): Promise<DriveFile | null> {
  const query = [
    `name = '${folderName}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    `trashed = false`,
  ].join(' and ');

  const params = new URLSearchParams({
    q: query,
    fields: 'files(id,name,mimeType,createdTime)',
    spaces: 'drive',
    pageSize: '10',
  });

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to search for folder: ${response.status}`);
  }

  const data: { files: DriveFile[] } = await response.json();
  return data.files.length > 0 ? data.files[0] : null;
}
```

**Key detail**: A file can only have one parent folder. The `parents` field accepts an array, but it must contain exactly one folder ID. Specifying multiple parents is not supported.

---

## R-002: Google Drive API v3 — Creating a Sheet Inside a Folder

### MIME Types

| Resource | MIME Type |
|----------|-----------|
| Folder | `application/vnd.google-apps.folder` |
| Google Sheet | `application/vnd.google-apps.spreadsheet` |
| Google Doc | `application/vnd.google-apps.document` |
| Google Slides | `application/vnd.google-apps.presentation` |

### Creating a Google Sheet Inside a Folder

Use `files.create` with the Sheet MIME type and the `parents` field pointing to the target folder.

```
POST https://www.googleapis.com/drive/v3/files
```

```typescript
async function createSheetInFolder(
  accessToken: string,
  sheetName: string,
  folderId: string
): Promise<DriveFile> {
  const response = await fetch(
    'https://www.googleapis.com/drive/v3/files',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: sheetName,
        mimeType: 'application/vnd.google-apps.spreadsheet',
        parents: [folderId],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to create sheet: ${response.status}`);
  }

  return response.json();
}
```

**Request body:**
```json
{
  "name": "NoDues - Database",
  "mimeType": "application/vnd.google-apps.spreadsheet",
  "parents": ["FOLDER_ID_HERE"]
}
```

**Response** (relevant fields):
```json
{
  "id": "spreadsheet-file-id-here",
  "name": "NoDues - Database",
  "mimeType": "application/vnd.google-apps.spreadsheet"
}
```

**Important**: The `id` returned is the file ID in Drive, which is also the `spreadsheetId` used in the Sheets API. They are the same value.

### Searching for a Sheet by Name Inside a Folder

```typescript
async function findSheetInFolder(
  accessToken: string,
  sheetName: string,
  folderId: string
): Promise<DriveFile | null> {
  const query = [
    `name = '${sheetName}'`,
    `mimeType = 'application/vnd.google-apps.spreadsheet'`,
    `'${folderId}' in parents`,
    `trashed = false`,
  ].join(' and ');

  const params = new URLSearchParams({
    q: query,
    fields: 'files(id,name,mimeType)',
    spaces: 'drive',
    pageSize: '10',
  });

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to search for sheet: ${response.status}`);
  }

  const data: { files: DriveFile[] } = await response.json();
  return data.files.length > 0 ? data.files[0] : null;
}
```

**Query used**: `name = 'NoDues - Database' and mimeType = 'application/vnd.google-apps.spreadsheet' and 'FOLDER_ID' in parents and trashed = false`

**Note on two ways to create a Sheet**: You can create a Sheet via Drive API (`files.create`) or via Sheets API (`spreadsheets.create`). However, the **Drive API approach** is required when you need to place the Sheet inside a specific folder using the `parents` field. The Sheets API `spreadsheets.create` does NOT support a `parents` field. **Strategy for NoDues**: Create the Sheet via Drive API (to place it in the NoDues folder), then use the Sheets API to add tabs and headers.

---

## R-003: Google Sheets API v4 — Creating Tabs and Headers

### Strategy: Two-Step Approach

Since the Sheet is created via Drive API (to place it in a folder), the initial Sheet has only one default tab ("Sheet1"). We then use the Sheets API to:
1. Add the 9 named tabs via `spreadsheets.batchUpdate` (using `addSheet` requests)
2. Delete the default "Sheet1" tab
3. Write header rows via `spreadsheets.values.batchUpdate`

**Alternative one-step approach**: Create the Sheet via Sheets API `spreadsheets.create` with all tabs defined, then move it to the folder via Drive API `files.update` with `addParents`. This is explored below.

### Option A: Create with All Tabs via Sheets API, Then Move (Recommended)

The Sheets API `spreadsheets.create` allows defining multiple tabs in a single call. Then move the file into the folder via a Drive API `files.update` call.

**Step 1 — Create spreadsheet with tabs:**

```
POST https://sheets.googleapis.com/v4/spreadsheets
```

```typescript
interface SheetProperties {
  sheetId?: number;
  title: string;
  index?: number;
}

interface SpreadsheetCreateRequest {
  properties: {
    title: string;
  };
  sheets: Array<{
    properties: SheetProperties;
  }>;
}

interface SpreadsheetResponse {
  spreadsheetId: string;
  spreadsheetUrl: string;
  properties: { title: string };
  sheets: Array<{
    properties: {
      sheetId: number;
      title: string;
      index: number;
    };
  }>;
}

async function createSpreadsheetWithTabs(
  accessToken: string,
  title: string,
  tabNames: string[]
): Promise<SpreadsheetResponse> {
  const body: SpreadsheetCreateRequest = {
    properties: { title },
    sheets: tabNames.map((name, index) => ({
      properties: {
        title: name,
        index,
      },
    })),
  };

  const response = await fetch(
    'https://sheets.googleapis.com/v4/spreadsheets',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to create spreadsheet: ${response.status}`);
  }

  return response.json();
}
```

**Request body** (for NoDues):
```json
{
  "properties": {
    "title": "NoDues - Database"
  },
  "sheets": [
    { "properties": { "title": "Properties", "index": 0 } },
    { "properties": { "title": "BillTypes", "index": 1 } },
    { "properties": { "title": "Bills", "index": 2 } },
    { "properties": { "title": "TodoCategories", "index": 3 } },
    { "properties": { "title": "RecurrencePatterns", "index": 4 } },
    { "properties": { "title": "Todos", "index": 5 } },
    { "properties": { "title": "PostponeLog", "index": 6 } },
    { "properties": { "title": "ActivityLog", "index": 7 } },
    { "properties": { "title": "Config", "index": 8 } }
  ]
}
```

**Response** (relevant fields):
```json
{
  "spreadsheetId": "abc123def456",
  "spreadsheetUrl": "https://docs.google.com/spreadsheets/d/abc123def456/edit",
  "sheets": [
    { "properties": { "sheetId": 0, "title": "Properties", "index": 0 } },
    { "properties": { "sheetId": 1234, "title": "BillTypes", "index": 1 } }
  ]
}
```

When you provide a `sheets` array in `spreadsheets.create`, the default "Sheet1" is **not created** — only the tabs you specify are created. The `sheetId` values are auto-generated.

**Step 2 — Move the Sheet into the NoDues folder:**

```
PATCH https://www.googleapis.com/drive/v3/files/{fileId}?addParents={folderId}&removeParents=root
```

```typescript
async function moveFileToFolder(
  accessToken: string,
  fileId: string,
  folderId: string
): Promise<void> {
  const params = new URLSearchParams({
    addParents: folderId,
    removeParents: 'root',
    fields: 'id,parents',
  });

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?${params}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to move file to folder: ${response.status}`);
  }
}
```

### Option B: Create via Drive API, Then Add Tabs (Alternative)

Create a blank Sheet via Drive API (already in the folder), then add tabs via `batchUpdate`.

```typescript
async function addTabsToSpreadsheet(
  accessToken: string,
  spreadsheetId: string,
  tabNames: string[]
): Promise<void> {
  const requests = tabNames.map((title) => ({
    addSheet: {
      properties: { title },
    },
  }));

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to add tabs: ${response.status}`);
  }
}
```

### Writing Header Rows

Use `spreadsheets.values.batchUpdate` to write headers to all tabs in a single call.

```
POST https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values:batchUpdate
```

```typescript
interface HeaderDefinition {
  tabName: string;
  headers: string[];
}

async function writeHeaders(
  accessToken: string,
  spreadsheetId: string,
  headerDefs: HeaderDefinition[]
): Promise<void> {
  const data = headerDefs.map(({ tabName, headers }) => ({
    range: `'${tabName}'!A1:${columnLetter(headers.length)}1`,
    values: [headers],
  }));

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to write headers: ${response.status}`);
  }
}

/** Convert 1-based column number to letter (1='A', 26='Z', 27='AA') */
function columnLetter(n: number): string {
  let result = '';
  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}
```

**Request body** (for NoDues headers):
```json
{
  "valueInputOption": "RAW",
  "data": [
    {
      "range": "'Properties'!A1:G1",
      "values": [["id", "name", "address", "notes", "active", "created_at", "deleted_at"]]
    },
    {
      "range": "'BillTypes'!A1:J1",
      "values": [["id", "property_id", "name", "default_amount", "default_due_day", "frequency", "reminder_offsets_days", "active", "created_at", "deleted_at"]]
    },
    {
      "range": "'Config'!A1:B1",
      "values": [["key", "value"]]
    }
  ]
}
```

**`valueInputOption` choices:**
- `RAW` — Values are stored as-is. No parsing. Use this for headers.
- `USER_ENTERED` — Values are parsed as if typed into the Sheets UI. `"=1+2"` becomes a formula, `"$100"` becomes currency.

### Can Tabs and Headers Be Set in a Single `spreadsheets.create` Call?

**Yes, partially.** The `spreadsheets.create` request body supports a `sheets` array where each sheet can include `data` (an array of `GridData`). However, the `GridData` structure is complex (it uses `RowData` > `CellData` > `ExtendedValue`) and is not the same as the simpler `values` API format. In practice, it is **much simpler** to:
1. Create the spreadsheet with named tabs via `spreadsheets.create`
2. Write headers via `values.batchUpdate` in a second call

This two-call approach is the standard pattern used in production.

### Recommendation for NoDues

Use **Option A** (Sheets API create + Drive API move):
1. `spreadsheets.create` with all 9 tabs defined (one call)
2. `files.update` to move the Sheet into the NoDues folder (one call)
3. `values.batchUpdate` to write all header rows (one call)

Total: **3 API calls** for Sheet setup.

---

## R-004: Google Calendar API v3 — Creating a Calendar

### REST Endpoint

```
POST https://www.googleapis.com/calendar/v3/calendars
```

### Creating a Secondary Calendar

```typescript
interface GoogleCalendar {
  id: string;
  summary: string;
  description?: string;
  timeZone?: string;
  etag?: string;
}

async function createCalendar(
  accessToken: string,
  summary: string,
  timeZone: string
): Promise<GoogleCalendar> {
  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary,
        timeZone,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to create calendar: ${response.status}`);
  }

  return response.json();
}
```

**Request body:**
```json
{
  "summary": "NoDues Reminders",
  "timeZone": "Asia/Kolkata"
}
```

**Response:**
```json
{
  "kind": "calendar#calendar",
  "etag": "\"abc123\"",
  "id": "abc123def456@group.calendar.google.com",
  "summary": "NoDues Reminders",
  "timeZone": "Asia/Kolkata"
}
```

The `id` is the calendar's unique identifier (an email-style string like `abc123@group.calendar.google.com`). This is stored in the Config tab.

### Required Scopes

Any of:
- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/calendar.app.created`
- `https://www.googleapis.com/auth/calendar.calendars`

The app currently uses the `calendar` scope, which is sufficient.

### Checking if a Calendar Already Exists

There is no direct "search by name" API. You must list all calendars and filter client-side.

```
GET https://www.googleapis.com/calendar/v3/users/me/calendarList
```

```typescript
interface CalendarListEntry {
  id: string;
  summary: string;
  description?: string;
  timeZone?: string;
  primary?: boolean;
  deleted?: boolean;
  accessRole: string;
}

interface CalendarListResponse {
  kind: string;
  items: CalendarListEntry[];
  nextPageToken?: string;
}

async function findCalendarBySummary(
  accessToken: string,
  summary: string
): Promise<CalendarListEntry | null> {
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      showDeleted: 'false',
      showHidden: 'false',
      maxResults: '250',
    });
    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/users/me/calendarList?${params}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to list calendars: ${response.status}`);
    }

    const data: CalendarListResponse = await response.json();
    const match = data.items?.find(
      (cal) => cal.summary === summary && !cal.deleted
    );
    if (match) return match;

    pageToken = data.nextPageToken;
  } while (pageToken);

  return null;
}
```

**Important**: The `calendarList.list` endpoint has no `q` or query parameter for filtering by summary. You must retrieve all entries (paginated, max 250 per page) and filter in JavaScript. For a typical personal account with fewer than 20 calendars, a single page is sufficient.

**Scope for listing**: `calendarList.list` requires any of: `calendar.readonly`, `calendar`, `calendar.calendarlist`, or `calendar.calendarlist.readonly`. The `calendar` scope covers both listing and inserting.

---

## R-005: `drive.file` Scope Behavior

### Official Description

The `drive.file` scope (`https://www.googleapis.com/auth/drive.file`) is described as:

> "Create new Drive files, or modify existing files, that you open with an app or that the user shares with an app while using the Google Picker API or the app's file picker."

### Key Properties

1. **Classification**: Non-sensitive scope (does not require advanced OAuth verification).
2. **REST API compatibility**: "The `drive.file` OAuth scope works with all Drive API REST Resources" — meaning `files.list`, `files.get`, `files.create`, `files.update`, `files.delete` all work.
3. **Per-file access model**: The scope grants access to files that are either (a) created by the app, or (b) explicitly opened/selected by the user via a file picker.

### Critical Question: Can `files.list` Discover Previously Created Files?

**Finding: YES, with caveats.**

Files **created** by the app (via `files.create`) are automatically accessible under `drive.file` scope, including via `files.list`. This access persists across sessions as long as the user has granted the `drive.file` scope to the app. The OAuth consent grant is tied to the app's client ID, not to a specific browser session.

Evidence:
- Google's scope documentation states: "Files created by your application are automatically available to the drive.file scope."
- The `drive.file` scope "works with all Drive API REST Resources" — including `files.list`.
- The scope grants access to files "created with this app" — the grant is at the app level, not the session level.

**What queries work under `drive.file`:**
- `name = 'NoDues'` — works (finds files the app created with this name)
- `mimeType = 'application/vnd.google-apps.folder'` — works
- `trashed = false` — works
- `'folderId' in parents` — works (as long as the folder was created by the app)
- Any combination with `and` — works

**What `files.list` will NOT return under `drive.file`:**
- Files created by the user manually (e.g., a folder named "NoDues" created by the user in the Drive UI, not by the app)
- Files created by other apps
- Files not explicitly opened with this app via a file picker

### Practical Implication for NoDues

The detection flow from the spec (FR-001) will work correctly:
1. Search for `name = 'NoDues' and mimeType = 'application/vnd.google-apps.folder' and trashed = false` — will find the folder the app created in a previous session.
2. Search for `name = 'NoDues - Database' and mimeType = 'application/vnd.google-apps.spreadsheet' and 'FOLDER_ID' in parents and trashed = false` — will find the Sheet the app created.

The `drive.file` scope is **sufficient** for this use case. No broader scope (`drive.readonly`, `drive`) is needed.

### Risk: Edge Cases

One Google Issue Tracker report (issue #177562923) documented a case where `files.list` did not return a file that had been opened via the Storage Access Framework (Android). This appears to be specific to the Android file picker integration, not to files created via the REST API. For files created via `files.create` (which is what NoDues does), the behavior is reliable.

### Recommendation

Proceed with `drive.file` scope only. No fallback to `drive.readonly` is needed. The detection flow will work across browser sessions.

---

## R-006: Idempotency Patterns

### The Core Challenge

The bootstrapping process involves 5+ sequential API calls:
1. Create Drive folder
2. Create Google Sheet (with tabs)
3. Move Sheet into folder
4. Write header rows
5. Create Google Calendar
6. Write seed data (Properties, BillTypes, TodoCategories)
7. Write Config row

If any step fails, the next attempt must detect what already exists and resume from the failed step.

### Pattern: Check-Then-Create

Before each creation step, search for the existing resource. If found, reuse it. If not found, create it.

```typescript
interface BootstrapState {
  folderId: string | null;
  spreadsheetId: string | null;
  calendarId: string | null;
  headersWritten: boolean;
  seedDataWritten: boolean;
  configWritten: boolean;
}

async function detectExistingSetup(
  accessToken: string
): Promise<BootstrapState> {
  const state: BootstrapState = {
    folderId: null,
    spreadsheetId: null,
    calendarId: null,
    headersWritten: false,
    seedDataWritten: false,
    configWritten: false,
  };

  // Step 1: Find existing folder
  const folder = await findFolder(accessToken, 'NoDues');
  if (!folder) return state;
  state.folderId = folder.id;

  // Step 2: Find existing Sheet inside folder
  const sheet = await findSheetInFolder(
    accessToken,
    'NoDues - Database',
    folder.id
  );
  if (!sheet) return state;
  state.spreadsheetId = sheet.id;

  // Step 3: Read Config tab to check for calendar ID and completion
  try {
    const configData = await readSheetValues(
      accessToken,
      sheet.id,
      "'Config'!A:B"
    );
    if (configData && configData.values) {
      const configMap = new Map(
        configData.values.slice(1).map((row: string[]) => [row[0], row[1]])
      );
      state.calendarId = configMap.get('calendar_id') ?? null;
      state.configWritten = configMap.has('drive_root_folder_id');
    }
  } catch {
    // Config tab may not exist yet — partial setup
  }

  // Step 4: Check if headers exist (read row 1 of first tab)
  try {
    const headerData = await readSheetValues(
      accessToken,
      sheet.id,
      "'Properties'!A1:A1"
    );
    state.headersWritten =
      headerData?.values?.[0]?.[0] === 'id';
  } catch {
    // Tab may not exist
  }

  // Step 5: Check if seed data exists
  try {
    const seedData = await readSheetValues(
      accessToken,
      sheet.id,
      "'Properties'!A2:A10"
    );
    state.seedDataWritten =
      (seedData?.values?.length ?? 0) > 0;
  } catch {
    // Tab may not exist
  }

  return state;
}
```

### Pattern: Conditional Execution

Only run steps that haven't been completed:

```typescript
async function bootstrap(
  accessToken: string,
  onProgress: (step: string) => void
): Promise<BootstrapResult> {
  // Detect what already exists
  const state = await detectExistingSetup(accessToken);

  // Step 1: Folder
  if (!state.folderId) {
    onProgress('Creating Drive folder...');
    const folder = await createFolder(accessToken, 'NoDues');
    state.folderId = folder.id;
  }

  // Step 2: Spreadsheet
  if (!state.spreadsheetId) {
    onProgress('Setting up database...');
    const sheet = await createSpreadsheetWithTabs(
      accessToken,
      'NoDues - Database',
      TAB_NAMES
    );
    state.spreadsheetId = sheet.spreadsheetId;

    // Move into folder
    await moveFileToFolder(accessToken, sheet.spreadsheetId, state.folderId);
  }

  // Step 3: Headers
  if (!state.headersWritten) {
    onProgress('Configuring database tables...');
    await writeHeaders(accessToken, state.spreadsheetId, HEADER_DEFINITIONS);
    state.headersWritten = true;
  }

  // Step 4: Calendar
  if (!state.calendarId) {
    onProgress('Creating calendar...');
    const calendar = await createCalendar(
      accessToken,
      'NoDues Reminders',
      'Asia/Kolkata'
    );
    state.calendarId = calendar.id;
  }

  // Step 5: Seed data
  if (!state.seedDataWritten) {
    onProgress('Seeding starter data...');
    await writeSeedData(accessToken, state.spreadsheetId);
    state.seedDataWritten = true;
  }

  // Step 6: Config
  if (!state.configWritten) {
    onProgress('Saving configuration...');
    await writeConfig(accessToken, state.spreadsheetId, {
      drive_root_folder_id: state.folderId,
      sheet_id: state.spreadsheetId,
      calendar_id: state.calendarId,
      timezone: 'Asia/Kolkata',
      currency: 'INR',
    });
    state.configWritten = true;
  }

  return state;
}
```

### Pattern: Seed Data Idempotency

When seeding rows, check if rows already exist by reading the tab first:

```typescript
async function writeSeedDataIfMissing(
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
  expectedRows: string[][],
  keyColumnIndex: number // which column to use as the identity check (e.g., "name")
): Promise<void> {
  // Read existing data
  const existing = await readSheetValues(
    accessToken,
    spreadsheetId,
    `'${tabName}'!A:Z`
  );

  const existingKeys = new Set(
    (existing?.values ?? [])
      .slice(1) // skip header
      .map((row: string[]) => row[keyColumnIndex])
  );

  // Filter to only rows that don't already exist
  const newRows = expectedRows.filter(
    (row) => !existingKeys.has(row[keyColumnIndex])
  );

  if (newRows.length === 0) return; // all seed data already present

  // Append only missing rows
  await appendRows(accessToken, spreadsheetId, tabName, newRows);
}
```

### Handling Partial Failures

The key insight: **Config is written last.** If the Config tab has valid `drive_root_folder_id`, `sheet_id`, and `calendar_id`, then setup is complete. If any are missing, we resume from the first missing piece.

The detection flow order matches the creation order:
1. Folder exists? (via Drive search)
2. Sheet exists inside folder? (via Drive search)
3. Headers exist? (via Sheets read)
4. Calendar exists? (via Config read or calendarList search)
5. Seed data exists? (via Sheets read)
6. Config complete? (via Sheets read)

---

## R-007: Client-Side Fetch Patterns

### Base Fetch Wrapper

```typescript
interface GoogleApiError {
  error: {
    code: number;
    message: string;
    status: string;
    errors?: Array<{
      message: string;
      domain: string;
      reason: string;
    }>;
  };
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface FetchOptions {
  method?: HttpMethod;
  body?: unknown;
  params?: Record<string, string>;
}

async function googleApiFetch<T>(
  accessToken: string,
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const { method = 'GET', body, params } = options;

  let fullUrl = url;
  if (params) {
    const searchParams = new URLSearchParams(params);
    fullUrl = `${url}?${searchParams}`;
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(fullUrl, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody: GoogleApiError = await response.json().catch(() => ({
      error: {
        code: response.status,
        message: response.statusText,
        status: 'UNKNOWN',
      },
    }));
    throw new GoogleApiRequestError(
      response.status,
      errorBody.error.message,
      errorBody
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

class GoogleApiRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: GoogleApiError
  ) {
    super(message);
    this.name = 'GoogleApiRequestError';
  }
}
```

### Error Handling Patterns

```typescript
/** Errors that are safe to retry */
function isRetryableError(error: unknown): boolean {
  if (error instanceof GoogleApiRequestError) {
    // 429 Rate Limit Exceeded
    // 500 Internal Server Error
    // 502 Bad Gateway
    // 503 Service Unavailable
    return [429, 500, 502, 503].includes(error.status);
  }
  // Network errors (fetch itself failed)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  return false;
}

/** Errors that indicate the token is invalid */
function isAuthError(error: unknown): boolean {
  if (error instanceof GoogleApiRequestError) {
    return error.status === 401;
  }
  return false;
}

/** Errors that indicate insufficient permissions */
function isPermissionError(error: unknown): boolean {
  if (error instanceof GoogleApiRequestError) {
    return error.status === 403;
  }
  return false;
}
```

### Retry with Exponential Backoff

```typescript
interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 32000,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry auth or permission errors
      if (isAuthError(error) || isPermissionError(error)) {
        throw error;
      }

      // Don't retry if we've exhausted attempts
      if (attempt === maxRetries || !isRetryableError(error)) {
        throw error;
      }

      // Exponential backoff with jitter
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelayMs
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```

### Usage with Retry

```typescript
// Example: Create folder with retry
const folder = await withRetry(() =>
  googleApiFetch<DriveFile>(accessToken, DRIVE_FILES_URL, {
    method: 'POST',
    body: {
      name: 'NoDues',
      mimeType: 'application/vnd.google-apps.folder',
    },
  })
);
```

### Rate Limiting Considerations

| API | Quota (per project per minute) | Per-user per minute | Write limit |
|-----|-------------------------------|---------------------|-------------|
| Drive API | 1,000,000 units | 325,000 units | ~3 write requests/second sustained |
| Sheets API | 300 requests/minute | 60 requests/minute | Same as read |
| Calendar API | 1,000,000 units | N/A | N/A |

**For NoDues bootstrapping** (creating 1 folder, 1 spreadsheet, moving 1 file, writing headers + seed data + config, creating 1 calendar): This is approximately **8-10 API calls total**. This is well within all quota limits and does not require any rate-limiting logic beyond basic retry.

**Quota unit costs for Drive API:**
- Read operations (files.list, files.get): Variable, but generally low
- Write operations (files.create, files.update): 50 units per request

### Reading Sheet Values Helper

```typescript
interface ValueRange {
  range: string;
  majorDimension: string;
  values: string[][];
}

async function readSheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string
): Promise<ValueRange | null> {
  const params = new URLSearchParams({
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });

  const encodedRange = encodeURIComponent(range);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (response.status === 404) {
    return null; // Sheet or range doesn't exist
  }

  if (!response.ok) {
    throw new Error(`Failed to read sheet values: ${response.status}`);
  }

  return response.json();
}
```

### Appending Rows

```typescript
async function appendRows(
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
  rows: string[][]
): Promise<void> {
  const range = encodeURIComponent(`'${tabName}'!A:A`);
  const params = new URLSearchParams({
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
  });

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?${params}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: rows,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to append rows: ${response.status}`);
  }
}
```

---

## API Endpoint Summary

| Operation | Method | Endpoint |
|-----------|--------|----------|
| Create folder | `POST` | `https://www.googleapis.com/drive/v3/files` |
| Search files | `GET` | `https://www.googleapis.com/drive/v3/files?q=...` |
| Move file to folder | `PATCH` | `https://www.googleapis.com/drive/v3/files/{fileId}?addParents=...&removeParents=...` |
| Create spreadsheet | `POST` | `https://sheets.googleapis.com/v4/spreadsheets` |
| Batch update sheet structure | `POST` | `https://sheets.googleapis.com/v4/spreadsheets/{id}:batchUpdate` |
| Write values (single range) | `PUT` | `https://sheets.googleapis.com/v4/spreadsheets/{id}/values/{range}` |
| Write values (multiple ranges) | `POST` | `https://sheets.googleapis.com/v4/spreadsheets/{id}/values:batchUpdate` |
| Append rows | `POST` | `https://sheets.googleapis.com/v4/spreadsheets/{id}/values/{range}:append` |
| Read values | `GET` | `https://sheets.googleapis.com/v4/spreadsheets/{id}/values/{range}` |
| Create calendar | `POST` | `https://www.googleapis.com/calendar/v3/calendars` |
| List calendars | `GET` | `https://www.googleapis.com/calendar/v3/users/me/calendarList` |

---

## Scopes Required

The app currently requests these scopes (from Phase 1):

| Scope | Purpose |
|-------|---------|
| `https://www.googleapis.com/auth/drive.file` | Create/find/manage the NoDues folder and Sheet |
| `https://www.googleapis.com/auth/spreadsheets` | Create tabs, write headers, read/write cell data |
| `https://www.googleapis.com/auth/calendar` | Create/list calendars, create events (later phases) |
| `openid` | Authentication |
| `email` | User email for display |
| `profile` | User name/avatar for display |

No additional scopes are needed for bootstrapping. The `drive.file` scope is sufficient for file discovery across sessions.

---

## Recommended Bootstrapping Sequence

```
1. detectExistingSetup()
   ├── findFolder("NoDues")                     → Drive files.list
   ├── findSheetInFolder("NoDues - Database")    → Drive files.list
   └── readConfig()                              → Sheets values.get

2. If setup complete → skip to dashboard

3. If not complete, run missing steps:
   a. createFolder("NoDues")                     → Drive files.create
   b. createSpreadsheetWithTabs(9 tabs)           → Sheets spreadsheets.create
   c. moveFileToFolder(sheetId, folderId)         → Drive files.update
   d. writeHeaders(all 9 tabs)                    → Sheets values.batchUpdate
   e. createCalendar("NoDues Reminders")          → Calendar calendars.insert
   f. writeSeedData(Properties, BillTypes, TodoCategories) → Sheets values.batchUpdate
   g. writeConfig(all IDs + defaults)             → Sheets values.update

Total API calls (first run): ~10
Total API calls (returning user, setup exists): ~3 (search folder + search sheet + read config)
```
