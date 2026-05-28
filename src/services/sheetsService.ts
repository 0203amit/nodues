import { googleApiFetch, withRetry, columnLetter, GoogleApiRequestError } from './googleApi';
import type { HeaderDefinition } from '../config/schema';
import { HEADER_DEFINITIONS } from '../config/schema';
import type { RowWithIndex } from '../types';

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

// --- Generic row helpers ---

function getLastColumnLetter(tabName: string): string {
  const def = HEADER_DEFINITIONS.find((d) => d.tabName === tabName);
  if (!def) throw new Error(`No header definition found for tab: ${tabName}`);
  return columnLetter(def.headers.length);
}

/** Read all data rows from a tab (skips header row 1). Returns each row with its 1-based row index. */
export async function readAllRows(
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
): Promise<RowWithIndex[]> {
  const def = HEADER_DEFINITIONS.find((d) => d.tabName === tabName);
  if (!def) throw new Error(`No header definition found for tab: ${tabName}`);
  const lastCol = columnLetter(def.headers.length);
  const colCount = def.headers.length;
  const range = `'${tabName}'!A2:${lastCol}`;
  const result = await readValues(accessToken, spreadsheetId, range);
  if (!result?.values) return [];
  return result.values.map((row, i) => ({
    rowIndex: i + 2,
    // Pad trailing empty cells that the Sheets API omits
    values: row.length < colCount ? [...row, ...Array(colCount - row.length).fill('')] : row,
  }));
}

/** Overwrite a full row at a given 1-based row index. */
export async function updateRow(
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
  rowIndex: number,
  values: string[],
): Promise<void> {
  const lastCol = getLastColumnLetter(tabName);
  const range = `'${tabName}'!A${rowIndex}:${lastCol}${rowIndex}`;
  await writeValues(accessToken, spreadsheetId, range, [values]);
}

/** Update a single cell. columnIndex is 0-based. */
export async function updateCell(
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
  rowIndex: number,
  columnIndex: number,
  value: string,
): Promise<void> {
  const letter = columnLetter(columnIndex + 1);
  const range = `'${tabName}'!${letter}${rowIndex}`;
  await writeValues(accessToken, spreadsheetId, range, [[value]]);
}
