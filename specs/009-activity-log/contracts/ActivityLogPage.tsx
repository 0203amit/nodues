/**
 * Contract: ActivityLogPage.tsx
 *
 * Read-only viewer page at /settings/activity-log.
 * Mirrors PropertiesPage.tsx shell: back link, title, loading spinner,
 * empty state, content list. No Add button, no filters, no pagination.
 *
 * Displays at most 100 entries (newest first) with entity-type icons,
 * friendly action labels, summary strings, and relative timestamps.
 */

// --- Dependencies ---
// React: useCallback, useEffect, useState
// React Router: Link
// Lucide: ArrowLeft, Loader2, History, Receipt, ListTodo, Home, FileText, Tags
// Contexts: useAuth, useBootstrap, useToast
// Services: fetchActivityLog from activityLogService
// Utils: formatRelativeTime from relativeTime
// Types: ActivityLogEntry, ActionType, ActivityEntityType
// Config: APP_TITLE_SUFFIX from branding

// --- Constants (module-level, inside this file) ---

/**
 * ACTION_LABELS: Record<ActionType, string>
 *
 * Maps each of the 26 ActionType values to a human-readable label:
 *   bill_added → "Bill added"
 *   bill_updated → "Bill updated"
 *   bill_paid → "Bill paid"
 *   bill_postponed → "Bill postponed"
 *   bill_deleted → "Bill deleted"
 *   bill_restored → "Bill restored"
 *   todo_added → "To-do added"
 *   todo_updated → "To-do updated"
 *   todo_done → "To-do done"
 *   todo_recurrence_created → "Recurrence created"
 *   todo_postponed → "To-do postponed"
 *   todo_deleted → "To-do deleted"
 *   todo_restored → "To-do restored"
 *   property_added → "Property added"
 *   property_updated → "Property updated"
 *   property_deleted → "Property deleted"
 *   property_restored → "Property restored"
 *   billtype_added → "Bill type added"
 *   billtype_updated → "Bill type updated"
 *   billtype_deleted → "Bill type deleted"
 *   billtype_restored → "Bill type restored"
 *   category_added → "Category added"
 *   category_updated → "Category updated"
 *   category_deleted → "Category deleted"
 *   category_restored → "Category restored"
 */

/**
 * ENTITY_ICONS: Record<ActivityEntityType, LucideIcon>
 *
 *   bill → Receipt
 *   todo → ListTodo
 *   property → Home
 *   billtype → FileText
 *   category → Tags
 */

// --- Component ---

/**
 * ActivityLogPage component.
 *
 * State:
 *   entries: ActivityLogEntry[] — loaded from fetchActivityLog, capped to 100
 *   isLoading: boolean — true during initial fetch
 *
 * Lifecycle:
 *   useEffect: set document.title to "NoDues · Activity Log"
 *   useCallback + useEffect: fetch activity log on mount
 *     - On success: setEntries(data.slice(0, 100))
 *     - On error: showToast('Failed to load activity log.', 'error')
 *     - Finally: setIsLoading(false)
 *
 * Render structure:
 *   <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-3xl mx-auto">
 *     <!-- Header -->
 *     <div className="mb-6">
 *       <Link to="/settings"> ← Settings </Link>
 *       <h1>Activity Log</h1>
 *     </div>
 *
 *     <!-- Loading -->
 *     {isLoading && <Loader2 spinner />}
 *
 *     <!-- Empty state -->
 *     {!isLoading && entries.length === 0 && (
 *       <History icon />
 *       <h3>No activity yet</h3>
 *       <p>Actions you perform will appear here.</p>
 *     )}
 *
 *     <!-- Entry list -->
 *     {!isLoading && entries.length > 0 && (
 *       <div className="flex flex-col">
 *         {entries.map(entry => (
 *           <div key={entry.id} className="py-3 border-b border-slate-100">
 *             <div className="flex items-start gap-3">
 *               <EntityIcon className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
 *               <div className="flex-1 min-w-0">
 *                 <div className="flex items-center justify-between gap-2">
 *                   <span className="text-sm font-medium text-slate-900">
 *                     {ACTION_LABELS[entry.action]}
 *                   </span>
 *                   <span className="text-xs text-slate-400 flex-shrink-0">
 *                     {formatRelativeTime(entry.timestamp)}
 *                   </span>
 *                 </div>
 *                 <p className="text-sm text-slate-600 mt-0.5">
 *                   {entry.summary}
 *                 </p>
 *               </div>
 *             </div>
 *           </div>
 *         ))}
 *       </div>
 *     )}
 *   </div>
 * );
 */
export default function ActivityLogPage(): JSX.Element;
