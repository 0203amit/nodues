import { forwardRef } from 'react';
import { ListTodo, Pencil, CheckCircle2, CalendarClock, Trash2, Bell } from 'lucide-react';
import type { TodoWithDisplay } from '../../types';
import { formatDueDate } from '../../services/calendarReminders';
import TodoStatusBadge from '../shared/TodoStatusBadge';

export interface TodoCardProps {
  todo: TodoWithDisplay;
  onEdit: (todo: TodoWithDisplay) => void;
  onMarkDone: (todo: TodoWithDisplay) => void;
  onPostpone: (todo: TodoWithDisplay) => void;
  onDelete: (todo: TodoWithDisplay) => void;
  isLoading: boolean;
  isFocused?: boolean;
}

const TodoCard = forwardRef<HTMLDivElement, TodoCardProps>(function TodoCard(
  { todo, onEdit, onMarkDone, onPostpone, onDelete, isLoading, isFocused },
  ref,
) {
  const showActions = todo.displayStatus === 'pending' || todo.displayStatus === 'overdue';

  // Build subtitle parts: categoryName · recurrenceName — omit empty strings
  const subtitleParts = [todo.categoryName, todo.recurrenceName].filter(Boolean);
  const subtitle = subtitleParts.join(' \u00b7 ');

  return (
    <div
      ref={ref}
      className={`bg-white border border-slate-200 rounded-lg p-4${isFocused ? ' ring-2 ring-indigo-300 ring-offset-2' : ''}`}
    >
      {/* Top section: info + status badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <ListTodo className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate">
              {todo.title}
            </p>
            {subtitle && (
              <p className="text-sm text-slate-600 truncate">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <TodoStatusBadge displayStatus={todo.displayStatus} />
        </div>
      </div>

      {/* Meta row: category badge, due date, bell */}
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {todo.categoryColor && todo.categoryName && (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
            <span
              className="w-2 h-2 rounded-full inline-block flex-shrink-0"
              style={{ backgroundColor: todo.categoryColor }}
            />
            {todo.categoryName}
          </span>
        )}
        {todo.dueDate && (
          <span className="text-xs text-slate-600">
            {formatDueDate(todo.dueDate)}
          </span>
        )}
        {todo.calendarEventIds && todo.calendarEventIds.trim() !== '' && (
          <span
            className="inline-flex items-center justify-center min-h-11 min-w-11 px-2 py-1"
            title="Calendar reminders set"
          >
            <Bell className="w-4 h-4 text-slate-400" aria-hidden="true" />
          </span>
        )}
      </div>

      {/* Action buttons row */}
      <div className="flex items-center gap-1 mt-3">
        <button
          type="button"
          onClick={() => onEdit(todo)}
          disabled={isLoading}
          className="text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50
                     font-medium text-sm px-2 py-1 rounded transition-colors cursor-pointer
                     min-h-11 min-w-11 inline-flex items-center justify-center gap-1
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label="Edit to-do"
        >
          <Pencil className="w-4 h-4" />
          <span className="hidden sm:inline">Edit</span>
        </button>

        {showActions && (
          <button
            type="button"
            onClick={() => onMarkDone(todo)}
            disabled={isLoading}
            className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50
                       font-medium text-sm px-2 py-1 rounded transition-colors cursor-pointer
                       min-h-11 min-w-11 inline-flex items-center justify-center gap-1
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            aria-label="Mark to-do as done"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span className="hidden sm:inline">Mark Done</span>
          </button>
        )}

        {showActions && todo.dueDate && (
          <button
            type="button"
            onClick={() => onPostpone(todo)}
            disabled={isLoading}
            className="text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50
                       font-medium text-sm px-2 py-1 rounded transition-colors cursor-pointer
                       min-h-11 min-w-11 inline-flex items-center justify-center gap-1
                       disabled:opacity-50 disabled:cursor-not-allowed
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            aria-label="Postpone to-do"
          >
            <CalendarClock className="w-4 h-4" />
            <span className="hidden sm:inline">Postpone</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onDelete(todo)}
          disabled={isLoading}
          className="text-red-600 hover:text-red-700 hover:bg-red-50
                     font-medium text-sm px-2 py-1 rounded transition-colors cursor-pointer
                     min-h-11 min-w-11 inline-flex items-center justify-center gap-1
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label="Delete to-do"
        >
          <Trash2 className="w-4 h-4" />
          <span className="hidden sm:inline">Delete</span>
        </button>
      </div>
    </div>
  );
});

export default TodoCard;
