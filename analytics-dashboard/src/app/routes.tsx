import { SignIn } from '@clerk/clerk-react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import AnalyticsPage from '../features/analytics/AnalyticsPage';
import CasesPage from '../features/cases/CasesPage';
import DashboardPage from '../features/dashboard/DashboardPage';
import GeneratePage from '../features/generation/GeneratePage';
import { useAdmin } from '../hooks/useAdmin';
import AdminLayout from '../layout/AdminLayout';

const routeContext: Record<string, { title: string; subtitle: string }> = {
  '/': {
    title: 'Dashboard',
    subtitle: 'System overview and performance',
  },
  '/dashboard': {
    title: 'Dashboard',
    subtitle: 'System overview and performance',
  },
  '/cases': {
    title: 'Cases',
    subtitle: 'Review and manage clinical cases',
  },
  '/generate': {
    title: 'Generate Cases',
    subtitle: 'Create new AI-generated cases',
  },
  '/analytics': {
    title: 'Analytics',
    subtitle: 'Track quality and gameplay trends',
  },
};

function SignInScreen({ path }: { path: '/' | '/cases' | '/generate' | '/analytics' }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <SignIn routing="path" path={path} />
      </div>
    </div>
  );
}

function AdminShell() {
  const location = useLocation();
  const admin = useAdmin();
  const context = routeContext[location.pathname] ?? routeContext['/'];
  const signInPath =
    location.pathname === '/cases' ||
    location.pathname === '/generate' ||
    location.pathname === '/analytics'
      ? (location.pathname as '/' | '/cases' | '/generate' | '/analytics')
      : '/';

  if (admin.status === 'loading') {
    return <p className="p-6 text-sm text-slate-600">Loading admin console...</p>;
  }

  if (admin.status === 'signed-out') {
    return <SignInScreen path={signInPath} />;
  }

  if (admin.status === 'error') {
    return (
      <div className="p-6 text-sm text-red-600">
        {admin.error ?? 'Unable to verify admin access'}
      </div>
    );
  }

  if (admin.status === 'unauthorized') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Access Restricted
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            Admin privileges required
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Your signed-in account does not have the admin role needed to view this console.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout
      title={context.title}
      subtitle={context.subtitle}
      user={{
        displayName: admin.displayName,
        email: admin.email,
        role: admin.role,
      }}
    >
      <Outlet />
    </AdminLayout>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AdminShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/cases" element={<CasesPage />} />
        <Route path="/generate" element={<GeneratePage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/admin" element={<Navigate to="/generate" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
