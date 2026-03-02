import { useCallback, useMemo, useState } from "react";
import type { Todo } from "../types/todo";
import  {writeJson} from "../utils/storage";

type Filter = "all" | "active" | "done";

type Stats = { total: number; active: number; done: number };

type UseTodosState = {
  text: string;
  filter: Filter;
  todos: Todo[];
  visibleTodos: Todo[];
  stats: Stats;
  error: string | null;
  toast: ToastState | null;
  isLoading: boolean;
  isAdding: boolean

  // селектори/derived-функції
  isDeleting: (id: string) => boolean;

  isPending: (id: string) => boolean// якщо поки нема pending — НЕ додавай сюди isPending
};

type UseTodosActions = {
  setText: (v: string) => void;
  setFilter: (f: Filter) => void;

  clearError: () => void;
  clearToast: () => void;
  showError: (msg: string) => void;
  showToast: (t: ToastState) => void;

  addTodo: () => void;
  toggleTodo: (id: string) => void;
  removeTodo: (id: string) => void;

  undoDelete: () => void;
};

export type UseTodosReturn = {
  state: UseTodosState;
  actions: UseTodosActions;
};

type ToastState = {
  message: string
  kind: "success" | "error";
  ms?: number;
  actionLabel?: string;
  onAction?: () => void;
};

type PendingDelete = {
  todo: Todo;
  index: number;
  timerId: number;
};

const STORAGE_KEY = "todos:v1";

function loadTodos(): Todo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    // простая валидация
    return data.filter(Boolean) as Todo[];
  } catch {
    return [];
  }
}

function saveTodos(next: Todo[]) {  
    writeJson(STORAGE_KEY, next);
}

export function useTodos(): UseTodosReturn {

  // 1) STATE
  const [text, setText] = useState("");
  const [todos, setTodos] = useState<Todo[]>(() => loadTodos());
  const [filter, setFilter] = useState<Filter>("all");

  const [error, setError] = useState<string | null>(null);

  const [isLoading] = useState(false);
  const [isAdding] = useState(false);
  const [setToast] = useState<ToastState | null>(null);
  const toast = null as ToastState | null;

  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

const [pendingIds] = useState<Set<string>>(new Set());

  // 2) DERIVED
  const stats = useMemo(() => {
    const done = todos.filter((t) => t.done).length;
    const active = todos.length - done;
    return { total: todos.length, active, done };
  }, [todos]);

  const visibleTodos = useMemo(() => {
    if (filter === "active") return todos.filter((t) => !t.done);
    if (filter === "done") return todos.filter((t) => t.done);
    return todos;
  }, [todos, filter]);

  // 3) HELPERS
 const clearError = useCallback(() => setError(null), []);
const clearToast = useCallback(() => setToast(null), []);

const showError = useCallback((msg: string) => setError(msg), []);
const showToast = useCallback((t: ToastState) => setToast(t), []);

  const undoDelete = useCallback(() => {
    if (!pendingDelete) return;
    window.clearTimeout(pendingDelete.timerId);
    setPendingDelete(null);
    setToast(null);
  }, [pendingDelete]);

  const isDeleting = (id: string) => pendingDelete?.todo.id === id;

  // 4) ACTIONS (минимум)
  const addTodo = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const next: Todo = { id: crypto.randomUUID(), text: trimmed, done: false };
    setTodos((prev) => {
      const updated = [next, ...prev];
      saveTodos(updated);
      return updated;
    });
    setText("");
    showToast({ message: "Added ✅", kind: "success", ms: 1200 });
  }, [text]);

  const toggleTodo = useCallback((id: string) => {
    setTodos((prev) => {
      const updated = prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
      saveTodos(updated);
      return updated;
    });
  }, []);

  const removeTodo = useCallback((id: string) => {
  // финализируем предыдущий pending
  setPendingDelete((cur) => {
    if (!cur) return cur;
    window.clearTimeout(cur.timerId);
    return null;
  });

  let captured: { todo: Todo; index: number } | null = null;

  // берём актуальное состояние списка
  setTodos((prev) => {
    const idx = prev.findIndex((t) => t.id === id);
    if (idx === -1) return prev;
    captured = { todo: prev[idx], index: idx };
    return prev; // soft delete — пока не удаляем
  });

  if (!captured) return;

  const { todo, index } = captured;

  const timerId = window.setTimeout(() => {
    setTodos((prev) => {
      const updated = prev.filter((t) => t.id !== todo.id);
      saveTodos(updated);
      return updated;
    });
    setPendingDelete(null);
  }, 3000);

  setPendingDelete({ todo, index, timerId });

  setToast({
    message: "Deleted",
    kind: "success",
    ms: 3000,
    actionLabel: "Undo",
    onAction: () => {
      window.clearTimeout(timerId);
      setPendingDelete(null);
    },
  });
}, []);

const isPending = useCallback(
  (id: string) => pendingIds.has(id),
  [pendingIds]
);

const result: UseTodosReturn = {
    state: {
      text,
      filter,
      todos,
      visibleTodos,
      stats,
      error,
      toast,
      isDeleting,
      isPending,
      isLoading,
      isAdding
    },
    actions: {
      setText,
      setFilter,
      clearError,
      clearToast,
      addTodo,
      toggleTodo,
      removeTodo,
      undoDelete,
      showError,
      showToast
      //setError, // временно, если нужно
      //setToast, // временно, если нужно
    },
  }
  return result
}
