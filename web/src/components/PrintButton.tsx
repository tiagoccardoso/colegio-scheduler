"use client";

export function PrintButton({
  children = "Imprimir",
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        window.print();
      }}
      className={
        className ??
        "rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      }
    >
      {children}
    </button>
  );
}
