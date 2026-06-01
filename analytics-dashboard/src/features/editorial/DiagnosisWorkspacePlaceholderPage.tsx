import { Link, useParams } from 'react-router-dom';

export default function DiagnosisWorkspacePlaceholderPage() {
  const { diagnosisRegistryId } = useParams<{ diagnosisRegistryId: string }>();

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          Diagnosis Workspace
        </p>
        <h2 className="mt-2 text-lg font-semibold text-slate-900">
          Editorial workspace placeholder
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Phase 12A only creates the route foundation. The full workspace read model
          and migrated cards will arrive in later phases.
        </p>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Diagnosis Registry ID
          </p>
          <p className="mt-2 break-all font-mono text-sm text-slate-900">
            {diagnosisRegistryId ?? 'Not provided'}
          </p>
        </div>
        <Link
          to="/editorial"
          className="mt-4 inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          Back to editorial
        </Link>
      </section>
    </div>
  );
}
