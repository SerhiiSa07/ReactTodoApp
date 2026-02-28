import { useCallback, useEffect, useMemo, useState } from "react";
import type { Filter, Todo } from "../types/todo";
import { readJson, writeJson } from "../utils/storage";
import { apiGetTodos, apiCreateTodo, apiPatchTodo, apiDeleteTodo } from "../utils/api";

type ToastState = {
  message: string;
  kind?: "success" | "error";
  ms?: number;
  actionLabel?: string;
  onAction?: () => void;
};

type PendingDelete = {
  todo: Todo | null;
  index: number;
  timerId: number;
};

const STORAGE_KEY = "todos:v1";

function isTodo(x: unknown): x is Todo {
  return (
    !!x &&
    typeof x === "object" &&
    typeof (x as { id?: unknown }).id === "string" &&
    typeof (x as { text?: unknown }).text === "string" &&
    typeof (x as { done?: unknown }).done === "boolean"
  );
}

function loadTodos(): Todo[] {
  const parsed = readJson<unknown>(STORAGE_KEY, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isTodo);
}

export function useTodos() {

  console.log("useTodos render");

  const [text, setText] = useState("");
  const [todos, setTodos] = useState<Todo[]>(() => loadTodos());
  const [filter, setFilter] = useState<Filter>("all");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); 

  const [pendingCount, setPendingCount] = useState(0);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const isBusy = pendingCount > 0;

  const [toast, setToast] = useState<ToastState | null>(null);

  const [pendingDelete, setPendingDelete] = useState<{
  todo: Todo;
  index: number;
  timerId: number;
} | null>(null);

  const beginGlobal = useCallback(() => {
  setPendingCount((c) => c + 1);
}, []);

  const endGlobal = useCallback(() => {
  setPendingCount((c) => Math.max(0, c - 1));
}, []);

 useEffect(() => {
  writeJson(STORAGE_KEY, todos);
}, [todos]);

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


const isPending = useCallback((id: string) => pendingIds.has(id), [pendingIds]);

  const markPending = useCallback((id: string, pending: boolean) => {
  setPendingIds((prev) => {
    const next = new Set(prev);
    if (pending) next.add(id);
    else next.delete(id);
    return next;
  });
}, []);


const addTodo = useCallback(async () => {
  const trimmed = text.trim();
  if (!trimmed) return;

  const temp: Todo = { id: crypto.randomUUID(), text: trimmed, done: false };

  beginGlobal();
  setTodos((prev) => [temp, ...prev]);
  setText("");

  try {
    const saved = await apiCreateTodo(temp);
    setTodos((prev) => prev.map((t) => (t.id === temp.id ? saved : t)));
    setToast("Added ✅");
  } catch (e) {
    setTodos((prev) => prev.filter((t) => t.id !== temp.id));
    setError(e instanceof Error ? e.message : "Failed to create todo");
  } finally {
    endGlobal();
  }
}, [text, beginGlobal, endGlobal]);

const editTodo = useCallback(async (id: string, newText: string) => {
  const trimmed = newText.trim();
  if (!trimmed) return;

  let prevText: string | null = null;

  // optimistic update + запоминаем prevText
  setTodos((prev) =>
    prev.map((t) => {
      if (t.id !== id) return t;
      prevText = t.text;
      return { ...t, text: trimmed };
    })
  );

  try {
    await apiPatchTodo(id, { text: trimmed });
  } catch (e) {
    // rollback
    if (prevText === null) return;

    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, text: prevText! } : t))
    );

    setError(e instanceof Error ? e.message : "Failed to edit todo");
  }
}, []);

