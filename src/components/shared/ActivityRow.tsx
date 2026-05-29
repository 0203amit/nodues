import { History } from 'lucide-react';
import type { ActivityLogEntry } from '../../types';
import { ACTION_LABELS, ENTITY_ICONS } from '../../utils/activityLabels';
import { formatRelativeTime } from '../../utils/relativeTime';

interface ActivityRowProps {
  entry: ActivityLogEntry;
}

export default function ActivityRow({ entry }: ActivityRowProps) {
  const Icon = ENTITY_ICONS[entry.entityType] ?? History;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-900">
              {ACTION_LABELS[entry.action] ?? entry.action}
            </span>
            <span className="text-xs text-slate-400 ml-auto flex-shrink-0">
              {formatRelativeTime(entry.timestamp)}
            </span>
          </div>
          <p className="text-sm text-slate-600">{entry.summary}</p>
        </div>
      </div>
    </div>
  );
}
