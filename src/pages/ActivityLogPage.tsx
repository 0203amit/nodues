import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, History } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBootstrap } from '../contexts/BootstrapContext';
import { useToast } from '../contexts/ToastContext';
import { fetchActivityLog } from '../services/activityLogService';
import type { ActivityLogEntry } from '../types';
import { APP_TITLE_SUFFIX } from '../config/branding';
import ActivityRow from '../components/shared/ActivityRow';

export default function ActivityLogPage() {
  const { accessToken } = useAuth();
  const { setupResult } = useBootstrap();
  const spreadsheetId = setupResult!.spreadsheetId;
  const { showToast } = useToast();

  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    document.title = `${APP_TITLE_SUFFIX} \u00b7 Activity Log`;
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchActivityLog(accessToken!, spreadsheetId);
        setEntries(data.slice(0, 100));
      } catch {
        showToast('Failed to load activity log.', 'error');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [accessToken, spreadsheetId, showToast]);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/settings"
          className="inline-flex items-center gap-1 text-sm font-medium text-indigo-700 hover:text-indigo-800
                     transition-colors cursor-pointer mb-2
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded"
        >
          <ArrowLeft className="w-4 h-4" />
          Settings
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Activity Log</h1>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-indigo-700 animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && entries.length === 0 && (
        <div className="text-center py-12 px-4">
          <div className="flex justify-center mb-3">
            <History className="w-12 h-12 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            No activity yet
          </h3>
          <p className="text-sm text-slate-600">
            Actions you perform will appear here.
          </p>
        </div>
      )}

      {/* Content list */}
      {!isLoading && entries.length > 0 && (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => (
            <ActivityRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
