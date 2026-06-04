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
import { appendActivityLogSafe } from '../services/activityLogService';
import { APP_TITLE_SUFFIX } from '../config/branding';
import type { Property, TenancyWithDisplay, TenancyFormData } from '../types';
import AddTenancyModal from '../components/rentals/AddTenancyModal';
import TenancyCard from '../components/rentals/TenancyCard';

// --- Helper: build activity log summary ---
function tenancySummary(action: string, t: TenancyWithDisplay): string {
  const unit = t.unitLabel ? ` (${t.unitLabel})` : '';
  return `Tenant ${action}: ${t.name}${unit} \u2014 ${t.propertyName}`;
}

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
  const [filterProperty, setFilterProperty] = useState<string>('all');

  // Modal targets
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TenancyWithDisplay | null>(null);

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
      const enriched = await fetchTenancies(accessToken!, spreadsheetId, propMap);
      setTenancies(enriched);
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

  // --- Handlers ---

  // T021: Add tenancy
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

  // T024: Edit tenancy
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

  // T022: Toggle active/inactive
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

  // T023: Soft-delete with undo
  async function handleDeleteTenancy(tenancy: TenancyWithDisplay) {
    const originalIndex = tenancies.findIndex((t) => t.id === tenancy.id);

    // Optimistic remove
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
          // Re-insert at original position
          setTenancies((prev) => {
            const next = [...prev];
            next.splice(originalIndex, 0, tenancy);
            return next;
          });
        } catch {
          showToast('Failed to undo delete.', 'error');
        }
      });

      // Log deletion (fires after undo window regardless — the undo callback handles restore separately)
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
      // Rollback
      setTenancies((prev) => {
        const next = [...prev];
        next.splice(originalIndex, 0, tenancy);
        return next;
      });
      showToast('Failed to delete tenant.', 'error');
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

      {/* Tenancy list grouped by property (T020) */}
      {!isLoading && groupedByProperty.length > 0 && (
        <div className="flex flex-col gap-6">
          {groupedByProperty.map((group) => (
            <div key={group.propertyId}>
              <h2 className="text-lg font-semibold text-slate-800 mb-3">
                {group.propertyName}
              </h2>
              <div className="flex flex-col gap-3">
                {group.tenancies.map((tenancy) => (
                  <TenancyCard
                    key={tenancy.id}
                    tenancy={tenancy}
                    onEdit={(t) => setEditTarget(t)}
                    onToggle={handleToggleTenancy}
                    onDelete={handleDeleteTenancy}
                    isLoading={isSaving}
                  />
                ))}
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
    </div>
  );
}
