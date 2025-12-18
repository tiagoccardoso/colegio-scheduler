"use client";

export function ConfirmButton({
  children,
  confirmText,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { confirmText: string }) {
  return (
    <button
      {...props}
      className={className}
      onClick={(e) => {
        if (!confirm(confirmText)) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        props.onClick?.(e);
      }}
    >
      {children}
    </button>
  );
}
