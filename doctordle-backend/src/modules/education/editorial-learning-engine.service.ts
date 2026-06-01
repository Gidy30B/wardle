import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';

export type EditorialLearningCandidateType =
  | 'teaching_rule_candidate'
  | 'pattern_improvement_candidate'
  | 'graph_fact_candidate'
  | 'diagnosis_specific_pearl_candidate';

export type EditorialLearningCandidate = {
  candidateType: EditorialLearningCandidateType;
  diagnosisRegistryId: string;
  sourceRevisionFrom: number;
  sourceRevisionTo: number;
  section: string;
  beforeText: string;
  afterText: string;
  inferredRule: string;
  rationale: string;
  confidence: number;
  recommendedReviewerAction: string;
};

export type EditorialLearningResult = {
  diagnosisRegistryId: string;
  fromVersion: number;
  toVersion: number;
  sourceSummary: {
    fromSource: string;
    toSource: string;
    fromCreatedByUserId: string | null;
    toCreatedByUserId: string | null;
    candidateCount: number;
  };
  candidates: EditorialLearningCandidate[];
};

type RevisionRow = {
  version: number;
  snapshot: Prisma.JsonValue;
  source: string;
  createdByUserId: string | null;
};

const LEARNABLE_SECTIONS = [
  'clinicalPattern',
  'keySymptoms',
  'keySigns',
  'examPearls',
  'scoringSystems',
  'investigations',
  'differentials',
  'management',
  'pitfalls',
  'recallPrompts',
] as const;

const COMPARATIVE_PATTERN =
  /\b(?:unlike|rather than|whereas|compared with|favors|favours|argues against|distinguish|differentiate|over|instead of|less likely|more likely)\b/i;
const INTERPRETATION_PATTERN =
  /\b(?:suggests|supports|argues for|argues against|rules in|rules out|indicates|interprets?|meaning|because|therefore|so|consistent with|raises concern for)\b/i;
const MECHANISM_PATTERN =
  /\b(?:because|mechanism|reflects|due to|from|causes|leads to|compensat|pathophysiology|physiology)\b/i;
const MANAGEMENT_PATTERN =
  /\b(?:treat|start|give|avoid|consult|escalate|admit|monitor|before|after|when|if)\b/i;
const GENERIC_ONLY_PATTERN =
  /\b(?:important|classic|common|consider|may be seen|can occur|high yield|clinically relevant)\b/i;

@Injectable()
export class EditorialLearningEngineService {
  constructor(private readonly prisma: PrismaService) {}

  async learnFromEdit(input: {
    diagnosisRegistryId: string;
    fromVersion: number;
    toVersion: number;
  }): Promise<EditorialLearningResult> {
    const context = await this.loadContext(input.diagnosisRegistryId);
    const revisions = context.education?.revisions ?? [];
    const fromRevision = revisions.find(
      (revision) => revision.version === input.fromVersion,
    );
    const toRevision = revisions.find(
      (revision) => revision.version === input.toVersion,
    );

    if (!fromRevision || !toRevision) {
      throw new NotFoundException('Diagnosis education revision not found');
    }

    const candidates = this.extractCandidates({
      diagnosisRegistryId: input.diagnosisRegistryId,
      fromRevision,
      toRevision,
    });

    return {
      diagnosisRegistryId: input.diagnosisRegistryId,
      fromVersion: input.fromVersion,
      toVersion: input.toVersion,
      sourceSummary: {
        fromSource: fromRevision.source,
        toSource: toRevision.source,
        fromCreatedByUserId: fromRevision.createdByUserId,
        toCreatedByUserId: toRevision.createdByUserId,
        candidateCount: candidates.length,
      },
      candidates,
    };
  }

  private async loadContext(diagnosisRegistryId: string) {
    const registry = await this.prisma.diagnosisRegistry.findUnique({
      where: { id: diagnosisRegistryId },
      select: {
        id: true,
        education: {
          select: {
            id: true,
            revisions: {
              orderBy: { version: 'asc' },
              select: {
                version: true,
                snapshot: true,
                source: true,
                createdByUserId: true,
              },
            },
          },
        },
      },
    });

    if (!registry) {
      throw new NotFoundException('Diagnosis registry entry not found');
    }

    return registry;
  }

