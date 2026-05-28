import { Pencil, Trash2, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import type { BillTypeWithProperty } from '../../types';
import StatusBadge from '../shared/StatusBadge';

export interface BillTypeCardProps {
  billType: BillTypeWithProperty;
  onEdit: (billType: BillTypeWithProperty) => void;
  onToggleActive: (billType: BillTypeWithProperty) => void;
  onDelete: (billType: BillTypeWithProperty) => void;
  isLoading: boolean;
}

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export default function BillTypeCard({
  billType,
  onEdit,
  onToggleActive,
  onDelete,
  isLoading,
}: BillTypeCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      {/* Top row: name + status */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <h3 className="text-base font-semibold text-slate-900 truncate">
          {billType.name}
        </h3>
        <StatusBadge active={billType.active} />
      </div>

      {/* Property + frequency */}
      <p className="text-sm text-slate-600 mb-1">
        <span
          className={
            billType.propertyDeleted
              ? 'text-slate-400 line-through'
              : undefined
          }
        >
          {billType.propertyName}
        </span>
        {' · '}
        {billType.frequency.charAt(0).toUpperCase() + billType.frequency.slice(1)}
      </p>

      {/* Due day / amount details */}
      {(billType.defaultDueDay !== null || billType.defaultAmount !== null) && (
        <p className="text-sm text-slate-500 mb-1">
          {billType.defaultDueDay !== null && (
            <span>Due day: {billType.defaultDueDay}</span>
          )}
          {billType.defaultDueDay !== null && billType.defaultAmount !== null && (
            <span> · </span>
          )}
          {billType.defaultAmount !== null && (
            <span className="tabular-nums">
              Amount: {currencyFormatter.format(billType.defaultAmount)}
            </span>
          )}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 mt-3">
        <button
          type="button"
          onClick={() => onEdit(billType)}
          disabled={isLoading}
          className="text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50
                     font-medium text-sm px-2 py-1 rounded transition-colors cursor-pointer
                     min-h-11 min-w-11 inline-flex items-center justify-center gap-1
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label="Edit bill type"
        >
          <Pencil className="w-4 h-4" />
          <span className="hidden sm:inline">Edit</span>
        </button>

        <button
          type="button"
          onClick={() => onDelete(billType)}
          disabled={isLoading}
          className="text-red-600 hover:text-red-700 hover:bg-red-50
                     font-medium text-sm px-2 py-1 rounded transition-colors cursor-pointer
                     min-h-11 min-w-11 inline-flex items-center justify-center gap-1
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label="Delete bill type"
        >
          <Trash2 className="w-4 h-4" />
          <span className="hidden sm:inline">Delete</span>
        </button>

        <button
          type="button"
          onClick={() => onToggleActive(billType)}
          disabled={isLoading}
          className="text-slate-600 hover:text-slate-800 hover:bg-slate-100
                     font-medium text-sm px-2 py-1 rounded transition-colors cursor-pointer
                     min-h-11 min-w-11 inline-flex items-center justify-center gap-1
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label={billType.active ? 'Deactivate bill type' : 'Activate bill type'}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : billType.active ? (
            <ToggleRight className="w-5 h-5" />
          ) : (
            <ToggleLeft className="w-5 h-5" />
          )}
          <span className="hidden sm:inline">
            {billType.active ? 'Deactivate' : 'Activate'}
          </span>
        </button>
      </div>
    </div>
  );
}
