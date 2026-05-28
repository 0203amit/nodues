import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Receipt, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBootstrap } from '../contexts/BootstrapContext';
import { useToast } from '../contexts/ToastContext';
import { fetchProperties } from '../services/propertiesService';
import { fetchBillTypes } from '../services/billTypesService';
import {
  fetchBills,
  addBill,
  computeCompositeKey,
  checkDuplicate,
  sortBills,
  formatMonth,
} from '../services/billsService';
import type {
  BillFormData,
  BillTypeWithProperty,
  BillWithDisplay,
  Property,
} from '../types';
import BillCard from '../components/bills/BillCard';
import BillFormModal from '../components/bills/BillFormModal';
import DuplicateWarningModal from '../components/bills/DuplicateWarningModal';
import { APP_TITLE_SUFFIX } from '../config/branding';

export default function BillsPage() {
  const { accessToken } = useAuth();
  const { setupResult } = useBootstrap();
  const spreadsheetId = setupResult!.spreadsheetId;
  const { showToast } = useToast();

  // --- State ---
  const [bills, setBills] = useState<BillWithDisplay[]>([]);
  const [billTypes, setBillTypes] = useState<BillTypeWithProperty[]>([]);
  const [, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Filters
  const [filterProperty, setFilterProperty] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');

  // Modals
  const [formModal, setFormModal] = useState<{
    mode: 'add' | 'edit';
    bill?: BillWithDisplay;
  } | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    existingBill: BillWithDisplay;
    pendingFormData: BillFormData;
    pendingMode: 'add' | 'edit';
    editBill?: BillWithDisplay;
  } | null>(null);

  // Ref map for scroll-to-existing
  const billRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Ref for highlight timeout cleanup
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Document title ---
  useEffect(() => {
    document.title = `${APP_TITLE_SUFFIX} \u00b7 Bills`;
  }, []);

  // Cleanup highlight timer on unmount
  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  // --- Data loading ---
  const loadData = useCallback(async () => {
    try {
      const [btData, propData] = await Promise.all([
        fetchBillTypes(accessToken!, spreadsheetId),
        fetchProperties(accessToken!, spreadsheetId),
      ]);
      setBillTypes(btData);
      setProperties(propData);

      // Build billTypeMap for enrichment
      const billTypeMap = new Map<
        string,
        { name: string; propertyId: string; propertyName: string }
      >();
      for (const bt of btData) {
        billTypeMap.set(bt.id, {
          name: bt.name,
          propertyId: bt.propertyId,
          propertyName: bt.propertyName,
        });
      }

      const billData = await fetchBills(accessToken!, spreadsheetId, billTypeMap);
      setBills(billData);
    } catch {
      showToast('Failed to load bills.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, spreadsheetId, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Helper: build billTypeMap from current state ---
  const billTypeMap = useMemo(() => {
    const map = new Map<
      string,
      { name: string; propertyId: string; propertyName: string }
    >();
    for (const bt of billTypes) {
      map.set(bt.id, {
        name: bt.name,
        propertyId: bt.propertyId,
        propertyName: bt.propertyName,
      });
    }
    return map;
  }, [billTypes]);

  // --- Helper: refetch bills ---
  async function refetchBills() {
    const billData = await fetchBills(accessToken!, spreadsheetId, billTypeMap);
    setBills(billData);
  }

  // --- Derived state ---
  const filteredBills = useMemo(() => {
    let result = bills;
    if (filterProperty !== 'all') {
      result = result.filter((b) => b.propertyId === filterProperty);
    }
    if (filterMonth !== 'all') {
      result = result.filter((b) => b.month === filterMonth);
    }
    return sortBills(result);
  }, [bills, filterProperty, filterMonth]);

  const propertyOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const b of bills) {
      if (b.propertyId && !seen.has(b.propertyId)) {
        seen.set(b.propertyId, b.propertyName);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({
      value: id,
      label: name,
    }));
  }, [bills]);

  const monthOptions = useMemo(() => {
    const months = [...new Set(bills.map((b) => b.month))].sort().reverse();
    return months.map((m) => ({ value: m, label: formatMonth(m) }));
  }, [bills]);

  const availableBillTypes = useMemo(
    () => billTypes.filter((bt) => bt.active && bt.deletedAt === ''),
    [billTypes],
  );

  // --- Add Bill flow ---
  function handleAddClick() {
    setFormModal({ mode: 'add' });
  }

  async function handleFormSubmit(data: BillFormData) {
    // Resolve propertyId from the selected bill type
    const btInfo = billTypeMap.get(data.billTypeId);
    const propertyId = btInfo?.propertyId ?? '';

    // Compute composite key for duplicate check
    const compositeKey = computeCompositeKey(propertyId, data.billTypeId, data.month);

    // Check for duplicates
    const existingBill = checkDuplicate(compositeKey, bills);
    if (existingBill) {
      setDuplicateWarning({
        existingBill,
        pendingFormData: data,
        pendingMode: formModal?.mode ?? 'add',
        editBill: formModal?.bill,
      });
      return;
    }

    // No duplicate — proceed with save
    await saveNewBill(data, propertyId);
  }

  async function saveNewBill(data: BillFormData, propertyId: string) {
    setIsSaving(true);
    try {
      await addBill(accessToken!, spreadsheetId, data, propertyId);
      await refetchBills();
      setFormModal(null);
      setDuplicateWarning(null);
      showToast('Bill added.', 'success');
    } catch {
      showToast('Failed to add bill.', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  // --- Duplicate Warning handlers ---
  function handleDuplicateOpenExisting() {
    if (!duplicateWarning) return;
    const billId = duplicateWarning.existingBill.id;

    // Close all modals
    setDuplicateWarning(null);
    setFormModal(null);

    // Scroll to existing bill + highlight
    requestAnimationFrame(() => {
      const el = billRefs.current.get(billId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-indigo-500');
        highlightTimerRef.current = setTimeout(() => {
          el.classList.remove('ring-2', 'ring-indigo-500');
        }, 2000);
      }
    });
  }

  async function handleDuplicateAddAnyway() {
    if (!duplicateWarning) return;
    const { pendingFormData } = duplicateWarning;
    const btInfo = billTypeMap.get(pendingFormData.billTypeId);
    const propertyId = btInfo?.propertyId ?? '';
    await saveNewBill(pendingFormData, propertyId);
  }

  function handleDuplicateCancel() {
    // Close duplicate modal only — form data preserved (formModal stays open)
    setDuplicateWarning(null);
  }

  // --- No-op handlers for features not yet wired ---
  function handleMarkPaid() {
    // Will be wired in final chunk
  }

  function handleEdit() {
    // Will be wired in final chunk
  }

  function handleDelete() {
    // Will be wired in final chunk
  }

  function handleModalClose() {
    if (!isSaving) {
      setFormModal(null);
    }
  }

  // --- Ref callback for BillCard registration ---
  function registerBillRef(billId: string) {
    return (el: HTMLDivElement | null) => {
      if (el) {
        billRefs.current.set(billId, el);
      } else {
        billRefs.current.delete(billId);
      }
    };
  }

  // --- Render ---
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-3xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Bills</h1>
        <button
          type="button"
          onClick={handleAddClick}
          className="bg-indigo-700 hover:bg-indigo-800 text-white font-medium px-4 py-2 rounded-lg
                     transition-colors cursor-pointer min-h-11 inline-flex items-center gap-2
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <Plus className="w-4 h-4" />
          Add Bill
        </button>
      </div>

      {/* Filters */}
      {!isLoading && bills.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <select
            value={filterProperty}
            onChange={(e) => setFilterProperty(e.target.value)}
            className="rounded-lg border border-slate-300 shadow-sm px-3 py-2 text-base
                       focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                       focus:outline-none cursor-pointer sm:w-auto w-full"
            aria-label="Filter by property"
          >
            <option value="all">All properties</option>
            {propertyOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="rounded-lg border border-slate-300 shadow-sm px-3 py-2 text-base
                       focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                       focus:outline-none cursor-pointer sm:w-auto w-full"
            aria-label="Filter by month"
          >
            <option value="all">All months</option>
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-indigo-700 animate-spin" />
        </div>
      )}

      {/* Empty state — no bills at all */}
      {!isLoading && bills.length === 0 && (
        <div className="text-center py-12 px-4">
          <div className="flex justify-center mb-3">
            <Receipt className="w-12 h-12 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            No bills yet
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            Add your first bill to start tracking
          </p>
          <button
            type="button"
            onClick={handleAddClick}
            className="bg-indigo-700 hover:bg-indigo-800 text-white font-medium px-4 py-2 rounded-lg
                       transition-colors cursor-pointer min-h-11 inline-flex items-center gap-2 mx-auto
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <Plus className="w-4 h-4" />
            Add a bill
          </button>
        </div>
      )}

      {/* Empty state — filters active but no matches */}
      {!isLoading && bills.length > 0 && filteredBills.length === 0 && (
        <div className="text-center py-12 px-4">
          <div className="flex justify-center mb-3">
            <Receipt className="w-12 h-12 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            No bills match your filters
          </h3>
          <p className="text-sm text-slate-600">
            Try adjusting the property or month filter
          </p>
        </div>
      )}

      {/* Bill list */}
      {!isLoading && filteredBills.length > 0 && (
        <div className="flex flex-col gap-3">
          {filteredBills.map((bill) => (
            <BillCard
              key={bill.id}
              ref={registerBillRef(bill.id)}
              bill={bill}
              onMarkPaid={handleMarkPaid}
              onEdit={handleEdit}
              onDelete={handleDelete}
              isLoading={isSaving}
            />
          ))}
        </div>
      )}

      {/* Bill Form Modal */}
      {formModal && (
        <BillFormModal
          bill={formModal.bill ?? null}
          availableBillTypes={availableBillTypes}
          isSaving={isSaving}
          onSubmit={handleFormSubmit}
          onClose={handleModalClose}
        />
      )}

      {/* Duplicate Warning Modal */}
      {duplicateWarning && (
        <DuplicateWarningModal
          existingBill={duplicateWarning.existingBill}
          onOpenExisting={handleDuplicateOpenExisting}
          onAddAnyway={handleDuplicateAddAnyway}
          onCancel={handleDuplicateCancel}
        />
      )}
    </div>
  );
}
