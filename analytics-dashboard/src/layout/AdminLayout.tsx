import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

type AdminLayoutProps = {
  children: ReactNode;
  title: string;
  subtitle?: string;
  user: {
    displayName: string;
    email: string;
    role: string;
  };
  access: {
    canAccessEditorial: boolean;
    canAccessAdminOps: boolean;
  };
};

export default function AdminLayout({
  children,
  title,
  subtitle,
  user,
  access,
}: AdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const editorialShell = location.pathname.startsWith('/editorial');

  return (
    <div className="flex h-screen flex-col bg-[var(--color-navy)] text-slate-100 md:flex-row">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((previous) => !previous)}
        canAccessEditorial={access.canAccessEditorial}
        canAccessAdminOps={access.canAccessAdminOps}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Topbar
          title={title}
          subtitle={subtitle}
          displayName={user.displayName}
          email={user.email}
          role={user.role}
        />
        <main
          className={`min-w-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,var(--color-navy)_0%,#0a1424_100%)] ${
            editorialShell ? 'p-3 sm:p-4 lg:p-5' : 'p-4 sm:p-6'
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
