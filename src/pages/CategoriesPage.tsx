import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Plus, Tags, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBootstrap } from '../contexts/BootstrapContext';
import { useToast } from '../contexts/ToastContext';
import {
  fetchCategories,
  addCategory,
  updateCategory,
  toggleCategoryActive,
  softDeleteCategory,
  undoDeleteCategory,
} from '../services/todoCategoriesService';
import type { TodoCategory, TodoCategoryFormData } from '../types';
import CategoryCard from '../components/settings/CategoryCard';
import CategoryFormModal from '../components/settings/CategoryFormModal';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { v4 as uuidv4 } from 'uuid';
import { appendActivityLogSafe } from '../services/activityLogService';
import { APP_TITLE_SUFFIX } from '../config/branding';

export default function CategoriesPage() {
  const { accessToken } = useAuth();
  const { setupResult } = useBootstrap();
  const spreadsheetId = setupResult!.spreadsheetId;
  const { showToast, showUndo } = useToast();

  // --- State ---
  const [categories, setCategories] = useState<TodoCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<TodoCategory | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TodoCategory | null>(null);

  // --- Document title ---
  useEffect(() => {
    document.title = `${APP_TITLE_SUFFIX} \u00b7 Categories`;
  }, []);

  // --- Initial fetch ---
  const loadCategories = useCallback(async () => {
    try {
      const data = await fetchCategories(accessToken!, spreadsheetId);
      setCategories(data);
    } catch {
      showToast('Failed to load categories.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, spreadsheetId, showToast]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // --- Add ---
  function handleAddClick() {
    setEditTarget(null);
    setModalMode('add');
  }

  // --- Edit ---
  function handleEditClick(category: TodoCategory) {
    setEditTarget(category);
    setModalMode('edit');
  }

  // --- Form submit (add or edit) ---
  async function handleFormSubmit(data: TodoCategoryFormData) {
    setIsSaving(true);
    try {
      if (modalMode === 'add') {
        const newCat = await addCategory(accessToken!, spreadsheetId, data);
        // Refetch to get valid _rowIndex
        const refreshed = await fetchCategories(accessToken!, spreadsheetId);
        setCategories(refreshed);
        await appendActivityLogSafe(accessToken!, spreadsheetId, {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          userEmail: 'user',
          action: 'category_added',
          entityType: 'category',
          entityId: newCat.id,
          summary: `${data.name}`,
        });
        showToast('Category added.', 'success');
      } else if (modalMode === 'edit' && editTarget) {
        const updated = await updateCategory(accessToken!, spreadsheetId, editTarget, data);
        setCategories((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c)),
        );
        await appendActivityLogSafe(accessToken!, spreadsheetId, {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          userEmail: 'user',
          action: 'category_updated',
          entityType: 'category',
          entityId: editTarget.id,
          summary: `${data.name}`,
        });
        showToast('Category updated.', 'success');
      }
      setModalMode(null);
      setEditTarget(null);
    } catch {
      showToast('Failed to save category.', 'error');
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
  async function handleToggle(category: TodoCategory) {
    setLoadingItemId(category.id);
    try {
      const updated = await toggleCategoryActive(accessToken!, spreadsheetId, category);
      setCategories((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      );
    } catch {
      showToast('Failed to update category.', 'error');
    } finally {
      setLoadingItemId(null);
    }
  }

  // --- Delete ---
  function handleDeleteClick(category: TodoCategory) {
    setDeleteTarget(category);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;

    const category = deleteTarget;
    const originalIndex = categories.findIndex((c) => c.id === category.id);
    setDeleteTarget(null);

    // Optimistic remove
    setCategories((prev) => prev.filter((c) => c.id !== category.id));

    try {
      await softDeleteCategory(accessToken!, spreadsheetId, category);
      await appendActivityLogSafe(accessToken!, spreadsheetId, {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        userEmail: 'user',
        action: 'category_deleted',
        entityType: 'category',
        entityId: category.id,
        summary: `${category.name}`,
      });
      showUndo(`"${category.name}" deleted.`, async () => {
        try {
          await undoDeleteCategory(accessToken!, spreadsheetId, category);
          await appendActivityLogSafe(accessToken!, spreadsheetId, {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            userEmail: 'user',
            action: 'category_restored',
            entityType: 'category',
            entityId: category.id,
            summary: `${category.name}`,
          });
          setCategories((prev) => {
            const next = [...prev];
            next.splice(originalIndex, 0, category);
            return next;
          });
        } catch {
          showToast('Failed to undo delete.', 'error');
        }
      });
    } catch {
      // Rollback: reinsert at original position
      setCategories((prev) => {
        const next = [...prev];
        next.splice(originalIndex, 0, category);
        return next;
      });
      showToast('Failed to delete category.', 'error');
    }
  }

  // --- Render ---
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-3xl mx-auto pb-24">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/settings"
          className="inline-flex items-center gap-1 text-sm font-medium text-indigo-700 hover:text-indigo-800
                     transition-colors cursor-pointer mb-2
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Settings
        </Link>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-slate-900">Categories</h1>
          <button
            type="button"
            onClick={handleAddClick}
            className="bg-indigo-700 hover:bg-indigo-800 text-white font-medium px-4 py-2 rounded-lg
                       transition-colors cursor-pointer min-h-11 inline-flex items-center gap-2
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <Plus className="w-4 h-4" />
            Add Category
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
      {!isLoading && categories.length === 0 && (
        <div className="text-center py-12 px-4">
          <div className="flex justify-center mb-3">
            <Tags className="w-12 h-12 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            No categories yet
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            Add a category to organize your to-dos
          </p>
          <button
            type="button"
            onClick={handleAddClick}
            className="bg-indigo-700 hover:bg-indigo-800 text-white font-medium px-4 py-2 rounded-lg
                       transition-colors cursor-pointer min-h-11 inline-flex items-center gap-2 mx-auto
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <Plus className="w-4 h-4" />
            Add a category
          </button>
        </div>
      )}

      {/* Category list */}
      {!isLoading && categories.length > 0 && (
        <div className="flex flex-col gap-3">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onEdit={handleEditClick}
              onToggleActive={handleToggle}
              onDelete={handleDeleteClick}
              isLoading={loadingItemId === category.id}
            />
          ))}
        </div>
      )}

      {/* Form modal */}
      {modalMode && (
        <CategoryFormModal
          category={editTarget}
          isSaving={isSaving}
          onSubmit={handleFormSubmit}
          onClose={handleModalClose}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete category"
          message={`Are you sure you want to delete "${deleteTarget.name}"? Existing to-dos will keep their category. You can undo this within 10 seconds.`}
          confirmLabel="Delete"
          confirmVariant="destructive"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
