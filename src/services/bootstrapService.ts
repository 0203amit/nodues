import { GoogleApiRequestError, isRetryableError } from './googleApi';
import { findFolder, createFolder, findSheetInFolder, moveFileToFolder } from './driveService';
import { createSpreadsheet, writeHeaders, readValues, appendRows, writeValues } from './sheetsService';
import { findCalendar, createCalendar } from './calendarService';
import {
  TAB_NAMES,
  HEADER_DEFINITIONS,
  generateSeedProperties,
  generateSeedBillTypes,
  generateSeedTodoCategories,
} from '../config/schema';
import { DRIVE_FOLDER_NAME, SHEET_NAME, CALENDAR_NAME } from '../config/branding';

// --- Types ---

export type BootstrapStep =
  | 'detect'
  | 'folder'
  | 'spreadsheet'
  | 'headers'
  | 'calendar'
  | 'seed'
  | 'config';

export interface SetupResult {
  folderId: string;
  spreadsheetId: string;
  calendarId: string;
  timezone: string;
  currency: string;
}

export interface DetectedState {
  folderId: string | null;
  spreadsheetId: string | null;
  calendarId: string | null;
  headersWritten: boolean;
  seedDataWritten: boolean;
  configWritten: boolean;
}

export class BootstrapError extends Error {
  readonly step: BootstrapStep;
  readonly isRetryable: boolean;
  readonly httpStatus: number | null;

  constructor(
    step: BootstrapStep,
    message: string,
    isRetryable: boolean,
    httpStatus: number | null,
  ) {
    super(message);
    this.name = 'BootstrapError';
    this.step = step;
    this.isRetryable = isRetryable;
    this.httpStatus = httpStatus;
  }
}

// --- Constants ---

const DEFAULT_TIMEZONE = 'Asia/Kolkata';
const DEFAULT_CURRENCY = 'INR';

const CONFIG_KEYS = {
  DRIVE_ROOT_FOLDER_ID: 'drive_root_folder_id',
  SHEET_ID: 'sheet_id',
  CALENDAR_ID: 'calendar_id',
  TIMEZONE: 'timezone',
  CURRENCY: 'currency',
} as const;

const ALL_CONFIG_KEYS = Object.values(CONFIG_KEYS);

// --- Error wrapping ---

function wrapError(step: BootstrapStep, error: unknown): BootstrapError {
  if (error instanceof GoogleApiRequestError) {
    const status = error.status;
    if (status === 401) {
      return new BootstrapError(
        step,
        'Your session has expired. Please sign in again.',
        false,
        status,
      );
    }
    if (status === 403) {
      return new BootstrapError(
        step,
        'Permission denied. Please sign in again and grant all required permissions.',
        false,
        status,
      );
    }
    if (isRetryableError(error)) {
      return new BootstrapError(
        step,
        'Google services are temporarily unavailable. Please try again.',
        true,
        status,
      );
    }
    return new BootstrapError(step, error.message, false, status);
  }
  if (error instanceof TypeError) {
    return new BootstrapError(
      step,
      'Could not reach Google services. Please check your connection and try again.',
      true,
      null,
    );
  }
  const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
  return new BootstrapError(step, message, false, null);
}

// --- Config helpers ---

function parseConfigMap(rows: string[][] | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!rows) return map;
  for (const row of rows) {
    if (row[0] && row[1]) {
      map.set(row[0], row[1]);
    }
  }
  return map;
}

// --- Detection ---

/** Detect existing setup state by searching Drive and reading Config. */
export async function detectExistingSetup(
  accessToken: string,
): Promise<DetectedState> {
  const state: DetectedState = {
    folderId: null,
    spreadsheetId: null,
    calendarId: null,
    headersWritten: false,
    seedDataWritten: false,
    configWritten: false,
  };

  // 1. Find folder
  const folder = await findFolder(accessToken, DRIVE_FOLDER_NAME);
  if (!folder) return state;
  state.folderId = folder.id;

  // 2. Find sheet in folder
  const sheet = await findSheetInFolder(accessToken, SHEET_NAME, folder.id);
  if (!sheet) return state;
  state.spreadsheetId = sheet.id;

  // 3. Read Config tab — extract calendarId and check completeness
  const configData = await readValues(accessToken, sheet.id, "'Config'!A:B");
  if (configData?.values) {
    const configMap = parseConfigMap(configData.values);
    state.calendarId = configMap.get(CONFIG_KEYS.CALENDAR_ID) ?? null;
    state.configWritten = ALL_CONFIG_KEYS.every((key) => configMap.has(key));
  }

  // 4. Check headers exist (Properties header row)
  const headerCheck = await readValues(accessToken, sheet.id, "'Properties'!A1:A1");
  state.headersWritten = !!(headerCheck?.values?.[0]?.[0]);

  // 5. Check seed data exists (Properties data rows)
  const seedCheck = await readValues(accessToken, sheet.id, "'Properties'!A2:A10");
  state.seedDataWritten = !!(seedCheck?.values?.length);

  return state;
}

// --- Bootstrap ---

