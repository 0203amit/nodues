import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleAuth } from 'google-auth-library';
import webpush from 'web-push';

// --- Constants ---

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const IST_OFFSET_MINUTES = 330; // UTC+5:30
const PUSH_PAYLOAD_MAX_BODY_CHARS = 200;

// --- Column indices (must match src/config/schema.ts) ---

const BILLS_COL = {
  ID: 0,
  BILL_TYPE_ID: 1,
  DUE_DATE: 4,
  STATUS: 6,
  DELETED_AT: 16,
} as const;

const BILL_TYPES_COL = {
  ID: 0,
  PROPERTY_ID: 1,
  NAME: 2,
} as const;

const PROPERTIES_COL = {
  ID: 0,
  NAME: 1,
} as const;

const TODOS_COL = {
  ID: 0,
  TITLE: 1,
  DUE_DATE: 4,
  STATUS: 6,
  DELETED_AT: 16,
} as const;

const PUSH_SUB_COL = {
  ID: 0,
  USER_EMAIL: 1,
  ENDPOINT: 2,
  P256DH_KEY: 3,
  AUTH_KEY: 4,
  DELIVERY_HOUR: 5,
  DELIVERY_MINUTE: 6,
  TIMEZONE: 7,
  ENABLED: 8,
  CREATED_AT: 9,
  LAST_PUSHED_AT: 10,
  DELETED_AT: 11,
} as const;

const TENANCIES_COL = {
  ID: 0,
  PROPERTY_ID: 1,
  UNIT_LABEL: 2,
  NAME: 3,
  RENT_AMOUNT: 6,
  RENT_DUE_DAY: 8,
  LEASE_START_DATE: 9,
  LEASE_END_DATE: 10,
  IS_ACTIVE: 11,
  DELETED_AT: 15,
} as const;

const COLLECTIONS_COL = {
  ID: 0,
  TENANCY_ID: 1,
  MONTH: 2,
  EXPECTED_AMOUNT: 3,
  DUE_DATE: 4,
  COMPOSITE_KEY: 6,
  DELETED_AT: 9,
} as const;

const PAYMENTS_COL = {
  ID: 0,
  COLLECTION_ID: 1,
  AMOUNT: 2,
  DELETED_AT: 8,
} as const;

// --- Types ---

interface PushSubRow {
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  delivery_hour: number;
  enabled: string;
  last_pushed_at: string;
  deleted_at: string;
  _rowNumber: number;
}

interface OverdueItem {
  description: string;
}

// --- Helpers ---

