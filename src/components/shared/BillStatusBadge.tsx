import { CheckCircle2, AlertCircle, Clock, FileQuestion, MinusCircle } from 'lucide-react';
import type { BillDisplayStatus } from '../../types';

const STATUS_CONFIG: Record<
  BillDisplayStatus,
  { bg: string; text: string; Icon: typeof CheckCircle2; label: string }
> = {
  paid: { bg: 'bg-emerald-50', text: 'text-emerald-700', Icon: CheckCircle2, label: 'Paid' },
  overdue: { bg: 'bg-red-50', text: 'text-red-700', Icon: AlertCircle, label: 'Overdue' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', Icon: Clock, label: 'Pending' },
  not_yet_generated: { bg: 'bg-cyan-50', text: 'text-cyan-700', Icon: FileQuestion, label: 'Not received yet' },
  skipped: { bg: 'bg-slate-100', text: 'text-slate-600', Icon: MinusCircle, label: 'Skipped' },
};

export default function BillStatusBadge({ displayStatus }: { displayStatus: BillDisplayStatus }) {
  const { bg, text, Icon, label } = STATUS_CONFIG[displayStatus];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${bg} ${text}`}
      aria-label={`Status: ${label}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}
