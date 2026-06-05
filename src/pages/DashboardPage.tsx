import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, RotateCw, Receipt, ListTodo, Landmark, CheckCircle2, History } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBootstrap } from '../contexts/BootstrapContext';
import { useToast } from '../contexts/ToastContext';
import { fetchProperties } from '../services/propertiesService';
import { fetchBillTypes } from '../services/billTypesService';
import { fetchBills, formatCurrency, formatMonth, formatDateDisplay } from '../services/billsService';
import { fetchTodos } from '../services/todosService';
import { fetchAllCategories } from '../services/todoCategoriesService';
import { fetchRecurrencePatterns } from '../services/recurrencePatternsService';
import { fetchActivityLog } from '../services/activityLogService';
import { fetchTenancies } from '../services/tenanciesService';
import { fetchRentCollections, computeRentStatus } from '../services/rentCollectionsService';
import { fetchPaymentEvents } from '../services/paymentEventsService';
import ActivityRow from '../components/shared/ActivityRow';
import { APP_TITLE_SUFFIX } from '../config/branding';
import type {
  AttentionItem,
  ActivityLogEntry,
  PropertyMoneySummary,
  Property,
  BillWithDisplay,
  TodoWithDisplay,
  TenancyWithDisplay,
  RentCollection,
  PaymentEvent,
} from '../types';

// --- Date filter helpers ---

const DATE_PRESET_OPTIONS = [
  { value: 'current_month', label: 'Current Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'last_6_months', label: 'Last 6 Months' },
  { value: 'last_year', label: 'Last Year' },
  { value: 'custom', label: 'Custom Range' },
] as const;

function getCurrentMonthIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 7);
}

