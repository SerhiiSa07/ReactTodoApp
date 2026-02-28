import { useCallback, useMemo, useState } from "react";
import type { Todo } from "../types/todo";



type Filter = "all" | "active" | "done";

type ToastState = {
  message: string;
  kind?: "success" | "error";
  ms?: number;
  actionLabel?: string;
  onAction?: () => void;
};

type PendingDelete = {
  todo: Todo;
  index: number;
  timerId: number;
};

const STORAGE_KEY = "todos";

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

function saveTodos(todos: Todo[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch {
    // noop
  }
}

export function useTodos() {
  // 1) STATE
  const [text, setText] = useState("");
  const [todos, setTodos] = useState<Todo[]>(() => loadTodos());
  const [filter, setFilter] = useState<Filter>("all");

  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

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

  const isDeleting = useCallback(
    (id: string) => pendingDelete?.todo.id === id,
    [pendingDelete]
  );

  // 3) HELPERS
  const clearError = useCallback(() => setError(null), []);
  const clearToast = useCallback(() => setToast(null), []);

  const undoDelete = useCallback(() => {
    if (!pendingDelete) return;
    window.clearTimeout(pendingDelete.timerId);
    setPendingDelete(null);
  }, [pendingDelete]);

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
    setToast({ message: "Added ✅", kind: "success", ms: 1200 });
  }, [text]);

  const toggleTodo = useCallback((id: string) => {
    setTodos((prev) => {
      const updated = prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
      saveTodos(updated);
      return updated;
    });
  }, []);

  const removeTodo = useCallback((id: string) => {
    // soft delete: помечаем как удаляемую, не удаляем из массива сразу
    const idx = todos.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const todo = todos[idx];

    if (pendingDelete) {
      // если уже было pending удаление — просто сбрасываем его (last-only)
      window.clearTimeout(pendingDelete.timerId);
      setPendingDelete(null);
    }

    const timerId = window.setTimeout(() => {
      setTodos((prev) => {
        const updated = prev.filter((t) => t.id !== todo.id);
        saveTodos(updated);
        return updated;
      });
      setPendingDelete(null);
    }, 3000);

    setPendingDelete({ todo, index: idx, timerId });
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
  }, [todos, pendingDelete]);

  return {
    state: {
      text,
      setText,
      filter,
      setFilter,
      todos,
      visibleTodos,
      stats,
      error,
      toast,
      isDeleting,
    },
    actions: {
      clearError,
      clearToast,
      addTodo,
      toggleTodo,
      removeTodo,
      undoDelete,
      setError, // временно, если нужно
      setToast, // временно, если нужно
    },
  };
}