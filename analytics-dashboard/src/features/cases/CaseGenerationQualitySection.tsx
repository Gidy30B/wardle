import type { ReactNode } from 'react';
import EmptyState from '../../components/ui/EmptyState';
import { SpecialtyIcon } from '../specialties/specialty-icons';
import CaseDetailSection from './CaseDetailSection';
import type { GenerationQualityMetadata } from './case.transforms';
import { formatLabel } from './cases.helpers';

type CaseGenerationQualitySectionProps = {
  quality: GenerationQualityMetadata | null;
};

function scoreTone(score?: number) {
  if (typeof score !== 'number') {
    return 'border-slate-200 bg-white text-slate-700';
  }

  if (score >= 85) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }

  if (score >= 70) {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }

  return 'border-rose-200 bg-rose-50 text-rose-800';
}

function formatValue(value: string | number | boolean | null | undefined) {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    return formatLabel(value);
  }

  return 'Not recorded';
}

function MetricCard({
  label,
  value,
  valueNode,
  accent,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
  valueNode?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </dt>
      <dd className={['mt-2 text-sm font-semibold', accent ?? 'text-slate-900'].join(' ')}>
        {valueNode ?? formatValue(value)}
      </dd>
    </div>
  );
}

function BulletList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {items.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700">
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">None reported.</p>
      )}
    </div>
  );
}

