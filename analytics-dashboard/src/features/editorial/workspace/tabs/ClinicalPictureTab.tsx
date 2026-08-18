import { Link } from 'react-router-dom';
import { useMemo } from 'react';

import type { DiagnosisEditorialWorkspace } from '../../../../api/admin';
import StatusBadge from '../../../../components/ui/StatusBadge';
import type { StatusBadgeTone } from '../../../../components/ui/statusBadgeMeta';
import {
  CompactMetricGrid,
  EditorialEntity,
  EditorialRow,
  EditorialStream,
  EmptyGuidance,
  ReasoningThread,
  StreamDisclosure,
  TabNextStepCard,
} from '../EditorialPrimitives';
import {
  buildConfusionCandidates,
  buildDiscriminatorTeachingSummary,
  buildEscalationNarrative,
  buildExemplarProgression,
  buildRecognitionAnchor,
} from '../clinicalRecognition';
import { mimicSurvivalStateMeta } from '../mimicSurvival';
import { formatDate, formatLabel, formatScore } from '../workspaceTransforms';

type ClinicalSectionId =
  | 'presentation'
  | 'investigation'
  | 'pearls'
  | 'management';

type ClinicalSection = {
  id: ClinicalSectionId;
  label: string;
  summary: string;
  discriminator: string;
  warning: string;
  tone: StatusBadgeTone;
  context: Array<{ label: string; detail: string; tone: StatusBadgeTone }>;
};

export function ClinicalPictureTab({
  workspace,
}: {
  workspace: DiagnosisEditorialWorkspace;
}) {
  const sections = useMemo(() => buildClinicalSections(workspace), [workspace]);
  const summarySection = sections[0];
  const investigationSection = sections.find((section) => section.id === 'investigation');
  const pitfallSection = sections.find((section) => section.id === 'pearls');
  const managementSection = sections.find((section) => section.id === 'management');

  return (
    <div className="space-y-4">
      {!workspace.education.id ? (
        <TabNextStepCard
          title="Clinical picture is missing"
          description="Generate or draft education content so the recognition narrative can be reviewed and shaped."
        />
      ) : null}

      <div id="education-summary" className="scroll-mt-24" tabIndex={-1}>
        <EditorialStream
          eyebrow="Clinical picture"
          title="Education cockpit"
          subtitle="The operator view of definition, recognition pattern, work-up, management, traps, and publication state."
        >
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.45fr)]">
            <EducationSummaryCard workspace={workspace} section={summarySection} />
            <PublicationStateCard workspace={workspace} />
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            {summarySection ? (
              <ClinicalSignalCard
                section={summarySection}
                anchorId="education-clinical-pattern"
                eyebrow="Clinical pattern"
              />
            ) : null}
            {investigationSection ? (
              <ClinicalSignalCard
                section={investigationSection}
                anchorId="education-investigations"
                eyebrow="Investigations"
              />
            ) : null}
            {managementSection ? (
              <ClinicalSignalCard
                section={managementSection}
                anchorId="education-management"
                eyebrow="Management"
              />
            ) : null}
            {pitfallSection ? (
              <ClinicalSignalCard
                section={pitfallSection}
                anchorId="education-pitfalls"
                eyebrow="Pitfalls"
              />
            ) : null}
          </div>

          <RepairsPointerCard workspace={workspace} />
        </EditorialStream>
      </div>
    </div>
  );
}

function EducationSummaryCard({
  workspace,
  section,
}: {
  workspace: DiagnosisEditorialWorkspace;
  section: ClinicalSection | undefined;
}) {
  return (
    <EditorialEntity
      eyebrow="Summary / definition"
      title={workspace.diagnosis.displayLabel}
      subtitle={
        workspace.education.id
          ? section?.summary ?? 'Education content is present, but no compact summary is available.'
          : 'No education content exists yet.'
      }
      tone={workspace.education.blockers.length ? 'danger' : 'info'}
      state={<StatusBadge status={formatLabel(workspace.education.status)} tone={educationTone(workspace)} />}
    >
      <CompactMetricGrid
        items={[
          {
            label: 'Quality',
            value: formatScore(workspace.education.qualityScore),
            tone: scoreTone(workspace.education.qualityScore),
          },
          { label: 'Version', value: workspace.education.version ?? 'None' },
          {
            label: 'Blockers',
            value: workspace.education.blockers.length,
            tone: workspace.education.blockers.length ? 'danger' : 'success',
          },
          {
            label: 'Warnings',
            value: workspace.education.warnings.length,
            tone: workspace.education.warnings.length ? 'warning' : 'success',
          },
        ]}
      />
      {workspace.education.updatedAt ? (
        <p className="mt-3 text-xs text-slate-500">
          Updated {formatDate(workspace.education.updatedAt)}
        </p>
      ) : null}
    </EditorialEntity>
  );
}

