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
      className={className ?? "btn btn-primary"}
    >
      {children}
    </button>
  );
}
