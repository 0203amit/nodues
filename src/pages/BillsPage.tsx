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
  postponeBill,
  softDeleteBill,
  undoDeleteBill,
  computeCompositeKey,
  checkDuplicate,
  sortBills,
  formatMonth,
  formatCurrency,
  computeDisplayStatus,
  setCalendarEventIds,
} from '../services/billsService';
import {
  parseEventIds,
  createReminders,
  cleanupReminders,
  formatDueDate,
} from '../services/calendarReminders';
import type {
  Bill,
  BillFormData,
  BillTypeWithProperty,
  BillWithDisplay,
  MarkPaidFormData,
  PostponeFormData,
  Property,
} from '../types';
import BillCard from '../components/bills/BillCard';
import BillFormModal from '../components/bills/BillFormModal';
import MarkPaidModal from '../components/bills/MarkPaidModal';
import PostponeModal from '../components/shared/PostponeModal';
import DuplicateWarningModal from '../components/bills/DuplicateWarningModal';
import AttachmentsModal from '../components/bills/AttachmentsModal';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { v4 as uuidv4 } from 'uuid';
import { appendActivityLogSafe, formatShortDate } from '../services/activityLogService';
import { APP_TITLE_SUFFIX } from '../config/branding';

export default function BillsPage() {
  const { accessToken } = useAuth();
  const { setupResult } = useBootstrap();
  const spreadsheetId = setupResult!.spreadsheetId;
  const folderId = setupResult!.folderId;
  const calendarId = setupResult!.calendarId;
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
  const [postponeTarget, setPostponeTarget] = useState<BillWithDisplay | null>(null);
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
  async function refetchBills(): Promise<BillWithDisplay[]> {
    const billData = await fetchBills(accessToken!, spreadsheetId, billTypeMap);
    setBills(billData);
    return billData;
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
      const newBill = await addBill(accessToken!, spreadsheetId, data, propertyId);
      const freshBills = await refetchBills();
      setFormModal(null);
      setDuplicateWarning(null);

      // Calendar side-effect (best-effort)
      const btInfo = billTypeMap.get(data.billTypeId);
      const billType = billTypes.find(bt => bt.id === data.billTypeId);
      if (newBill.dueDate && billType && billType.reminderOffsetsDays.length > 0) {
        try {
          const title = `${btInfo?.name ?? ''} \u2014 ${btInfo?.propertyName ?? ''} due ${formatDueDate(newBill.dueDate)}`;
          const description = `Month: ${formatMonth(data.month)}` + (newBill.amount !== null ? `\nAmount: ${formatCurrency(newBill.amount)}` : '');
          const result = await createReminders(
            accessToken!, calendarId, newBill.dueDate,
            billType.reminderOffsetsDays, title, description,
          );
          if (result.eventIds.length > 0) {
            const fresh = freshBills.find(b => b.id === newBill.id);
            if (fresh) {
              const updated = await setCalendarEventIds(
                accessToken!, spreadsheetId, fresh, result.eventIds,
              );
              setBills(prev => prev.map(b => b.id === updated.id
                ? { ...b, calendarEventIds: updated.calendarEventIds } : b));
            }
          }
          if (!result.allSucceeded) {
            showToast("Bill saved, but some reminders couldn't be set.", 'error');
          } else {
            showToast('Bill added.', 'success');
          }
        } catch {
          showToast("Bill saved, but reminders couldn't be set.", 'error');
        }
      } else {
        showToast('Bill added.', 'success');
      }

      await appendActivityLogSafe(accessToken!, spreadsheetId, {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        userEmail: 'user',
        action: 'bill_added',
        entityType: 'bill',
        entityId: newBill.id,
        summary: `${btInfo?.name ?? ''} — ${btInfo?.propertyName ?? ''} · ${formatMonth(data.month)}`,
      });
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
      const dueDateChanged = bill.dueDate !== data.dueDate;
      const updatedBill = await updateBill(accessToken!, spreadsheetId, bill, data, propertyId);

      // Calendar side-effect (only when dueDate changed)
      let calendarFailed = false;
      if (dueDateChanged) {
        try {
          const oldIds = parseEventIds(bill.calendarEventIds);
          if (oldIds.length > 0) {
            await cleanupReminders(accessToken!, calendarId, oldIds);
          }
          if (data.dueDate !== '') {
            const billType = billTypes.find(bt => bt.id === bill.billTypeId);
            const parsedAmount = data.amount.trim() === '' ? null : Number(data.amount);
            const title = `${billType?.name ?? ''} \u2014 ${billType?.propertyName ?? ''} due ${formatDueDate(data.dueDate)}`;
            const description = `Month: ${formatMonth(data.month)}` + (parsedAmount !== null ? `\nAmount: ${formatCurrency(parsedAmount)}` : '');
            const result = await createReminders(
              accessToken!, calendarId, data.dueDate,
              billType?.reminderOffsetsDays ?? [], title, description,
            );
            const updated = await setCalendarEventIds(
              accessToken!, spreadsheetId, updatedBill, result.eventIds,
            );
            setBills(prev => prev.map(b => b.id === updated.id
              ? { ...b, calendarEventIds: updated.calendarEventIds } : b));
            if (!result.allSucceeded) {
              showToast("Bill updated, but some reminders couldn't be set.", 'error');
              calendarFailed = true;
            }
          } else {
            // Date removed — clear event IDs
            const updated = await setCalendarEventIds(
              accessToken!, spreadsheetId, updatedBill, [],
            );
            setBills(prev => prev.map(b => b.id === updated.id
              ? { ...b, calendarEventIds: updated.calendarEventIds } : b));
          }
        } catch {
          showToast("Bill updated, but reminders couldn't be updated.", 'error');
          calendarFailed = true;
        }
      }

      await refetchBills();
      setFormModal(null);
      setDuplicateWarning(null);

      await appendActivityLogSafe(accessToken!, spreadsheetId, {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        userEmail: 'user',
        action: 'bill_updated',
        entityType: 'bill',
        entityId: bill.id,
        summary: `${bill.billTypeName} — ${bill.propertyName} · ${formatMonth(data.month)}`,
      });

      if (!calendarFailed) {
        showToast('Bill updated.', 'success');
      }
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
      const paidBill = await markBillPaid(accessToken!, spreadsheetId, markPaidTarget, data);

      // Calendar cleanup (best-effort)
      let calendarFailed = false;
      if (markPaidTarget.calendarEventIds && markPaidTarget.calendarEventIds.trim() !== '') {
        try {
          await cleanupReminders(
            accessToken!, calendarId,
            parseEventIds(markPaidTarget.calendarEventIds),
          );
          await setCalendarEventIds(accessToken!, spreadsheetId, paidBill, []);
        } catch {
          showToast("Bill marked paid, but calendar reminders couldn't be removed.", 'error');
          calendarFailed = true;
        }
      }

      await refetchBills();
      setMarkPaidTarget(null);

      await appendActivityLogSafe(accessToken!, spreadsheetId, {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        userEmail: 'user',
        action: 'bill_paid',
        entityType: 'bill',
        entityId: markPaidTarget.id,
        summary: `${markPaidTarget.billTypeName} — ${markPaidTarget.propertyName} · ${formatMonth(markPaidTarget.month)}${markPaidTarget.amount !== null ? ` · ${formatCurrency(markPaidTarget.amount)}` : ''}`,
      });

      if (!calendarFailed) {
        showToast('Bill marked as paid.', 'success');
      }
    } catch {
      showToast('Failed to mark bill as paid.', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  // --- Postpone ---
  function handlePostpone(bill: BillWithDisplay) {
    setPostponeTarget(bill);
  }

  async function handlePostponeSubmit(data: PostponeFormData) {
    if (!postponeTarget) return;

    // Same-date guard — before setIsSaving, modal stays open
    if (data.newDueDate === postponeTarget.dueDate) {
      showToast('New date is the same as the current due date.', 'info');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await postponeBill(
        accessToken!, spreadsheetId,
        postponeTarget, data.newDueDate, data.reason,
      );

      // Best-effort calendar (nested try/catch, AFTER critical path)
      let calendarFailed = false;
      try {
        const oldIds = parseEventIds(postponeTarget.calendarEventIds);
        if (oldIds.length > 0) {
          await cleanupReminders(accessToken!, calendarId, oldIds);
        }

        const billType = billTypes.find(bt => bt.id === postponeTarget.billTypeId);
        if (billType && billType.reminderOffsetsDays.length > 0) {
          // Branch 1: has offsets — create new events
          const title = `${postponeTarget.billTypeName} \u2014 ${postponeTarget.propertyName} due ${formatDueDate(data.newDueDate)}`;
          const description = `Month: ${formatMonth(updated.month)}` + (updated.amount !== null ? `\nAmount: ${formatCurrency(updated.amount)}` : '');
          const result = await createReminders(
            accessToken!, calendarId, data.newDueDate,
            billType.reminderOffsetsDays, title, description,
          );
          const withEvents = await setCalendarEventIds(
            accessToken!, spreadsheetId, updated, result.eventIds,
          );
          setBills(prev => prev.map(b => b.id === updated.id ? {
            ...b, ...updated,
            calendarEventIds: withEvents.calendarEventIds,
            displayStatus: computeDisplayStatus(updated.status, updated.dueDate),
          } : b));
          if (!result.allSucceeded) {
            showToast("Bill postponed, but some reminders couldn't be set.", 'error');
            calendarFailed = true;
          }
        } else if (oldIds.length > 0) {
          // Branch 2: no offsets but old IDs existed — clear the column
          const cleared = await setCalendarEventIds(
            accessToken!, spreadsheetId, updated, [],
          );
          setBills(prev => prev.map(b => b.id === updated.id ? {
            ...b, ...updated,
            calendarEventIds: cleared.calendarEventIds,
            displayStatus: computeDisplayStatus(updated.status, updated.dueDate),
          } : b));
        } else {
          // Branch 3: neither — just refresh in-memory bill
          setBills(prev => prev.map(b => b.id === updated.id ? {
            ...b, ...updated,
            displayStatus: computeDisplayStatus(updated.status, updated.dueDate),
          } : b));
        }
      } catch {
        showToast("Bill postponed, but calendar reminders couldn't be updated.", 'error');
        calendarFailed = true;
        // Still update in-memory bill so the badge refreshes
        setBills(prev => prev.map(b => b.id === updated.id ? {
          ...b, ...updated,
          displayStatus: computeDisplayStatus(updated.status, updated.dueDate),
        } : b));
      }

      await appendActivityLogSafe(accessToken!, spreadsheetId, {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        userEmail: 'user',
        action: 'bill_postponed',
        entityType: 'bill',
        entityId: postponeTarget.id,
        summary: `${postponeTarget.billTypeName} — ${postponeTarget.propertyName} · ${formatShortDate(postponeTarget.dueDate)} → ${formatDueDate(data.newDueDate)}`,
      });

      // Close modal + success toast (only if no calendar issue toast shown)
      setPostponeTarget(null);
      if (!calendarFailed) {
        showToast('Bill postponed.', 'success');
      }
    } catch {
      showToast('Failed to postpone bill.', 'error');
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

      // Calendar cleanup (best-effort) — do NOT call setCalendarEventIds
      // (softDeleteBill uses updateCell on deleted_at; a full-row write would un-delete)
      if (bill.calendarEventIds && bill.calendarEventIds.trim() !== '') {
        try {
          await cleanupReminders(
            accessToken!, calendarId,
            parseEventIds(bill.calendarEventIds),
          );
        } catch {
          showToast("Bill deleted, but calendar reminders couldn't be removed.", 'error');
        }
      }

      await appendActivityLogSafe(accessToken!, spreadsheetId, {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        userEmail: 'user',
        action: 'bill_deleted',
        entityType: 'bill',
        entityId: bill.id,
        summary: `${bill.billTypeName} — ${bill.propertyName} · ${formatMonth(bill.month)}`,
      });

      showUndo('Bill deleted.', async () => {
        try {
          await undoDeleteBill(accessToken!, spreadsheetId, bill);

          // Recreate calendar reminders (best-effort)
          let restoredBill: Bill = bill;
          const billType = billTypes.find(bt => bt.id === bill.billTypeId);
          if (bill.dueDate && billType && billType.reminderOffsetsDays.length > 0) {
            try {
              const title = `${bill.billTypeName} \u2014 ${bill.propertyName} due ${formatDueDate(bill.dueDate)}`;
              const description = `Month: ${formatMonth(bill.month)}` + (bill.amount !== null ? `\nAmount: ${formatCurrency(bill.amount)}` : '');
              const result = await createReminders(
                accessToken!, calendarId, bill.dueDate,
                billType.reminderOffsetsDays, title, description,
              );
              if (result.eventIds.length > 0) {
                restoredBill = await setCalendarEventIds(
                  accessToken!, spreadsheetId, bill, result.eventIds,
                );
              }
              if (!result.allSucceeded) {
                showToast("Bill restored, but some reminders couldn't be recreated.", 'error');
              }
            } catch {
              showToast("Bill restored, but reminders couldn't be recreated.", 'error');
            }
          }

          await appendActivityLogSafe(accessToken!, spreadsheetId, {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            userEmail: 'user',
            action: 'bill_restored',
            entityType: 'bill',
            entityId: bill.id,
            summary: `${bill.billTypeName} — ${bill.propertyName} · ${formatMonth(bill.month)}`,
          });

          setBills((prev) => {
            const next = [...prev];
            next.splice(originalIndex, 0, {
              ...restoredBill,
              billTypeName: bill.billTypeName,
              propertyName: bill.propertyName,
              propertyId: bill.propertyId,
              displayStatus: bill.displayStatus,
            });
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
              onPostpone={handlePostpone}
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

      {/* Postpone Modal */}
      {postponeTarget && (
        <PostponeModal
          title="Postpone bill"
          itemTitle={`${postponeTarget.billTypeName} \u2014 ${postponeTarget.propertyName}`}
          contextLine={`${formatMonth(postponeTarget.month)}${postponeTarget.amount !== null ? ` \u00b7 ${formatCurrency(postponeTarget.amount)}` : ''}`}
          currentDueDate={postponeTarget.dueDate}
          isSaving={isSaving}
          onSubmit={handlePostponeSubmit}
          onClose={() => !isSaving && setPostponeTarget(null)}
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
