import { NavLink } from 'react-router-dom';

const navigationItems = [
  { to: '/', label: 'Dashboard', icon: 'D', end: true },
  { to: '/cases', label: 'Cases', icon: 'C' },
  { to: '/generate', label: 'Generate', icon: 'G' },
  { to: '/analytics', label: 'Analytics', icon: 'A' },
];

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={`shrink-0 border-r border-slate-200 bg-white transition-all duration-200 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className={`border-b border-slate-200 ${collapsed ? 'px-3 py-4' : 'px-5 py-4'}`}>
        <div className="flex items-center justify-between gap-2">
          {collapsed ? (
            <h1 className="text-sm font-semibold text-slate-900">WA</h1>
          ) : (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Control Panel
              </p>
              <h1 className="mt-2 text-lg font-semibold text-slate-900">Wardle Admin</h1>
            </div>
          )}

          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            {collapsed ? '>>' : '<<'}
          </button>
        </div>
      </div>

      <nav className="space-y-1 px-3 py-4">
        {navigationItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              [
                'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition',
                collapsed ? 'justify-center' : 'gap-3',
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              ].join(' ')
            }
          >
            <span
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold ${
                collapsed
                  ? 'border-slate-300 bg-slate-100 text-slate-700'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
              aria-hidden="true"
            >
              {item.icon}
            </span>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
