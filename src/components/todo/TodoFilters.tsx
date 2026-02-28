import type { Filter } from "../../types/todo";

 type Props = {
  filter: Filter;
  total: number;
  doneCount: number;
  onChange: (next: Filter) => void;
  onMarkAll: () => void;
  onClearDone: () => void;
};

export default function TodoFilters({
  filter,
  total,
  doneCount,
  onChange,
  onMarkAll,
  onClearDone,
}: Props) {
  const btnClass = (active: boolean) =>
    [
      "px-3 py-1.5 rounded-lg text-sm border transition",
      active
        ? "bg-white/10 border-white/20 text-white"
        : "bg-transparent border-white/10 text-slate-300 hover:text-white hover:border-white/20",
    ].join(" ");

  return (
    <div className="mt-4 flex items-center justify-between gap-2">
      <div className="flex gap-2">
        <button type="button" className={btnClass(filter === "all")} onClick={() => onChange("all")}>
          All
        </button>
        <button
          type="button"
          className={btnClass(filter === "active")}
          onClick={() => onChange("active")}
        >
          Active
        </button>
        <button type="button" className={btnClass(filter === "done")} onClick={() => onChange("done")}>
          Done
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onMarkAll}
          disabled={total === 0}
          className="text-xs px-2 py-1 rounded-lg border border-white/10 text-slate-300 hover:text-white hover:border-white/20 disabled:opacity-40 disabled:hover:border-white/10"
        >
          Mark all
        </button>
        <button
          type="button"
          onClick={onClearDone}
          disabled={doneCount === 0}
          className="text-xs px-2 py-1 rounded-lg border border-white/10 text-slate-300 hover:text-white hover:border-white/20 disabled:opacity-40 disabled:hover:border-white/10"
        >
          Clear done
        </button>
      </div>
    </div>
  );
}