const toggleTodo = useCallback(async (id: string) => {
  let prevDone: boolean | null = null;
  let nextDone: boolean | null = null;

  // 1) optimistic update + сохраняем старое/новое значение
  setTodos((prev) =>
    prev.map((t) => {
      if (t.id !== id) return t;
      prevDone = t.done;
      nextDone = !t.done;
      return { ...t, done: !t.done };
    })
  );

  try {
    // 2) подтверждаем на сервере
    if (nextDone === null) return; // id не найден
    await apiPatchTodo(id, { done: nextDone });
  } catch (e) {
    // 3) rollback если сервер не принял
    if (prevDone === null) return;

    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: prevDone! } : t))
    );

    setError(e instanceof Error ? e.message : "Failed to toggle todo");
  }
}, []);

const undoDelete = useCallback(() => {
  if (!pendingDelete) return;
  window.clearTimeout(pendingDelete.timerId);
  setPendingDelete(null);
}, [pendingDelete]);


const finalizePendingDelete = useCallback(async (op: {
  todo: Todo;
  index: number;
  timerId: number;
}) => {
  window.clearTimeout(op.timerId);

  try {
    await apiDeleteTodo(op.todo.id);
  } catch (e) {
    // rollback
    setTodos((prev) => {
      if (prev.some((t) => t.id === op.todo.id)) return prev;
      const next = [...prev];
      next.splice(op.index, 0, op.todo);
      return next;
    });
    setError(e instanceof Error ? e.message : "Failed to delete todo");
  } finally {
    setPendingDelete((cur) => (cur?.todo.id === op.todo.id ? null : cur));
  }
}, []);

const removeTodo = useCallback(
  (id: string) => {
    // если было предыдущее “Undo” — финализируем именно его
    if (pendingDelete) {
      void finalizePendingDelete(pendingDelete);
    }

    let removed: Todo | null = null;
    let removedIndex = 0;

    // НЕ удаляем из UI, просто находим todo
setTodos((prev) => {
  const idx = prev.findIndex((t) => t.id === id);
  if (idx === -1) return prev;
  removedIndex = idx;
  removed = prev[idx];
  return prev;
});

if (!removed) return;

const op = {
  todo: removed,
  index: removedIndex,
  timerId: window.setTimeout(() => {
    // вот тут уже реально удалим из массива и сервера
    void (async () => {
      try {
        await apiDeleteTodo(op.todo.id);
        setTodos((prev) => prev.filter((t) => t.id !== op.todo.id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete todo");
      } finally {
        setPendingDelete(null);
      }
    })();
  }, 3000),
};

setPendingDelete(op);

    setToast({
      message: "Deleted",
      kind: "success",
      ms: 3000,
      actionLabel: "Undo",
      onAction: () => {
  window.clearTimeout(op.timerId);
  setPendingDelete(null);
},
    });
  },
  [pendingDelete, finalizePendingDelete]
);

 const clearToast = useCallback(() => setToast(null), []);

const isDeleting = useCallback(
  (id: string) => pendingDelete?.todo.id === id,
  [pendingDelete]
);

  const clearCompleted = useCallback(() => {
  setTodos((prev) => prev.filter((t) => !t.done));
}, []);

  const setAllDone = useCallback((nextDone: boolean) => {
  setTodos((prev) => prev.map((t) => ({ ...t, done: nextDone })));
}, []);
  const markAllDone = useCallback(() => {
  setAllDone(true);
}, [setAllDone]);

const clearError = useCallback(() => setError(null), []);

  const beginId = useCallback((id: string) => {
  setPendingIds((prev) => {
    const next = new Set(prev);
    next.add(id);
    return next;
  });
}, []);

  const endId = useCallback((id: string) => {
  setPendingIds((prev) => {
    const next = new Set(prev);
    next.delete(id);
    return next;
  });
}, []);


    return {
    state: {
      text,
      filter,
      todos,
      visibleTodos,
      stats,
      isPending,
      isDeleting,
      error,
      toast 
    },
    actions: {
      clearError,
      setText,
      setFilter,
      addTodo,
      toggleTodo,
      removeTodo,
      undoDelete,
      //editTodo,
      //clearCompleted,
      setAllDone,
      //markAllDone, // если ты уже добавил
      clearToast 
    },
  };
}