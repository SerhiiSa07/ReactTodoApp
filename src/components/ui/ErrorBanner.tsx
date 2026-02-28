import { useEffect, useState } from "react";

type Props = {
  message: string;
  onClose: () => void;
  visibleMs?: number; // сколько показывать до fade
  fadeMs?: number;    // длительность fade
};

export default function ErrorBanner({
  message,
  onClose,
  visibleMs = 2500,
  fadeMs = 300,
}: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // при новом сообщении показываем заново
    setShow(true);

    const t1 = window.setTimeout(() => setShow(false), visibleMs);
    const t2 = window.setTimeout(() => onClose(), visibleMs + fadeMs);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [message, onClose, visibleMs, fadeMs]);

  return (
    <div
      className={[
        "mt-2 text-sm rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2",
        "transition-opacity duration-300",
        show ? "opacity-100" : "opacity-0",
      ].join(" ")}
      role="alert"
    >
      {message}
    </div>
  );
}