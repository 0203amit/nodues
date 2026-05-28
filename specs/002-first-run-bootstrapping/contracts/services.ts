/**
 * Contract: Service Modules
 *
 * Thin wrappers around Google REST APIs. Each function takes an
 * accessToken and returns typed results. No React dependencies.
 */

// --- Shared Types ---

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  createdTime?: string;
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  timeZone?: string;
}

export interface ValueRange {
  range: string;
  majorDimension: string;
  values: string[][];
}

// --- Google API Error ---

export interface GoogleApiErrorBody {
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

// --- driveService ---

export interface DriveService {
  /** Search for a folder by name. Returns null if not found. */
  findFolder(accessToken: string, folderName: string): Promise<DriveFile | null>;

  /** Create a folder at Drive root. Returns the created file metadata. */
  createFolder(accessToken: string, folderName: string): Promise<DriveFile>;

  /** Search for a Sheet by name inside a specific folder. */
  findSheetInFolder(
    accessToken: string,
    sheetName: string,
    folderId: string,
  ): Promise<DriveFile | null>;

  /** Move a file into a folder (remove from root). */
  moveFileToFolder(
    accessToken: string,
    fileId: string,
    folderId: string,
  ): Promise<void>;
}

// --- sheetsService ---

export interface SpreadsheetResponse {
  spreadsheetId: string;
  spreadsheetUrl: string;
  sheets: Array<{
    properties: {
      sheetId: number;
      title: string;
      index: number;
    };
  }>;
}

export interface HeaderDefinition {
  tabName: string;
  headers: string[];
}

export interface SheetsService {
  /** Create a spreadsheet with named tabs. Returns metadata including spreadsheetId. */
  createSpreadsheet(
    accessToken: string,
    title: string,
    tabNames: string[],
  ): Promise<SpreadsheetResponse>;

  /** Write header rows to multiple tabs in one batch call. */
  writeHeaders(
    accessToken: string,
    spreadsheetId: string,
    headerDefs: HeaderDefinition[],
  ): Promise<void>;

  /** Read values from a range. Returns null if range doesn't exist. */
  readValues(
    accessToken: string,
    spreadsheetId: string,
    range: string,
  ): Promise<ValueRange | null>;

  /** Append rows to a tab. */
  appendRows(
    accessToken: string,
    spreadsheetId: string,
    tabName: string,
    rows: string[][],
  ): Promise<void>;

  /** Write values to a specific range (overwrite). */
  writeValues(
    accessToken: string,
    spreadsheetId: string,
    range: string,
    values: string[][],
  ): Promise<void>;
}

// --- calendarService ---

export interface CalendarService {
  /** Find a calendar by summary name. Returns null if not found. */
  findCalendar(
    accessToken: string,
    summary: string,
  ): Promise<GoogleCalendar | null>;

  /** Create a secondary calendar. Returns the created calendar. */
  createCalendar(
    accessToken: string,
    summary: string,
    timeZone: string,
  ): Promise<GoogleCalendar>;
}

// --- bootstrapService ---

export interface BootstrapService {
  /** Detect existing setup state by searching Drive and reading Config. */
  detectExistingSetup(accessToken: string): Promise<DetectedState>;

  /** Run the full bootstrap flow, skipping already-completed steps. */
  bootstrap(
    accessToken: string,
    onProgress: (step: BootstrapStep) => void,
  ): Promise<SetupResult>;
}

export interface DetectedState {
  folderId: string | null;
  spreadsheetId: string | null;
  calendarId: string | null;
  headersWritten: boolean;
  seedDataWritten: boolean;
  configWritten: boolean;
}

// Re-export from bootstrap-context for convenience
export type { BootstrapStep, SetupResult } from './bootstrap-context';