async function sheetsGet(
  token: string,
  sheetId: string,
  range: string,
): Promise<{ values?: string[][] }> {
  const url = `${SHEETS_API}/${sheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets GET ${range} failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function sheetsUpdate(
  token: string,
  sheetId: string,
  range: string,
  values: string[][],
): Promise<unknown> {
  const url = `${SHEETS_API}/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets PUT ${range} failed (${res.status}): ${text}`);
  }
  return res.json();
}

// --- Cron Activity Log Helper (R-007) ---

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Format "2026-06" as "Jun 2026". */
function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
}

/** Best-effort activity log append from cron. Uses userEmail='cron'. */
async function appendActivityLogFromCron(
  token: string,
  sheetId: string,
  entry: { id: string; action: string; entityType: string; entityId: string; summary: string },
): Promise<void> {
  const nowISO = new Date().toISOString();
  const row = [entry.id, nowISO, 'cron', entry.action, entry.entityType, entry.entityId, entry.summary];
  try {
    await sheetsUpdate(token, sheetId, "'ActivityLog'!A:G", [row]);
  } catch (e) {
    console.error('[notify] Activity log write failed:', e);
  }
}

// --- Main Handler ---

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  try {
    // 1. Env var validation
    const requiredEnvVars = [
      'CRON_SECRET',
      'GOOGLE_SERVICE_ACCOUNT_JSON',
      'NODUES_SHEET_ID',
      'VAPID_PUBLIC_KEY',
      'VAPID_PRIVATE_KEY',
      'VAPID_SUBJECT',
    ] as const;

    const missing = requiredEnvVars.filter((v) => !process.env[v]);
    if (missing.length > 0) {
      res.status(500).json({ error: `Missing env vars: ${missing.join(', ')}` });
      return;
    }

    // 2. Auth check
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    if (req.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // 3. VAPID setup
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );

    // 4. Service Account auth
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const accessToken = await auth.getAccessToken();

    if (!accessToken) {
      res.status(500).json({ error: 'Failed to obtain Google access token' });
      return;
    }

    const sheetId = process.env.NODUES_SHEET_ID!;

    // 5. Compute IST hour
    const now = new Date();
    const utcMin = now.getUTCHours() * 60 + now.getUTCMinutes();
    const istMin = (utcMin + IST_OFFSET_MINUTES) % 1440;
    const currentISTHour = Math.floor(istMin / 60);
    const istToday = new Date(Date.now() + IST_OFFSET_MINUTES * 60_000)
      .toISOString()
      .slice(0, 10);

    // 6. Read PushSubscriptions
    const subsResponse = await sheetsGet(
      accessToken,
      sheetId,
      "'PushSubscriptions'!A2:L",
    );
    const subsRows = subsResponse.values || [];

    const activeSubscriptions: PushSubRow[] = [];
    let pushesSkipped = 0;

    for (let i = 0; i < subsRows.length; i++) {
      const row = subsRows[i];
      const enabled = row[PUSH_SUB_COL.ENABLED] || '';
      const deletedAt = row[PUSH_SUB_COL.DELETED_AT] || '';
      const deliveryHour = Number(row[PUSH_SUB_COL.DELIVERY_HOUR]) || 0;
      const lastPushedAt = row[PUSH_SUB_COL.LAST_PUSHED_AT] || '';

      if (enabled !== 'TRUE' || deletedAt !== '') continue;
      if (deliveryHour !== currentISTHour) continue;

      // Idempotency check: skip if pushed within last 23 hours
      if (lastPushedAt) {
        const lastPushTime = new Date(lastPushedAt).getTime();
        if (Date.now() - lastPushTime < 23 * 60 * 60 * 1000) {
          pushesSkipped++;
          continue;
        }
      }

      activeSubscriptions.push({
        endpoint: row[PUSH_SUB_COL.ENDPOINT] || '',
        p256dh_key: row[PUSH_SUB_COL.P256DH_KEY] || '',
        auth_key: row[PUSH_SUB_COL.AUTH_KEY] || '',
        delivery_hour: deliveryHour,
        enabled,
        last_pushed_at: lastPushedAt,
        deleted_at: deletedAt,
        _rowNumber: i + 2, // Sheet is 1-indexed, row 1 is header
      });
    }

    // 7. Read Properties (needed by rent auto-gen AND notification body)
    const propertiesResponse = await sheetsGet(accessToken, sheetId, "'Properties'!A2:G");

    const propertyMap = new Map<string, string>();
    for (const row of propertiesResponse.values || []) {
      const id = row[PROPERTIES_COL.ID] || '';
      if (id) {
        propertyMap.set(id, row[PROPERTIES_COL.NAME] || '');
      }
    }

    // Block 1: Read rent data (DEGRADE-ON-MISSING per R-010)
    let tenancyRows: string[][] = [];
    let collectionRows: string[][] = [];
    let paymentRows: string[][] = [];
    try {
      const [tenanciesResponse, collectionsResponse, paymentsResponse] =
        await Promise.all([
          sheetsGet(accessToken, sheetId, "'Tenancies'!A2:P"),
          sheetsGet(accessToken, sheetId, "'RentCollections'!A2:J"),
          sheetsGet(accessToken, sheetId, "'PaymentEvents'!A2:I"),
        ]);
      tenancyRows = tenanciesResponse.values || [];
      collectionRows = collectionsResponse.values || [];
      paymentRows = paymentsResponse.values || [];
    } catch (e) {
      console.error('[notify] Failed to read rent data:', e);
      // Continue — rent features degraded but bills/todos unaffected
    }

    // Build rental lookup maps
    const tenancyMap = new Map<string, {
      name: string; unitLabel: string; propertyId: string;
      rentAmount: number; rentDueDay: number; leaseStartDate: string;
      leaseEndDate: string; isActive: string; deletedAt: string;
    }>();
    for (const row of tenancyRows) {
      const id = row[TENANCIES_COL.ID] || '';
      if (id) {
        tenancyMap.set(id, {
          name: row[TENANCIES_COL.NAME] || '',
          unitLabel: row[TENANCIES_COL.UNIT_LABEL] || '',
          propertyId: row[TENANCIES_COL.PROPERTY_ID] || '',
          rentAmount: Number(row[TENANCIES_COL.RENT_AMOUNT]) || 0,
          rentDueDay: Number(row[TENANCIES_COL.RENT_DUE_DAY]) || 1,
          leaseStartDate: row[TENANCIES_COL.LEASE_START_DATE] || '',
          leaseEndDate: row[TENANCIES_COL.LEASE_END_DATE] || '',
          isActive: row[TENANCIES_COL.IS_ACTIVE] || 'false',
          deletedAt: row[TENANCIES_COL.DELETED_AT] || '',
        });
      }
    }

    // Build existing composite key set (non-deleted collections only)
    const existingCompositeKeys = new Set<string>();
    for (const row of collectionRows) {
      const deletedAt = row[COLLECTIONS_COL.DELETED_AT] || '';
      if (deletedAt === '') {
        const ck = row[COLLECTIONS_COL.COMPOSITE_KEY] || '';
        if (ck) existingCompositeKeys.add(ck);
      }
    }

    // Build payment sums by collection ID
    const paymentSumByCollection = new Map<string, number>();
    for (const row of paymentRows) {
      const deletedAt = row[PAYMENTS_COL.DELETED_AT] || '';
      if (deletedAt !== '') continue;
      const collId = row[PAYMENTS_COL.COLLECTION_ID] || '';
      const amount = Number(row[PAYMENTS_COL.AMOUNT]) || 0;
      paymentSumByCollection.set(collId, (paymentSumByCollection.get(collId) || 0) + amount);
    }

    // Block 2: Auto-generate rent collections (R-005)
    try {
      const currentMonth = istToday.slice(0, 7); // YYYY-MM
      const firstDayOfMonth = currentMonth + '-01';

      for (const [tenancyId, tenancy] of tenancyMap) {
        try {
          // Skip checks per FR-018
          if (tenancy.deletedAt !== '') continue;
          if (tenancy.isActive !== 'true') continue;
          const propName = propertyMap.get(tenancy.propertyId);
          if (!propName) continue;
          if (tenancy.leaseStartDate > istToday) continue;
          if (tenancy.leaseEndDate && tenancy.leaseEndDate < firstDayOfMonth) continue;

          // Idempotency check
          const compositeKey = `${tenancyId}|${currentMonth}`;
          if (existingCompositeKeys.has(compositeKey)) continue;

          // Compute due date with clamping
          const [yearStr, monStr] = currentMonth.split('-');
          const year = Number(yearStr);
          const mon = Number(monStr);
          const lastDay = new Date(year, mon, 0).getDate();
          const clampedDay = Math.min(tenancy.rentDueDay, lastDay);
          const dueDate = `${year}-${String(mon).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;

          // Build new collection row
          const newId = crypto.randomUUID();
          const nowISO = new Date().toISOString();
          const newRow = [
            newId, tenancyId, currentMonth, String(tenancy.rentAmount),
            dueDate, '', compositeKey, nowISO, nowISO, '',
          ];

          // Append to Sheet
          await sheetsUpdate(accessToken, sheetId, `'RentCollections'!A${collectionRows.length + 2}:J${collectionRows.length + 2}`, [newRow]);
          collectionRows.push(newRow); // keep local state in sync
          existingCompositeKeys.add(compositeKey);

          // Activity log (R-007)
          const unitPart = tenancy.unitLabel ? ` (${tenancy.unitLabel})` : '';
          await appendActivityLogFromCron(accessToken, sheetId, {
            id: crypto.randomUUID(),
            action: 'rent_auto_generated',
            entityType: 'rent_collection',
            entityId: newId,
            summary: `Rent auto-generated: ${tenancy.name}${unitPart} \u2014 ${propName} ${formatMonthLabel(currentMonth)}`,
          });
        } catch (innerErr) {
          console.error(`[notify] Rent auto-gen failed for tenancy ${tenancyId}:`, innerErr);
          // Continue with remaining tenancies (FR-021)
        }
      }
    } catch (e) {
      console.error('[notify] Rent auto-generation block failed:', e);
    }

    // 8. If no active subscriptions match, return early
    // (rent auto-gen has already run above — only notification logic is skipped)
    if (activeSubscriptions.length === 0) {
      res.status(200).json({
        subscriptionsChecked: subsRows.length,
        pushesSent: 0,
        pushesSkipped,
        errors: [],
      });
      return;
    }

    // 9. Read overdue items (fetch in parallel)
    const [billsResponse, billTypesResponse, todosResponse] =
      await Promise.all([
        sheetsGet(accessToken, sheetId, "'Bills'!A2:R"),
        sheetsGet(accessToken, sheetId, "'BillTypes'!A2:J"),
        sheetsGet(accessToken, sheetId, "'Todos'!A2:Q"),
      ]);

    // Build lookup maps
    const billTypeMap = new Map<string, { name: string; propertyId: string }>();
    for (const row of billTypesResponse.values || []) {
      const id = row[BILL_TYPES_COL.ID] || '';
      if (id) {
        billTypeMap.set(id, {
          name: row[BILL_TYPES_COL.NAME] || '',
          propertyId: row[BILL_TYPES_COL.PROPERTY_ID] || '',
        });
      }
    }

    // Duplicates computeDisplayStatus from src/services/billsService.ts and
    // src/services/todosService.ts — keep in sync if the overdue rules change.

    // Parse overdue bills
    const overdueBills: OverdueItem[] = [];
    for (const row of billsResponse.values || []) {
      const deletedAt = row[BILLS_COL.DELETED_AT] || '';
      if (deletedAt !== '') continue;

      const status = row[BILLS_COL.STATUS] || 'pending';
      if (status === 'paid' || status === 'skipped' || status === 'not_yet_generated')
        continue;

      // status === 'pending': check if overdue
      const dueDate = row[BILLS_COL.DUE_DATE] || '';
      if (!dueDate || dueDate >= istToday) continue;

      // Overdue \u2014 build description
      const billTypeId = row[BILLS_COL.BILL_TYPE_ID] || '';
      const btInfo = billTypeMap.get(billTypeId);
      const billTypeName = btInfo?.name || 'Unknown';
      const propertyName = btInfo?.propertyId
        ? propertyMap.get(btInfo.propertyId) || 'Unknown'
        : 'Unknown';

      overdueBills.push({
        description: `${billTypeName} \u2014 ${propertyName}`,
      });
    }

    // Parse overdue todos
    const overdueTodos: OverdueItem[] = [];
    for (const row of todosResponse.values || []) {
      const deletedAt = row[TODOS_COL.DELETED_AT] || '';
      if (deletedAt !== '') continue;

      const status = row[TODOS_COL.STATUS] || 'pending';
      if (status === 'done') continue;

      // status === 'pending': check if overdue
      const dueDate = row[TODOS_COL.DUE_DATE] || '';
      if (!dueDate || dueDate >= istToday) continue;

      const title = row[TODOS_COL.TITLE] || 'Untitled';
      overdueTodos.push({ description: title });
    }

    // Block 3: Compute overdue rents (R-005)
    const overdueRents: OverdueItem[] = [];
    try {
      const currentMonth = istToday.slice(0, 7);
      for (const row of collectionRows) {
        const deletedAt = row[COLLECTIONS_COL.DELETED_AT] || '';
        if (deletedAt !== '') continue;

        const month = row[COLLECTIONS_COL.MONTH] || '';
        if (!month || month >= currentMonth) continue; // only past months are overdue

        const collId = row[COLLECTIONS_COL.ID] || '';
        const expectedAmount = Number(row[COLLECTIONS_COL.EXPECTED_AMOUNT]) || 0;
        const totalReceived = paymentSumByCollection.get(collId) || 0;
        if (totalReceived >= expectedAmount) continue; // fully received

        // Overdue \u2014 build description
        const tenancyId = row[COLLECTIONS_COL.TENANCY_ID] || '';
        const tenancy = tenancyMap.get(tenancyId);
        if (!tenancy) continue;
        const propName = propertyMap.get(tenancy.propertyId) || 'Unknown';
        const desc = tenancy.unitLabel
          ? `${tenancy.name} (${tenancy.unitLabel}) \u2014 ${propName}`
          : `${tenancy.name} \u2014 ${propName}`;

        overdueRents.push({ description: desc });
      }
    } catch (e) {
      console.error('[notify] Overdue rent computation failed:', e);
      // overdueRents stays empty — push notification proceeds without rent items
    }

    // 10. Skip if zero overdue items
    const overdueBillCount = overdueBills.length;
    const overdueRentCount = overdueRents.length;
    const overdueTodoCount = overdueTodos.length;

    const allOverdue = [...overdueBills, ...overdueRents, ...overdueTodos];
    const total = allOverdue.length;

    if (total === 0) {
      res.status(200).json({
        subscriptionsChecked: subsRows.length,
        pushesSent: 0,
        pushesSkipped: pushesSkipped + activeSubscriptions.length,
        errors: [],
      });
      return;
    }

    // 11. Build notification body (R-002/R-003)
    let prefix: string;
    if (overdueRentCount > 0) {
      const parts: string[] = [];
      if (overdueBillCount > 0) parts.push(`${overdueBillCount} bill${overdueBillCount > 1 ? 's' : ''}`);
      if (overdueRentCount > 0) parts.push(`${overdueRentCount} rent${overdueRentCount > 1 ? 's' : ''}`);
      if (overdueTodoCount > 0) parts.push(`${overdueTodoCount} todo${overdueTodoCount > 1 ? 's' : ''}`);
      prefix = `${parts.join(' + ')} pending`;
    } else {
      prefix = `${total} overdue`; // existing format preserved
    }

    const allDescriptions = allOverdue.map(item => item.description);
    const first3 = allDescriptions.slice(0, 3).join(', ');
    const more = total > 3 ? `... and ${total - 3} more` : '';
    let body = `${prefix}: ${first3}${more}`;

    // Truncate to 200 chars at word boundary
    if (body.length > PUSH_PAYLOAD_MAX_BODY_CHARS) {
      const truncated = body.slice(0, PUSH_PAYLOAD_MAX_BODY_CHARS - 1);
      const lastSpace = truncated.lastIndexOf(' ');
      body = (lastSpace > 100 ? truncated.slice(0, lastSpace) : truncated) + '\u2026';
    }

    const payload = JSON.stringify({ title: 'NoDues', body });

    // 12. Send pushes
    const errors: { endpoint: string; status: number; message: string }[] = [];
    let pushesSent = 0;

    for (const sub of activeSubscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
          },
          payload,
        );

        // Success — update last_pushed_at
        await sheetsUpdate(
          accessToken,
          sheetId,
          `'PushSubscriptions'!K${sub._rowNumber}`,
          [[new Date().toISOString()]],
        );
        pushesSent++;
      } catch (err: any) {
        const statusCode = err.statusCode || err.status || 0;
        if (statusCode === 410) {
          // Subscription is invalid — soft-delete
          await sheetsUpdate(
            accessToken,
            sheetId,
            `'PushSubscriptions'!L${sub._rowNumber}`,
            [[new Date().toISOString()]],
          );
          errors.push({
            endpoint: sub.endpoint,
            status: 410,
            message: 'Subscription invalid (410 Gone); soft-deleted',
          });
        } else {
          errors.push({
            endpoint: sub.endpoint,
            status: statusCode,
            message: err.message || 'Unknown error',
          });
        }
      }
    }

    // 13. Return summary
    res.status(200).json({
      subscriptionsChecked: subsRows.length,
      pushesSent,
      pushesSkipped,
      errors,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