/** Run the full bootstrap flow, skipping already-completed steps. */
export async function bootstrap(
  accessToken: string,
  onProgress: (step: BootstrapStep) => void,
): Promise<SetupResult> {
  // 1. Detect existing state
  onProgress('detect');
  let detected: DetectedState;
  try {
    detected = await detectExistingSetup(accessToken);
  } catch (error) {
    throw wrapError('detect', error);
  }

  // 2. If everything is already complete, return immediately
  if (
    detected.folderId &&
    detected.spreadsheetId &&
    detected.calendarId &&
    detected.headersWritten &&
    detected.seedDataWritten &&
    detected.configWritten
  ) {
    try {
      const configData = await readValues(
        accessToken,
        detected.spreadsheetId,
        "'Config'!A:B",
      );
      const configMap = parseConfigMap(configData?.values);
      return {
        folderId: detected.folderId,
        spreadsheetId: detected.spreadsheetId,
        calendarId: detected.calendarId,
        timezone: configMap.get(CONFIG_KEYS.TIMEZONE) ?? DEFAULT_TIMEZONE,
        currency: configMap.get(CONFIG_KEYS.CURRENCY) ?? DEFAULT_CURRENCY,
      };
    } catch (error) {
      throw wrapError('detect', error);
    }
  }

  // 3. Create missing resources in order

  let { folderId, spreadsheetId, calendarId } = detected;

  // --- Folder ---
  if (!folderId) {
    onProgress('folder');
    try {
      const folder = await createFolder(accessToken, DRIVE_FOLDER_NAME);
      folderId = folder.id;
    } catch (error) {
      throw wrapError('folder', error);
    }
  }

  // --- Spreadsheet + move into folder ---
  if (!spreadsheetId) {
    onProgress('spreadsheet');
    try {
      const response = await createSpreadsheet(
        accessToken,
        SHEET_NAME,
        [...TAB_NAMES],
      );
      spreadsheetId = response.spreadsheetId;
      await moveFileToFolder(accessToken, spreadsheetId, folderId);
    } catch (error) {
      throw wrapError('spreadsheet', error);
    }
  }

  // --- Headers ---
  if (!detected.headersWritten) {
    onProgress('headers');
    try {
      await writeHeaders(accessToken, spreadsheetId, HEADER_DEFINITIONS);
    } catch (error) {
      throw wrapError('headers', error);
    }
  }

  // --- Calendar (find existing first, create only if not found) ---
  if (!calendarId) {
    onProgress('calendar');
    try {
      const existing = await findCalendar(accessToken, CALENDAR_NAME);
      if (existing) {
        calendarId = existing.id;
      } else {
        const created = await createCalendar(
          accessToken,
          CALENDAR_NAME,
          DEFAULT_TIMEZONE,
        );
        calendarId = created.id;
      }
    } catch (error) {
      throw wrapError('calendar', error);
    }
  }

  // --- Seed data (check-then-append per tab for idempotency) ---
  if (!detected.seedDataWritten) {
    onProgress('seed');
    try {
      // Properties — generate or read existing IDs
      let propertyIds: Record<string, string> = {};

      const existingProperties = await readValues(
        accessToken,
        spreadsheetId,
        "'Properties'!A2:B",
      );
      if (existingProperties?.values?.length) {
        // Extract { propertyName → propertyId } from existing rows
        for (const row of existingProperties.values) {
          if (row[0] && row[1]) {
            propertyIds[row[1]] = row[0]; // col A = id, col B = name
          }
        }
      } else {
        const seedProperties = generateSeedProperties();
        await appendRows(accessToken, spreadsheetId, 'Properties', seedProperties);
        for (const row of seedProperties) {
          propertyIds[row[1]] = row[0]; // col 0 = id, col 1 = name
        }
      }

      // BillTypes
      const existingBillTypes = await readValues(
        accessToken,
        spreadsheetId,
        "'BillTypes'!A2:A",
      );
      if (!existingBillTypes?.values?.length) {
        const seedBillTypes = generateSeedBillTypes(propertyIds);
        await appendRows(accessToken, spreadsheetId, 'BillTypes', seedBillTypes);
      }

      // TodoCategories
      const existingCategories = await readValues(
        accessToken,
        spreadsheetId,
        "'TodoCategories'!A2:A",
      );
      if (!existingCategories?.values?.length) {
        const seedCategories = generateSeedTodoCategories();
        await appendRows(accessToken, spreadsheetId, 'TodoCategories', seedCategories);
      }
    } catch (error) {
      throw wrapError('seed', error);
    }
  }

  // --- Config (written LAST as the completion marker — FR-009) ---
  if (!detected.configWritten) {
    onProgress('config');
    try {
      const configRows: string[][] = [
        [CONFIG_KEYS.DRIVE_ROOT_FOLDER_ID, folderId],
        [CONFIG_KEYS.SHEET_ID, spreadsheetId],
        [CONFIG_KEYS.CALENDAR_ID, calendarId],
        [CONFIG_KEYS.TIMEZONE, DEFAULT_TIMEZONE],
        [CONFIG_KEYS.CURRENCY, DEFAULT_CURRENCY],
      ];
      await writeValues(
        accessToken,
        spreadsheetId,
        "'Config'!A2:B6",
        configRows,
      );
    } catch (error) {
      throw wrapError('config', error);
    }
  }

  return {
    folderId,
    spreadsheetId,
    calendarId,
    timezone: DEFAULT_TIMEZONE,
    currency: DEFAULT_CURRENCY,
  };
}