  private extractCandidates(input: {
    diagnosisRegistryId: string;
    fromRevision: RevisionRow;
    toRevision: RevisionRow;
  }): EditorialLearningCandidate[] {
    const before = this.objectFromSnapshot(input.fromRevision.snapshot);
    const after = this.objectFromSnapshot(input.toRevision.snapshot);
    const candidates: EditorialLearningCandidate[] = [];

    for (const section of LEARNABLE_SECTIONS) {
      const beforeText = this.textFrom(before[section]);
      const afterText = this.textFrom(after[section]);
      if (!this.isMeaningfulEdit(beforeText, afterText)) {
        continue;
      }

      const candidate = this.candidateForSection({
        diagnosisRegistryId: input.diagnosisRegistryId,
        fromVersion: input.fromRevision.version,
        toVersion: input.toRevision.version,
        section,
        beforeText,
        afterText,
      });
      if (candidate) {
        candidates.push(candidate);
      }
    }

    return candidates;
  }

  private candidateForSection(input: {
    diagnosisRegistryId: string;
    fromVersion: number;
    toVersion: number;
    section: string;
    beforeText: string;
    afterText: string;
  }): EditorialLearningCandidate | null {
    const gainedComparison =
      !COMPARATIVE_PATTERN.test(input.beforeText) &&
      COMPARATIVE_PATTERN.test(input.afterText);
    const gainedInterpretation =
      !INTERPRETATION_PATTERN.test(input.beforeText) &&
      INTERPRETATION_PATTERN.test(input.afterText);
    const gainedMechanism =
      !MECHANISM_PATTERN.test(input.beforeText) &&
      MECHANISM_PATTERN.test(input.afterText);
    const gainedManagement =
      !MANAGEMENT_PATTERN.test(input.beforeText) &&
      MANAGEMENT_PATTERN.test(input.afterText);

    if (input.section === 'differentials' && gainedComparison) {
      return this.buildCandidate(input, {
        candidateType: 'pattern_improvement_candidate',
        inferredRule:
          'Differential entries should include an explicit discriminator using comparative language.',
        rationale:
          'The human edit added contrast language that explains why a mimic loses against the target diagnosis.',
        confidence: 0.86,
        recommendedReviewerAction:
          'Review as a reusable differential discriminator pattern.',
      });
    }

    if (input.section === 'investigations' && gainedInterpretation) {
      return this.buildCandidate(input, {
        candidateType: 'graph_fact_candidate',
        inferredRule:
          'Investigation entries should pair the test with expected interpretation and diagnostic consequence.',
        rationale:
          'The human edit added interpretation that can inform graph investigation or discriminator candidates.',
        confidence: 0.84,
        recommendedReviewerAction:
          'Review for graph candidate extraction or investigation teaching rule.',
      });
    }

    if (input.section === 'examPearls' && gainedMechanism) {
      return this.buildCandidate(input, {
        candidateType: 'diagnosis_specific_pearl_candidate',
        inferredRule:
          'Exam pearls should explain the mechanism or discriminator, not just name the finding.',
        rationale:
          'The human edit added mechanism-oriented explanation to an exam teaching point.',
        confidence: 0.8,
        recommendedReviewerAction:
          'Review as a diagnosis-specific pearl candidate.',
      });
    }

    if (input.section === 'management' && gainedManagement) {
      return this.buildCandidate(input, {
        candidateType: 'teaching_rule_candidate',
        inferredRule:
          'Management anchors should specify the indication, timing, or escalation consequence.',
        rationale:
          'The human edit added operational management language that can become a teaching constraint.',
        confidence: 0.78,
        recommendedReviewerAction:
          'Review as a management teaching rule candidate.',
      });
    }

    if (this.addedSpecificClinicalContent(input.beforeText, input.afterText)) {
      return this.buildCandidate(input, {
        candidateType: 'diagnosis_specific_pearl_candidate',
        inferredRule:
          'Human-added specific clinical reasoning should be reviewed for reusable diagnosis teaching guidance.',
        rationale:
          'The edit added specific clinical content rather than generic wording.',
        confidence: 0.68,
        recommendedReviewerAction:
          'Review as a diagnosis-specific editorial learning candidate.',
      });
    }

    return null;
  }