function InvalidReasoningEdgesList({
  quality,
}: {
  quality: GenerationQualityMetadata;
}) {
  if (quality.invalidReasoningEdges.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-3">
      <p className="text-sm font-semibold text-rose-950">
        Invalid reasoning edges
      </p>
      <div className="mt-3 space-y-3">
        {quality.invalidReasoningEdges.map((edge, index) => (
          <div
            key={`${edge.differential}-${edge.clueOrder}-${index}`}
            className="rounded-md border border-rose-200 bg-white px-3 py-3"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-rose-700">
              <span>{formatLabel(edge.verdict)}</span>
              <span>Clue {edge.clueOrder}</span>
              <span>{formatLabel(edge.claimedEffect)}</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-950">
              {edge.differential}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-700">
              {edge.evidence}
            </p>
            <p className="mt-2 text-sm leading-6 text-rose-800">
              {edge.issue}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeachingAlignmentSummary({
  quality,
}: {
  quality: GenerationQualityMetadata;
}) {
  const alignment = quality.teachingAlignment;
  if (!alignment) {
    return null;
  }

  const coveredCount = alignment.selectedUnits.filter((unit) => unit.covered).length;
  const warningCount = alignment.warnings.length;
  const visibleUnits = alignment.selectedUnits.slice(0, 4);

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Teaching alignment
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {coveredCount} of {alignment.selectedUnits.length} selected units covered
          </p>
        </div>
        <div
          className={[
            'rounded-full border px-3 py-1.5 text-sm font-semibold',
            scoreTone(alignment.playability.score),
          ].join(' ')}
        >
          Playability {alignment.playability.score}
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <MetricCard
          label="Difficulty fit"
          value={formatLabel(alignment.playability.difficultyFit)}
        />
        <MetricCard label="Warnings" value={warningCount} />
        <MetricCard
          label="Mimic alive until"
          value={alignment.mimicPersistence.mimicsStillPlausibleUntilClue}
        />
      </div>

      {visibleUnits.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {visibleUnits.map((unit) => (
            <span
              key={unit.id}
              className={[
                'rounded-full border px-2.5 py-1 text-xs font-semibold',
                unit.covered
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800',
              ].join(' ')}
            >
              {unit.covered ? 'Covered' : 'Missing'}: {unit.label}
            </span>
          ))}
        </div>
      ) : null}

      {alignment.warnings.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-800">
          {alignment.warnings.slice(0, 3).map((warning) => (
            <li key={warning}>{formatLabel(warning)}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function GeneratedBecauseSummary({
  quality,
}: {
  quality: GenerationQualityMetadata;
}) {
  const trace = quality.reasoningPathTrace;
  const governance = quality.generationGovernance;
  if (!trace && !governance) {
    return null;
  }

  const constrained = governance?.constrained === true;

  return (
    <div
      className={[
        'rounded-lg border px-3 py-3',
        constrained
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-amber-200 bg-amber-50',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Generated because
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {trace?.title ??
              (constrained
                ? 'Constrained reasoning path was applied.'
                : 'No active reasoning path constrained this draft.')}
          </p>
        </div>
        <div className="rounded-full border border-white/70 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
          {constrained ? 'Constrained' : 'Unconstrained'} ·{' '}
          {formatLabel(governance?.hallucinationRisk ?? 'unknown')} risk
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-4">
        <MetricCard label="Goal" value={trace?.reasoningGoal} />
        <MetricCard label="Purpose" value={trace?.generationPurpose} />
        <MetricCard
          label="Readiness"
          value={
            trace?.readinessSnapshot.readinessScore !== null &&
            trace?.readinessSnapshot.readinessScore !== undefined
              ? `${trace.readinessSnapshot.readinessScore}% ${formatLabel(
                  trace.readinessSnapshot.readinessTier,
                )}`
              : formatLabel(trace?.readinessSnapshot.readinessTier ?? 'unknown')
          }
        />
        <MetricCard label="Confidence" value={governance?.confidence} />
      </div>

      {trace?.requiredTeachingPoints.length ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
            Teaching points
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {trace.requiredTeachingPoints.slice(0, 5).map((item) => (
              <span
                key={item}
                className="rounded-full border border-white/80 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {[...(governance?.warnings ?? []), ...quality.reasoningQualityWarnings]
        .length ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-900">
          {[...(governance?.warnings ?? []), ...quality.reasoningQualityWarnings]
            .slice(0, 6)
            .map((warning) => (
              <li key={warning}>{formatLabel(warning)}</li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function CaseGenerationQualitySection({
  quality,
}: CaseGenerationQualitySectionProps) {
  return (
    <CaseDetailSection
      title="Generation quality"
      description="AI generation metadata for difficulty, balance, and editorial triage."
    >
      {quality ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Quality summary
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {quality.version ?? 'Unknown generator version'}
              </p>
            </div>
            <div
              className={[
                'rounded-full border px-3 py-1.5 text-sm font-semibold',
                scoreTone(quality.qualityScore ?? quality.critiqueScore),
              ].join(' ')}
            >
              Score {quality.qualityScore ?? quality.critiqueScore ?? '--'}
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Critique"
              value={
                typeof quality.critiquePassed === 'boolean'
                  ? quality.critiquePassed
                    ? 'Passed'
                    : 'Needs review'
                  : undefined
              }
              accent={
                quality.critiquePassed === false ? 'text-rose-700' : 'text-emerald-700'
              }
            />
            <MetricCard label="Critique score" value={quality.critiqueScore} />
            <MetricCard
              label="Differential plausibility"
              value={quality.differentialPlausibilityScore}
            />
            <MetricCard
              label="Differential discrimination"
              value={quality.differentialDiscriminationScore}
            />
            <MetricCard
              label="Clinical edge validity"
              value={quality.clinicalEdgeValidityScore}
            />
            <MetricCard
              label="Rule-out score"
              value={quality.differentialRuleOutScore}
            />
            <MetricCard
              label="Educational value"
              value={quality.educationalValueScore}
            />
            <MetricCard
              label="Graph consistency"
              value={quality.graphConsistencyScore}
            />
            <MetricCard label="Difficulty" value={quality.estimatedDifficulty} />
            <MetricCard label="Solve clue" value={quality.estimatedSolveClue} />
            <MetricCard
              label="Specialty"
              value={quality.specialty}
              valueNode={
                quality.specialty ? (
                  <span className="inline-flex items-center gap-1.5">
                    <SpecialtyIcon
                      specialty={quality.specialty}
                      className="h-3.5 w-3.5 text-slate-500"
                    />
                    {formatLabel(quality.specialty)}
                  </span>
                ) : undefined
              }
            />
            <MetricCard label="Acuity" value={quality.acuity} />
            <MetricCard label="Differentials" value={quality.differentialCount} />
            <MetricCard label="Labs" value={quality.hasLabs} />
            <MetricCard label="Imaging" value={quality.hasImaging} />
            <MetricCard label="Vitals" value={quality.hasVitals} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <BulletList title="Critique issues" items={quality.critiqueIssues} />
            <BulletList
              title="Recommendations"
              items={quality.critiqueRecommendations}
            />
          </div>

          <GeneratedBecauseSummary quality={quality} />

          <TeachingAlignmentSummary quality={quality} />

          <InvalidReasoningEdgesList quality={quality} />
        </div>
      ) : (
        <EmptyState
          title="No generation quality metadata"
          description="Older cases may not include generationQuality in the explanation payload yet."
        />
      )}
    </CaseDetailSection>
  );
}
