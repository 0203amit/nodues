import { Landmark, Pencil, Power, Trash2 } from 'lucide-react';
import type { TenancyWithDisplay } from '../../types';
import { formatCurrency } from '../../services/billsService';

export interface TenancyCardProps {
  tenancy: TenancyWithDisplay;
  onEdit: (tenancy: TenancyWithDisplay) => void;
  onToggle: (tenancy: TenancyWithDisplay) => void;
  onDelete: (tenancy: TenancyWithDisplay) => void;
  isLoading: boolean;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatLeaseDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, mon] = dateStr.split('-').map(Number);
  return `${MONTHS[mon - 1]} ${year}`;
}

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function TenancyCard({
  tenancy,
  onEdit,
  onToggle,
  onDelete,
  isLoading,
}: TenancyCardProps) {
  const displayName = tenancy.unitLabel
    ? `${tenancy.name} (${tenancy.unitLabel})`
    : tenancy.name;

  const leaseRange = tenancy.leaseEndDate
    ? `${formatLeaseDate(tenancy.leaseStartDate)} \u2013 ${formatLeaseDate(tenancy.leaseEndDate)}`
    : `${formatLeaseDate(tenancy.leaseStartDate)} \u2013 Indefinite`;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      {/* Top section: info + amount/badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Landmark className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate">{displayName}</p>
            <p className="text-sm text-slate-600 truncate">
              Due: {ordinalSuffix(tenancy.rentDueDay)} &middot; {leaseRange}
            </p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-semibold text-slate-900 tabular-nums">
            {formatCurrency(tenancy.rentAmount)}
          </p>
          <div className="mt-1">
            {tenancy.isActive ? (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                Active
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                Inactive
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons row */}
      <div className="flex items-center gap-1 mt-3">
        <button
          type="button"
          onClick={() => onEdit(tenancy)}
          disabled={isLoading}
          className="text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50
                     font-medium text-sm px-2 py-1 rounded transition-colors cursor-pointer
                     min-h-11 min-w-11 inline-flex items-center justify-center gap-1
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label="Edit tenancy"
        >
          <Pencil className="w-4 h-4" />
          <span className="hidden sm:inline">Edit</span>
        </button>

        <button
          type="button"
          onClick={() => onToggle(tenancy)}
          disabled={isLoading}
          className={`font-medium text-sm px-2 py-1 rounded transition-colors cursor-pointer
                     min-h-11 min-w-11 inline-flex items-center justify-center gap-1
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                     ${tenancy.isActive
                       ? 'text-amber-700 hover:text-amber-800 hover:bg-amber-50'
                       : 'text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50'
                     }`}
          aria-label={tenancy.isActive ? 'Set inactive' : 'Set active'}
        >
          <Power className="w-4 h-4" />
          <span className="hidden sm:inline">
            {tenancy.isActive ? 'Set Inactive' : 'Set Active'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onDelete(tenancy)}
          disabled={isLoading}
          className="text-red-600 hover:text-red-700 hover:bg-red-50
                     font-medium text-sm px-2 py-1 rounded transition-colors cursor-pointer
                     min-h-11 min-w-11 inline-flex items-center justify-center gap-1
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label="Delete tenancy"
        >
          <Trash2 className="w-4 h-4" />
          <span className="hidden sm:inline">Delete</span>
        </button>
      </div>
    </div>
  );
}
