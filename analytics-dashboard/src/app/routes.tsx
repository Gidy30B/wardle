import { SignIn } from '@clerk/clerk-react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import AnalyticsPage from '../features/analytics/AnalyticsPage';
import CasesPage from '../features/cases/CasesPage';
import DashboardPage from '../features/dashboard/DashboardPage';
import GeneratePage from '../features/generation/GeneratePage';
import PublishPage from '../features/publish/PublishPage';
import { useAdmin } from '../hooks/useAdmin';
import AdminLayout from '../layout/AdminLayout';

const routeContext: Record<string, { title: string; subtitle: string }> = {
  '/': {
    title: 'Overview',
    subtitle: 'Operational overview for case review and publishing',
  },
  '/dashboard': {
    title: 'Overview',
    subtitle: 'Operational overview for case review and publishing',
  },
  '/cases': {
    title: 'Cases',
    subtitle: 'Editorial review and clinical case management',
  },
  '/generate': {
    title: 'Generate Cases',
    subtitle: 'Create AI-assisted clinical cases',
  },
  '/analytics': {
    title: 'Analytics',
    subtitle: 'Gameplay and case-quality insights',
  },
  '/publish': {
    title: 'Publish',
    subtitle: 'Publish readiness and distribution health',
  },
};

function SignInScreen({
  path,
}: {
  path: '/' | '/cases' | '/generate' | '/analytics' | '/publish';
}) {
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
  const isCasesPath =
    location.pathname === '/cases' || location.pathname.startsWith('/cases/');
  const context = isCasesPath
    ? routeContext['/cases']
    : routeContext[location.pathname] ?? routeContext['/'];
  const signInPath: '/' | '/cases' | '/generate' | '/analytics' | '/publish' =
    isCasesPath
      ? '/cases'
      : location.pathname === '/generate'
        ? '/generate'
        : location.pathname === '/analytics'
          ? '/analytics'
          : location.pathname === '/publish'
            ? '/publish'
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
        <Route path="/cases/:caseId" element={<CasesPage />} />
        <Route path="/generate" element={<GeneratePage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/publish" element={<PublishPage />} />
        <Route path="/admin" element={<Navigate to="/" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
