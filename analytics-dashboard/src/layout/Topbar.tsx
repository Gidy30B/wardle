import { UserButton } from '@clerk/clerk-react';

type TopbarProps = {
  title: string;
  subtitle?: string;
  displayName: string;
  email: string;
  role: string;
};

export default function Topbar({ title, subtitle, displayName, email, role }: TopbarProps) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          DxLab Admin
        </p>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="flex items-center justify-end gap-2">
            <p className="text-sm font-medium text-slate-900">{displayName}</p>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              {role}
            </span>
          </div>
          <p className="text-xs text-slate-500">{email}</p>
        </div>
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  );
}
