import type { ReactNode } from "react";

export function InlineAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
    >
      {children}
    </div>
  );
}
