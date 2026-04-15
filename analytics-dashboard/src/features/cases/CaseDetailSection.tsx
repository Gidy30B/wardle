import type { ReactNode } from 'react';

type CaseDetailSectionProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
};

export default function CaseDetailSection({
  title,
  description,
  actions,
  children,
  collapsible = false,
  defaultOpen = true,
}: CaseDetailSectionProps) {
  if (collapsible) {
    return (
      <details
        className="rounded-xl border border-slate-200 bg-slate-50 p-4"
        open={defaultOpen}
      >
        <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            {description ? (
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            {actions}
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Toggle
            </span>
          </div>
        </summary>

        <div className="mt-4">{children}</div>
      </details>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {description ? (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>

      {children}
    </section>
  );
}
