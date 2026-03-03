import { useEffect } from "react";

type Props = {
  message: string
  kind?: "success" | "error"; 
  ms?: number;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
};

export default function Toast({
  message,
  kind = "success",
  onClose,
  ms = 1400,
  actionLabel,
  onAction,
}: Props) {
  useEffect(() => {
    const t = window.setTimeout(onClose, ms);
    return () => window.clearTimeout(t);
  }, [onClose, ms]);

  const styles =
    kind === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
      : "border-red-500/30 bg-red-500/10 text-red-100";

  return (
    <div
      className={[
        "fixed right-4 top-4 z-[9999]",
        "rounded-xl border px-3 py-2 text-sm shadow",
        "backdrop-blur",
        styles,
      ].join(" ")}
      role="status"
    >
      <div className="flex items-center gap-3">
        <div className="flex-1">{message}</div>

        {actionLabel && onAction && (
          <button type="button" onClick={onAction}> {actionLabel} </button>
        )}
      </div>
    </div>
  );
}