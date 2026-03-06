import { useCallback,useEffect, useMemo, useState } from "react";
import type { Todo } from "../types/todo";
import  {writeJson, readJson} from "../utils/storage";
import {apiGetTodos, apiPatchTodo, apiCreateTodo, apiDeleteTodo} from "../api/todos";


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
  isBusy: boolean;

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
  //showError: (msg: string) => void;
  showToast: (t: ToastState) => void;

  addTodo: () => void;
  toggleTodo: (id: string) => void;
  removeTodo: (id: string) => void;
  // undoDelete: () => void;
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

// function saveTodos(next: Todo[]) {  
//     writeJson(STORAGE_KEY, next);
// }

export function useTodos(): UseTodosReturn {

  // 1) STATE
  const [text, setText] = useState("");
  const [todos, setTodos] = useState<Todo[]>(() => loadTodos());
  const [filter, setFilter] = useState<Filter>("all");

  const [error, setError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [pendingDelete] = useState<PendingDelete | null>(null);

const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());

const [pendingCount, setPendingCount] = useState(0)

  // 2) HELPERS
 const clearError = useCallback(() => setError(null), []);
const clearToast = useCallback(() => setToast(null), []);

//const showError = useCallback((msg: string) => setError(msg), []);
const showToast = useCallback((t: ToastState) => setToast(t), []);

useEffect(() => {
  const ctrl = new AbortController();

  (async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await apiGetTodos(ctrl.signal);
      setTodos(data);
      writeJson(STORAGE_KEY, data);
    } catch (e) {
      const cached = readJson<Todo[]>(STORAGE_KEY, []);
      setTodos(cached);
      setError(e instanceof Error ? e.message : "Failed to load todos");
    } finally {
      setIsLoading(false);
    }
  })();

  return () => ctrl.abort();
}, []);
 
const beginGlobal = useCallback(() => setPendingCount((c) => c + 1), []);
const endGlobal = useCallback(() => setPendingCount((c) => Math.max(0, c - 1)), []);
 
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

  const temp: Todo = { id: crypto.randomUUID(), text: trimmed, done: false };
  setTodos(prev => [temp, ...prev]);
  setText("");
  setIsAdding(true);
  beginGlobal();

  try {
    const saved = await apiCreateTodo(temp);
    setTodos((prev) => prev.map(t => (t.id === temp.id ? saved : t)));
    writeJson(STORAGE_KEY, readJson<Todo[]>(STORAGE_KEY, []));
  } catch (e) {
    // rollback optimistic
    setTodos((prev) => prev.filter((t) => t.id !== temp.id));
    setError(e instanceof Error ? e.message : "Failed to add todo");
  } finally {
    setIsAdding(false);
    endGlobal();
  }
}, [text, beginGlobal, endGlobal]);

 const beginId = useCallback((id: string) => {
  setPendingIds((prev) => {
    const next = new Set(prev);
    next.delete(id);
    return next;
  });
}, []);

const endId = useCallback((id: string) => {
  setPendingIds(prev => {
    const next = new Set(prev);
    next.delete(id);
    return next;
  });
  setPendingCount(c => Math.max(0, c - 1));
}, []);

  const toggleTodo = useCallback(async (id: string) => {
    const before = todos.find((t) => t.id === id);
    if (!before) return;
    
    beginId(id);

    //optimistic
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

try
  {await apiPatchTodo(id, {done: !before.done});}

catch (e) {
  //rollback
  setTodos((prev) => prev.map((t) => (t.id === id ? before : t)));
  setError(e instanceof Error ? e.message : "Failed to toggle")
} finally {
  endId(id);
}}, [todos, beginId, endId]);

const removeTodo = useCallback(async (id: string) => {
  const prev = todos;

  beginId(id);
  setTodos((curr) => curr.filter((t) => t.id !== id));

  try {
    await apiDeleteTodo(id);
    showToast({
      message: "Deleted",
      kind: "success",
      ms: 1200,
    });
  } catch (e) {
    setTodos(prev);
    setError(e instanceof Error ? e.message : "Failed to delete todo");
  } finally {
    endId(id);
  }
}, [todos, beginId, endId, showToast]);


// const undoDelete = useCallback(() => {
//     if (!pendingDelete) return;
//     window.clearTimeout(pendingDelete.timerId);
//     setPendingDelete(null);
//     setToast(null);
//   }, [pendingDelete]);

const isBusy = pendingCount > 0;


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
      isAdding,
      isBusy
    },
    actions: {
      setText,
      setFilter,
      clearError,
      clearToast,
      addTodo,
      toggleTodo,
      removeTodo,
      // undoDelete,
      //showError,
      showToast
      //setError, // временно, если нужно
      //setToast, // временно, если нужно
    },
  }
  return result
}
