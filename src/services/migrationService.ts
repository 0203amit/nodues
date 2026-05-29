import { readAllRows, appendRows, updateCell } from './sheetsService';
import { generateSeedRecurrencePatterns, HEADER_DEFINITIONS } from '../config/schema';
import { CATEGORY_COLOR_PALETTE } from '../types';

// --- Column index for TodoCategories ---

const CAT_HEADERS = HEADER_DEFINITIONS.find((d) => d.tabName === 'TodoCategories')!.headers;
const CAT_COL = Object.fromEntries(CAT_HEADERS.map((h, i) => [h, i])) as Record<string, number>;

// --- Migrations ---

export async function runMigrations(
  accessToken: string,
  spreadsheetId: string,
): Promise<void> {
  // Migration 1: Seed RecurrencePatterns if empty
  try {
    const rows = await readAllRows(accessToken, spreadsheetId, 'RecurrencePatterns');
    if (rows.length === 0) {
      const seedPatterns = generateSeedRecurrencePatterns();
      await appendRows(accessToken, spreadsheetId, 'RecurrencePatterns', seedPatterns);
    }
  } catch {
    console.warn('Migration: Failed to seed RecurrencePatterns');
  }

  // Migration 2: Backfill empty TodoCategory colors
  try {
    const rows = await readAllRows(accessToken, spreadsheetId, 'TodoCategories');
    let colorIndex = 0;
    for (const row of rows) {
      const v = row.values;
      if (!v || v.length === 0) continue;
      const id = v[CAT_COL.id];
      if (!id) continue;

      const color = v[CAT_COL.color] ?? '';
      if (color === '') {
        const paletteColor = CATEGORY_COLOR_PALETTE[colorIndex % CATEGORY_COLOR_PALETTE.length].hex;
        await updateCell(accessToken, spreadsheetId, 'TodoCategories', row.rowIndex, CAT_COL.color, paletteColor);
        colorIndex++;
      }
    }
  } catch {
    console.warn('Migration: Failed to backfill TodoCategory colors');
  }
}
