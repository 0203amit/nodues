import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, RotateCw, Receipt, ListTodo, CheckCircle2, History } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBootstrap } from '../contexts/BootstrapContext';
import { useToast } from '../contexts/ToastContext';
import { fetchProperties } from '../services/propertiesService';
import { fetchBillTypes } from '../services/billTypesService';
import { fetchBills, formatCurrency, formatMonth } from '../services/billsService';
import { fetchTodos } from '../services/todosService';
import { fetchAllCategories } from '../services/todoCategoriesService';
import { fetchRecurrencePatterns } from '../services/recurrencePatternsService';
import { fetchActivityLog } from '../services/activityLogService';
import { formatDueDate } from '../services/calendarReminders';
import ActivityRow from '../components/shared/ActivityRow';
import { APP_TITLE_SUFFIX } from '../config/branding';
import type {
  MoneyThisMonth,
  AttentionItem,
  ActivityLogEntry,
  PropertyMoneySummary,
  Property,
  BillWithDisplay,
  TodoWithDisplay,
} from '../types';

export default function DashboardPage() {
  const { accessToken } = useAuth();
  const { setupResult } = useBootstrap();
  const spreadsheetId = setupResult!.spreadsheetId;
  const { showToast } = useToast();
  const navigate = useNavigate();

  // --- State ---
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [moneyThisMonth, setMoneyThisMonth] = useState<MoneyThisMonth | null>(null);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityLogEntry[]>([]);
  const lastFetchAt = useRef<number>(0);

  // --- Document title ---
  useEffect(() => {
    document.title = `${APP_TITLE_SUFFIX} · Dashboard`;
  }, []);

  // --- Data loading ---
  const loadAllData = useCallback(async () => {
    const token = accessToken!;
    const ssId = spreadsheetId;

    // Phase 1: independent reference data
    const phase1Names = ['properties', 'bill types', 'categories', 'recurrence patterns', 'activity log'];
    const phase1 = await Promise.allSettled([
      fetchProperties(token, ssId),
      fetchBillTypes(token, ssId),
      fetchAllCategories(token, ssId),
      fetchRecurrencePatterns(token, ssId),
      fetchActivityLog(token, ssId),
    ]);

    const properties: Property[] = phase1[0].status === 'fulfilled' ? phase1[0].value : [];
    const billTypes = phase1[1].status === 'fulfilled' ? phase1[1].value : [];
    const categories = phase1[2].status === 'fulfilled' ? phase1[2].value : [];
    const patterns = phase1[3].status === 'fulfilled' ? phase1[3].value : [];
    const activityEntries: ActivityLogEntry[] = phase1[4].status === 'fulfilled' ? phase1[4].value : [];

    for (let i = 0; i < phase1.length; i++) {
      if (phase1[i].status === 'rejected') {
        showToast(`Failed to load ${phase1Names[i]}.`, 'error');
      }
    }

    // Build maps (same patterns as BillsPage / TodosPage)
    const billTypeMap = new Map<string, { name: string; propertyId: string; propertyName: string }>();
    for (const bt of billTypes) {
      billTypeMap.set(bt.id, {
        name: bt.name,
        propertyId: bt.propertyId,
        propertyName: bt.propertyName,
      });
    }

    const categoryMap = new Map<string, { name: string; color: string }>();
    for (const c of categories) {
      categoryMap.set(c.id, { name: c.name, color: c.color });
    }

    const patternMap = new Map<string, { name: string; intervalValue: number }>();
    for (const p of patterns) {
      patternMap.set(p.id, { name: p.name, intervalValue: p.intervalValue });
    }

    // Phase 2: dependent data
    const phase2Names = ['bills', 'to-dos'];
    const phase2 = await Promise.allSettled([
      fetchBills(token, ssId, billTypeMap),
      fetchTodos(token, ssId, categoryMap, patternMap),
    ]);

    const bills: BillWithDisplay[] = phase2[0].status === 'fulfilled' ? phase2[0].value : [];
    const todos: TodoWithDisplay[] = phase2[1].status === 'fulfilled' ? phase2[1].value : [];

    for (let i = 0; i < phase2.length; i++) {
      if (phase2[i].status === 'rejected') {
        showToast(`Failed to load ${phase2Names[i]}.`, 'error');
      }
    }

    // --- Compute Money This Month (T015) ---
    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const currentMonth = todayIST.slice(0, 7);
    const currentMonthBills = bills.filter(b => b.month === currentMonth);

    const outstanding = currentMonthBills
      .filter(b => (b.displayStatus === 'pending' || b.displayStatus === 'overdue') && b.amount !== null)
      .reduce((sum, b) => sum + b.amount!, 0);

    const paid = currentMonthBills
      .filter(b => b.status === 'paid' && b.amount !== null)
      .reduce((sum, b) => sum + b.amount!, 0);

    // Per-property breakdown
    const propertyGroups = new Map<string, BillWithDisplay[]>();
    for (const bill of currentMonthBills) {
      const group = propertyGroups.get(bill.propertyId) ?? [];
      group.push(bill);
      propertyGroups.set(bill.propertyId, group);
    }

    const byProperty: PropertyMoneySummary[] = [];
    for (const [propertyId, group] of propertyGroups) {
      const propOutstanding = group
        .filter(b => (b.displayStatus === 'pending' || b.displayStatus === 'overdue') && b.amount !== null)
        .reduce((sum, b) => sum + b.amount!, 0);
      const propPaid = group
        .filter(b => b.status === 'paid' && b.amount !== null)
        .reduce((sum, b) => sum + b.amount!, 0);
      if (propOutstanding === 0 && propPaid === 0) continue;
      const prop = properties.find(p => p.id === propertyId);
      byProperty.push({
        propertyId,
        propertyName: prop?.name ?? 'Unknown',
        outstanding: propOutstanding,
        paid: propPaid,
      });
    }

    setMoneyThisMonth({ outstanding, paid, byProperty });

    // --- Compute Attention Items (T016) ---
    const overdueBills: AttentionItem[] = bills
      .filter(b => b.displayStatus === 'overdue')
      .map(b => ({
        kind: 'bill' as const,
        id: b.id,
        billTypeName: b.billTypeName,
        propertyName: b.propertyName,
        propertyId: b.propertyId,
        month: b.month,
        dueDate: b.dueDate,
        displayStatus: b.displayStatus,
        amount: b.amount,
      }));

    const overdueTodos: AttentionItem[] = todos
      .filter(t => t.displayStatus === 'overdue')
      .map(t => ({
        kind: 'todo' as const,
        id: t.id,
        title: t.title,
        categoryId: t.categoryId,
        categoryName: t.categoryName,
        categoryColor: t.categoryColor,
        dueDate: t.dueDate,
        displayStatus: t.displayStatus,
      }));

    const merged = [...overdueBills, ...overdueTodos].sort((a, b) => {
      const dateCompare = a.dueDate.localeCompare(b.dueDate);
      if (dateCompare !== 0) return dateCompare;
      return a.kind === 'bill' ? -1 : 1;
    });

    setAttentionItems(merged);

    // --- Recent Activity (T017) ---
    setRecentActivity(activityEntries.slice(0, 5));

    lastFetchAt.current = Date.now();
  }, [accessToken, spreadsheetId, showToast]);

  // --- Mount ---
  useEffect(() => {
    setIsLoading(true);
    loadAllData().finally(() => setIsLoading(false));
  }, [loadAllData]);

  // --- Auto-refresh on visibility change (T018) ---
  useEffect(() => {
    function handleVisibility() {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - lastFetchAt.current > 30_000
      ) {
        setIsRefreshing(true);
        loadAllData().finally(() => setIsRefreshing(false));
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadAllData]);

  // --- Refresh handler ---
  function handleRefresh() {
    setIsRefreshing(true);
    loadAllData().finally(() => setIsRefreshing(false));
  }

  // --- Current month for display ---
  const currentMonthLabel = moneyThisMonth
    ? formatMonth(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 7))
    : '';

  // --- Render ---
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-3xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer
                     min-h-11 min-w-11 inline-flex items-center justify-center
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
                     disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Refresh"
        >
          <RotateCw className={`w-4 h-4${isRefreshing ? ' animate-spin' : ''}`} />
        </button>
      </div>

      {/* Loading state */}
      {isLoading && !isRefreshing && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-indigo-700 animate-spin" />
        </div>
      )}

      {/* Content sections (shown after initial load) */}
      {!isLoading && (
        <div className="flex flex-col gap-8">
          {/* --- Money This Month (T015) --- */}
          {moneyThisMonth && (
            <section>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Money This Month</h2>
                <p className="text-sm text-slate-500">{currentMonthLabel}</p>
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 bg-white border border-slate-200 rounded-lg p-4">
                  <p className="text-sm text-slate-500 mb-1">Outstanding</p>
                  <p className="text-2xl font-bold text-slate-900 tabular-nums">
                    {formatCurrency(moneyThisMonth.outstanding)}
                  </p>
                </div>
                <div className="flex-1 bg-white border border-slate-200 rounded-lg p-4">
                  <p className="text-sm text-slate-500 mb-1">Paid</p>
                  <p className="text-2xl font-bold text-emerald-700 tabular-nums">
                    {formatCurrency(moneyThisMonth.paid)}
                  </p>
                </div>
              </div>

              {moneyThisMonth.byProperty.length > 0 && (
                <div className="mt-4 bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="grid grid-cols-3 gap-2 px-4 py-2 border-b border-slate-100 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <span>Property</span>
                    <span className="text-right">Outstanding</span>
                    <span className="text-right">Paid</span>
                  </div>
                  {moneyThisMonth.byProperty.map(row => (
                    <div key={row.propertyId} className="grid grid-cols-3 gap-2 px-4 py-2 border-b border-slate-50 last:border-b-0 text-sm">
                      <span className="text-slate-900 truncate">{row.propertyName}</span>
                      <span className="text-right text-slate-900 tabular-nums">{formatCurrency(row.outstanding)}</span>
                      <span className="text-right text-emerald-700 tabular-nums">{formatCurrency(row.paid)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* --- Needs Attention (T016) --- */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Needs Attention</h2>

            {attentionItems.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="flex justify-center mb-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-1">All clear</h3>
                <p className="text-sm text-slate-600">Nothing overdue right now.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {attentionItems.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    className="bg-white border border-slate-200 rounded-lg p-4 cursor-pointer
                               hover:bg-slate-50 focus:outline-none focus:ring-2
                               focus:ring-indigo-500 focus:ring-offset-2 min-h-11 w-full text-left"
                    onClick={() => {
                      if (item.kind === 'bill') {
                        navigate(`/bills?property=${item.propertyId}&month=${item.month}&focus=${item.id}`);
                      } else if (item.kind === 'todo') {
                        navigate(
                          item.categoryId
                            ? `/todos?category=${item.categoryId}&focus=${item.id}`
                            : `/todos?focus=${item.id}`,
                        );
                      } else {
                        navigate('/rentals');
                      }
                    }}
                  >
                    {item.kind === 'bill' ? (
                      <div className="flex items-start gap-3">
                        <Receipt className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-slate-900">
                              {item.billTypeName} — {item.propertyName} · {formatMonth(item.month)}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">
                              Overdue
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5">{formatDueDate(item.dueDate)}</p>
                        </div>
                      </div>
                    ) : item.kind === 'todo' ? (
                      <div className="flex items-start gap-3">
                        <ListTodo className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-slate-900">
                              {item.title}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">
                              Overdue
                            </span>
                            {item.categoryName && (
                              <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                                <span
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: item.categoryColor }}
                                />
                                {item.categoryName}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5">{formatDueDate(item.dueDate)}</p>
                        </div>
                      </div>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* --- Recent Activity (T017) --- */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h2>

            {recentActivity.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="flex justify-center mb-3">
                  <History className="w-12 h-12 text-slate-400" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-1">No activity yet</h3>
                <p className="text-sm text-slate-600">Actions you perform will appear here.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3">
                  {recentActivity.map(entry => (
                    <ActivityRow key={entry.id} entry={entry} />
                  ))}
                </div>
                <Link
                  to="/settings/activity-log"
                  className="inline-block mt-3 text-sm text-indigo-700 hover:underline font-medium"
                >
                  View all
                </Link>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
