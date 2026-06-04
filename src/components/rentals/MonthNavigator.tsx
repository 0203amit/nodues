import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMonth } from '../../services/billsService';

export interface MonthNavigatorProps {
  selectedMonth: string; // YYYY-MM
  onChange: (month: string) => void;
}

function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split('-').map(Number);
  const d = new Date(year, mon - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function MonthNavigator({ selectedMonth, onChange }: MonthNavigatorProps) {
  return (
    <div className="flex items-center justify-center gap-3">
      <button
        type="button"
        onClick={() => onChange(shiftMonth(selectedMonth, -1))}
        className="p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer
                   min-h-11 min-w-11 inline-flex items-center justify-center
                   focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        aria-label="Previous month"
      >
        <ChevronLeft className="w-5 h-5 text-slate-700" />
      </button>

      <span className="text-base font-semibold text-slate-900 min-w-[8rem] text-center">
        {formatMonth(selectedMonth)}
      </span>

      <button
        type="button"
        onClick={() => onChange(shiftMonth(selectedMonth, 1))}
        className="p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer
                   min-h-11 min-w-11 inline-flex items-center justify-center
                   focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        aria-label="Next month"
      >
        <ChevronRight className="w-5 h-5 text-slate-700" />
      </button>
    </div>
  );
}
