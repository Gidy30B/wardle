import { useState, type ReactNode } from 'react';
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
};

export default function AdminLayout({
  children,
  title,
  subtitle,
  user,
}: AdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((previous) => !previous)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={title}
          subtitle={subtitle}
          displayName={user.displayName}
          email={user.email}
          role={user.role}
        />
        <main className="min-w-0 flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
