import type { ReactNode } from "react";

export function ReviewSection({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "teal" | "amber";
  children: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <p
        className={`mb-2 font-brand-mono text-[10px] font-bold uppercase tracking-[0.18em] ${
          tone === "teal"
            ? "text-[var(--wardle-color-teal)]/70"
            : "text-[var(--wardle-color-amber)]/75"
        }`}
      >
        {title}
      </p>
      {children}
    </section>
  );
}
