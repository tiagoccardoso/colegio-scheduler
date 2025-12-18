export function Flash({
  message,
  variant = "info",
}: {
  message?: string | null;
  variant?: "info" | "success" | "error";
}) {
  if (!message) return null;

  const cls =
    variant === "error"
      ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100"
      : variant === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100"
      : "border-zinc-200 bg-white text-zinc-800 dark:border-zinc-900 dark:bg-zinc-950 dark:text-zinc-200";

  return <div className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${cls}`}>{message}</div>;
}
