import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Landmark, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../contexts/AuthContext';
import { useBootstrap } from '../contexts/BootstrapContext';
import { useToast } from '../contexts/ToastContext';
import { fetchProperties } from '../services/propertiesService';
import {
  ensureRentalTabs,
  fetchTenancies,
  addTenancy,
  updateTenancy,
  toggleTenancyActive,
  softDeleteTenancy,
  undoDeleteTenancy,
} from '../services/tenanciesService';
import {
  fetchRentCollections,
  computeRentStatus,
  updateRentCollection,
  softDeleteRentCollection,
  undoDeleteRentCollection,
} from '../services/rentCollectionsService';
import { formatCurrency, formatMonth } from '../services/billsService';
import {
  fetchPaymentEvents,
  addPaymentEvent,
  softDeletePaymentEvent,
  undoDeletePaymentEvent,
} from '../services/paymentEventsService';
import { appendActivityLogSafe } from '../services/activityLogService';
import { APP_TITLE_SUFFIX } from '../config/branding';
import type {
  Property,
  TenancyWithDisplay,
  TenancyFormData,
  RentCollection,
  RentCollectionWithDisplay,
  PaymentEvent,
  RentDisplayStatus,
} from '../types';
import AddTenancyModal from '../components/rentals/AddTenancyModal';
import TenancyCard from '../components/rentals/TenancyCard';
import MonthNavigator from '../components/rentals/MonthNavigator';
import RentSummaryHeader from '../components/rentals/RentSummaryHeader';
import CollectionCard from '../components/rentals/CollectionCard';
import MarkReceivedFullModal from '../components/rentals/MarkReceivedFullModal';
import MarkReceivedPartialModal from '../components/rentals/MarkReceivedPartialModal';
import CollectionHistorySection from '../components/rentals/CollectionHistorySection';

// --- Helpers ---

function getISTToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function getCurrentMonth(): string {
  return getISTToday().slice(0, 7);
}

function tenancySummary(action: string, t: TenancyWithDisplay): string {
  const unit = t.unitLabel ? ` (${t.unitLabel})` : '';
  return `Tenant ${action}: ${t.name}${unit} \u2014 ${t.propertyName}`;
}

function paymentLogSummary(
  prefix: string,
  t: TenancyWithDisplay,
  amount: number,
  month: string,
): string {
  const unit = t.unitLabel ? ` (${t.unitLabel})` : '';
  return `${prefix}: ${t.name}${unit} \u2014 ${t.propertyName} ${formatCurrency(amount)} ${formatMonth(month)}`;
}

// FR-015 sort priority
const STATUS_SORT: Record<RentDisplayStatus, number> = {
  overdue: 0,
  pending: 1,
  partial: 2,
  received: 3,
};

