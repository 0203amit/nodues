import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Receipt, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBootstrap } from '../contexts/BootstrapContext';
import { useToast } from '../contexts/ToastContext';
import { fetchProperties } from '../services/propertiesService';
import {
  fetchBillTypes,
  addBillType,
  updateBillType,
  toggleBillTypeActive,
  softDeleteBillType,
  undoDeleteBillType,
} from '../services/billTypesService';
import type { Property, BillTypeWithProperty, BillTypeFormData } from '../types';
import BillTypeCard from '../components/settings/BillTypeCard';
import BillTypeFormModal from '../components/settings/BillTypeFormModal';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { v4 as uuidv4 } from 'uuid';
import { appendActivityLogSafe } from '../services/activityLogService';
import { APP_TITLE_SUFFIX } from '../config/branding';

export default function BillTypesPage() {
  const { accessToken } = useAuth();
  const { setupResult } = useBootstrap();
  const spreadsheetId = setupResult!.spreadsheetId;
  const { showToast, showUndo } = useToast();

  // --- State ---
  const [billTypes, setBillTypes] = useState<BillTypeWithProperty[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<BillTypeWithProperty | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BillTypeWithProperty | null>(null);

  // --- Document title ---
  useEffect(() => {
    document.title = `${APP_TITLE_SUFFIX} \u00b7 Bill Types`;
  }, []);

  // --- Initial fetch ---
  const loadData = useCallback(async () => {
    try {
      const [btData, propData] = await Promise.all([
        fetchBillTypes(accessToken!, spreadsheetId),
        fetchProperties(accessToken!, spreadsheetId),
      ]);
      setBillTypes(btData);
      setProperties(propData);
    } catch {
      showToast('Failed to load bill types.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, spreadsheetId, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Available properties for the form dropdown (active + non-deleted)
  const availableProperties = properties.filter((p) => p.active && p.deletedAt === '');

  // --- Add ---
  function handleAddClick() {
    setEditTarget(null);
    setModalMode('add');
  }

  // --- Edit ---
  function handleEditClick(billType: BillTypeWithProperty) {
    setEditTarget(billType);
    setModalMode('edit');
  }

  // --- Form submit (add or edit) ---
  async function handleFormSubmit(data: BillTypeFormData) {
    setIsSaving(true);
    try {
      if (modalMode === 'add') {
        const newBt = await addBillType(accessToken!, spreadsheetId, data);
        // Refetch to get valid _rowIndex and resolved property names
        const [refreshedBt, refreshedProps] = await Promise.all([
          fetchBillTypes(accessToken!, spreadsheetId),
          fetchProperties(accessToken!, spreadsheetId),
        ]);
        setBillTypes(refreshedBt);
        setProperties(refreshedProps);
        await appendActivityLogSafe(accessToken!, spreadsheetId, {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          userEmail: 'user',
          action: 'billtype_added',
          entityType: 'billtype',
          entityId: newBt.id,
          summary: `${data.name}`,
        });
        showToast('Bill type added.', 'success');
      } else if (modalMode === 'edit' && editTarget) {
        const updated = await updateBillType(accessToken!, spreadsheetId, editTarget, data);
        setBillTypes((prev) =>
          prev.map((bt) =>
            bt.id === updated.id
              ? { ...updated, propertyName: editTarget.propertyName, propertyDeleted: editTarget.propertyDeleted, propertyActive: editTarget.propertyActive }
              : bt,
          ),
        );
        await appendActivityLogSafe(accessToken!, spreadsheetId, {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          userEmail: 'user',
          action: 'billtype_updated',
          entityType: 'billtype',
          entityId: editTarget.id,
          summary: `${data.name}`,
        });
        showToast('Bill type updated.', 'success');
      }
      setModalMode(null);
      setEditTarget(null);
    } catch {
      showToast(
        modalMode === 'add'
          ? 'Failed to add bill type.'
          : 'Failed to update bill type.',
        'error',
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleModalClose() {
    if (!isSaving) {
      setModalMode(null);
      setEditTarget(null);
    }
  }

  // --- Toggle active ---
  async function handleToggle(billType: BillTypeWithProperty) {
    setLoadingItemId(billType.id);
    try {
      const toggled = await toggleBillTypeActive(accessToken!, spreadsheetId, billType);
      setBillTypes((prev) =>
        prev.map((bt) =>
          bt.id === toggled.id
            ? { ...toggled, propertyName: billType.propertyName, propertyDeleted: billType.propertyDeleted, propertyActive: billType.propertyActive }
            : bt,
        ),
      );
    } catch {
      showToast('Failed to toggle bill type status.', 'error');
    } finally {
      setLoadingItemId(null);
    }
  }

  // --- Delete ---
  function handleDeleteClick(billType: BillTypeWithProperty) {
    setDeleteTarget(billType);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;

    const billType = deleteTarget;
    const originalIndex = billTypes.findIndex((bt) => bt.id === billType.id);
    setDeleteTarget(null);

    // Optimistic remove
    setBillTypes((prev) => prev.filter((bt) => bt.id !== billType.id));

    try {
      await softDeleteBillType(accessToken!, spreadsheetId, billType);
      await appendActivityLogSafe(accessToken!, spreadsheetId, {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        userEmail: 'user',
        action: 'billtype_deleted',
        entityType: 'billtype',
        entityId: billType.id,
        summary: `${billType.name}`,
      });
      showUndo(`"${billType.name}" deleted.`, async () => {
        try {
          await undoDeleteBillType(accessToken!, spreadsheetId, billType);
          await appendActivityLogSafe(accessToken!, spreadsheetId, {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            userEmail: 'user',
            action: 'billtype_restored',
            entityType: 'billtype',
            entityId: billType.id,
            summary: `${billType.name}`,
          });
          setBillTypes((prev) => {
            const next = [...prev];
            next.splice(originalIndex, 0, billType);
            return next;
          });
        } catch {
          showToast('Failed to undo delete.', 'error');
        }
      });
    } catch {
      // Rollback: reinsert at original position
      setBillTypes((prev) => {
        const next = [...prev];
        next.splice(originalIndex, 0, billType);
        return next;
      });
      showToast('Failed to delete bill type.', 'error');
    }
  }

  // --- Render ---
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/settings"
          className="inline-flex items-center gap-1 text-sm font-medium text-indigo-700 hover:text-indigo-800
                     transition-colors cursor-pointer mb-2
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded"
        >
          <ArrowLeft className="w-4 h-4" />
          Settings
        </Link>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-slate-900">Bill Types</h1>
          <button
            type="button"
            onClick={handleAddClick}
            className="bg-indigo-700 hover:bg-indigo-800 text-white font-medium px-4 py-2 rounded-lg
                       transition-colors cursor-pointer min-h-11 inline-flex items-center gap-2
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <Plus className="w-4 h-4" />
            Add Bill Type
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-indigo-700 animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && billTypes.length === 0 && (
        <div className="text-center py-12 px-4">
          <div className="flex justify-center mb-3">
            <Receipt className="w-12 h-12 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            No bill types yet
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            Add your first bill type to start tracking bills
          </p>
          <button
            type="button"
            onClick={handleAddClick}
            className="bg-indigo-700 hover:bg-indigo-800 text-white font-medium px-4 py-2 rounded-lg
                       transition-colors cursor-pointer min-h-11 inline-flex items-center gap-2 mx-auto
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <Plus className="w-4 h-4" />
            Add Bill Type
          </button>
        </div>
      )}

      {/* Bill type list */}
      {!isLoading && billTypes.length > 0 && (
        <div className="flex flex-col gap-3">
          {billTypes.map((billType) => (
            <BillTypeCard
              key={billType.id}
              billType={billType}
              onEdit={handleEditClick}
              onToggleActive={handleToggle}
              onDelete={handleDeleteClick}
              isLoading={loadingItemId === billType.id}
            />
          ))}
        </div>
      )}

      {/* Form modal */}
      {modalMode && (
        <BillTypeFormModal
          billType={editTarget}
          availableProperties={availableProperties}
          isSaving={isSaving}
          onSubmit={handleFormSubmit}
          onClose={handleModalClose}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete bill type"
          message={`Are you sure you want to delete "${deleteTarget.name}"? You can undo this within 10 seconds.`}
          confirmLabel="Delete"
          confirmVariant="destructive"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
