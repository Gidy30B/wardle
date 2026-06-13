import { UserButton } from '@clerk/clerk-react';
import { ChevronRight } from 'lucide-react';

type TopbarProps = {
  title: string;
  subtitle?: string;
  displayName: string;
  email: string;
  role: string;
};

export default function Topbar({ title, subtitle, displayName, email, role }: TopbarProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-navy-border)] bg-[var(--color-navy-mid)] px-3 py-2.5 text-slate-100 sm:px-5 sm:py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          <span className="hidden sm:inline">Wardle Editorial</span>
          <ChevronRight className="h-3.5 w-3.5 text-[var(--color-teal)]" aria-hidden="true" />
          <span className="max-w-[70vw] truncate text-slate-300 sm:max-w-none">
            {title}
          </span>
        </div>
        {subtitle ? (
          <p className="mt-0.5 hidden max-w-[68vw] truncate text-sm text-slate-400 md:block">
            {subtitle}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <div className="hidden text-right sm:block">
          <div className="flex items-center justify-end gap-2">
            <p className="text-sm font-medium text-slate-100">{displayName}</p>
            <span className="rounded-full border border-[var(--color-teal)]/40 bg-[var(--color-teal)]/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-teal)]">
              {role}
            </span>
          </div>
          <p className="hidden text-xs text-slate-400 lg:block">{email}</p>
        </div>
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  );
}
