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
    <header className="flex items-center justify-between border-b border-[var(--color-navy-border)] bg-[var(--color-navy-mid)] px-6 py-4 text-slate-100">
      <div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          <span>Wardle Editorial</span>
          <ChevronRight className="h-3.5 w-3.5 text-[var(--color-teal)]" aria-hidden="true" />
          <span className="text-slate-300">{title}</span>
        </div>
        {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="flex items-center justify-end gap-2">
            <p className="text-sm font-medium text-slate-100">{displayName}</p>
            <span className="rounded-full border border-[var(--color-teal)]/40 bg-[var(--color-teal)]/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-teal)]">
              {role}
            </span>
          </div>
          <p className="text-xs text-slate-400">{email}</p>
        </div>
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  );
}
