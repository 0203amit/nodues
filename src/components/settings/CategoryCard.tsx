import { Pencil, ToggleLeft, ToggleRight, Trash2, Loader2 } from 'lucide-react';
import type { TodoCategory } from '../../types';
import StatusBadge from '../shared/StatusBadge';

export interface CategoryCardProps {
  category: TodoCategory;
  onEdit: (category: TodoCategory) => void;
  onToggleActive: (category: TodoCategory) => void;
  onDelete: (category: TodoCategory) => void;
  isLoading: boolean;
}

export default function CategoryCard({
  category,
  onEdit,
  onToggleActive,
  onDelete,
  isLoading,
}: CategoryCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      {/* Top row: color dot + name + status */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-full inline-block flex-shrink-0"
            style={{ backgroundColor: category.color }}
            aria-hidden="true"
          />
          <h3 className="text-base font-semibold text-slate-900 truncate">
            {category.name}
          </h3>
        </div>
        <StatusBadge active={category.active} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 mt-3">
        <button
          type="button"
          onClick={() => onEdit(category)}
          disabled={isLoading}
          className="text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50
                     font-medium text-sm px-2 py-1 rounded transition-colors cursor-pointer
                     min-h-11 min-w-11 inline-flex items-center justify-center gap-1
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label="Edit category"
        >
          <Pencil className="w-4 h-4" />
          <span className="hidden sm:inline">Edit</span>
        </button>

        <button
          type="button"
          onClick={() => onToggleActive(category)}
          disabled={isLoading}
          className="text-slate-700 hover:text-slate-800 hover:bg-slate-100
                     font-medium text-sm px-2 py-1 rounded transition-colors cursor-pointer
                     min-h-11 min-w-11 inline-flex items-center justify-center gap-1
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label={category.active ? 'Deactivate category' : 'Activate category'}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : category.active ? (
            <ToggleRight className="w-5 h-5" />
          ) : (
            <ToggleLeft className="w-5 h-5" />
          )}
          <span className="hidden sm:inline">
            {category.active ? 'Deactivate' : 'Activate'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onDelete(category)}
          disabled={isLoading}
          className="text-red-700 hover:text-red-800 hover:bg-red-50
                     font-medium text-sm px-2 py-1 rounded transition-colors cursor-pointer
                     min-h-11 min-w-11 inline-flex items-center justify-center gap-1
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label="Delete category"
        >
          <Trash2 className="w-4 h-4" />
          <span className="hidden sm:inline">Delete</span>
        </button>
      </div>
    </div>
  );
}
