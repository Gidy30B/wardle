import { AuthenticateWithRedirectCallback, SignIn } from '@clerk/clerk-react';
import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useConsoleAccess } from '../hooks/useConsoleAccess';
import AdminLayout from '../layout/AdminLayout';

const AnalyticsPage = lazy(() => import('../features/analytics/AnalyticsPage'));
const CasesPage = lazy(() => import('../features/cases/CasesPage'));
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage'));
const DiagnosisGraphCandidatesPage = lazy(
  () => import('../features/diagnosis-graph/DiagnosisGraphCandidatesPage'),
);
const EditorialDiagnosisWorkspacePage = lazy(
  () => import('../features/editorial/EditorialDiagnosisWorkspacePage'),
);
const EditorialWorkspaceQueuePage = lazy(
  () => import('../features/editorial/EditorialWorkspaceQueuePage'),
);
const EditorialCoverageDashboardPage = lazy(
  () => import('../features/editorial/EditorialCoverageDashboardPage'),
);
const CurriculumPlannerPage = lazy(
  () => import('../features/editorial/CurriculumPlannerPage'),
);
const EditorialHomePage = lazy(
  () => import('../features/editorial/EditorialHomePage'),
);
const EditorialReviewInboxPage = lazy(
  () => import('../features/editorial/EditorialReviewInboxPage'),
);
const RegistryCandidatesPage = lazy(
  () => import('../features/editorial/RegistryCandidatesPage'),
);
const RegistryMergeAnalysisPage = lazy(
  () => import('../features/editorial/RegistryMergeAnalysisPage'),
);
const UnresolvedDifferentialsPage = lazy(
  () => import('../features/editorial/UnresolvedDifferentialsPage'),
);
const GeneratePage = lazy(() => import('../features/generation/GeneratePage'));
const PublishPage = lazy(() => import('../features/publish/PublishPage'));

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
  '/diagnosis-graph/candidates': {
    title: 'Diagnosis Graph',
    subtitle: 'Review extracted graph candidates before promotion',
  },
  '/publish': {
    title: 'Publish',
    subtitle: 'Publish readiness and distribution health',
  },
  '/editorial': {
    title: 'Editorial',
    subtitle: 'Diagnosis-centered editorial workspace foundation',
  },
  '/editorial/inbox': {
    title: 'Review Inbox',
    subtitle: 'Unified editorial review queues',
  },
  '/editorial/coverage': {
    title: 'Coverage Dashboard',
    subtitle: 'Curriculum coverage, inventory, graph, and teaching gaps',
  },
  '/editorial/planner': {
    title: 'Curriculum Planner',
    subtitle: 'Prioritized editorial roadmap from coverage gaps',
  },
  '/editorial/differentials': {
    title: 'Differentials',
    subtitle: 'Resolve differential text into registry-linked diagnoses',
  },
  '/editorial/registry-candidates': {
    title: 'Registry Candidates',
    subtitle: 'Review proposed diagnosis registry entries before creation',
  },
};

function SignInScreen({
  path,
}: {
  path: '/' | '/cases' | '/generate' | '/analytics' | '/publish' | '/editorial';
}) {
  const redirectUrl = new URL(path, window.location.origin).toString();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <SignIn
          routing="path"
          path={path}
          fallbackRedirectUrl={redirectUrl}
          forceRedirectUrl={redirectUrl}
        />
      </div>
    </div>
  );
}

