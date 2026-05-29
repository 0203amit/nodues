import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, ListTodo, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBootstrap } from '../contexts/BootstrapContext';
import { useToast } from '../contexts/ToastContext';
import {
  fetchTodos,
  addTodo,
  updateTodo,
  markTodoDone,
  createNextRecurrence,
  postponeTodo,
  softDeleteTodo,
  undoDeleteTodo,
  computeDisplayStatus,
  sortTodos,
  parseReminderOffsets,
  setCalendarEventIds,
} from '../services/todosService';
import { fetchCategories, fetchAllCategories } from '../services/todoCategoriesService';
import { fetchRecurrencePatterns } from '../services/recurrencePatternsService';
import { runMigrations } from '../services/migrationService';
import {
  parseEventIds,
  createReminders,
  cleanupReminders,
  formatDueDate,
} from '../services/calendarReminders';
import TodoCard from '../components/todos/TodoCard';
import TodoFormModal from '../components/todos/TodoFormModal';
import MarkDoneModal from '../components/todos/MarkDoneModal';
import PostponeModal from '../components/shared/PostponeModal';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { v4 as uuidv4 } from 'uuid';
import { appendActivityLogSafe, formatShortDate } from '../services/activityLogService';
import { APP_TITLE_SUFFIX } from '../config/branding';
import { useSearchParams } from 'react-router-dom';
import type {
  TodoWithDisplay,
  TodoCategory,
  RecurrencePattern,
  TodoFormData,
  MarkDoneFormData,
  PostponeFormData,
  Todo,
} from '../types';

