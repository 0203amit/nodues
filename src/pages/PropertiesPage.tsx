import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Building2, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBootstrap } from '../contexts/BootstrapContext';
import { useToast } from '../contexts/ToastContext';
import {
  fetchProperties,
  addProperty,
  updateProperty,
  togglePropertyActive,
  softDeleteProperty,
  undoDeleteProperty,
} from '../services/propertiesService';
import type { Property, PropertyFormData } from '../types';
import PropertyCard from '../components/settings/PropertyCard';
import PropertyFormModal from '../components/settings/PropertyFormModal';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { APP_TITLE_SUFFIX } from '../config/branding';

export default function PropertiesPage() {
  const { accessToken } = useAuth();
  const { setupResult } = useBootstrap();
  const spreadsheetId = setupResult!.spreadsheetId;
  const { showToast, showUndo } = useToast();

  // --- State ---
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<Property | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);

  // --- Document title ---
  useEffect(() => {
    document.title = `${APP_TITLE_SUFFIX} \u00b7 Properties`;
  }, []);

  // --- Initial fetch ---
  const loadProperties = useCallback(async () => {
    try {
      const data = await fetchProperties(accessToken!, spreadsheetId);
      setProperties(data);
    } catch {
      showToast('Failed to load properties.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, spreadsheetId, showToast]);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  // --- Add ---
  function handleAddClick() {
    setEditTarget(null);
    setModalMode('add');
  }

  // --- Edit ---
  function handleEditClick(property: Property) {
    setEditTarget(property);
    setModalMode('edit');
  }

  // --- Form submit (add or edit) ---
  async function handleFormSubmit(data: PropertyFormData) {
    setIsSaving(true);
    try {
      if (modalMode === 'add') {
        await addProperty(accessToken!, spreadsheetId, data);
        // Refetch to get valid _rowIndex
        const refreshed = await fetchProperties(accessToken!, spreadsheetId);
        setProperties(refreshed);
        showToast('Property added.', 'success');
      } else if (modalMode === 'edit' && editTarget) {
        const updated = await updateProperty(accessToken!, spreadsheetId, editTarget, data);
        setProperties((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p)),
        );
        showToast('Property updated.', 'success');
      }
      setModalMode(null);
      setEditTarget(null);
    } catch {
      showToast(
        modalMode === 'add'
          ? 'Failed to add property.'
          : 'Failed to update property.',
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
  async function handleToggle(property: Property) {
    setLoadingItemId(property.id);
    try {
      const toggled = await togglePropertyActive(accessToken!, spreadsheetId, property);
      setProperties((prev) =>
        prev.map((p) => (p.id === toggled.id ? toggled : p)),
      );
    } catch {
      showToast('Failed to toggle property status.', 'error');
    } finally {
      setLoadingItemId(null);
    }
  }

  // --- Delete ---
  function handleDeleteClick(property: Property) {
    setDeleteTarget(property);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;

    const property = deleteTarget;
    const originalIndex = properties.findIndex((p) => p.id === property.id);
    setDeleteTarget(null);

    // Optimistic remove
    setProperties((prev) => prev.filter((p) => p.id !== property.id));

    try {
      await softDeleteProperty(accessToken!, spreadsheetId, property);
      showUndo(`"${property.name}" deleted.`, async () => {
        try {
          await undoDeleteProperty(accessToken!, spreadsheetId, property);
          setProperties((prev) => {
            const next = [...prev];
            next.splice(originalIndex, 0, property);
            return next;
          });
        } catch {
          showToast('Failed to undo delete.', 'error');
        }
      });
    } catch {
      // Rollback: reinsert at original position
      setProperties((prev) => {
        const next = [...prev];
        next.splice(originalIndex, 0, property);
        return next;
      });
      showToast('Failed to delete property.', 'error');
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
          <h1 className="text-2xl font-semibold text-slate-900">Properties</h1>
          <button
            type="button"
            onClick={handleAddClick}
            className="bg-indigo-700 hover:bg-indigo-800 text-white font-medium px-4 py-2 rounded-lg
                       transition-colors cursor-pointer min-h-11 inline-flex items-center gap-2
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <Plus className="w-4 h-4" />
            Add Property
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
      {!isLoading && properties.length === 0 && (
        <div className="text-center py-12 px-4">
          <div className="flex justify-center mb-3">
            <Building2 className="w-12 h-12 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            No properties yet
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            Add your first property to start tracking bills
          </p>
          <button
            type="button"
            onClick={handleAddClick}
            className="bg-indigo-700 hover:bg-indigo-800 text-white font-medium px-4 py-2 rounded-lg
                       transition-colors cursor-pointer min-h-11 inline-flex items-center gap-2 mx-auto
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <Plus className="w-4 h-4" />
            Add Property
          </button>
        </div>
      )}

      {/* Property list */}
      {!isLoading && properties.length > 0 && (
        <div className="flex flex-col gap-3">
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              onEdit={handleEditClick}
              onToggleActive={handleToggle}
              onDelete={handleDeleteClick}
              isLoading={loadingItemId === property.id}
            />
          ))}
        </div>
      )}

      {/* Form modal */}
      {modalMode && (
        <PropertyFormModal
          property={editTarget}
          isSaving={isSaving}
          onSubmit={handleFormSubmit}
          onClose={handleModalClose}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete property"
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