export default function RentalsPage() {
  const { accessToken } = useAuth();
  const { setupResult } = useBootstrap();
  const spreadsheetId = setupResult!.spreadsheetId;
  const { showToast, showUndo } = useToast();

  // --- State ---
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenancies, setTenancies] = useState<TenancyWithDisplay[]>([]);
  const [collections, setCollections] = useState<RentCollection[]>([]);
  const [paymentEvents, setPaymentEvents] = useState<PaymentEvent[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
  const [filterProperty, setFilterProperty] = useState<string>('all');

  // Modal targets
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TenancyWithDisplay | null>(null);
  const [markReceivedFullTarget, setMarkReceivedFullTarget] =
    useState<RentCollectionWithDisplay | null>(null);
  const [markReceivedPartialTarget, setMarkReceivedPartialTarget] =
    useState<RentCollectionWithDisplay | null>(null);
  const [editCollectionTarget, setEditCollectionTarget] =
    useState<RentCollectionWithDisplay | null>(null);

  // Edit collection form state
  const [editCollExpectedAmount, setEditCollExpectedAmount] = useState('');
  const [editCollDueDate, setEditCollDueDate] = useState('');
  const [editCollNotes, setEditCollNotes] = useState('');

  // --- Document title ---
  useEffect(() => {
    document.title = `${APP_TITLE_SUFFIX} \u00b7 Rentals`;
  }, []);

  // --- Data loading ---
  const loadData = useCallback(async () => {
    try {
      await ensureRentalTabs(accessToken!, spreadsheetId);
      const propData = await fetchProperties(accessToken!, spreadsheetId);
      setProperties(propData);

      const propMap = new Map<string, string>();
      for (const p of propData) {
        propMap.set(p.id, p.name);
      }

      const [enrichedTenancies, collData, peData] = await Promise.all([
        fetchTenancies(accessToken!, spreadsheetId, propMap),
        fetchRentCollections(accessToken!, spreadsheetId),
        fetchPaymentEvents(accessToken!, spreadsheetId),
      ]);

      setTenancies(enrichedTenancies);
      setCollections(collData);
      setPaymentEvents(peData);
    } catch {
      showToast('Failed to load rentals data.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, spreadsheetId, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Property map for summaries ---
  const propertyMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of properties) {
      map.set(p.id, p.name);
    }
    return map;
  }, [properties]);

  // --- Tenancy map for lookups ---
  const tenancyMap = useMemo(() => {
    const map = new Map<string, TenancyWithDisplay>();
    for (const t of tenancies) {
      map.set(t.id, t);
    }
    return map;
  }, [tenancies]);

  // --- Payment events by collection id ---
  const paymentEventsByCollection = useMemo(() => {
    const map = new Map<string, PaymentEvent[]>();
    for (const pe of paymentEvents) {
      if (pe.deletedAt !== '') continue;
      let arr = map.get(pe.collectionId);
      if (!arr) {
        arr = [];
        map.set(pe.collectionId, arr);
      }
      arr.push(pe);
    }
    return map;
  }, [paymentEvents]);

  // --- Enriched collections for selected month (T032) ---
  const enrichedCollections = useMemo(() => {
    const today = getISTToday();
    const result: RentCollectionWithDisplay[] = [];

    for (const coll of collections) {
      if (coll.deletedAt !== '') continue;
      if (coll.month !== selectedMonth) continue;

      const tenancy = tenancyMap.get(coll.tenancyId);
      if (!tenancy) continue;

      const events = paymentEventsByCollection.get(coll.id) ?? [];
      const totalReceived = events.reduce((sum, e) => sum + e.amount, 0);
      const remainingBalance = Math.max(0, coll.expectedAmount - totalReceived);
      const displayStatus = computeRentStatus(
        coll.expectedAmount,
        totalReceived,
        coll.month,
        today,
      );

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

    // FR-015 sorting
    result.sort((a, b) => {
      const pa = STATUS_SORT[a.displayStatus];
      const pb = STATUS_SORT[b.displayStatus];
      if (pa !== pb) return pa - pb;

      if (a.displayStatus === 'received') {
        // Most recently received first — approximate by latest payment event date
        const aLatest = (paymentEventsByCollection.get(a.id) ?? [])
          .reduce((max, e) => (e.paymentDate > max ? e.paymentDate : max), '');
        const bLatest = (paymentEventsByCollection.get(b.id) ?? [])
          .reduce((max, e) => (e.paymentDate > max ? e.paymentDate : max), '');
        return bLatest.localeCompare(aLatest);
      }

      // overdue, pending, partial: soonest (oldest for overdue) due date first
      return a.dueDate.localeCompare(b.dueDate);
    });

    return result;
  }, [collections, selectedMonth, tenancyMap, paymentEventsByCollection]);

  // --- Collections grouped by tenancy for rendering ---
  const collectionsByTenancy = useMemo(() => {
    const map = new Map<string, RentCollectionWithDisplay[]>();
    for (const coll of enrichedCollections) {
      let arr = map.get(coll.tenancyId);
      if (!arr) {
        arr = [];
        map.set(coll.tenancyId, arr);
      }
      arr.push(coll);
    }
    return map;
  }, [enrichedCollections]);

  // --- Past collections for history (T043) ---
  const pastCollectionsByTenancy = useMemo(() => {
    const today = getISTToday();
    const map = new Map<string, RentCollectionWithDisplay[]>();

    for (const coll of collections) {
      if (coll.deletedAt !== '') continue;
      if (coll.month >= selectedMonth) continue;

      const tenancy = tenancyMap.get(coll.tenancyId);
      if (!tenancy) continue;

      const events = paymentEventsByCollection.get(coll.id) ?? [];
      const totalReceived = events.reduce((sum, e) => sum + e.amount, 0);
      const remainingBalance = Math.max(0, coll.expectedAmount - totalReceived);
      const displayStatus = computeRentStatus(
        coll.expectedAmount,
        totalReceived,
        coll.month,
        today,
      );

      const enriched: RentCollectionWithDisplay = {
        ...coll,
        tenancyName: tenancy.name,
        unitLabel: tenancy.unitLabel,
        propertyId: tenancy.propertyId,
        propertyName: tenancy.propertyName,
        totalReceived,
        remainingBalance,
        displayStatus,
      };

      let arr = map.get(coll.tenancyId);
      if (!arr) {
        arr = [];
        map.set(coll.tenancyId, arr);
      }
      arr.push(enriched);
    }

    // Sort newest first and limit to 6 per tenancy
    for (const [key, arr] of map) {
      arr.sort((a, b) => b.month.localeCompare(a.month));
      map.set(key, arr.slice(0, 6));
    }

    return map;
  }, [collections, selectedMonth, tenancyMap, paymentEventsByCollection]);

  // --- Summary header totals (T030) ---
  const summaryTotals = useMemo(() => {
    let totalExpected = 0;
    let totalReceived = 0;
    let pendingCount = 0;

    for (const coll of enrichedCollections) {
      totalExpected += coll.expectedAmount;
      totalReceived += coll.totalReceived;
      if (coll.displayStatus !== 'received') {
        pendingCount++;
      }
    }

    return {
      totalExpected,
      totalReceived,
      totalOutstanding: Math.max(0, totalExpected - totalReceived),
      pendingCount,
    };
  }, [enrichedCollections]);

  // --- Grouped tenancies by property ---
  const groupedByProperty = useMemo(() => {
    const filtered =
      filterProperty === 'all'
        ? tenancies
        : tenancies.filter((t) => t.propertyId === filterProperty);

    const groups = new Map<
      string,
      { propertyId: string; propertyName: string; tenancies: TenancyWithDisplay[] }
    >();

    for (const t of filtered) {
      let group = groups.get(t.propertyId);
      if (!group) {
        group = { propertyId: t.propertyId, propertyName: t.propertyName, tenancies: [] };
        groups.set(t.propertyId, group);
      }
      group.tenancies.push(t);
    }

    return Array.from(groups.values());
  }, [tenancies, filterProperty]);

  // --- Property filter options ---
  const propertyFilterOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of tenancies) {
      if (!seen.has(t.propertyId)) {
        seen.set(t.propertyId, t.propertyName);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({
      value: id,
      label: name,
    }));
  }, [tenancies]);

  // --- Active non-deleted properties for modal dropdown ---
  const activeProperties = useMemo(
    () => properties.filter((p) => p.active && p.deletedAt === ''),
    [properties],
  );

  // --- Tenancy Handlers ---

  async function handleAddTenancy(data: TenancyFormData) {
    setIsSaving(true);
    try {
      const newTenancy = await addTenancy(accessToken!, spreadsheetId, data);
      const propName = propertyMap.get(data.propertyId) ?? 'Unknown';
      const unit = data.unitLabel ? ` (${data.unitLabel})` : '';
      await appendActivityLogSafe(accessToken!, spreadsheetId, {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        userEmail: 'user',
        action: 'tenancy_added',
        entityType: 'tenancy',
        entityId: newTenancy.id,
        summary: `Tenant added: ${data.name}${unit} \u2014 ${propName}`,
      });
      await loadData();
      setAddModalOpen(false);
      showToast('Tenant added.', 'success');
    } catch {
      showToast('Failed to add tenant.', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEditTenancy(data: TenancyFormData) {
    if (!editTarget) return;
    setIsSaving(true);
    try {
      await updateTenancy(accessToken!, spreadsheetId, editTarget, data);
      const propName = propertyMap.get(editTarget.propertyId) ?? editTarget.propertyName;
      const unit = data.unitLabel ? ` (${data.unitLabel})` : '';
      await appendActivityLogSafe(accessToken!, spreadsheetId, {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        userEmail: 'user',
        action: 'tenancy_updated',
        entityType: 'tenancy',
        entityId: editTarget.id,
        summary: `Tenant updated: ${data.name}${unit} \u2014 ${propName}`,
      });
      await loadData();
      setEditTarget(null);
      showToast('Tenant updated.', 'success');
    } catch {
      showToast('Failed to update tenant.', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleTenancy(tenancy: TenancyWithDisplay) {
    setIsSaving(true);
    try {
      const updated = await toggleTenancyActive(accessToken!, spreadsheetId, tenancy);
      const status = updated.isActive ? 'active' : 'inactive';
      await appendActivityLogSafe(accessToken!, spreadsheetId, {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        userEmail: 'user',
        action: 'tenancy_toggled',
        entityType: 'tenancy',
        entityId: tenancy.id,
        summary: tenancySummary(status, tenancy),
      });
      await loadData();
      showToast(`Tenant set to ${status}.`, 'success');
    } catch {
      showToast('Failed to toggle tenant status.', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteTenancy(tenancy: TenancyWithDisplay) {
    const originalIndex = tenancies.findIndex((t) => t.id === tenancy.id);
    setTenancies((prev) => prev.filter((t) => t.id !== tenancy.id));

    try {
      await softDeleteTenancy(accessToken!, spreadsheetId, tenancy);

      showUndo('Tenant deleted.', async () => {
        try {
          await undoDeleteTenancy(accessToken!, spreadsheetId, tenancy);
          await appendActivityLogSafe(accessToken!, spreadsheetId, {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            userEmail: 'user',
            action: 'tenancy_restored',
            entityType: 'tenancy',
            entityId: tenancy.id,
            summary: tenancySummary('restored', tenancy),
          });
          setTenancies((prev) => {
            const next = [...prev];
            next.splice(originalIndex, 0, tenancy);
            return next;
          });
        } catch {
          showToast('Failed to undo delete.', 'error');
        }
      });

      await appendActivityLogSafe(accessToken!, spreadsheetId, {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        userEmail: 'user',
        action: 'tenancy_deleted',
        entityType: 'tenancy',
        entityId: tenancy.id,
        summary: tenancySummary('deleted', tenancy),
      });
    } catch {
      setTenancies((prev) => {
        const next = [...prev];
        next.splice(originalIndex, 0, tenancy);
        return next;
      });
      showToast('Failed to delete tenant.', 'error');
    }
  }

  // --- Collection + Payment Handlers ---

  // T035: Mark Received Full
  async function handleMarkReceivedFull(data: {
    paymentDate: string;
    paymentMethod: string;
    notes: string;
  }) {
    if (!markReceivedFullTarget) return;
    const target = markReceivedFullTarget;
    const tenancy = tenancyMap.get(target.tenancyId);
    if (!tenancy) return;

    setIsSaving(true);
    try {
      const pe = await addPaymentEvent(accessToken!, spreadsheetId, {
        collectionId: target.id,
        amount: target.remainingBalance,
        paymentDate: data.paymentDate,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
      });
      await appendActivityLogSafe(accessToken!, spreadsheetId, {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        userEmail: 'user',
        action: 'payment_received',
        entityType: 'payment_event',
        entityId: pe.id,
        summary: paymentLogSummary('Rent received', tenancy, target.remainingBalance, target.month),
      });
      await loadData();
      setMarkReceivedFullTarget(null);
      showToast('Payment recorded.', 'success');
    } catch {
      showToast('Failed to record payment.', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  // T037: Mark Received Partial
  async function handleMarkReceivedPartial(data: {
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    notes: string;
  }) {
    if (!markReceivedPartialTarget) return;
    const target = markReceivedPartialTarget;
    const tenancy = tenancyMap.get(target.tenancyId);
    if (!tenancy) return;

    setIsSaving(true);
    try {
      const pe = await addPaymentEvent(accessToken!, spreadsheetId, {
        collectionId: target.id,
        amount: data.amount,
        paymentDate: data.paymentDate,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
      });
      await appendActivityLogSafe(accessToken!, spreadsheetId, {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        userEmail: 'user',
        action: 'payment_received',
        entityType: 'payment_event',
        entityId: pe.id,
        summary: paymentLogSummary('Rent received', tenancy, data.amount, target.month),
      });
      await loadData();
      setMarkReceivedPartialTarget(null);
      showToast('Payment recorded.', 'success');
    } catch {
      showToast('Failed to record payment.', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  // T039: Delete payment event (optimistic + undo)
  async function handleDeletePaymentEvent(event: PaymentEvent) {
    const originalEvents = [...paymentEvents];
    setPaymentEvents((prev) => prev.filter((e) => e.id !== event.id));

    try {
      await softDeletePaymentEvent(accessToken!, spreadsheetId, event);

      showUndo('Payment deleted.', async () => {
        try {
          await undoDeletePaymentEvent(accessToken!, spreadsheetId, event);
          await loadData();
        } catch {
          showToast('Failed to undo delete.', 'error');
        }
      });

      // Find parent collection for log summary
      const parentColl = collections.find((c) => c.id === event.collectionId);
      const tenancy = parentColl ? tenancyMap.get(parentColl.tenancyId) : null;
      if (tenancy && parentColl) {
        await appendActivityLogSafe(accessToken!, spreadsheetId, {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          userEmail: 'user',
          action: 'payment_deleted',
          entityType: 'payment_event',
          entityId: event.id,
          summary: paymentLogSummary('Payment deleted', tenancy, event.amount, parentColl.month),
        });
      }
    } catch {
      setPaymentEvents(originalEvents);
      showToast('Failed to delete payment.', 'error');
    }
  }

  // T040: Edit collection
  function openEditCollection(coll: RentCollectionWithDisplay) {
    setEditCollectionTarget(coll);
    setEditCollExpectedAmount(String(coll.expectedAmount));
    setEditCollDueDate(coll.dueDate);
    setEditCollNotes(coll.notes);
  }

  async function handleEditCollection(e: React.FormEvent) {
    e.preventDefault();
    if (!editCollectionTarget) return;

    const parsedAmount = Number(editCollExpectedAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast('Expected amount must be greater than 0.', 'error');
      return;
    }
    if (!editCollDueDate) {
      showToast('Due date is required.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await updateRentCollection(accessToken!, spreadsheetId, editCollectionTarget, {
        expectedAmount: parsedAmount,
        dueDate: editCollDueDate,
        notes: editCollNotes.trim(),
      });
      await loadData();
      setEditCollectionTarget(null);
      showToast('Collection updated.', 'success');
    } catch {
      showToast('Failed to update collection.', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  // T041: Delete collection (optimistic + undo)
  async function handleDeleteCollection(coll: RentCollectionWithDisplay) {
    const originalCollections = [...collections];
    setCollections((prev) => prev.filter((c) => c.id !== coll.id));

    try {
      await softDeleteRentCollection(accessToken!, spreadsheetId, coll);

      showUndo('Collection deleted.', async () => {
        try {
          await undoDeleteRentCollection(accessToken!, spreadsheetId, coll);
          await loadData();
        } catch {
          showToast('Failed to undo delete.', 'error');
        }
      });
    } catch {
      setCollections(originalCollections);
      showToast('Failed to delete collection.', 'error');
    }
  }

  // --- Render ---
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-3xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Rentals</h1>
        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          className="bg-indigo-700 hover:bg-indigo-800 text-white font-medium px-4 py-2 rounded-lg
                     transition-colors cursor-pointer min-h-11 inline-flex items-center gap-2
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <Plus className="w-4 h-4" />
          Add Tenancy
        </button>
      </div>

      {/* Property filter (T025) */}
      {!isLoading && tenancies.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <select
            value={filterProperty}
            onChange={(e) => setFilterProperty(e.target.value)}
            className="rounded-lg border border-slate-300 shadow-sm px-3 py-2 text-base
                       focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                       focus:outline-none cursor-pointer sm:w-auto w-full"
            aria-label="Filter by property"
          >
            <option value="all">All Properties</option>
            {propertyFilterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Month navigator (T029) */}
      {!isLoading && tenancies.length > 0 && (
        <div className="mb-4">
          <MonthNavigator
            selectedMonth={selectedMonth}
            onChange={setSelectedMonth}
          />
        </div>
      )}

      {/* Summary header (T030) */}
      {!isLoading && tenancies.length > 0 && enrichedCollections.length > 0 && (
        <RentSummaryHeader
          totalExpected={summaryTotals.totalExpected}
          totalReceived={summaryTotals.totalReceived}
          totalOutstanding={summaryTotals.totalOutstanding}
          pendingCount={summaryTotals.pendingCount}
        />
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-indigo-700 animate-spin" />
        </div>
      )}

      {/* Empty state — no tenancies at all (T026) */}
      {!isLoading && tenancies.length === 0 && (
        <div className="text-center py-12 px-4">
          <div className="flex justify-center mb-3">
            <Landmark className="w-12 h-12 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            No tenants yet
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            Add a tenant to start tracking rent collection.
          </p>
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="bg-indigo-700 hover:bg-indigo-800 text-white font-medium px-4 py-2 rounded-lg
                       transition-colors cursor-pointer min-h-11 inline-flex items-center gap-2 mx-auto
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <Plus className="w-4 h-4" />
            Add Tenancy
          </button>
        </div>
      )}

      {/* Empty state — filter active but no matches */}
      {!isLoading && tenancies.length > 0 && groupedByProperty.length === 0 && (
        <div className="text-center py-12 px-4">
          <div className="flex justify-center mb-3">
            <Landmark className="w-12 h-12 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            No tenancies for this property
          </h3>
          <p className="text-sm text-slate-600">
            Try selecting a different property filter.
          </p>
        </div>
      )}

      {/* Tenancy list grouped by property (T020 + T032 collections) */}
      {!isLoading && groupedByProperty.length > 0 && (
        <div className="flex flex-col gap-6">
          {groupedByProperty.map((group) => (
            <div key={group.propertyId}>
              <h2 className="text-lg font-semibold text-slate-800 mb-3">
                {group.propertyName}
              </h2>
              <div className="flex flex-col gap-3">
                {group.tenancies.map((tenancy) => {
                  const tenancyCollections = collectionsByTenancy.get(tenancy.id) ?? [];
                  const pastColls = pastCollectionsByTenancy.get(tenancy.id) ?? [];

                  return (
                    <div key={tenancy.id} className="flex flex-col gap-2">
                      <TenancyCard
                        tenancy={tenancy}
                        onEdit={(t) => setEditTarget(t)}
                        onToggle={handleToggleTenancy}
                        onDelete={handleDeleteTenancy}
                        isLoading={isSaving}
                      />

                      {/* Collection cards for this tenancy in selected month */}
                      {tenancyCollections.map((coll) => (
                        <CollectionCard
                          key={coll.id}
                          collection={coll}
                          paymentEvents={paymentEventsByCollection.get(coll.id) ?? []}
                          tenancy={tenancy}
                          onMarkReceivedFull={setMarkReceivedFullTarget}
                          onMarkReceivedPartial={setMarkReceivedPartialTarget}
                          onEdit={openEditCollection}
                          onDelete={handleDeleteCollection}
                          onDeletePaymentEvent={handleDeletePaymentEvent}
                          isLoading={isSaving}
                        />
                      ))}

                      {/* No collection for this month */}
                      {tenancyCollections.length === 0 && (
                        <p className="text-sm text-slate-500 ml-8">
                          No collection record for {formatMonth(selectedMonth)}.
                        </p>
                      )}

                      {/* Collection history (T043) */}
                      {pastColls.length > 0 && (
                        <div className="ml-8">
                          <CollectionHistorySection collections={pastColls} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Tenancy Modal */}
      {addModalOpen && (
        <AddTenancyModal
          mode="add"
          properties={activeProperties}
          isSaving={isSaving}
          onSubmit={handleAddTenancy}
          onClose={() => !isSaving && setAddModalOpen(false)}
        />
      )}

      {/* Edit Tenancy Modal */}
      {editTarget && (
        <AddTenancyModal
          mode="edit"
          tenancy={editTarget}
          properties={activeProperties}
          isSaving={isSaving}
          onSubmit={handleEditTenancy}
          onClose={() => !isSaving && setEditTarget(null)}
        />
      )}

      {/* Mark Received Full Modal (T034/T035) */}
      {markReceivedFullTarget && (
        <MarkReceivedFullModal
          collection={markReceivedFullTarget}
          tenancy={tenancyMap.get(markReceivedFullTarget.tenancyId)!}
          remainingBalance={markReceivedFullTarget.remainingBalance}
          isSaving={isSaving}
          onSubmit={handleMarkReceivedFull}
          onClose={() => !isSaving && setMarkReceivedFullTarget(null)}
        />
      )}

      {/* Mark Received Partial Modal (T036/T037) */}
      {markReceivedPartialTarget && (
        <MarkReceivedPartialModal
          collection={markReceivedPartialTarget}
          tenancy={tenancyMap.get(markReceivedPartialTarget.tenancyId)!}
          remainingBalance={markReceivedPartialTarget.remainingBalance}
          isSaving={isSaving}
          onSubmit={handleMarkReceivedPartial}
          onClose={() => !isSaving && setMarkReceivedPartialTarget(null)}
        />
      )}

      {/* Edit Collection Modal (T040) */}
      {editCollectionTarget && (
        <div
          className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50"
          onClick={() => !isSaving && setEditCollectionTarget(null)}
        >
          <div
            role="dialog"
            aria-labelledby="edit-collection-title"
            className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="edit-collection-title"
              className="text-lg font-semibold text-slate-900 mb-4"
            >
              Edit Collection
            </h2>
            <form onSubmit={handleEditCollection} className="flex flex-col gap-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Expected Amount <span className="text-red-600">*</span>
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={editCollExpectedAmount}
                  onChange={(e) => setEditCollExpectedAmount(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                             px-3 py-2 text-base
                             focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  min="1"
                  step="any"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Due Date <span className="text-red-600">*</span>
                </span>
                <input
                  type="date"
                  value={editCollDueDate}
                  onChange={(e) => setEditCollDueDate(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                             px-3 py-2 text-base
                             focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Notes</span>
                <textarea
                  value={editCollNotes}
                  onChange={(e) => setEditCollNotes(e.target.value)}
                  rows={2}
                  className="mt-1 block w-full rounded-lg border border-slate-300 shadow-sm
                             px-3 py-2 text-base
                             focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Optional"
                />
              </label>

              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setEditCollectionTarget(null)}
                  disabled={isSaving}
                  className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700
                             font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer min-h-11
                             disabled:opacity-50 disabled:cursor-not-allowed
                             focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-indigo-700 hover:bg-indigo-800 text-white
                             font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer
                             min-h-11 inline-flex items-center gap-2
                             disabled:opacity-50 disabled:cursor-not-allowed
                             focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
