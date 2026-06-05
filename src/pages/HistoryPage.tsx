import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RotateCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBootstrap } from '../contexts/BootstrapContext';
import { useToast } from '../contexts/ToastContext';
import { fetchProperties } from '../services/propertiesService';
import { fetchBillTypes } from '../services/billTypesService';
import { fetchBills, formatCurrency, formatMonth } from '../services/billsService';
import { fetchTenancies } from '../services/tenanciesService';
import { fetchRentCollections, computeRentStatus } from '../services/rentCollectionsService';
import { fetchPaymentEvents } from '../services/paymentEventsService';
import { APP_TITLE_SUFFIX } from '../config/branding';
import BillHistoryCard from '../components/history/BillHistoryCard';
import RentHistoryCard from '../components/history/RentHistoryCard';
import BillDetailModal from '../components/history/BillDetailModal';
import RentDetailModal from '../components/history/RentDetailModal';
import type {
  Property,
  BillWithDisplay,
  TenancyWithDisplay,
  RentCollection,
  RentCollectionWithDisplay,
  PaymentEvent,
} from '../types';

// --- Date filter helpers (same as DashboardPage) ---

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

export default function HistoryPage() {
  const { accessToken } = useAuth();
  const { setupResult } = useBootstrap();
  const spreadsheetId = setupResult!.spreadsheetId;
  const { showToast } = useToast();

  // --- State ---
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastFetchAt = useRef<number>(0);

  // Raw data
  const [allBills, setAllBills] = useState<BillWithDisplay[]>([]);
  const [allTenancies, setAllTenancies] = useState<TenancyWithDisplay[]>([]);
  const [allRentCollections, setAllRentCollections] = useState<RentCollection[]>([]);
  const [allPaymentEvents, setAllPaymentEvents] = useState<PaymentEvent[]>([]);

  // Shared filters
  const [datePreset, setDatePreset] = useState('last_3_months');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('all');

  // Active tab
  const [activeTab, setActiveTab] = useState<'bills' | 'rents'>('bills');

  // Detail modal state
  const [selectedBill, setSelectedBill] = useState<BillWithDisplay | null>(null);
  const [selectedRent, setSelectedRent] = useState<RentCollectionWithDisplay | null>(null);

  // --- Document title ---
  useEffect(() => {
    document.title = `${APP_TITLE_SUFFIX} \u00b7 History`;
  }, []);

  // --- Data loading (same 3-phase pattern as DashboardPage) ---
  const loadAllData = useCallback(async () => {
    const token = accessToken!;
    const ssId = spreadsheetId;

    // Phase 1: properties + bill types
    const phase1Names = ['properties', 'bill types'];
    const phase1 = await Promise.allSettled([
      fetchProperties(token, ssId),
      fetchBillTypes(token, ssId),
    ]);

    const properties: Property[] = phase1[0].status === 'fulfilled' ? phase1[0].value : [];
    const billTypes = phase1[1].status === 'fulfilled' ? phase1[1].value : [];

    for (let i = 0; i < phase1.length; i++) {
      if (phase1[i].status === 'rejected') {
        showToast(`Failed to load ${phase1Names[i]}.`, 'error');
      }
    }

    // Build bill type map
    const billTypeMap = new Map<string, { name: string; propertyId: string; propertyName: string }>();
    for (const bt of billTypes) {
      billTypeMap.set(bt.id, {
        name: bt.name,
        propertyId: bt.propertyId,
        propertyName: bt.propertyName,
      });
    }

    // Phase 2: bills (needs billTypeMap)
    let bills: BillWithDisplay[] = [];
    try {
      bills = await fetchBills(token, ssId, billTypeMap);
    } catch {
      showToast('Failed to load bills.', 'error');
    }

    // Phase 3: rental data (may not exist)
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
    } catch { /* rental tabs may not exist yet */ }

    setAllBills(bills);
    setAllTenancies(tenancies);
    setAllRentCollections(rentCollections);
    setAllPaymentEvents(paymentEvents);

    lastFetchAt.current = Date.now();
  }, [accessToken, spreadsheetId, showToast]);

  // --- Mount ---
  useEffect(() => {
    setIsLoading(true);
    loadAllData().finally(() => setIsLoading(false));
  }, [loadAllData]);

  // --- Auto-refresh on visibility change ---
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

  function handleRefresh() {
    setIsRefreshing(true);
    loadAllData().finally(() => setIsRefreshing(false));
  }

  // --- Property options (union of bill + tenancy properties) ---
  const propertyOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const b of allBills) {
      if (b.propertyId && !seen.has(b.propertyId)) {
        seen.set(b.propertyId, b.propertyName);
      }
    }
    for (const t of allTenancies) {
      if (!seen.has(t.propertyId)) {
        seen.set(t.propertyId, t.propertyName);
      }
    }
    return Array.from(seen.entries())
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allBills, allTenancies]);

  // --- Filtered bills ---
  const filteredBills = useMemo(() => {
    const { startMonth, endMonth } = getMonthRange(datePreset, customStart, customEnd);
    let result = allBills.filter(b => isMonthInRange(b.month, startMonth, endMonth));
    if (propertyFilter !== 'all') {
      result = result.filter(b => b.propertyId === propertyFilter);
    }
    return result.sort((a, b) => {
      const monthCmp = b.month.localeCompare(a.month);
      if (monthCmp !== 0) return monthCmp;
      return a.propertyName.localeCompare(b.propertyName);
    });
  }, [allBills, datePreset, customStart, customEnd, propertyFilter]);

  // --- Filtered rent collections ---
  const filteredRentData = useMemo(() => {
    const { startMonth, endMonth } = getMonthRange(datePreset, customStart, customEnd);
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    // Build lookups
    const tenancyById = new Map<string, TenancyWithDisplay>();
    for (const t of allTenancies) tenancyById.set(t.id, t);

    const paymentSumByCollection = new Map<string, number>();
    for (const pe of allPaymentEvents) {
      if (pe.deletedAt !== '') continue;
      paymentSumByCollection.set(
        pe.collectionId,
        (paymentSumByCollection.get(pe.collectionId) || 0) + pe.amount,
      );
    }

    const result: RentCollectionWithDisplay[] = [];
    for (const coll of allRentCollections) {
      if (coll.deletedAt !== '') continue;
      if (!isMonthInRange(coll.month, startMonth, endMonth)) continue;

      const tenancy = tenancyById.get(coll.tenancyId);
      if (!tenancy) continue;

      if (propertyFilter !== 'all' && tenancy.propertyId !== propertyFilter) continue;

      const totalReceived = paymentSumByCollection.get(coll.id) || 0;
      const remainingBalance = Math.max(0, coll.expectedAmount - totalReceived);
      const displayStatus = computeRentStatus(coll.expectedAmount, totalReceived, coll.month, todayStr);

      result.push({
        ...coll,
        tenancyName: tenancy.name,
        unitLabel: tenancy.unitLabel,
        propertyId: tenancy.propertyId,
        propertyName: tenancy.propertyName,
        totalReceived,
        remainingBalance,
        displayStatus,
      });
    }

    return result.sort((a, b) => {
      const monthCmp = b.month.localeCompare(a.month);
      if (monthCmp !== 0) return monthCmp;
      return a.propertyName.localeCompare(b.propertyName);
    });
  }, [allRentCollections, allPaymentEvents, allTenancies, datePreset, customStart, customEnd, propertyFilter]);

  // --- Range label ---
  const rangeLabel = useMemo(() => {
    const { startMonth, endMonth } = getMonthRange(datePreset, customStart, customEnd);
    return formatMonthRange(startMonth, endMonth);
  }, [datePreset, customStart, customEnd]);

  // --- Totals for the active tab ---
  const billsTotal = useMemo(() => {
    const total = filteredBills.reduce((sum, b) => sum + (b.amount ?? 0), 0);
    return formatCurrency(total);
  }, [filteredBills]);

  const rentsExpected = useMemo(() => {
    const total = filteredRentData.reduce((sum, c) => sum + c.expectedAmount, 0);
    return formatCurrency(total);
  }, [filteredRentData]);

  const rentsReceived = useMemo(() => {
    const total = filteredRentData.reduce((sum, c) => sum + c.totalReceived, 0);
    return formatCurrency(total);
  }, [filteredRentData]);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-3xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">History</h1>
          <p className="text-sm text-slate-500">{rangeLabel}</p>
        </div>
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

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select
          value={datePreset}
          onChange={(e) => setDatePreset(e.target.value)}
          className="rounded-lg border border-slate-300 shadow-sm px-3 py-2 text-sm
                     focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                     focus:outline-none cursor-pointer sm:w-auto w-full"
          aria-label="Date range"
        >
          {DATE_PRESET_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {datePreset === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-lg border border-slate-300 shadow-sm px-3 py-2 text-sm
                         focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                         focus:outline-none flex-1 sm:w-auto"
              aria-label="Start month"
            />
            <span className="text-slate-400 text-sm">to</span>
            <input
              type="month"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-lg border border-slate-300 shadow-sm px-3 py-2 text-sm
                         focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                         focus:outline-none flex-1 sm:w-auto"
              aria-label="End month"
            />
          </div>
        )}

        <select
          value={propertyFilter}
          onChange={(e) => setPropertyFilter(e.target.value)}
          className="rounded-lg border border-slate-300 shadow-sm px-3 py-2 text-sm
                     focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                     focus:outline-none cursor-pointer sm:w-auto w-full"
          aria-label="Property filter"
        >
          <option value="all">All properties</option>
          {propertyOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-slate-200 mb-4">
        <button
          type="button"
          onClick={() => setActiveTab('bills')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer
            ${activeTab === 'bills'
              ? 'border-indigo-700 text-indigo-700'
              : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
        >
          Bills ({filteredBills.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('rents')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer
            ${activeTab === 'rents'
              ? 'border-indigo-700 text-indigo-700'
              : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
        >
          Rents ({filteredRentData.length})
        </button>
      </div>

      {/* Loading state */}
      {isLoading && !isRefreshing && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-indigo-700 animate-spin" />
        </div>
      )}

      {/* Content */}
      {!isLoading && activeTab === 'bills' && (
        <div>
          {filteredBills.length > 0 && (
            <p className="text-sm text-slate-500 mb-3">
              {filteredBills.length} bill{filteredBills.length !== 1 ? 's' : ''} &middot; Total: {billsTotal}
            </p>
          )}

          {filteredBills.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-500 text-sm">No bills match the selected filters.</p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {filteredBills.map(bill => (
              <BillHistoryCard key={bill.id} bill={bill} onClick={() => setSelectedBill(bill)} />
            ))}
          </div>
        </div>
      )}

      {!isLoading && activeTab === 'rents' && (
        <div>
          {filteredRentData.length > 0 && (
            <p className="text-sm text-slate-500 mb-3">
              {filteredRentData.length} collection{filteredRentData.length !== 1 ? 's' : ''} &middot; Expected: {rentsExpected} &middot; Received: {rentsReceived}
            </p>
          )}

          {filteredRentData.length === 0 && allTenancies.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-500 text-sm">No rent data yet. Visit the Rentals page to start tracking.</p>
            </div>
          )}

          {filteredRentData.length === 0 && allTenancies.length > 0 && (
            <div className="text-center py-12">
              <p className="text-slate-500 text-sm">No rent collections match the selected filters.</p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {filteredRentData.map(coll => (
              <RentHistoryCard key={coll.id} collection={coll} onClick={() => setSelectedRent(coll)} />
            ))}
          </div>
        </div>
      )}

      {/* Detail modals */}
      {selectedBill && (
        <BillDetailModal bill={selectedBill} onClose={() => setSelectedBill(null)} />
      )}

      {selectedRent && (
        <RentDetailModal
          collection={selectedRent}
          paymentEvents={allPaymentEvents.filter(pe => pe.collectionId === selectedRent.id)}
          onClose={() => setSelectedRent(null)}
        />
      )}
    </div>
  );
}
