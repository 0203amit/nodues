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
  updateBill,
  markBillPaid,
  softDeleteBill,
  undoDeleteBill,
  computeCompositeKey,
  checkDuplicate,
  sortBills,
  formatMonth,
  computeDisplayStatus,
} from '../services/billsService';
import type {
  Bill,
  BillFormData,
  BillTypeWithProperty,
  BillWithDisplay,
  MarkPaidFormData,
  Property,
} from '../types';
import BillCard from '../components/bills/BillCard';
import BillFormModal from '../components/bills/BillFormModal';
import MarkPaidModal from '../components/bills/MarkPaidModal';
import DuplicateWarningModal from '../components/bills/DuplicateWarningModal';
import AttachmentsModal from '../components/bills/AttachmentsModal';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { APP_TITLE_SUFFIX } from '../config/branding';

export default function BillsPage() {
  const { accessToken } = useAuth();
  const { setupResult } = useBootstrap();
  const spreadsheetId = setupResult!.spreadsheetId;
  const folderId = setupResult!.folderId;
  const { showToast, showUndo } = useToast();

  // --- State ---
  const [bills, setBills] = useState<BillWithDisplay[]>([]);
  const [billTypes, setBillTypes] = useState<BillTypeWithProperty[]>([]);
  const [, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Filters
  const [filterProperty, setFilterProperty] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');

  // Modals / action targets
  const [markPaidTarget, setMarkPaidTarget] = useState<BillWithDisplay | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BillWithDisplay | null>(null);
  const [attachmentsTarget, setAttachmentsTarget] = useState<BillWithDisplay | null>(null);
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

    // In edit mode, exclude the bill itself from the duplicate check
    const excludeId = formModal?.mode === 'edit' ? formModal.bill?.id : undefined;
    const existingBill = checkDuplicate(compositeKey, bills, excludeId);
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
    if (formModal?.mode === 'edit' && formModal.bill) {
      await saveEditBill(data, formModal.bill, propertyId);
    } else {
      await saveNewBill(data, propertyId);
    }
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

  async function saveEditBill(
    data: BillFormData,
    bill: BillWithDisplay,
    propertyId: string,
  ) {
    setIsSaving(true);
    try {
      await updateBill(accessToken!, spreadsheetId, bill, data, propertyId);
      await refetchBills();
      setFormModal(null);
      setDuplicateWarning(null);
      showToast('Bill updated.', 'success');
    } catch {
      showToast('Failed to update bill.', 'error');
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
    const { pendingFormData, pendingMode, editBill } = duplicateWarning;
    const btInfo = billTypeMap.get(pendingFormData.billTypeId);
    const propertyId = btInfo?.propertyId ?? '';
    if (pendingMode === 'edit' && editBill) {
      await saveEditBill(pendingFormData, editBill, propertyId);
    } else {
      await saveNewBill(pendingFormData, propertyId);
    }
  }

  function handleDuplicateCancel() {
    // Close duplicate modal only — form data preserved (formModal stays open)
    setDuplicateWarning(null);
  }

  // --- Mark Paid ---
  function handleMarkPaid(bill: BillWithDisplay) {
    setMarkPaidTarget(bill);
  }

  async function handleMarkPaidSubmit(data: MarkPaidFormData) {
    if (!markPaidTarget) return;
    setIsSaving(true);
    try {
      await markBillPaid(accessToken!, spreadsheetId, markPaidTarget, data);
      await refetchBills();
      setMarkPaidTarget(null);
      showToast('Bill marked as paid.', 'success');
    } catch {
      showToast('Failed to mark bill as paid.', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  // --- Edit ---
  function handleEdit(bill: BillWithDisplay) {
    setFormModal({ mode: 'edit', bill });
  }

  // --- Delete (optimistic + undo) ---
  function handleDelete(bill: BillWithDisplay) {
    setDeleteTarget(bill);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;

    const bill = deleteTarget;
    const originalIndex = bills.findIndex((b) => b.id === bill.id);
    setDeleteTarget(null);

    // Optimistic remove
    setBills((prev) => prev.filter((b) => b.id !== bill.id));

    try {
      await softDeleteBill(accessToken!, spreadsheetId, bill);
      showUndo('Bill deleted.', async () => {
        try {
          await undoDeleteBill(accessToken!, spreadsheetId, bill);
          setBills((prev) => {
            const next = [...prev];
            next.splice(originalIndex, 0, bill);
            return next;
          });
        } catch {
          showToast('Failed to undo delete.', 'error');
        }
      });
    } catch {
      // Rollback: reinsert at original position
      setBills((prev) => {
        const next = [...prev];
        next.splice(originalIndex, 0, bill);
        return next;
      });
      showToast('Failed to delete bill.', 'error');
    }
  }

  function handleModalClose() {
    if (!isSaving) {
      setFormModal(null);
    }
  }

  // --- Attachments ---
  function handleViewAttachments(bill: BillWithDisplay) {
    setAttachmentsTarget(bill);
  }

  function handleBillUpdated(updatedBill: Bill) {
    setBills((prev) =>
      prev.map((b) => {
        if (b.id !== updatedBill.id) return b;
        return {
          ...b,
          ...updatedBill,
          displayStatus: computeDisplayStatus(updatedBill.status, updatedBill.dueDate),
        };
      }),
    );
    setAttachmentsTarget((prev) => {
      if (!prev || prev.id !== updatedBill.id) return prev;
      return {
        ...prev,
        ...updatedBill,
        displayStatus: computeDisplayStatus(updatedBill.status, updatedBill.dueDate),
      };
    });
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
              onViewAttachments={handleViewAttachments}
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

      {/* Mark Paid Modal */}
      {markPaidTarget && (
        <MarkPaidModal
          bill={markPaidTarget}
          isSaving={isSaving}
          onSubmit={handleMarkPaidSubmit}
          onClose={() => !isSaving && setMarkPaidTarget(null)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete bill"
          message="Delete this bill? You can undo within 10 seconds."
          confirmLabel="Delete"
          confirmVariant="destructive"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Attachments Modal */}
      {attachmentsTarget && (
        <AttachmentsModal
          bill={attachmentsTarget}
          folderId={folderId}
          onBillUpdated={handleBillUpdated}
          onClose={() => setAttachmentsTarget(null)}
        />
      )}
    </div>
  );
}
