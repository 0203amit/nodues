import { formatDueDate } from '../services/calendarReminders';

export function formatRelativeTime(isoTimestamp: string, now?: Date): string {
  const then = new Date(isoTimestamp);
  const current = now ?? new Date();
  const diffMs = current.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
  if (diffHr < 24) return diffHr === 1 ? '1 hour ago' : `${diffHr} hours ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay <= 7) return `${diffDay} days ago`;

  // Older than 7 days — format as "5 Jun 2026"
  const dateStr = `${then.getFullYear()}-${String(then.getMonth() + 1).padStart(2, '0')}-${String(then.getDate()).padStart(2, '0')}`;
  return formatDueDate(dateStr);
}
