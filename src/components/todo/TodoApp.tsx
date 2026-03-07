import TodoItem from "./TodoItem";
import TodoFilters from "./TodoFilters";
import { useTodos } from "../../hooks/useTodos";
import ErrorBanner from "../ui/ErrorBanner";
import Toast from "../ui/Toast"; // поправь путь под свою структуру

export default function TodoApp() {
  const { state, actions } = useTodos();
  const { text, filter, visibleTodos, stats, isLoading, error, isPending, isAdding, isDeleting, toast } = state;
  const {setText, setFilter, addTodo, toggleTodo, removeTodo, editTodo, clearCompleted, markAllDone} =actions;

  return (

<div> {toast && (
  <Toast
    message={toast.message}
    kind={toast.kind}
    ms={toast.ms}
    actionLabel={toast.actionLabel}
    onAction={toast.onAction}
    onClose={actions.clearToast}
  />
)}

    <div className="min-h-screen bg-slate-900 text-white flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-md bg-slate-800/70 rounded-2xl p-6 shadow border border-white/10">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-bold">My To-Do</h1>
          <div className="text-xs text-slate-300">
            Active: <span className="font-semibold text-white">{stats.active}</span>{" "}
            • Done: <span className="font-semibold text-white">{stats.done}</span>
          </div>
        </div>
     {error && <ErrorBanner message={error} onClose={actions.clearError} />}
       {isLoading && <div className="mt-4 text-sm text-slate-300">Loading...</div>}

        <div className="mt-4 flex gap-2">
          <input
            className="flex-1 p-3 rounded-xl bg-slate-700/70 outline-none placeholder:text-slate-300/70 focus:ring-2 focus:ring-blue-500"
            placeholder="Введите задачу..."
            value={text ?? ""}
          onChange={(e) => actions.setText(e.target.value)}
            onKeyDown={(e) => {
  if (e.key === "Enter") actions.addTodo();
            }}
          />
          <div className="mt-2 text-xs text-white/60">
  debug text: [{text}]
</div>
                
          <button

  onClick={actions.addTodo}
  disabled={!text.trim() || isAdding||isLoading}
  className="bg-blue-600 hover:bg-blue-700 px-4 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
  type="button"
  aria-label="add"
>
  {isAdding ? "..." : "+" }


</button>

<div className="text-xs text-slate-400">error: {String(error)}</div>
        </div>

        <TodoFilters


  filter={filter}
  total={stats.total}
  doneCount={stats.done}
  onChange={actions.setFilter}
  onMarkAll={markAllDone}
  onClearDone={clearCompleted}


/>

        <ul className="mt-4 space-y-2">
  {visibleTodos.length === 0 ? (
    <li className="text-slate-300 text-sm">
      Пока пусто. Добавь первую задачу 👇
    </li>
  ) : (
    visibleTodos.map((t) => (
      <TodoItem
  value={state.text}
  key={t.id}
  todo={t}
  onToggle={toggleTodo}
  onRemove={removeTodo}
  onEdit={editTodo}
  isPending={false}
  isDeleting={isDeleting(t.id)}
  onUndoDelete={actions.undoDelete}
/>
    ))
  )}
</ul>
      </div>
    </div>
    </div>

  );
}





