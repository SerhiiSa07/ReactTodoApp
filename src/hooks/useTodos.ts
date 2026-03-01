import { useCallback, useMemo, useState } from "react";
import type { Todo } from "../types/todo";
import {readJson, writeJson} from "../utils/storage";

type Filter = "all" | "active" | "done";

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

export function useTodos() {

  // 1) STATE
  const [text, setText] = useState("");
  const [todos, setTodos] = useState<Todo[]>(() => loadTodos());
  const [filter, setFilter] = useState<Filter>("all");

  const [error, setError] = useState<string | null>(null);
 // const [toast, setToast] = useState<ToastState | null>(null);
const toast = null as ToastState | null;
const setToast = () => {};


  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

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

  return {
    state: {
      text,
      filter,
      todos,
      visibleTodos,
      stats,
      error,
      toast,
      isDeleting,
      isPending
    },
    actions: {
      setText,
      setFilter,
      setPendingIds,
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
  };
}