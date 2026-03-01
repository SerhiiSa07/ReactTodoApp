import type { Todo } from "../../types/todo";
import { memo, useEffect, useState } from "react";

type Props = {
  todo: Todo;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onEdit: (id: string, newText: string) => void;
  isPending: (id: string) => boolean;
  isDeleting: boolean;
  onUndoDelete: () => void
};

function useDelayed(value: boolean, delayMs: number) {
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    if (!value) {
      setDelayed(false);
      return;
    }

    const t = window.setTimeout(() => setDelayed(true), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);

  return delayed;
}

function TodoItem({ todo, onToggle, onRemove, isPending, isDeleting, onUndoDelete }: Props) {

const showSpinner = useDelayed(isPending, 200);

  return (
    <li
      className={[
        "flex items-center gap-3 bg-slate-900/40 border border-white/10 rounded-xl px-3 py-2 transition",
        isPending ? "opacity-70" : "",
      ].join(" ")}
    >

      <div> className={[
    "flex items-center gap-3 bg-slate-900/40 border border-white/10 rounded-xl px-3 py-2 transition",
    isDeleting ? "opacity-50" : "",
  ].join(" ")}
  </div>

      <button
        type="button"
        disabled={isPending}
        onClick={() => onToggle(todo.id)}
        className="h-5 w-5 flex items-center justify-center disabled:cursor-not-allowed"
        aria-label="toggle"
      >
        {showSpinner ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
        ) : (
          <div
            className={[
              "h-5 w-5 rounded border transition",
              todo.done
                ? "bg-green-500 border-green-500"
                : "border-slate-400 hover:border-white/40",
            ].join(" ")}
          />
        )}
      </button>

      <span
        className={[
          "flex-1",
          todo.done ? "line-through text-slate-400" : "text-white",
        ].join(" ")}
      >
        {todo.text}
      </span>

      <button
        type="button"
        disabled={isPending || isDeleting}
        onClick={() => onRemove(todo.id)}
        className={[
    "text-slate-300 hover:text-red-400",
    (isPending || isDeleting) ? "opacity-50 cursor-not-allowed hover:text-slate-300" : "",
  ].join(" ")}
        aria-label="delete"
      >
        ✕
      </button>
      {isDeleting && (
  <button
    type="button"
    onClick={onUndoDelete}
    className="text-xs px-2 py-1 rounded-lg border border-white/10 text-slate-200 hover:border-white/20"
  >
    Undo
  </button>
)}
    </li>
  );
}

export default memo(TodoItem);