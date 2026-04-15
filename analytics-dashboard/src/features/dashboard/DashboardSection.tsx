import type { ReactNode } from 'react';

type DashboardSectionProps = {
  eyebrow?: string;
  title: string;
  description: string;
  children: ReactNode;
};

export default function DashboardSection({
  eyebrow,
  title,
  description,
  children,
}: DashboardSectionProps) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <div className="mb-5 space-y-2">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            {eyebrow}
          </p>
        ) : null}
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>

      {children}
    </section>
  );
}