export default function TodosPage() {
  const { accessToken } = useAuth();
  const { setupResult } = useBootstrap();
  const spreadsheetId = setupResult!.spreadsheetId;
  const calendarId = setupResult!.calendarId;
  const { showToast, showUndo } = useToast();

  // --- State ---
  const [todos, setTodos] = useState<TodoWithDisplay[]>([]);
  const [categories, setCategories] = useState<TodoCategory[]>([]);
  const [allCategories, setAllCategories] = useState<TodoCategory[]>([]);
  const [patterns, setPatterns] = useState<RecurrencePattern[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Modals / action targets
  const [formModal, setFormModal] = useState<{
    mode: 'add' | 'edit';
    todo?: TodoWithDisplay;
  } | null>(null);
  const [markDoneTarget, setMarkDoneTarget] = useState<TodoWithDisplay | null>(null);
  const [postponeTarget, setPostponeTarget] = useState<TodoWithDisplay | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TodoWithDisplay | null>(null);

  // Ref map for scroll-to
  const todoRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Clickthrough support (URL search params)
  const [searchParams, setSearchParams] = useSearchParams();
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const pendingFocusRef = useRef<string | null>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Document title ---
  useEffect(() => {
    document.title = `${APP_TITLE_SUFFIX} · To-Dos`;
  }, []);

  // Cleanup focus timer on unmount
  useEffect(() => {
    return () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    };
  }, []);

  // Read URL search params on mount (clickthrough from Dashboard)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const category = searchParams.get('category');
    const focus = searchParams.get('focus');
    if (category && category !== 'all') setFilterCategory(category);
    if (focus) pendingFocusRef.current = focus;
  }, []);

  // After data loads, scroll to focused todo and highlight
  useEffect(() => {
    if (!isLoading && pendingFocusRef.current) {
      const id = pendingFocusRef.current;
      pendingFocusRef.current = null;
      setFocusedId(id);
      requestAnimationFrame(() => {
        todoRefs.current.get(id)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      });
      focusTimerRef.current = setTimeout(() => {
        setFocusedId(null);
        const params = new URLSearchParams(window.location.search);
        params.delete('focus');
        setSearchParams(params, { replace: true });
      }, 1500);
    }
  }, [isLoading, setSearchParams]);

  // --- Maps for enrichment (derived from allCategories and patterns) ---
  const categoryMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    for (const c of allCategories) {
      map.set(c.id, { name: c.name, color: c.color });
    }
    return map;
  }, [allCategories]);

  const patternMap = useMemo(() => {
    const map = new Map<string, { name: string; intervalValue: number }>();
    for (const p of patterns) {
      map.set(p.id, { name: p.name, intervalValue: p.intervalValue });
    }
    return map;
  }, [patterns]);

  // --- Data loading ---
  const loadData = useCallback(async () => {
    try {
      // Run migrations first (idempotent, non-blocking)
      await runMigrations(accessToken!, spreadsheetId);

      // Parallel fetch of reference data
      const [catData, allCatData, patData] = await Promise.all([
        fetchCategories(accessToken!, spreadsheetId),
        fetchAllCategories(accessToken!, spreadsheetId),
        fetchRecurrencePatterns(accessToken!, spreadsheetId),
      ]);
      setCategories(catData);
      setAllCategories(allCatData);
      setPatterns(patData);

      // Build maps for enrichment
      const catMap = new Map<string, { name: string; color: string }>();
      for (const c of allCatData) {
        catMap.set(c.id, { name: c.name, color: c.color });
      }
      const patMap = new Map<string, { name: string; intervalValue: number }>();
      for (const p of patData) {
        patMap.set(p.id, { name: p.name, intervalValue: p.intervalValue });
      }

      const todoData = await fetchTodos(accessToken!, spreadsheetId, catMap, patMap);
      setTodos(todoData);
    } catch {
      showToast('Failed to load to-dos.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, spreadsheetId, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Helper: refetch todos ---
  async function refetchTodos(): Promise<TodoWithDisplay[]> {
    const todoData = await fetchTodos(accessToken!, spreadsheetId, categoryMap, patternMap);
    setTodos(todoData);
    return todoData;
  }

  // --- Derived state ---
  const filteredTodos = useMemo(() => {
    let result = todos;
    if (filterCategory !== 'all') {
      result = result.filter((t) => t.categoryId === filterCategory);
    }
    if (filterStatus !== 'all') {
      result = result.filter((t) => t.displayStatus === filterStatus);
    }
    return sortTodos(result);
  }, [todos, filterCategory, filterStatus]);

  const categoryOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of todos) {
      if (t.categoryId && !seen.has(t.categoryId)) {
        seen.set(t.categoryId, t.categoryName);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({
      value: id,
      label: name,
    }));
  }, [todos]);

  const statusOptions = [
    { value: 'all', label: 'All statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'done', label: 'Done' },
  ];

  // --- Add To-Do ---
  function handleAddClick() {
    setFormModal({ mode: 'add' });
  }

  // --- Edit ---
  function handleEdit(todo: TodoWithDisplay) {
    setFormModal({ mode: 'edit', todo });
  }

  // --- Form Submit (Add / Edit) ---
  async function handleFormSubmit(data: TodoFormData) {
    if (formModal?.mode === 'edit' && formModal.todo) {
      await saveEditTodo(data, formModal.todo);
    } else {
      await saveNewTodo(data);
    }
  }

  async function saveNewTodo(data: TodoFormData) {
    setIsSaving(true);
    try {
      const newTodo = await addTodo(accessToken!, spreadsheetId, data);
      const freshTodos = await refetchTodos();

      // Calendar create (best-effort)
      if (newTodo.dueDate) {
        const offsets = parseReminderOffsets(newTodo.reminderOffsetsDays);
        if (offsets.length > 0) {
          try {
            const catInfo = categoryMap.get(newTodo.categoryId);
            const title = `[To-Do] ${newTodo.title} due ${formatDueDate(newTodo.dueDate)}`;
            const description = catInfo ? `Category: ${catInfo.name}` : '';
            const result = await createReminders(
              accessToken!, calendarId, newTodo.dueDate,
              offsets, title, description,
            );
            if (result.eventIds.length > 0) {
              const fresh = freshTodos.find(t => t.id === newTodo.id);
              if (fresh) {
                const updated = await setCalendarEventIds(
                  accessToken!, spreadsheetId, fresh, result.eventIds,
                );
                setTodos(prev => prev.map(t => t.id === updated.id
                  ? { ...t, calendarEventIds: updated.calendarEventIds } : t));
              }
            }
            if (!result.allSucceeded) {
              showToast("To-do added, but some reminders couldn't be set.", 'error');
            } else {
              showToast('To-do added.', 'success');
            }
          } catch {
            showToast("To-do added, but reminders couldn't be set.", 'error');
          }
        } else {
          showToast('To-do added.', 'success');
        }
      } else {
        showToast('To-do added.', 'success');
      }

      await appendActivityLogSafe(accessToken!, spreadsheetId, {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        userEmail: 'user',
        action: 'todo_added',
        entityType: 'todo',
        entityId: newTodo.id,
        summary: `${newTodo.title}`,
      });

      setFormModal(null);
    } catch {
      showToast('Failed to add to-do.', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  async function saveEditTodo(data: TodoFormData, todo: TodoWithDisplay) {
    setIsSaving(true);
    try {
      const oldDueDate = todo.dueDate;
      const dueDateChanged = data.dueDate !== oldDueDate;
      const updated = await updateTodo(accessToken!, spreadsheetId, todo, data);

      // Calendar side-effect (only when dueDate changed)
      let calendarFailed = false;
      if (dueDateChanged) {
        try {
          const oldIds = parseEventIds(todo.calendarEventIds);
          if (oldIds.length > 0) {
            await cleanupReminders(accessToken!, calendarId, oldIds);
          }

          if (data.dueDate !== '') {
            const offsets = parseReminderOffsets(updated.reminderOffsetsDays);
            if (offsets.length > 0) {
              const catInfo = categoryMap.get(updated.categoryId);
              const title = `[To-Do] ${updated.title} due ${formatDueDate(updated.dueDate)}`;
              const description = catInfo ? `Category: ${catInfo.name}` : '';
              const result = await createReminders(
                accessToken!, calendarId, updated.dueDate,
                offsets, title, description,
              );
              const withEvents = await setCalendarEventIds(
                accessToken!, spreadsheetId, updated, result.eventIds,
              );
              setTodos(prev => prev.map(t => t.id === withEvents.id ? {
                ...t, ...withEvents,
                displayStatus: computeDisplayStatus(withEvents.status, withEvents.dueDate),
              } : t));
              if (!result.allSucceeded) {
                showToast("To-do updated, but some reminders couldn't be set.", 'error');
                calendarFailed = true;
              }
            }
          } else {
            // Date removed — clear event IDs
            const cleared = await setCalendarEventIds(
              accessToken!, spreadsheetId, updated, [],
            );
            setTodos(prev => prev.map(t => t.id === cleared.id ? {
              ...t, ...cleared,
              displayStatus: computeDisplayStatus(cleared.status, cleared.dueDate),
            } : t));
          }
        } catch {
          showToast("To-do updated, but reminders couldn't be updated.", 'error');
          calendarFailed = true;
        }
      }

      await refetchTodos();

      await appendActivityLogSafe(accessToken!, spreadsheetId, {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        userEmail: 'user',
        action: 'todo_updated',
        entityType: 'todo',
        entityId: todo.id,
        summary: `${data.title}`,
      });

      setFormModal(null);
      if (!calendarFailed) {
        showToast('To-do updated.', 'success');
      }
    } catch {
      showToast('Failed to update to-do.', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  // --- Mark Done ---
  function handleMarkDone(todo: TodoWithDisplay) {
    setMarkDoneTarget(todo);
  }

  async function handleMarkDoneSubmit(data: MarkDoneFormData) {
    if (!markDoneTarget) return;
    setIsSaving(true);
    try {
      // STEP 1: critical — mark done
      const doneTodo = await markTodoDone(
        accessToken!, spreadsheetId, markDoneTarget, data,
      );

      // STEP 2: critical IF recurring — create next instance
      let nextTodo: Todo | null = null;
      const pattern = patterns.find(p => p.id === markDoneTarget.recurrencePatternId);
      if (pattern && pattern.intervalValue > 0) {
        nextTodo = await createNextRecurrence(
          accessToken!, spreadsheetId, doneTodo, pattern,
        );
      }

      // STEP 3: best-effort — calendar cleanup on completed todo
      try {
        const oldIds = parseEventIds(markDoneTarget.calendarEventIds);
        if (oldIds.length > 0) {
          await cleanupReminders(accessToken!, calendarId, oldIds);
          await setCalendarEventIds(accessToken!, spreadsheetId, doneTodo, []);
        }
      } catch { /* swallow */ }

      await appendActivityLogSafe(accessToken!, spreadsheetId, {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        userEmail: 'user',
        action: 'todo_done',
        entityType: 'todo',
        entityId: markDoneTarget.id,
        summary: `${markDoneTarget.title}`,
      });

      // STEP 4: best-effort — calendar create on next instance (NEEDS REFETCH for _rowIndex)
      let calendarPartialFailed = false;
      if (nextTodo && nextTodo.dueDate) {
        const offsets = parseReminderOffsets(nextTodo.reminderOffsetsDays);
        if (offsets.length > 0) {
          try {
            const catInfo = categoryMap.get(nextTodo.categoryId);
            const title = `[To-Do] ${nextTodo.title} due ${formatDueDate(nextTodo.dueDate)}`;
            const description = catInfo ? `Category: ${catInfo.name}` : '';
            const result = await createReminders(
              accessToken!, calendarId, nextTodo.dueDate,
              offsets, title, description,
            );
            // Refetch to get _rowIndex of the new instance
            const freshTodos = await refetchTodos();
            const freshNext = freshTodos.find(t => t.id === nextTodo!.id);
            if (freshNext && result.eventIds.length > 0) {
              await setCalendarEventIds(
                accessToken!, spreadsheetId, freshNext, result.eventIds,
              );
            }
            if (!result.allSucceeded) calendarPartialFailed = true;
          } catch {
            showToast("To-do marked as done, but calendar reminders couldn't be updated.", 'error');
          }
        }
      }

      if (nextTodo) {
        await appendActivityLogSafe(accessToken!, spreadsheetId, {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          userEmail: 'user',
          action: 'todo_recurrence_created',
          entityType: 'todo',
          entityId: nextTodo.id,
          summary: nextTodo.dueDate ? `${nextTodo.title} · next ${formatDueDate(nextTodo.dueDate)}` : nextTodo.title,
        });
      }

      // STEP 5: refetch all
      await refetchTodos();
      setMarkDoneTarget(null);

      // STEP 6: success toast
      if (nextTodo) {
        showToast('To-do marked as done. Next occurrence created.', 'success');
      } else {
        showToast('To-do marked as done.', 'success');
      }
      if (calendarPartialFailed) {
        showToast("Some reminders couldn't be set for the next occurrence.", 'error');
      }
    } catch {
      showToast('Failed to mark to-do as done.', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  // --- Postpone ---
  function handlePostpone(todo: TodoWithDisplay) {
    setPostponeTarget(todo);
  }

  async function handlePostponeSubmit(data: PostponeFormData) {
    if (!postponeTarget) return;

    // Same-date guard — before setIsSaving, modal stays open
    if (data.newDueDate === postponeTarget.dueDate) {
      showToast('New date is the same as the current due date.', 'info');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await postponeTodo(
        accessToken!, spreadsheetId,
        postponeTarget, data.newDueDate, data.reason,
      );

      // Best-effort calendar (nested try/catch, AFTER critical path)
      let calendarFailed = false;
      try {
        const oldIds = parseEventIds(postponeTarget.calendarEventIds);
        if (oldIds.length > 0) {
          await cleanupReminders(accessToken!, calendarId, oldIds);
        }

        const offsets = parseReminderOffsets(updated.reminderOffsetsDays);
        if (offsets.length > 0) {
          // Branch 1: has offsets — create new events
          const catInfo = categoryMap.get(updated.categoryId);
          const title = `[To-Do] ${updated.title} due ${formatDueDate(updated.dueDate)}`;
          const description = catInfo ? `Category: ${catInfo.name}` : '';
          const result = await createReminders(
            accessToken!, calendarId, updated.dueDate,
            offsets, title, description,
          );
          const withEvents = await setCalendarEventIds(
            accessToken!, spreadsheetId, updated, result.eventIds,
          );
          setTodos(prev => prev.map(t => t.id === withEvents.id ? {
            ...t, ...withEvents,
            displayStatus: computeDisplayStatus(withEvents.status, withEvents.dueDate),
          } : t));
          if (!result.allSucceeded) {
            showToast("To-do postponed, but some reminders couldn't be set.", 'error');
            calendarFailed = true;
          }
        } else if (oldIds.length > 0) {
          // Branch 2: no offsets but old IDs existed — clear the column
          const cleared = await setCalendarEventIds(
            accessToken!, spreadsheetId, updated, [],
          );
          setTodos(prev => prev.map(t => t.id === cleared.id ? {
            ...t, ...cleared,
            displayStatus: computeDisplayStatus(cleared.status, cleared.dueDate),
          } : t));
        } else {
          // Branch 3: neither — just refresh in-memory todo
          setTodos(prev => prev.map(t => t.id === updated.id ? {
            ...t, ...updated,
            displayStatus: computeDisplayStatus(updated.status, updated.dueDate),
          } : t));
        }
      } catch {
        showToast("To-do postponed, but calendar reminders couldn't be updated.", 'error');
        calendarFailed = true;
        // Still update in-memory todo so the badge refreshes
        setTodos(prev => prev.map(t => t.id === updated.id ? {
          ...t, ...updated,
          displayStatus: computeDisplayStatus(updated.status, updated.dueDate),
        } : t));
      }

      await appendActivityLogSafe(accessToken!, spreadsheetId, {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        userEmail: 'user',
        action: 'todo_postponed',
        entityType: 'todo',
        entityId: postponeTarget.id,
        summary: `${postponeTarget.title} · ${formatShortDate(postponeTarget.dueDate)} → ${formatDueDate(data.newDueDate)}`,
      });

      // Close modal + success toast (only if no calendar issue toast shown)
      setPostponeTarget(null);
      if (!calendarFailed) {
        showToast('To-do postponed.', 'success');
      }
    } catch {
      showToast('Failed to postpone to-do.', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  // --- Delete (optimistic + undo) ---
  function handleDelete(todo: TodoWithDisplay) {
    setDeleteTarget(todo);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;

    const todo = deleteTarget;
    const originalIndex = todos.findIndex((t) => t.id === todo.id);
    setDeleteTarget(null);

    // Optimistic remove
    setTodos((prev) => prev.filter((t) => t.id !== todo.id));

    try {
      await softDeleteTodo(accessToken!, spreadsheetId, todo);

      // Calendar cleanup (best-effort) — do NOT call setCalendarEventIds
      // (softDeleteTodo uses updateCell on deleted_at; a full-row write would un-delete)
      if (todo.calendarEventIds && todo.calendarEventIds.trim() !== '') {
        try {
          await cleanupReminders(
            accessToken!, calendarId,
            parseEventIds(todo.calendarEventIds),
          );
        } catch { /* swallow */ }
      }

      await appendActivityLogSafe(accessToken!, spreadsheetId, {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        userEmail: 'user',
        action: 'todo_deleted',
        entityType: 'todo',
        entityId: todo.id,
        summary: `${todo.title}`,
      });

      showUndo('To-do deleted.', async () => {
        try {
          await undoDeleteTodo(accessToken!, spreadsheetId, todo);

          // Recreate calendar reminders (best-effort)
          let restoredTodo: TodoWithDisplay = todo;
          const offsets = parseReminderOffsets(restoredTodo.reminderOffsetsDays);
          if (restoredTodo.dueDate && offsets.length > 0) {
            try {
              const catInfo = categoryMap.get(restoredTodo.categoryId);
              const title = `[To-Do] ${restoredTodo.title} due ${formatDueDate(restoredTodo.dueDate)}`;
              const description = catInfo ? `Category: ${catInfo.name}` : '';
              const result = await createReminders(
                accessToken!, calendarId, restoredTodo.dueDate,
                offsets, title, description,
              );
              if (result.eventIds.length > 0) {
                const withEvents = await setCalendarEventIds(
                  accessToken!, spreadsheetId, todo, result.eventIds,
                );
                restoredTodo = {
                  ...restoredTodo,
                  calendarEventIds: withEvents.calendarEventIds,
                };
              }
            } catch { /* swallow */ }
          }

          await appendActivityLogSafe(accessToken!, spreadsheetId, {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            userEmail: 'user',
            action: 'todo_restored',
            entityType: 'todo',
            entityId: todo.id,
            summary: `${todo.title}`,
          });

          // Reinsert at originalIndex (re-enriched)
          setTodos((prev) => {
            const next = [...prev];
            next.splice(originalIndex, 0, {
              ...restoredTodo,
              displayStatus: computeDisplayStatus(restoredTodo.status, restoredTodo.dueDate),
            });
            return next;
          });
        } catch {
          showToast('Failed to undo delete.', 'error');
        }
      });
    } catch {
      // Rollback: reinsert at original position
      setTodos((prev) => {
        const next = [...prev];
        next.splice(originalIndex, 0, todo);
        return next;
      });
      showToast('Failed to delete to-do.', 'error');
    }
  }

  function handleModalClose() {
    if (!isSaving) {
      setFormModal(null);
    }
  }

  // --- Ref callback for TodoCard registration ---
  function registerTodoRef(todoId: string) {
    return (el: HTMLDivElement | null) => {
      if (el) {
        todoRefs.current.set(todoId, el);
      } else {
        todoRefs.current.delete(todoId);
      }
    };
  }

  // --- Render ---
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-3xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">To-Dos</h1>
        <button
          type="button"
          onClick={handleAddClick}
          className="bg-indigo-700 hover:bg-indigo-800 text-white font-medium px-4 py-2 rounded-lg
                     transition-colors cursor-pointer min-h-11 inline-flex items-center gap-2
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <Plus className="w-4 h-4" />
          Add To-Do
        </button>
      </div>

      {/* Filters */}
      {!isLoading && todos.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-lg border border-slate-300 shadow-sm px-3 py-2 text-base
                       focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                       focus:outline-none cursor-pointer sm:w-auto w-full"
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {categoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-slate-300 shadow-sm px-3 py-2 text-base
                       focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500
                       focus:outline-none cursor-pointer sm:w-auto w-full"
            aria-label="Filter by status"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-indigo-700 animate-spin" />
        </div>
      )}

      {/* Empty state — no to-dos at all */}
      {!isLoading && todos.length === 0 && (
        <div className="text-center py-12 px-4">
          <div className="flex justify-center mb-3">
            <ListTodo className="w-12 h-12 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            No to-dos yet
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            Add your first to-do to start tracking
          </p>
          <button
            type="button"
            onClick={handleAddClick}
            className="bg-indigo-700 hover:bg-indigo-800 text-white font-medium px-4 py-2 rounded-lg
                       transition-colors cursor-pointer min-h-11 inline-flex items-center gap-2 mx-auto
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <Plus className="w-4 h-4" />
            Add a to-do
          </button>
        </div>
      )}

      {/* Empty state — filters active but no matches */}
      {!isLoading && todos.length > 0 && filteredTodos.length === 0 && (
        <div className="text-center py-12 px-4">
          <div className="flex justify-center mb-3">
            <ListTodo className="w-12 h-12 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            No to-dos match your filters
          </h3>
          <p className="text-sm text-slate-600">
            Try adjusting the category or status filter
          </p>
        </div>
      )}

      {/* Todo list */}
      {!isLoading && filteredTodos.length > 0 && (
        <div className="flex flex-col gap-3">
          {filteredTodos.map((todo) => (
            <TodoCard
              key={todo.id}
              ref={registerTodoRef(todo.id)}
              todo={todo}
              onEdit={handleEdit}
              onMarkDone={handleMarkDone}
              onPostpone={handlePostpone}
              onDelete={handleDelete}
              isLoading={isSaving}
              isFocused={focusedId === todo.id}
            />
          ))}
        </div>
      )}

      {/* Todo Form Modal */}
      {formModal && (
        <TodoFormModal
          todo={formModal.todo ?? null}
          categories={categories}
          recurrencePatterns={patterns}
          isSaving={isSaving}
          onSubmit={handleFormSubmit}
          onClose={handleModalClose}
        />
      )}

      {/* Mark Done Modal */}
      {markDoneTarget && (
        <MarkDoneModal
          todo={markDoneTarget}
          isSaving={isSaving}
          onSubmit={handleMarkDoneSubmit}
          onClose={() => !isSaving && setMarkDoneTarget(null)}
        />
      )}

      {/* Postpone Modal */}
      {postponeTarget && (
        <PostponeModal
          title="Postpone to-do"
          itemTitle={postponeTarget.title}
          contextLine={[postponeTarget.categoryName, postponeTarget.recurrenceName].filter(Boolean).join(' · ')}
          currentDueDate={postponeTarget.dueDate}
          isSaving={isSaving}
          onSubmit={handlePostponeSubmit}
          onClose={() => !isSaving && setPostponeTarget(null)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete this to-do?"
          message="You can undo within 10 seconds."
          confirmLabel="Delete"
          confirmVariant="destructive"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
