import { v4 as uuidv4 } from 'uuid';
import { HEADER_DEFINITIONS } from '../config/schema';
import { readValues, readAllRows, appendRows, updateCell, writeHeaders, addSheet } from './sheetsService';
import { GoogleApiRequestError } from './googleApi';
import type { PushSubscription, RowWithIndex } from '../types';

// --- Column index map derived from HEADER_DEFINITIONS ---

const TAB_NAME = 'PushSubscriptions';
const PUSH_HEADERS = HEADER_DEFINITIONS.find((d) => d.tabName === TAB_NAME)!;
const COL = Object.fromEntries(PUSH_HEADERS.headers.map((h, i) => [h, i])) as Record<string, number>;

// --- Parse ---

function parseRow(row: RowWithIndex): PushSubscription | null {
  const v = row.values;
  if (!v || v.length === 0) return null;
  const id = v[COL.id];
  if (!id) return null;

  return {
    _rowIndex: row.rowIndex,
    id,
    userEmail: v[COL.user_email] ?? '',
    endpoint: v[COL.endpoint] ?? '',
    p256dhKey: v[COL.p256dh_key] ?? '',
    authKey: v[COL.auth_key] ?? '',
    deliveryHour: parseInt(v[COL.delivery_hour], 10) || 8,
    deliveryMinute: parseInt(v[COL.delivery_minute], 10) || 0,
    timezone: v[COL.timezone] || 'Asia/Kolkata',
    enabled: v[COL.enabled] === 'TRUE',
    createdAt: v[COL.created_at] ?? '',
    lastPushedAt: v[COL.last_pushed_at] ?? '',
    deletedAt: v[COL.deleted_at] ?? '',
  };
}

// --- Ensure tab exists (lazy bootstrap) ---

export async function ensurePushSubscriptionsTab(
  accessToken: string,
  spreadsheetId: string,
): Promise<void> {
  try {
    const result = await readValues(
      accessToken,
      spreadsheetId,
      `'${TAB_NAME}'!A1:L1`,
    );
    if (!result?.values || result.values.length === 0) {
      // Tab exists but no headers — write them
      await writeHeaders(accessToken, spreadsheetId, [PUSH_HEADERS]);
    }
    // Tab exists with headers — nothing to do
  } catch (error) {
    if (error instanceof GoogleApiRequestError && error.status === 400) {
      // Tab doesn't exist — create it and write headers
      await addSheet(accessToken, spreadsheetId, TAB_NAME);
      await writeHeaders(accessToken, spreadsheetId, [PUSH_HEADERS]);
    } else {
      throw error;
    }
  }
}

// --- Read ---

export async function readPushSubscriptions(
  accessToken: string,
  spreadsheetId: string,
): Promise<PushSubscription[]> {
  const rows = await readAllRows(accessToken, spreadsheetId, TAB_NAME);
  const subscriptions: PushSubscription[] = [];
  for (const row of rows) {
    const parsed = parseRow(row);
    if (parsed && parsed.deletedAt === '') {
      subscriptions.push(parsed);
    }
  }
  return subscriptions;
}

// --- Find by endpoint ---

export async function findActiveSubscriptionByEndpoint(
  accessToken: string,
  spreadsheetId: string,
  endpoint: string,
): Promise<PushSubscription | null> {
  const all = await readPushSubscriptions(accessToken, spreadsheetId);
  return all.find((s) => s.endpoint === endpoint && s.enabled) ?? null;
}

// --- Create ---

export async function createPushSubscription(
  accessToken: string,
  spreadsheetId: string,
  data: { endpoint: string; p256dhKey: string; authKey: string; deliveryHour: number; deliveryMinute: number },
): Promise<string> {
  const id = uuidv4();
  const row = [
    id,
    'user',
    data.endpoint,
    data.p256dhKey,
    data.authKey,
    String(data.deliveryHour),
    String(data.deliveryMinute),
    'Asia/Kolkata',
    'TRUE',
    new Date().toISOString(),
    '',
    '',
  ];
  await appendRows(accessToken, spreadsheetId, TAB_NAME, [row]);
  return id;
}

// --- Soft delete ---

export async function softDeletePushSubscription(
  accessToken: string,
  spreadsheetId: string,
  rowIndex: number,
): Promise<void> {
  await updateCell(
    accessToken,
    spreadsheetId,
    TAB_NAME,
    rowIndex,
    COL.deleted_at,
    new Date().toISOString(),
  );
}

// --- Update delivery time ---

export async function updateDeliveryTime(
  accessToken: string,
  spreadsheetId: string,
  rowIndex: number,
  hour: number,
  minute: number,
): Promise<void> {
  await updateCell(accessToken, spreadsheetId, TAB_NAME, rowIndex, COL.delivery_hour, String(hour));
  await updateCell(accessToken, spreadsheetId, TAB_NAME, rowIndex, COL.delivery_minute, String(minute));
}
