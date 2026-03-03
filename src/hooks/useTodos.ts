import { useCallback,useEffect, useMemo, useState } from "react";
import type { Todo } from "../types/todo";
import  {writeJson, readJson} from "../utils/storage";
import {apiGetTodos} from "../utils/api";

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
  isAdding: boolean;
  beginId: (id: string) => void;
  endId: (id: string) => void;
  beginGlobal: () => void;
  endGlobal: () => void

  // селектори/derived-функції
  isDeleting: (id: string) => boolean;
  pendingCount: number;
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

  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

const [pendingCount, setPendingCount] = useState(0)

  // 2) HELPERS
 const clearError = useCallback(() => setError(null), []);
const clearToast = useCallback(() => setToast(null), []);

const showError = useCallback((msg: string) => setError(msg), []);
const showToast = useCallback((t: ToastState) => setToast(t), []);

useEffect(() => {
  const ctrl = new AbortController();

  (async () => {
    try {
      setIsLoading(true);
      clearError();

      const data = await apiGetTodos(ctrl.signal);
      setTodos(data);
      writeJson(STORAGE_KEY, data);
    } catch (e) {
      const cached = readJson<Todo[]>(STORAGE_KEY, []);
      setTodos(cached);
      showError(e instanceof Error ? e.message : "Failed to load todos");
    } finally {
      setIsLoading(false);
    }
  })();

  return () => ctrl.abort();
}, [clearError, showError]);
 
const beginGlobal = useCallback(() => setPendingCount(c => c + 1), []);
const endGlobal = useCallback(() => setPendingCount(c => Math.max(0, c - 1)), []);
 
//3)Derived + Selectors
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

  const isPending = useCallback(
  (id: string) => pendingIds.has(id),
  [pendingIds]
);

const isDeleting = (id: string) => pendingDelete?.todo.id === id;

//4) Actions 
  const addTodo = useCallback(async () => {
  const trimmed = text.trim();
  if (!trimmed) return;

  setIsAdding(true);
  clearError();

  const temp: Todo = { id: crypto.randomUUID(), text: trimmed, done: false };
  setTodos(prev => [temp, ...prev]);
  setText("");

  try {
    const saved = await apiCreateTodo(temp);
    setTodos(prev => prev.map(t => (t.id === temp.id ? saved : t)));
    showToast({ message: "Added ✅", kind: "success", ms: 1200 });
  } catch (e) {
    // rollback optimistic
    setTodos(prev => prev.filter(t => t.id !== temp.id));
    showError(e instanceof Error ? e.message : "Failed to add todo");
  } finally {
    setIsAdding(false);
  }
}, [text, clearError, showError, showToast]);

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
    },
  );
}, []);

const undoDelete = useCallback(() => {
    if (!pendingDelete) return;
    window.clearTimeout(pendingDelete.timerId);
    setPendingDelete(null);
    setToast(null);
  }, [pendingDelete]);

 const beginId = useCallback((id: string) => {
  setPendingIds(prev => {
    const next = new Set(prev);
    next.add(id);
    return next;
  });
  setPendingCount(c => c + 1);
}, []);

const endId = useCallback((id: string) => {
  setPendingIds(prev => {
    const next = new Set(prev);
    next.delete(id);
    return next;
  });
  setPendingCount(c => Math.max(0, c - 1));
}, []);

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
      beginId,
      beginGlobal,
      endGlobal,
      endId,

      pendingCount,
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
