import { NavLink } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  BookOpen,
  BrainCircuit,
  ClipboardList,
  GitMerge,
  GitPullRequest,
  Home,
  Layers3,
  Network,
  PenLine,
  Send,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

const editorialNavigationItems = [
  { to: '/editorial', label: 'Editorial', icon: PenLine },
  { to: '/editorial/workspace', label: 'Workspace Queue', icon: Layers3 },
  { to: '/editorial/inbox', label: 'Review Inbox', icon: ClipboardList },
  { to: '/editorial/coverage', label: 'Coverage Dashboard', icon: BarChart3 },
  { to: '/editorial/planner', label: 'Curriculum Planner', icon: BookOpen },
  { to: '/editorial/differentials', label: 'Differentials', icon: GitMerge },
  { to: '/editorial/registry-candidates', label: 'Registry Queue', icon: GitPullRequest },
];

const administrationNavigationItems = [
  { to: '/', label: 'Overview', icon: Home, end: true },
  { to: '/cases', label: 'Cases', icon: Activity },
  { to: '/generate', label: 'Generate Cases', icon: Sparkles },
  { to: '/publish', label: 'Publish', icon: Send },
  { to: '/diagnosis-graph/candidates', label: 'Graph', icon: Network },
  { to: '/analytics', label: 'Analytics', icon: BrainCircuit },
];

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  canAccessEditorial: boolean;
  canAccessAdminOps: boolean;
};

function NavigationGroup({
  title,
  collapsed,
  items,
}: {
  title: string;
  collapsed: boolean;
  items: Array<{ to: string; label: string; icon: LucideIcon; end?: boolean }>;
}) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="space-y-1">
      {!collapsed ? (
        <p className="px-3 pt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          {title}
        </p>
      ) : null}
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            [
              'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition',
              collapsed ? 'justify-center' : 'gap-3',
              isActive
                ? 'bg-[var(--color-teal)]/12 text-[var(--color-teal)] ring-1 ring-[var(--color-teal)]/30'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
            ].join(' ')
          }
        >
          <item.icon
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold ${
              collapsed
                ? 'border-[var(--color-navy-border)] bg-white/5 p-1.5'
                : 'border-[var(--color-navy-border)] bg-white/5 p-1.5'
            }`}
            aria-hidden="true"
          />
          {!collapsed && <span>{item.label}</span>}
        </NavLink>
      ))}
    </div>
  );
}

export default function Sidebar({
  collapsed,
  onToggle,
  canAccessEditorial,
  canAccessAdminOps,
}: SidebarProps) {
  const editorialItems = canAccessEditorial ? editorialNavigationItems : [];
  const administrationItems = canAccessAdminOps
    ? administrationNavigationItems
    : [];

  return (
    <aside
      className={`shrink-0 border-r border-[var(--color-navy-border)] bg-[var(--color-navy-mid)] transition-all duration-200 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div
        className={`border-b border-[var(--color-navy-border)] ${collapsed ? 'px-3 py-4' : 'px-5 py-4'}`}
      >
        <div className="flex items-center justify-between gap-2">
          {collapsed ? (
            <h1 className="text-sm font-semibold text-[var(--color-teal)]">WD</h1>
          ) : (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Editorial Console
              </p>
              <h1 className="mt-2 text-lg font-semibold text-slate-100">
                Wardle
              </h1>
            </div>
          )}

          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 px-2 py-1 text-xs font-semibold text-slate-300 transition hover:bg-white/10"
          >
            {collapsed ? '>>' : '<<'}
          </button>
        </div>
      </div>

      <nav className="space-y-4 px-3 py-4">
        <NavigationGroup
          title="Editorial"
          collapsed={collapsed}
          items={editorialItems}
        />
        <NavigationGroup
          title="Administration"
          collapsed={collapsed}
          items={administrationItems}
        />
      </nav>
    </aside>
  );
}
