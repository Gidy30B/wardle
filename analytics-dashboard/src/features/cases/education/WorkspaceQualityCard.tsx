import type {
  EducationRegenerableSection,
  DiagnosisWorkspaceProjection,
  WorkspaceSectionFailureSummary,
  WorkspaceCoverageWarning,
} from '../../../api/admin';
import LoadingState from '../../../components/ui/LoadingState';
import StatusBadge from '../../../components/ui/StatusBadge';
import {
  dedupeWarnings,
  formatScore,
  formatScoreLabel,
  formatSectionLabel,
  formatWorkspaceWarning,
  scoreTone,
} from './workspaceQualityFormatting';

type WorkspaceQualityCardProps = {
  projection: DiagnosisWorkspaceProjection | null;
  loading: boolean;
  error: string | null;
  legacyWarnings: string[];
  legacyBlockers: string[];
  pendingAction?: string | null;
  onRegenerateSection?: (section: EducationRegenerableSection) => void;
};

const visibleWarningLimit = 6;

export default function WorkspaceQualityCard({
  projection,
  loading,
  error,
  legacyWarnings,
  legacyBlockers,
  pendingAction,
  onRegenerateSection,
}: WorkspaceQualityCardProps) {
  if (loading && !projection) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <LoadingState
          title="Loading editorial quality"
          description="Checking readiness, teaching coverage, and graph inputs."
        />
      </div>
    );
  }

  if (error && !projection) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Editorial quality projection could not be loaded: {error}
      </div>
    );
  }

  if (!projection) {
    return null;
  }

  const qualityReport = projection.education.qualityReport;
  const blockers = dedupeWarnings(
    qualityReport?.blockers?.length
      ? qualityReport.blockers
      : legacyBlockers,
  );
  const stringWarnings = dedupeWarnings(
    qualityReport?.warnings?.length
      ? qualityReport.warnings
      : legacyWarnings,
  );
  const coverageWarnings = dedupeWarnings(
    qualityReport?.coverageWarnings ?? [],
  );
  const fallbackCoverageWarnings = coverageWarnings.length
    ? []
    : stringWarnings.filter((warning) => warning.startsWith('missing_required_'));
  const otherWarnings = stringWarnings.filter(
    (warning) => !warning.startsWith('missing_required_'),
  );
  const visibleOtherWarnings = otherWarnings.slice(0, visibleWarningLimit);
  const hiddenWarningCount = Math.max(
    0,
    otherWarnings.length - visibleWarningLimit,
  );
  const graphReadinessScore =
    qualityReport?.scores?.graphReadinessScore ??
    qualityReport?.coverageScores?.overall;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Editorial quality
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Readiness and missing teaching coverage for this diagnosis.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status={
              projection.readiness.publishReady
                ? 'publish ready'
                : 'review needed'
            }
            tone={projection.readiness.publishReady ? 'success' : 'warning'}
          />
          <StatusBadge
            status={projection.graph.readiness.replace(/_/g, ' ')}
            tone={projection.readiness.graphReady ? 'info' : 'neutral'}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <ReadinessTile
          label="Education"
          value={projection.education.status}
          ready={projection.education.status !== 'missing'}
        />
        <ReadinessTile
          label="Review"
          value={
            projection.readiness.educationReadyForReview
              ? 'ready'
              : 'needs work'
          }
          ready={projection.readiness.educationReadyForReview}
        />
        <ReadinessTile
          label="Publish"
          value={projection.readiness.publishReady ? 'ready' : 'blocked'}
          ready={projection.readiness.publishReady}
        />
        <ReadinessTile
          label="Graph"
          value={projection.graph.readiness.replace(/_/g, ' ')}
          ready={projection.readiness.graphReady}
        />
      </div>

      {blockers.length ? (
        <ActionList
          title="Blockers"
          tone="danger"
          items={blockers.map(formatWorkspaceWarning)}
        />
      ) : null}

      {coverageWarnings.length || fallbackCoverageWarnings.length ? (
        <CoverageList
          coverageWarnings={coverageWarnings}
          fallbackWarnings={fallbackCoverageWarnings}
        />
      ) : null}

      {projection.readiness.nextActions.length ? (
        <ActionList
          title="Next actions"
          tone="info"
          items={projection.readiness.nextActions}
        />
      ) : null}

      {qualityReport?.sectionFailureSummary?.length ? (
        <SectionHealthCard
          sections={qualityReport.sectionFailureSummary}
          pendingAction={pendingAction}
          onRegenerateSection={onRegenerateSection}
        />
      ) : null}

      {visibleOtherWarnings.length ? (
        <ActionList
          title="Other warnings"
          tone="warning"
          items={[
            ...visibleOtherWarnings.map(formatWorkspaceWarning),
            ...(hiddenWarningCount ? [`${hiddenWarningCount} more warnings hidden`] : []),
          ]}
        />
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
        <ScoreTile label="Graph readiness" value={graphReadinessScore} />
        <ScoreTile
          label="Teaching coverage"
          value={qualityReport?.coverageScores?.overall}
        />
        <SourceTile label="Cases" value={projection.sourceSummary.caseCount} />
        <SourceTile
          label="Graph facts"
          value={projection.sourceSummary.promotedGraphFactCount}
          detail={`${projection.sourceSummary.graphCandidateCount} candidates`}
        />
      </div>

      <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">
          Score details
        </summary>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <ScoreGrid
            title="Section scores"
            scores={qualityReport?.sectionScores ?? {}}
          />
          <ScoreGrid
            title="Coverage scores"
            scores={qualityReport?.coverageScores ?? {}}
          />
          <ScoreGrid
            title="Pattern compliance"
            scores={qualityReport?.patternComplianceScores ?? {}}
          />
        </div>
      </details>
    </div>
  );
}

