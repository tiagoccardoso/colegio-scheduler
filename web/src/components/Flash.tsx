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
      ? "flash flash-error"
      : variant === "success"
        ? "flash flash-success"
        : "flash flash-info";

  return <div className={cls}>{message}</div>;
}