function shiftMonthBy(baseMonth: string, offset: number): string {
  const [y, m] = baseMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthRange(
  preset: string,
  customStart: string,
  customEnd: string,
): { startMonth: string; endMonth: string } {
  const currentMonth = getCurrentMonthIST();

  if (preset === 'custom') {
    return {
      startMonth: customStart || currentMonth,
      endMonth: customEnd || currentMonth,
    };
  }

  switch (preset) {
    case 'last_month': {
      const m = shiftMonthBy(currentMonth, -1);
      return { startMonth: m, endMonth: m };
    }
    case 'last_3_months':
      return { startMonth: shiftMonthBy(currentMonth, -2), endMonth: currentMonth };
    case 'last_6_months':
      return { startMonth: shiftMonthBy(currentMonth, -5), endMonth: currentMonth };
    case 'last_year':
      return { startMonth: shiftMonthBy(currentMonth, -11), endMonth: currentMonth };
    default: // 'current_month'
      return { startMonth: currentMonth, endMonth: currentMonth };
  }
}

function formatMonthRange(startMonth: string, endMonth: string): string {
  if (startMonth === endMonth) return formatMonth(startMonth);
  const [sy] = startMonth.split('-');
  const [ey] = endMonth.split('-');
  if (sy === ey) {
    const startLabel = formatMonth(startMonth).split(' ')[0];
    return `${startLabel} \u2013 ${formatMonth(endMonth)}`;
  }
  return `${formatMonth(startMonth)} \u2013 ${formatMonth(endMonth)}`;
}

function isMonthInRange(month: string, startMonth: string, endMonth: string): boolean {
  return month >= startMonth && month <= endMonth;
}

export default function DashboardPage() {
  const { accessToken } = useAuth();
  const { setupResult } = useBootstrap();
  const spreadsheetId = setupResult!.spreadsheetId;
  const { showToast } = useToast();
  const navigate = useNavigate();

  // --- State ---
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityLogEntry[]>([]);
  const lastFetchAt = useRef<number>(0);

  // Raw data for client-side filtering
  const [allBills, setAllBills] = useState<BillWithDisplay[]>([]);
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [allTenancies, setAllTenancies] = useState<TenancyWithDisplay[]>([]);
  const [allRentCollections, setAllRentCollections] = useState<RentCollection[]>([]);
  const [allPaymentEvents, setAllPaymentEvents] = useState<PaymentEvent[]>([]);

  // Bills filter state
  const [billsDatePreset, setBillsDatePreset] = useState('current_month');
  const [billsCustomStart, setBillsCustomStart] = useState('');
  const [billsCustomEnd, setBillsCustomEnd] = useState('');
  const [billsPropertyFilter, setBillsPropertyFilter] = useState('all');

  // Rents filter state
  const [rentsDatePreset, setRentsDatePreset] = useState('current_month');
  const [rentsCustomStart, setRentsCustomStart] = useState('');
  const [rentsCustomEnd, setRentsCustomEnd] = useState('');
  const [rentsPropertyFilter, setRentsPropertyFilter] = useState('all');

  // --- Document title ---
  useEffect(() => {
    document.title = `${APP_TITLE_SUFFIX} · Dashboard`;
  }, []);

  // --- Data loading ---
  const loadAllData = useCallback(async () => {
    const token = accessToken!;
    const ssId = spreadsheetId;

    // Phase 1: independent reference data
    const phase1Names = ['properties', 'bill types', 'categories', 'recurrence patterns', 'activity log'];
    const phase1 = await Promise.allSettled([
      fetchProperties(token, ssId),
      fetchBillTypes(token, ssId),
      fetchAllCategories(token, ssId),
      fetchRecurrencePatterns(token, ssId),
      fetchActivityLog(token, ssId),
    ]);

    const properties: Property[] = phase1[0].status === 'fulfilled' ? phase1[0].value : [];
    const billTypes = phase1[1].status === 'fulfilled' ? phase1[1].value : [];
    const categories = phase1[2].status === 'fulfilled' ? phase1[2].value : [];
    const patterns = phase1[3].status === 'fulfilled' ? phase1[3].value : [];
    const activityEntries: ActivityLogEntry[] = phase1[4].status === 'fulfilled' ? phase1[4].value : [];

    for (let i = 0; i < phase1.length; i++) {
      if (phase1[i].status === 'rejected') {
        showToast(`Failed to load ${phase1Names[i]}.`, 'error');
      }
    }

    // Build maps (same patterns as BillsPage / TodosPage)
    const billTypeMap = new Map<string, { name: string; propertyId: string; propertyName: string }>();
    for (const bt of billTypes) {
      billTypeMap.set(bt.id, {
        name: bt.name,
        propertyId: bt.propertyId,
        propertyName: bt.propertyName,
      });
    }

    const categoryMap = new Map<string, { name: string; color: string }>();
    for (const c of categories) {
      categoryMap.set(c.id, { name: c.name, color: c.color });
    }

    const patternMap = new Map<string, { name: string; intervalValue: number }>();
    for (const p of patterns) {
      patternMap.set(p.id, { name: p.name, intervalValue: p.intervalValue });
    }

    // Phase 2: dependent data
    const phase2Names = ['bills', 'to-dos'];
    const phase2 = await Promise.allSettled([
      fetchBills(token, ssId, billTypeMap),
      fetchTodos(token, ssId, categoryMap, patternMap),
    ]);

    const bills: BillWithDisplay[] = phase2[0].status === 'fulfilled' ? phase2[0].value : [];
    const todos: TodoWithDisplay[] = phase2[1].status === 'fulfilled' ? phase2[1].value : [];

    for (let i = 0; i < phase2.length; i++) {
      if (phase2[i].status === 'rejected') {
        showToast(`Failed to load ${phase2Names[i]}.`, 'error');
      }
    }

    // Phase 3: Rental data (may not exist if user hasn't visited /rentals yet)
    const propMap = new Map<string, string>();
    for (const p of properties) propMap.set(p.id, p.name);

    let tenancies: TenancyWithDisplay[] = [];
    let rentCollections: RentCollection[] = [];
    let paymentEvents: PaymentEvent[] = [];
    try {
      [tenancies, rentCollections, paymentEvents] = await Promise.all([
        fetchTenancies(token, ssId, propMap),
        fetchRentCollections(token, ssId),
        fetchPaymentEvents(token, ssId),
      ]);
    } catch { /* tabs may not exist yet */ }

    // --- Store raw data for client-side filtering ---
    setAllBills(bills);
    setAllProperties(properties);
    setAllTenancies(tenancies);
    setAllRentCollections(rentCollections);
    setAllPaymentEvents(paymentEvents);

    // --- Compute Attention Items (T016) ---
    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    // Build payment sums by collection ID (needed for attention items)
    const paymentSumByCollection = new Map<string, number>();
    for (const pe of paymentEvents) {
      if (pe.deletedAt !== '') continue;
      paymentSumByCollection.set(pe.collectionId, (paymentSumByCollection.get(pe.collectionId) || 0) + pe.amount);
    }

    // Build tenancy lookup
    const tenancyById = new Map<string, TenancyWithDisplay>();
    for (const t of tenancies) tenancyById.set(t.id, t);

    const overdueBills: AttentionItem[] = bills
      .filter(b => b.displayStatus === 'overdue')
      .map(b => ({
        kind: 'bill' as const,
        id: b.id,
        billTypeName: b.billTypeName,
        propertyName: b.propertyName,
        propertyId: b.propertyId,
        month: b.month,
        dueDate: b.dueDate,
        displayStatus: b.displayStatus,
        amount: b.amount,
      }));

    const overdueTodos: AttentionItem[] = todos
      .filter(t => t.displayStatus === 'overdue')
      .map(t => ({
        kind: 'todo' as const,
        id: t.id,
        title: t.title,
        categoryId: t.categoryId,
        categoryName: t.categoryName,
        categoryColor: t.categoryColor,
        dueDate: t.dueDate,
        displayStatus: t.displayStatus,
      }));

    // Overdue rent items (T055) — iterate ALL non-deleted collections
    const overdueRentItems: AttentionItem[] = [];
    for (const coll of rentCollections) {
      if (coll.deletedAt !== '') continue;
      const totalRcv = paymentSumByCollection.get(coll.id) || 0;
      const status = computeRentStatus(coll.expectedAmount, totalRcv, coll.month, todayIST);
      if (status !== 'overdue') continue;

      const ten = tenancyById.get(coll.tenancyId);
      if (!ten) continue;
      overdueRentItems.push({
        kind: 'rent',
        id: coll.id,
        tenancyName: ten.name,
        unitLabel: ten.unitLabel,
        propertyId: ten.propertyId,
        propertyName: ten.propertyName,
        month: coll.month,
        dueDate: coll.dueDate,
        expectedAmount: coll.expectedAmount,
        totalReceived: totalRcv,
        displayStatus: status,
      });
    }

    const merged = [...overdueBills, ...overdueRentItems, ...overdueTodos].sort((a, b) => {
      const dateCompare = a.dueDate.localeCompare(b.dueDate);
      if (dateCompare !== 0) return dateCompare;
      const kindOrder = { bill: 0, rent: 1, todo: 2 };
      return kindOrder[a.kind] - kindOrder[b.kind];
    });

    setAttentionItems(merged);

    // --- Recent Activity (T017) ---
    setRecentActivity(activityEntries.slice(0, 5));

    lastFetchAt.current = Date.now();
  }, [accessToken, spreadsheetId, showToast]);

  // --- Mount ---
  useEffect(() => {
    setIsLoading(true);
    loadAllData().finally(() => setIsLoading(false));
  }, [loadAllData]);

  // --- Auto-refresh on visibility change (T018) ---
  useEffect(() => {
    function handleVisibility() {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - lastFetchAt.current > 30_000
      ) {
        setIsRefreshing(true);
        loadAllData().finally(() => setIsRefreshing(false));
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadAllData]);

  // --- Refresh handler ---
  function handleRefresh() {
    setIsRefreshing(true);
    loadAllData().finally(() => setIsRefreshing(false));
  }

  // --- Bills summary (filtered) ---
  const billsPropertyOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const b of allBills) {
      if (b.propertyId && !seen.has(b.propertyId)) {
        seen.set(b.propertyId, b.propertyName);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ value: id, label: name }));
  }, [allBills]);

  const billsSummary = useMemo(() => {
    const { startMonth, endMonth } = getMonthRange(billsDatePreset, billsCustomStart, billsCustomEnd);

    let filtered = allBills.filter(b => isMonthInRange(b.month, startMonth, endMonth));
    if (billsPropertyFilter !== 'all') {
      filtered = filtered.filter(b => b.propertyId === billsPropertyFilter);
    }

    const outstanding = filtered
      .filter(b => (b.displayStatus === 'pending' || b.displayStatus === 'overdue') && b.amount !== null)
      .reduce((sum, b) => sum + b.amount!, 0);

    const paid = filtered
      .filter(b => b.status === 'paid' && b.amount !== null)
      .reduce((sum, b) => sum + b.amount!, 0);

    const propertyGroups = new Map<string, BillWithDisplay[]>();
    for (const bill of filtered) {
      const group = propertyGroups.get(bill.propertyId) ?? [];
      group.push(bill);
      propertyGroups.set(bill.propertyId, group);
    }

    const byProperty: PropertyMoneySummary[] = [];
    for (const [propertyId, group] of propertyGroups) {
      const propOutstanding = group
        .filter(b => (b.displayStatus === 'pending' || b.displayStatus === 'overdue') && b.amount !== null)
        .reduce((sum, b) => sum + b.amount!, 0);
      const propPaid = group
        .filter(b => b.status === 'paid' && b.amount !== null)
        .reduce((sum, b) => sum + b.amount!, 0);
      if (propOutstanding === 0 && propPaid === 0) continue;
      const prop = allProperties.find(p => p.id === propertyId);
      byProperty.push({
        propertyId,
        propertyName: prop?.name ?? 'Unknown',
        outstanding: propOutstanding,
        paid: propPaid,
      });
    }

    return { outstanding, paid, byProperty, rangeLabel: formatMonthRange(startMonth, endMonth) };
  }, [allBills, allProperties, billsDatePreset, billsCustomStart, billsCustomEnd, billsPropertyFilter]);

  // --- Rents summary (filtered) ---
  const rentsPropertyOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of allTenancies) {
      if (!seen.has(t.propertyId)) {
        seen.set(t.propertyId, t.propertyName);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ value: id, label: name }));
  }, [allTenancies]);

  const rentsSummary = useMemo(() => {
    const { startMonth, endMonth } = getMonthRange(rentsDatePreset, rentsCustomStart, rentsCustomEnd);

    const paymentSumByCollection = new Map<string, number>();
    for (const pe of allPaymentEvents) {
      if (pe.deletedAt !== '') continue;
      paymentSumByCollection.set(pe.collectionId, (paymentSumByCollection.get(pe.collectionId) || 0) + pe.amount);
    }

    const tenancyById = new Map<string, TenancyWithDisplay>();
    for (const t of allTenancies) tenancyById.set(t.id, t);

    let filtered = allRentCollections.filter(
      c => c.deletedAt === '' && isMonthInRange(c.month, startMonth, endMonth),
    );

    if (rentsPropertyFilter !== 'all') {
      filtered = filtered.filter(c => {
        const ten = tenancyById.get(c.tenancyId);
        return ten?.propertyId === rentsPropertyFilter;
      });
    }

    let rentExpected = 0;
    let rentReceived = 0;
    const rentByProperty = new Map<string, { propertyId: string; propertyName: string; expected: number; received: number }>();

    for (const coll of filtered) {
      const received = paymentSumByCollection.get(coll.id) || 0;
      rentExpected += coll.expectedAmount;
      rentReceived += received;

      const ten = tenancyById.get(coll.tenancyId);
      if (ten) {
        const key = ten.propertyId;
        const existing = rentByProperty.get(key) ?? {
          propertyId: ten.propertyId,
          propertyName: ten.propertyName,
          expected: 0,
          received: 0,
        };
        existing.expected += coll.expectedAmount;
        existing.received += received;
        rentByProperty.set(key, existing);
      }
    }

    return {
      totalExpected: rentExpected,
      totalReceived: rentReceived,
      totalOutstanding: Math.max(0, rentExpected - rentReceived),
      byProperty: Array.from(rentByProperty.values()),
      rangeLabel: formatMonthRange(startMonth, endMonth),
      hasData: filtered.length > 0,
    };
  }, [allRentCollections, allPaymentEvents, allTenancies, rentsDatePreset, rentsCustomStart, rentsCustomEnd, rentsPropertyFilter]);

  // --- Render ---
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-3xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer
                     min-h-11 min-w-11 inline-flex items-center justify-center
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                     disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Refresh"
        >
          <RotateCw className={`w-4 h-4${isRefreshing ? ' animate-spin' : ''}`} />
        </button>
      </div>

      {/* Loading state */}
      {isLoading && !isRefreshing && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-indigo-700 animate-spin" />
        </div>
      )}

      {/* Content sections (shown after initial load) */}
      {!isLoading && (
        <div className="flex flex-col gap-8">
          {/* --- Bills --- */}
          {allBills.length > 0 && (
            <section>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Bills</h2>
                <p className="text-sm text-slate-500">{billsSummary.rangeLabel}</p>
              </div>

              {/* Filter bar */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <select
                  value={billsDatePreset}
                  onChange={(e) => setBillsDatePreset(e.target.value)}
                  className="rounded-lg border border-slate-300 shadow-sm px-3 py-2 text-sm
                             focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                             focus:outline-none cursor-pointer sm:w-auto w-full"
                  aria-label="Bills date range"
                >
                  {DATE_PRESET_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                {billsDatePreset === 'custom' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="month"
                      value={billsCustomStart}
                      onChange={(e) => setBillsCustomStart(e.target.value)}
                      className="rounded-lg border border-slate-300 shadow-sm px-3 py-2 text-sm
                                 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                                 focus:outline-none flex-1 sm:w-auto"
                      aria-label="Bills start month"
                    />
                    <span className="text-slate-400 text-sm">to</span>
                    <input
                      type="month"
                      value={billsCustomEnd}
                      onChange={(e) => setBillsCustomEnd(e.target.value)}
                      className="rounded-lg border border-slate-300 shadow-sm px-3 py-2 text-sm
                                 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                                 focus:outline-none flex-1 sm:w-auto"
                      aria-label="Bills end month"
                    />
                  </div>
                )}

                <select
                  value={billsPropertyFilter}
                  onChange={(e) => setBillsPropertyFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 shadow-sm px-3 py-2 text-sm
                             focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                             focus:outline-none cursor-pointer sm:w-auto w-full"
                  aria-label="Bills property filter"
                >
                  <option value="all">All properties</option>
                  {billsPropertyOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 bg-white border border-slate-200 rounded-lg p-4">
                  <p className="text-sm text-slate-500 mb-1">Outstanding</p>
                  <p className="text-2xl font-bold text-slate-900 tabular-nums">
                    {formatCurrency(billsSummary.outstanding)}
                  </p>
                </div>
                <div className="flex-1 bg-white border border-slate-200 rounded-lg p-4">
                  <p className="text-sm text-slate-500 mb-1">Paid</p>
                  <p className="text-2xl font-bold text-emerald-700 tabular-nums">
                    {formatCurrency(billsSummary.paid)}
                  </p>
                </div>
              </div>

              {billsSummary.byProperty.length > 0 && (
                <div className="mt-4 bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-3 gap-2 px-4 py-2 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <span>Property</span>
                    <span className="text-right">Outstanding</span>
                    <span className="text-right">Paid</span>
                  </div>
                  {billsSummary.byProperty.map(row => (
                    <div key={row.propertyId} className="grid grid-cols-3 gap-2 px-4 py-2 border-b border-slate-50 last:border-b-0 text-sm">
                      <span className="text-slate-900 truncate">{row.propertyName}</span>
                      <span className="text-right text-slate-900 tabular-nums">{formatCurrency(row.outstanding)}</span>
                      <span className="text-right text-emerald-700 tabular-nums">{formatCurrency(row.paid)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* --- Rent Collected --- */}
          {allTenancies.length > 0 && (
            <section>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Rent Collected</h2>
                <p className="text-sm text-slate-500">{rentsSummary.rangeLabel}</p>
              </div>

              {/* Filter bar */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <select
                  value={rentsDatePreset}
                  onChange={(e) => setRentsDatePreset(e.target.value)}
                  className="rounded-lg border border-slate-300 shadow-sm px-3 py-2 text-sm
                             focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                             focus:outline-none cursor-pointer sm:w-auto w-full"
                  aria-label="Rent date range"
                >
                  {DATE_PRESET_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                {rentsDatePreset === 'custom' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="month"
                      value={rentsCustomStart}
                      onChange={(e) => setRentsCustomStart(e.target.value)}
                      className="rounded-lg border border-slate-300 shadow-sm px-3 py-2 text-sm
                                 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                                 focus:outline-none flex-1 sm:w-auto"
                      aria-label="Rent start month"
                    />
                    <span className="text-slate-400 text-sm">to</span>
                    <input
                      type="month"
                      value={rentsCustomEnd}
                      onChange={(e) => setRentsCustomEnd(e.target.value)}
                      className="rounded-lg border border-slate-300 shadow-sm px-3 py-2 text-sm
                                 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                                 focus:outline-none flex-1 sm:w-auto"
                      aria-label="Rent end month"
                    />
                  </div>
                )}

                <select
                  value={rentsPropertyFilter}
                  onChange={(e) => setRentsPropertyFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 shadow-sm px-3 py-2 text-sm
                             focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                             focus:outline-none cursor-pointer sm:w-auto w-full"
                  aria-label="Rent property filter"
                >
                  <option value="all">All properties</option>
                  {rentsPropertyOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 bg-white border border-slate-200 rounded-lg p-4">
                  <p className="text-sm text-slate-500 mb-1">Expected</p>
                  <p className="text-2xl font-bold text-slate-900 tabular-nums">
                    {formatCurrency(rentsSummary.totalExpected)}
                  </p>
                </div>
                <div className="flex-1 bg-white border border-slate-200 rounded-lg p-4">
                  <p className="text-sm text-slate-500 mb-1">Received</p>
                  <p className="text-2xl font-bold text-emerald-700 tabular-nums">
                    {formatCurrency(rentsSummary.totalReceived)}
                  </p>
                </div>
                <div className="flex-1 bg-white border border-slate-200 rounded-lg p-4">
                  <p className="text-sm text-slate-500 mb-1">Outstanding</p>
                  <p className="text-2xl font-bold text-slate-900 tabular-nums">
                    {formatCurrency(rentsSummary.totalOutstanding)}
                  </p>
                </div>
              </div>

              {rentsSummary.byProperty.length > 0 && (
                <div className="mt-4 bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-3 gap-2 px-4 py-2 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <span>Property</span>
                    <span className="text-right">Expected</span>
                    <span className="text-right">Received</span>
                  </div>
                  {rentsSummary.byProperty.map(row => (
                    <div key={row.propertyId} className="grid grid-cols-3 gap-2 px-4 py-2 border-b border-slate-50 last:border-b-0 text-sm">
                      <span className="text-slate-900 truncate">{row.propertyName}</span>
                      <span className="text-right text-slate-900 tabular-nums">{formatCurrency(row.expected)}</span>
                      <span className="text-right text-emerald-700 tabular-nums">{formatCurrency(row.received)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* --- Needs Attention (T016) --- */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Needs Attention</h2>

            {attentionItems.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="flex justify-center mb-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-1">All clear</h3>
                <p className="text-sm text-slate-600">Nothing overdue right now.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {attentionItems.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    className="bg-white border border-slate-200 rounded-lg p-4 cursor-pointer
                               hover:bg-slate-50 focus:outline-none focus:ring-2
                               focus:ring-indigo-500 focus:ring-offset-2 min-h-11 w-full text-left"
                    onClick={() => {
                      if (item.kind === 'bill') {
                        navigate(`/bills?property=${item.propertyId}&month=${item.month}&focus=${item.id}`);
                      } else if (item.kind === 'todo') {
                        navigate(
                          item.categoryId
                            ? `/todos?category=${item.categoryId}&focus=${item.id}`
                            : `/todos?focus=${item.id}`,
                        );
                      } else {
                        navigate('/rentals');
                      }
                    }}
                  >
                    {item.kind === 'bill' ? (
                      <div className="flex items-start gap-3">
                        <Receipt className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-slate-900">
                              {item.billTypeName} — {item.propertyName} · {formatMonth(item.month)}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">
                              Overdue
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5">{formatDateDisplay(item.dueDate)}</p>
                        </div>
                      </div>
                    ) : item.kind === 'todo' ? (
                      <div className="flex items-start gap-3">
                        <ListTodo className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-slate-900">
                              {item.title}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">
                              Overdue
                            </span>
                            {item.categoryName && (
                              <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                                <span
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: item.categoryColor }}
                                />
                                {item.categoryName}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5">{formatDateDisplay(item.dueDate)}</p>
                        </div>
                      </div>
                    ) : item.kind === 'rent' ? (
                      <div className="flex items-start gap-3">
                        <Landmark className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-slate-900">
                              {item.tenancyName}{item.unitLabel ? ` (${item.unitLabel})` : ''} — {item.propertyName} · {formatMonth(item.month)}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">
                              Overdue
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5">
                            {formatCurrency(item.totalReceived)} / {formatCurrency(item.expectedAmount)} received · {formatDateDisplay(item.dueDate)}
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* --- Recent Activity (T017) --- */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h2>

            {recentActivity.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="flex justify-center mb-3">
                  <History className="w-12 h-12 text-slate-400" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-1">No activity yet</h3>
                <p className="text-sm text-slate-600">Actions you perform will appear here.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3">
                  {recentActivity.map(entry => (
                    <ActivityRow key={entry.id} entry={entry} />
                  ))}
                </div>
                <Link
                  to="/settings/activity-log"
                  className="inline-block mt-3 text-sm text-indigo-700 hover:underline font-medium"
                >
                  View all
                </Link>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