function SectionHealthCard({
  sections,
  pendingAction,
  onRegenerateSection,
}: {
  sections: WorkspaceSectionFailureSummary[];
  pendingAction?: string | null;
  onRegenerateSection?: (section: EducationRegenerableSection) => void;
}) {
  const visibleSections = sections.filter((section) => section.section !== 'findings');

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">Section health</p>
        <p className="text-xs text-slate-500">
          Regenerate the weakest editable sections without rewriting the draft.
        </p>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {visibleSections.map((section) => (
          <SectionHealthRow
            key={section.section}
            section={section}
            pendingAction={pendingAction}
            onRegenerateSection={onRegenerateSection}
          />
        ))}
      </div>
    </div>
  );
}

function SectionHealthRow({
  section,
  pendingAction,
  onRegenerateSection,
}: {
  section: WorkspaceSectionFailureSummary;
  pendingAction?: string | null;
  onRegenerateSection?: (section: EducationRegenerableSection) => void;
}) {
  const tone = section.blockers.length
    ? 'danger'
    : section.regenerationRecommended
      ? 'warning'
      : section.warnings.length
        ? 'caution'
        : 'success';
  const styles = {
    danger: 'border-rose-200 bg-rose-50 text-rose-800',
    warning: 'border-orange-200 bg-orange-50 text-orange-900',
    caution: 'border-amber-200 bg-amber-50 text-amber-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  };
  const indicator = tone === 'danger' ? 'Red' : tone === 'warning' ? 'Orange' : tone === 'caution' ? 'Yellow' : 'Green';
  const actionId = `regenerate-${section.section}`;
  const regenerableSection: EducationRegenerableSection | null =
    isRegenerableSection(section.section) ? section.section : null;

  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${styles[tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-semibold">
            {indicator} {formatSectionLabel(section.section)}
          </p>
          <p className="text-xs opacity-80">
            Score {formatScore(section.score ?? undefined)}
            {section.reason ? ` - ${formatWorkspaceWarning(section.reason)}` : ''}
          </p>
        </div>
        {regenerableSection && section.regenerationRecommended && onRegenerateSection ? (
          <button
            type="button"
            onClick={() => onRegenerateSection(regenerableSection)}
            disabled={Boolean(pendingAction)}
            className="rounded-lg border border-current bg-white/70 px-2 py-1 text-xs font-semibold transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === actionId ? 'Regenerating...' : 'Regenerate'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function isRegenerableSection(
  section: WorkspaceSectionFailureSummary['section'],
): section is EducationRegenerableSection {
  return ['differentials', 'investigations', 'examPearls', 'management'].includes(
    section,
  );
}

function ReadinessTile({
  label,
  value,
  ready,
}: {
  label: string;
  value: string;
  ready: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-3 ${
        ready
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-amber-200 bg-amber-50 text-amber-900'
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-80">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold capitalize">{value}</p>
    </div>
  );
}

function ActionList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: 'danger' | 'warning' | 'info';
}) {
  const styles = {
    danger: 'border-rose-200 bg-rose-50 text-rose-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    info: 'border-sky-200 bg-sky-50 text-sky-800',
  };

  return (
    <div className={`rounded-lg border p-3 text-sm ${styles[tone]}`}>
      <p className="font-semibold">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-4">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function CoverageList({
  coverageWarnings,
  fallbackWarnings,
}: {
  coverageWarnings: WorkspaceCoverageWarning[];
  fallbackWarnings: string[];
}) {
  const grouped = coverageWarnings.reduce<Record<string, WorkspaceCoverageWarning[]>>(
    (groups, warning) => {
      const section = warning.section ?? 'coverage';
      groups[section] = [...(groups[section] ?? []), warning];
      return groups;
    },
    {},
  );

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-semibold">Missing required teaching coverage</p>
      {coverageWarnings.length ? (
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {Object.entries(grouped).map(([section, warnings]) => (
            <div key={section} className="rounded-lg bg-white/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">
                {formatSectionLabel(section)}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {warnings.map((warning) => (
                  <li key={`${warning.code}:${warning.item}`}>
                    {formatWorkspaceWarning(warning)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {fallbackWarnings.map((warning) => (
            <li key={warning}>{formatWorkspaceWarning(warning)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ScoreTile({
  label,
  value,
}: {
  label: string;
  value: number | undefined;
}) {
  return (
    <div className={`rounded-lg border px-3 py-3 ${scoreTone(value)}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-80">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold">{formatScore(value)}</p>
    </div>
  );
}

function SourceTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-slate-800">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold">{value}</p>
      {detail ? <p className="text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}

function ScoreGrid({
  title,
  scores,
}: {
  title: string;
  scores: Record<string, number>;
}) {
  const entries = Object.entries(scores);

  if (!entries.length) {
    return (
      <div>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="mt-2 text-sm text-slate-500">No scores available.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {entries.map(([key, value]) => (
          <div
            key={key}
            className={`rounded-lg border px-3 py-2 text-sm ${scoreTone(value)}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span>{formatScoreLabel(key)}</span>
              <span className="font-semibold">{formatScore(value)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