  private buildCandidate(
    input: {
      diagnosisRegistryId: string;
      fromVersion: number;
      toVersion: number;
      section: string;
      beforeText: string;
      afterText: string;
    },
    candidate: Omit<
      EditorialLearningCandidate,
      | 'diagnosisRegistryId'
      | 'sourceRevisionFrom'
      | 'sourceRevisionTo'
      | 'section'
      | 'beforeText'
      | 'afterText'
    >,
  ): EditorialLearningCandidate {
    return {
      ...candidate,
      diagnosisRegistryId: input.diagnosisRegistryId,
      sourceRevisionFrom: input.fromVersion,
      sourceRevisionTo: input.toVersion,
      section: input.section,
      beforeText: this.compact(input.beforeText),
      afterText: this.compact(input.afterText),
    };
  }

  private isMeaningfulEdit(beforeText: string, afterText: string): boolean {
    const before = this.normalize(beforeText);
    const after = this.normalize(afterText);
    if (!after || before === after) {
      return false;
    }

    const addedTokens = this.addedTokens(before, after);
    if (addedTokens.length < 3) {
      return false;
    }

    const overlap = this.tokenOverlap(before, after);
    const patternGain =
      (!COMPARATIVE_PATTERN.test(beforeText) &&
        COMPARATIVE_PATTERN.test(afterText)) ||
      (!INTERPRETATION_PATTERN.test(beforeText) &&
        INTERPRETATION_PATTERN.test(afterText)) ||
      (!MECHANISM_PATTERN.test(beforeText) && MECHANISM_PATTERN.test(afterText)) ||
      (!MANAGEMENT_PATTERN.test(beforeText) && MANAGEMENT_PATTERN.test(afterText));

    if (patternGain) {
      return true;
    }

    if (overlap > 0.9 && !this.addedSpecificClinicalContent(beforeText, afterText)) {
      return false;
    }

    return this.addedSpecificClinicalContent(beforeText, afterText);
  }

  private addedSpecificClinicalContent(beforeText: string, afterText: string): boolean {
    const before = this.normalize(beforeText);
    const after = this.normalize(afterText);
    const added = this.addedTokens(before, after);
    if (added.length < 4) {
      return false;
    }

    const addedText = added.join(' ');
    if (GENERIC_ONLY_PATTERN.test(addedText) && added.length < 7) {
      return false;
    }

    return (
      /\b(?:positive|negative|elevated|low|high|ct|ecg|xray|ultrasound|troponin|ketone|anion|potassium|lactate|oxygen|rebound|guarding|focal|diffuse|before|after|risk|because|rules|supports|distinguish)\b/i.test(
        addedText,
      ) || added.length >= 8
    );
  }

  private addedTokens(before: string, after: string): string[] {
    const beforeTokens = new Set(
      before.split(' ').filter((token) => token.length >= 4),
    );
    return after
      .split(' ')
      .filter((token) => token.length >= 4 && !beforeTokens.has(token));
  }

  private tokenOverlap(before: string, after: string): number {
    const beforeTokens = new Set(
      before.split(' ').filter((token) => token.length >= 4),
    );
    const afterTokens = after.split(' ').filter((token) => token.length >= 4);
    if (!afterTokens.length) {
      return 0;
    }

    return afterTokens.filter((token) => beforeTokens.has(token)).length /
      afterTokens.length;
  }

  private objectFromSnapshot(snapshot: Prisma.JsonValue): Record<string, unknown> {
    if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
      return snapshot as Record<string, unknown>;
    }

    return {};
  }

  private textFrom(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.textFrom(item)).join(' ');
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value)
        .map((item) => this.textFrom(item))
        .join(' ');
    }
    return '';
  }

  private compact(value: string): string {
    const compacted = value.replace(/\s+/g, ' ').trim();
    return compacted.length > 900
      ? `${compacted.slice(0, 897).trim()}...`
      : compacted;
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