function PublicationStateCard({
  workspace,
}: {
  workspace: DiagnosisEditorialWorkspace;
}) {
  return (
    <div id="education-publication-state" className="scroll-mt-24" tabIndex={-1}>
      <EditorialEntity
        eyebrow="Publication state"
        title={formatLabel(workspace.education.status)}
        subtitle="Current education editorial state and blocking signals from the workspace projection."
        tone={educationTone(workspace)}
        state={<StatusBadge status={formatLabel(workspace.lifecycle.education)} tone={lifecycleTone(workspace.lifecycle.education)} />}
      >
        {workspace.education.blockers.length || workspace.education.warnings.length ? (
          <div className="grid gap-2">
            {[...workspace.education.blockers, ...workspace.education.warnings]
              .slice(0, 4)
              .map((message) => (
                <p
                  key={message}
                  className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 px-3 py-2 text-xs leading-5 text-slate-300"
                >
                  {message}
                </p>
              ))}
          </div>
        ) : (
          <p className="text-sm leading-6 text-slate-400">
            No education-level blockers or warnings are currently reported.
          </p>
        )}
      </EditorialEntity>
    </div>
  );
}

function ClinicalSignalCard({
  section,
  anchorId,
  eyebrow,
}: {
  section: ClinicalSection;
  anchorId: string;
  eyebrow: string;
}) {
  return (
    <div id={anchorId} className="scroll-mt-24" tabIndex={-1}>
      <EditorialEntity
        eyebrow={eyebrow}
        title={section.label}
        subtitle={section.summary}
        tone={section.tone}
        state={<StatusBadge status={formatLabel(section.tone)} tone={section.tone} />}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <EditorialRow
            title="Key discriminator"
            subtitle={section.discriminator}
            tone={section.discriminator ? 'success' : 'warning'}
          />
          <EditorialRow
            title="Must-not-miss"
            subtitle={section.warning}
            tone={section.tone === 'danger' ? 'danger' : 'warning'}
          />
        </div>
        <StreamDisclosure
          title="Support and context"
          summary={`${section.context.length} compact signal${section.context.length === 1 ? '' : 's'}`}
        >
          {section.context.length ? (
            <ReasoningThread items={section.context} />
          ) : (
            <EmptyGuidance
              title="No support context"
              description="No compact clinical support signal is available for this section yet."
            />
          )}
        </StreamDisclosure>
      </EditorialEntity>
    </div>
  );
}

function RepairsPointerCard({
  workspace,
}: {
  workspace: DiagnosisEditorialWorkspace;
}) {
  const repairs = workspace.education.acceptedRepairs ?? [];

  if (!repairs.length) {
    return null;
  }

  return (
    <div id="education-repairs" className="scroll-mt-24" tabIndex={-1}>
      <EditorialEntity
        eyebrow="Repairs / integrity"
        title={`${repairs.length} accepted repair${repairs.length === 1 ? '' : 's'}`}
        subtitle="Accepted claim repairs are tracked in Integrity so education stays evidence-supported."
        tone="success"
        state={<StatusBadge status="Evidence-supported" tone="success" />}
        action={
          <Link
            to={`/editorial/diagnoses/${workspace.diagnosis.id}?tab=integrity`}
            className="editorial-action"
          >
            Open Integrity
          </Link>
        }
      >
        <div className="grid gap-2 md:grid-cols-2">
          {repairs.slice(0, 4).map((repair) => (
            <EditorialRow
              key={`${repair.section}-${repair.sourceAuditId ?? repair.acceptedClaim}`}
              title={formatLabel(repair.section)}
              subtitle={repair.acceptedClaim}
              tone="success"
            />
          ))}
        </div>
      </EditorialEntity>
    </div>
  );
}

