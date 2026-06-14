import { useMemo, useState } from 'react';

import type { DiagnosisEditorialWorkspace } from '../../../../api/admin';
import StatusBadge from '../../../../components/ui/StatusBadge';
import type { StatusBadgeTone } from '../../../../components/ui/statusBadgeMeta';
import {
  EditorialEntity,
  EditorialRow,
  EditorialStream,
  EmptyGuidance,
  ReasoningThread,
  SidebarDetailLayout,
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
import { formatLabel } from '../workspaceTransforms';

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
  const [activeSectionId, setActiveSectionId] =
    useState<ClinicalSectionId>('presentation');
  const sections = useMemo(() => buildClinicalSections(workspace), [workspace]);
  const activeSection =
    sections.find((section) => section.id === activeSectionId) ?? sections[0];

  return (
    <div className="space-y-4">
      {!workspace.education.id ? (
        <TabNextStepCard
          title="Clinical picture is missing"
          description="Generate or draft education content so the recognition narrative can be reviewed and shaped."
        />
      ) : null}
      <EditorialStream
        eyebrow="Clinical picture"
        title="Clinician recognition cockpit"
        subtitle="What it looks like, what it is confused with, what separates it, and when to worry."
      >
        <SidebarDetailLayout
          sidebar={
            <ClinicalSectionSelector
              sections={sections}
              activeSectionId={activeSection.id}
              onSelect={setActiveSectionId}
            />
          }
          sidebarWidth={220}
          detail={<ClinicalSectionDetail section={activeSection} />}
        />
      </EditorialStream>
    </div>
  );
}

function ClinicalSectionSelector({
  sections,
  activeSectionId,
  onSelect,
}: {
  sections: ClinicalSection[];
  activeSectionId: ClinicalSectionId;
  onSelect: (section: ClinicalSectionId) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        Clinical lens
      </p>
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => onSelect(section.id)}
          className={[
            'w-full rounded-lg border px-3 py-2 text-left transition',
            activeSectionId === section.id
              ? 'border-[var(--color-teal)] bg-[var(--color-teal-bg)]'
              : 'border-[var(--color-navy-border)] bg-white/[0.03] hover:border-slate-500',
          ].join(' ')}
        >
          <span className="block text-sm font-semibold text-slate-100">
            {section.label}
          </span>
          <span className="mt-1 inline-flex">
            <StatusBadge status={formatLabel(section.tone)} tone={section.tone} />
          </span>
        </button>
      ))}
    </div>
  );
}

function ClinicalSectionDetail({ section }: { section: ClinicalSection }) {
  return (
    <EditorialEntity
      eyebrow="Clinician view"
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

function riskTone(tier: string | null): StatusBadgeTone {
  if (tier === 'critical' || tier === 'high') return 'danger';
  if (tier === 'medium') return 'warning';
  if (tier === 'low') return 'success';
  return 'info';
}
