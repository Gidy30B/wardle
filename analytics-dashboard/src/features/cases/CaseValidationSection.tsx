import type { ReactNode } from 'react';
import type { EditorialCaseValidationRun } from '../../api/admin';
import EmptyState from '../../components/ui/EmptyState';
import StatusBadge from '../../components/ui/StatusBadge';
import CaseDetailSection from './CaseDetailSection';
import StructuredDataView from './StructuredDataView';
import type {
  ValidationFindingIssue,
  ValidationIssueBuckets,
} from './case.transforms';
import { formatDateLabel, formatLabel } from './cases.helpers';

type CaseValidationSectionProps = {
  latestValidation: EditorialCaseValidationRun | null;
  validationIssues: ValidationFindingIssue[];
  validationBuckets: ValidationIssueBuckets;
};

function renderIssueList(
  title: string,
  issues: ValidationFindingIssue[],
  tone: 'danger' | 'warning' | 'info',
) {
  const toneClasses =
    tone === 'danger'
      ? 'border-rose-200 bg-rose-50'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50'
        : 'border-sky-200 bg-sky-50';

  return (
    <div className={['rounded-lg border p-3', toneClasses].join(' ')}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <span className="rounded-full border border-white/80 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
          {issues.length}
        </span>
      </div>

      {issues.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">None reported.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {issues.map((issue, index) => (
            <div
              key={`${issue.validator}-${issue.code}-${index}`}
              className="rounded-lg border border-white/80 bg-white px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                  {formatLabel(issue.validator)}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {issue.code}
                </span>
                {issue.path ? (
                  <span className="text-xs text-slate-500">{issue.path}</span>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-slate-800">{issue.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  valueNode,
}: {
  label: string;
  value?: string;
  valueNode?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-2 text-sm font-semibold text-slate-900">
        {valueNode ?? value}
      </dd>
    </div>
  );
}

export default function CaseValidationSection({
  latestValidation,
  validationIssues,
  validationBuckets,
}: CaseValidationSectionProps) {
  return (
    <CaseDetailSection
      title="Latest validation"
      description="The most recent automated validation result for the selected case."
    >
      {latestValidation ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Latest run status
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Version {latestValidation.validatorVersion ?? 'unknown'} - completed{' '}
                {formatDateLabel(
                  latestValidation.completedAt ?? latestValidation.startedAt,
                )}
              </p>
            </div>
            <StatusBadge status={latestValidation.outcome} kind="validation" />
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <SummaryStat
              label="Blockers"
              value={String(validationBuckets.blockers.length)}
            />
            <SummaryStat
              label="Warnings"
              value={String(validationBuckets.warnings.length)}
            />
            <SummaryStat
              label="Issues total"
              value={String(validationIssues.length)}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {renderIssueList('Blockers', validationBuckets.blockers, 'danger')}
            {renderIssueList('Warnings', validationBuckets.warnings, 'warning')}
          </div>

          <div className="rounded-lg bg-white px-3 py-3">
            <p className="text-sm font-semibold text-slate-900">Summary</p>
            <div className="mt-2">
              <StructuredDataView
                data={latestValidation.summary}
                emptyLabel="No validation summary returned."
              />
            </div>
          </div>

          <CaseDetailSection
            title="Raw validation payload"
            description="Expanded only when you need the full validation details."
            collapsible
            defaultOpen={false}
          >
            <div className="rounded-lg bg-white px-3 py-3">
              <p className="text-sm font-semibold text-slate-900">Findings</p>
              <div className="mt-2">
                <StructuredDataView
                  data={latestValidation.findings}
                  emptyLabel="No validation findings returned."
                />
              </div>
            </div>
          </CaseDetailSection>
        </div>
      ) : (
        <EmptyState
          title="No validation runs yet"
          description="Run validation to populate the latest validation section."
        />
      )}
    </CaseDetailSection>
  );
}