function buildClinicalSections(
  workspace: DiagnosisEditorialWorkspace,
): ClinicalSection[] {
  const anchor = buildRecognitionAnchor(workspace);
  const exemplar = buildExemplarProgression(workspace);
  const confusions = buildConfusionCandidates(workspace);
  const discriminatorSummary = buildDiscriminatorTeachingSummary(workspace);
  const escalation = buildEscalationNarrative(workspace);
  const primaryConfusion = confusions[0] ?? null;
  const primaryDiscriminator = discriminatorSummary.items[0] ?? null;
  const topClue = exemplar?.states[0]?.clue ?? null;
  const investigationSection = workspace.education.sectionHealth.find((section) =>
    ['investigations', 'diagnostics'].includes(section.section),
  );
  const pearlsSection = workspace.education.sectionHealth.find((section) =>
    ['examPearls', 'differentials'].includes(section.section),
  );
  const managementSection = workspace.education.sectionHealth.find(
    (section) => section.section === 'management',
  );

  return [
    {
      id: 'presentation',
      label: 'Presentation & Differential',
      summary:
        topClue ??
        `${anchor.displayLabel} is a ${formatLabel(anchor.difficultyBand ?? 'unrated')} ${anchor.specialty ? formatLabel(anchor.specialty) : 'clinical'} presentation.`,
      discriminator:
        primaryDiscriminator?.label ??
        primaryConfusion?.discriminatorSummary ??
        'No primary discriminator is documented yet.',
      warning:
        primaryConfusion?.learnerPitfall ??
        (anchor.hasUsableCase
          ? 'No major recognition trap is surfaced.'
          : 'No usable case currently lets learners practice recognition.'),
      tone: primaryConfusion?.survivalState === 'unresolved' ? 'danger' : 'info',
      context: [
        {
          label: 'Learner risk',
          detail: anchor.learnerRiskTier
            ? formatLabel(anchor.learnerRiskTier)
            : 'Unscored',
          tone: riskTone(anchor.learnerRiskTier),
        },
        {
          label: 'Primary mimic',
          detail: primaryConfusion?.label ?? 'No mimic mapped',
          tone: primaryConfusion
            ? mimicSurvivalStateMeta(primaryConfusion.survivalState).tone
            : 'neutral',
        },
      ],
    },
    {
      id: 'investigation',
      label: 'Investigation & Confirmation',
      summary:
        primaryDiscriminator?.evidence ??
        primaryDiscriminator?.label ??
        'Confirmatory evidence has not been summarized yet.',
      discriminator:
        primaryDiscriminator?.label ??
        'No investigation discriminator is documented yet.',
      warning:
        investigationSection?.blockers[0] ??
        investigationSection?.warnings[0] ??
        'No investigation-specific warning is surfaced.',
      tone: investigationSection?.blockers.length
        ? 'danger'
        : investigationSection?.warnings.length
          ? 'warning'
          : primaryDiscriminator
            ? 'success'
            : 'warning',
      context: discriminatorSummary.items.slice(0, 4).map((item) => ({
        label: item.label,
        detail: item.evidence ?? formatLabel(item.strength),
        tone: item.annotationSource === 'editorial' ? 'success' : 'warning',
      })),
    },
    {
      id: 'pearls',
      label: 'Clinical Pearls & Traps',
      summary:
        primaryConfusion?.confusionReason ??
        primaryConfusion?.learnerPitfall ??
        'No dominant learner trap is documented yet.',
      discriminator:
        primaryConfusion?.discriminatorSummary ??
        primaryDiscriminator?.label ??
        'No trap-specific discriminator is documented yet.',
      warning:
        pearlsSection?.blockers[0] ??
        primaryConfusion?.learnerPitfall ??
        'No must-not-miss pearl is surfaced.',
      tone: primaryConfusion?.survivalState === 'unresolved' ? 'danger' : 'warning',
      context: confusions.slice(0, 4).map((confusion) => ({
        label: confusion.label,
        detail:
          confusion.confusionReason ??
          confusion.discriminatorSummary ??
          'No concise trap note.',
        tone: mimicSurvivalStateMeta(confusion.survivalState).tone,
      })),
    },
    {
      id: 'management',
      label: 'Management & Disposition',
      summary: escalation.coversEscalation
        ? `Escalates to ${formatLabel(escalation.escalationType ?? 'severe disease')}.`
        : 'No escalation pathway is documented yet.',
      discriminator:
        escalation.escalationRelationships[0]?.discriminatorSummary ??
        'No escalation discriminator is documented yet.',
      warning:
        managementSection?.blockers[0] ??
        (escalation.noPlayableEscalationCase
          ? 'Escalation is documented, but no playable case exercises it.'
          : escalation.missingEscalationTeaching
            ? 'Escalation teaching is missing.'
            : 'No disposition blocker is surfaced.'),
      tone:
        !escalation.coversEscalation ||
        escalation.noPlayableEscalationCase ||
        managementSection?.blockers.length
          ? 'danger'
          : escalation.weakEscalationEvidence || managementSection?.warnings.length
            ? 'warning'
            : 'success',
      context: escalation.escalationRelationships.slice(0, 4).map((relationship) => ({
        label: relationship.targetDiagnosisRegistry.displayLabel,
        detail:
          relationship.discriminatorSummary ??
          relationship.commonConfusionReason ??
          'No concise escalation note.',
        tone: relationship.discriminatorSummary ? 'success' : 'warning',
      })),
    },
  ];
}

function educationTone(workspace: DiagnosisEditorialWorkspace): StatusBadgeTone {
  if (workspace.education.blockers.length) return 'danger';
  if (workspace.education.warnings.length) return 'warning';
  if (workspace.education.id) return 'success';
  return 'neutral';
}

function lifecycleTone(value: string): StatusBadgeTone {
  if (value === 'complete') return 'success';
  if (value === 'blocked') return 'danger';
  return 'warning';
}

function scoreTone(score: number | null | undefined): StatusBadgeTone {
  if (typeof score !== 'number') return 'warning';
  if (score < 0.5) return 'danger';
  if (score < 0.75) return 'warning';
  return 'success';
}

function riskTone(tier: string | null): StatusBadgeTone {
  if (tier === 'critical' || tier === 'high') return 'danger';
  if (tier === 'medium') return 'warning';
  if (tier === 'low') return 'success';
  return 'info';
}
