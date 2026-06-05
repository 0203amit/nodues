import { Pencil, Trash2, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import type { Property } from '../../types';
import StatusBadge from '../shared/StatusBadge';

export interface PropertyCardProps {
  property: Property;
  onEdit: (property: Property) => void;
  onToggleActive: (property: Property) => void;
  onDelete: (property: Property) => void;
  isLoading: boolean;
}

export default function PropertyCard({
  property,
  onEdit,
  onToggleActive,
  onDelete,
  isLoading,
}: PropertyCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      {/* Top row: name + badges */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <h3 className="text-base font-semibold text-slate-900 truncate">
          {property.name}
        </h3>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {property.isRental && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700"
              aria-label="Rental property"
            >
              Rental
            </span>
          )}
          <StatusBadge active={property.active} />
        </div>
      </div>

      {/* Address */}
      {property.address && (
        <p className="text-sm text-slate-600 mb-3 truncate">{property.address}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 mt-3">
        <button
          type="button"
          onClick={() => onEdit(property)}
          disabled={isLoading}
          className="text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50
                     font-medium text-sm px-2 py-1 rounded transition-colors cursor-pointer
                     min-h-11 min-w-11 inline-flex items-center justify-center gap-1
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label="Edit property"
        >
          <Pencil className="w-4 h-4" />
          <span className="hidden sm:inline">Edit</span>
        </button>

        <button
          type="button"
          onClick={() => onDelete(property)}
          disabled={isLoading}
          className="text-red-600 hover:text-red-700 hover:bg-red-50
                     font-medium text-sm px-2 py-1 rounded transition-colors cursor-pointer
                     min-h-11 min-w-11 inline-flex items-center justify-center gap-1
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label="Delete property"
        >
          <Trash2 className="w-4 h-4" />
          <span className="hidden sm:inline">Delete</span>
        </button>

        <button
          type="button"
          onClick={() => onToggleActive(property)}
          disabled={isLoading}
          className="text-slate-600 hover:text-slate-800 hover:bg-slate-100
                     font-medium text-sm px-2 py-1 rounded transition-colors cursor-pointer
                     min-h-11 min-w-11 inline-flex items-center justify-center gap-1
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label={property.active ? 'Deactivate property' : 'Activate property'}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : property.active ? (
            <ToggleRight className="w-5 h-5" />
          ) : (
            <ToggleLeft className="w-5 h-5" />
          )}
          <span className="hidden sm:inline">
            {property.active ? 'Deactivate' : 'Activate'}
          </span>
        </button>
      </div>
    </div>
  );
}
