import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import type { TodoDisplayStatus } from '../../types';

const STATUS_CONFIG: Record<
  TodoDisplayStatus,
  { bg: string; text: string; Icon: typeof CheckCircle2; label: string }
> = {
  done: { bg: 'bg-emerald-50', text: 'text-emerald-700', Icon: CheckCircle2, label: 'Done' },
  overdue: { bg: 'bg-red-50', text: 'text-red-700', Icon: AlertCircle, label: 'Overdue' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', Icon: Clock, label: 'Pending' },
};

export default function TodoStatusBadge({ displayStatus }: { displayStatus: TodoDisplayStatus }) {
  const { bg, text, Icon, label } = STATUS_CONFIG[displayStatus];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${bg} ${text}`}
      aria-label={`Status: ${label}`}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      {label}
    </span>
  );
}
