import EmptyState from '../../components/ui/EmptyState';
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
  accent,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </dt>
      <dd className={['mt-2 text-sm font-semibold', accent ?? 'text-slate-900'].join(' ')}>
        {formatValue(value)}
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
            <MetricCard label="Difficulty" value={quality.estimatedDifficulty} />
            <MetricCard label="Solve clue" value={quality.estimatedSolveClue} />
            <MetricCard label="Specialty" value={quality.specialty} />
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
