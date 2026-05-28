import { googleApiFetch, withRetry, columnLetter, GoogleApiRequestError } from './googleApi';
import type { HeaderDefinition } from '../config/schema';

// --- Types ---

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

export interface ValueRange {
  range: string;
  majorDimension: string;
  values: string[][];
}

// --- Constants ---

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

// --- Functions ---

/** Create a spreadsheet with named tabs. Returns metadata including spreadsheetId. */
export async function createSpreadsheet(
  accessToken: string,
  title: string,
  tabNames: string[],
): Promise<SpreadsheetResponse> {
  return withRetry(() =>
    googleApiFetch<SpreadsheetResponse>(accessToken, SHEETS_API, {
      method: 'POST',
      body: {
        properties: { title },
        sheets: tabNames.map((name, index) => ({
          properties: { title: name, index },
        })),
      },
    }),
  );
}

/** Write header rows to multiple tabs in one batch call. */
export async function writeHeaders(
  accessToken: string,
  spreadsheetId: string,
  headerDefs: HeaderDefinition[],
): Promise<void> {
  const data = headerDefs.map((def) => ({
    range: `'${def.tabName}'!A1:${columnLetter(def.headers.length)}1`,
    majorDimension: 'ROWS',
    values: [def.headers],
  }));

  await withRetry(() =>
    googleApiFetch<unknown>(
      accessToken,
      `${SHEETS_API}/${spreadsheetId}/values:batchUpdate`,
      {
        method: 'POST',
        body: {
          valueInputOption: 'RAW',
          data,
        },
      },
    ),
  );
}

/** Read values from a range. Returns null if range doesn't exist. */
export async function readValues(
  accessToken: string,
  spreadsheetId: string,
  range: string,
): Promise<ValueRange | null> {
  try {
    return await withRetry(() =>
      googleApiFetch<ValueRange>(
        accessToken,
        `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      ),
    );
  } catch (error) {
    if (error instanceof GoogleApiRequestError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/** Append rows to a tab. */
export async function appendRows(
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
  rows: string[][],
): Promise<void> {
  const range = encodeURIComponent(`'${tabName}'!A:A`);

  await withRetry(() =>
    googleApiFetch<unknown>(
      accessToken,
      `${SHEETS_API}/${spreadsheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        body: {
          majorDimension: 'ROWS',
          values: rows,
        },
      },
    ),
  );
}

/** Write values to a specific range (overwrite). */
export async function writeValues(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: string[][],
): Promise<void> {
  await withRetry(() =>
    googleApiFetch<unknown>(
      accessToken,
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
      {
        method: 'PUT',
        body: {
          majorDimension: 'ROWS',
          values,
        },
      },
    ),
  );
}