function AdminShell() {
  const location = useLocation();
  const access = useConsoleAccess();
  const isCasesPath =
    location.pathname === '/cases' || location.pathname.startsWith('/cases/');
  const isEditorialPath =
    location.pathname === '/editorial' ||
    location.pathname.startsWith('/editorial/');
  const isEditorialAccessPath =
    isEditorialPath ||
    isCasesPath ||
    location.pathname === '/diagnosis-graph/candidates' ||
    location.pathname === '/publish';
  const context =
    routeContext[location.pathname] ??
    (isCasesPath
      ? routeContext['/cases']
      : isEditorialPath
        ? routeContext['/editorial']
        : routeContext['/']);
  const signInPath:
    | '/'
    | '/cases'
    | '/generate'
    | '/analytics'
    | '/publish'
    | '/editorial' = isCasesPath
    ? '/cases'
    : isEditorialPath
      ? '/editorial'
      : location.pathname === '/generate'
        ? '/generate'
        : location.pathname === '/analytics'
          ? '/analytics'
          : location.pathname === '/publish'
            ? '/publish'
            : '/';

  if (access.status === 'loading') {
    return (
      <p className="p-6 text-sm text-slate-600">Loading admin console...</p>
    );
  }

  if (access.status === 'signed-out') {
    return <SignInScreen path={signInPath} />;
  }

  if (access.status === 'error') {
    return (
      <div className="p-6 text-sm text-red-600">
        {access.error ?? 'Unable to verify console access'}
      </div>
    );
  }

  if (
    access.status === 'unauthorized' ||
    (isEditorialAccessPath && !access.canAccessEditorial) ||
    (!isEditorialAccessPath && !access.canAccessAdminOps)
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Access Restricted
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            Access privileges required
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Your signed-in account does not have the role needed to view this
            console area.
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
        displayName: access.displayName,
        email: access.email,
        role: access.role,
      }}
      access={{
        canAccessEditorial: access.canAccessEditorial,
        canAccessAdminOps: access.canAccessAdminOps,
      }}
    >
      <Outlet />
    </AdminLayout>
  );
}

function RouteFallback() {
  return (
    <p className="p-6 text-sm text-slate-500">Loading workspace route...</p>
  );
}

function lazyPage(page: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{page}</Suspense>;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/sso-callback"
        element={
          <AuthenticateWithRedirectCallback
            redirectUrl={new URL('/', window.location.origin).toString()}
          />
        }
      />
      <Route element={<AdminShell />}>
        <Route path="/" element={lazyPage(<DashboardPage />)} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/cases" element={lazyPage(<CasesPage />)} />
        <Route path="/cases/:caseId" element={lazyPage(<CasesPage />)} />
        <Route path="/generate" element={lazyPage(<GeneratePage />)} />
        <Route path="/analytics" element={lazyPage(<AnalyticsPage />)} />
        <Route path="/publish" element={lazyPage(<PublishPage />)} />
        <Route path="/editorial" element={lazyPage(<EditorialHomePage />)} />
        <Route
          path="/editorial/inbox"
          element={lazyPage(<EditorialReviewInboxPage />)}
        />
        <Route
          path="/editorial/coverage"
          element={lazyPage(<EditorialCoverageDashboardPage />)}
        />
        <Route
          path="/editorial/planner"
          element={lazyPage(<CurriculumPlannerPage />)}
        />
        <Route
          path="/editorial/differentials"
          element={lazyPage(<UnresolvedDifferentialsPage />)}
        />
        <Route
          path="/editorial/registry-candidates"
          element={lazyPage(<RegistryCandidatesPage />)}
        />
        <Route
          path="/editorial/registry-merge"
          element={lazyPage(<RegistryMergeAnalysisPage />)}
        />
        <Route
          path="/editorial/workspace"
          element={lazyPage(<EditorialWorkspaceQueuePage />)}
        />
        <Route
          path="/editorial/diagnoses/:diagnosisRegistryId"
          element={lazyPage(<EditorialDiagnosisWorkspacePage />)}
        />
        <Route
          path="/diagnosis-graph/candidates"
          element={lazyPage(<DiagnosisGraphCandidatesPage />)}
        />
        <Route
          path="/admin/diagnosis-graph/candidates"
          element={<Navigate to="/diagnosis-graph/candidates" replace />}
        />
        <Route path="/admin" element={<Navigate to="/" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
