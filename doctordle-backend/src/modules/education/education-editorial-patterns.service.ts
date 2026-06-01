import { Injectable } from '@nestjs/common';
import { EducationSchemaContractService } from './education-schema-contract.service';

export type EducationEditorialPatternId =
  | 'differential'
  | 'investigation'
  | 'examPearl'
  | 'managementAnchor'
  | 'pitfall'
  | 'recallPrompt';

export type EducationEditorialPatternComplianceScores = Record<
  EducationEditorialPatternId | 'overall',
  number
>;

const COMPARISON_PATTERN =
  /\b(?:unlike|rather than|whereas|compared with|favors|favours|argues against|distinguish|differentiate|over|instead of|less likely|more likely)\b/i;

const INTERPRETATION_PATTERN =
  /\b(?:supports|favors|favours|suggests|indicates|argues against|rules out|distinguishes|differentiate|confirms|raises suspicion|lowers suspicion|elevated|reduced|normal|positive|negative)\b/i;

const MECHANISM_PATTERN =
  /\b(?:because|due to|from|reflects|suggests|indicates|produces|irritat|reproduc|provok|extension|palpation|maneuver|manoeuvre)\b/i;

const INDICATION_PATTERN =
  /\b(?:when|if|for|with|suspected|confirmed|severe|high risk|high-risk|unstable|focal|persistent|progressive)\b/i;

const OBJECTIVE_FINDING_PATTERN =
  /\b(?:shows?|finding|findings|positive|negative|elevated|reduced|low|high|normal|abnormal|leukocytosis|ketone|ketones|acidosis|consolidation|infiltrate|troponin|lactate|bnp|wbc|ph|bicarbonate|creatinine|score)\b/i;

@Injectable()
export class EducationEditorialPatternsService {
  constructor(
    private readonly schemaContractService: EducationSchemaContractService = new EducationSchemaContractService(),
  ) {}

  getPromptGuidance() {
    return this.schemaContractService.getPromptPatterns();
  }

  scoreDraft(
    draft: Partial<Record<string, unknown>>,
  ): EducationEditorialPatternComplianceScores {
    const scores = {
      differential: this.scoreSection(draft.differentials, (item) =>
        this.scoreDifferential(item),
      ),
      investigation: this.scoreSection(
        [...this.asArray(draft.investigations), ...this.asArray(draft.scoringSystems)],
        (item) => this.scoreInvestigation(item),
      ),
      examPearl: this.scoreSection(draft.examPearls, (item) =>
        this.scoreExamPearl(item),
      ),
      managementAnchor: this.scoreSection(draft.management, (item) =>
        this.scoreManagementAnchor(item),
      ),
      pitfall: this.scoreSection(draft.pitfalls, (item) => this.scorePitfall(item)),
      recallPrompt: this.scoreSection(draft.recallPrompts, (item) =>
        this.scoreRecallPrompt(item),
      ),
    };

    return {
      ...scores,
      overall: this.round(
        Object.values(scores).reduce((sum, score) => sum + score, 0) /
          Object.values(scores).length,
      ),
    };
  }

  private scoreDifferential(item: unknown): number {
    const pearl = this.schemaContractService.readTypedPearl(item);
    const text = this.schemaContractService.canonicalText(item);
    const overlapText = [pearl.content, pearl.whyItMatters, pearl.trapAvoided]
      .filter(Boolean)
      .join(' ');
    return this.scoreParts([
      Boolean(pearl.title || pearl.content),
      /\b(?:both|overlap|mimic|confused|similar|shared|common alternative)\b/i.test(
        overlapText,
      ),
      Boolean(pearl.discriminator),
      COMPARISON_PATTERN.test(text),
      Boolean(pearl.managementImplication || pearl.trapAvoided),
    ]);
  }

  private scoreInvestigation(item: unknown): number {
    const pearl = this.schemaContractService.readTypedPearl(item);
    const text = this.schemaContractService.canonicalText(item, [
      'content',
      'whyItMatters',
      'managementImplication',
    ]);
    return this.scoreParts([
      Boolean(pearl.title || pearl.content),
      OBJECTIVE_FINDING_PATTERN.test(pearl.content ?? ''),
      Boolean(pearl.whyItMatters && INTERPRETATION_PATTERN.test(pearl.whyItMatters)),
      Boolean(pearl.managementImplication),
      !/\b(?:useful test|helps diagnose|important test)\b/i.test(text),
    ]);
  }

  private scoreExamPearl(item: unknown): number {
    const pearl = this.schemaContractService.readTypedPearl(item);
    const text = this.schemaContractService.canonicalText(item, [
      'content',
      'whyItMatters',
      'discriminator',
    ]);
    return this.scoreParts([
      Boolean(pearl.title || pearl.content),
      Boolean(pearl.content && MECHANISM_PATTERN.test(pearl.content)),
      Boolean(pearl.whyItMatters && INTERPRETATION_PATTERN.test(pearl.whyItMatters)),
      Boolean(pearl.discriminator || COMPARISON_PATTERN.test(text)),
    ]);
  }

  private scoreManagementAnchor(item: unknown): number {
    const pearl = this.schemaContractService.readTypedPearl(item);
    const text = this.schemaContractService.canonicalText(item, [
      'content',
      'whyItMatters',
      'managementImplication',
      'escalationImplication',
    ]);
    return this.scoreParts([
      Boolean(pearl.title || pearl.content),
      INDICATION_PATTERN.test(pearl.content ?? ''),
      Boolean(pearl.whyItMatters),
      Boolean(pearl.managementImplication),
      Boolean(pearl.escalationImplication),
      /\b(?:because|risk|prevents|avoid|source control|monitor|escalat|delay)\b/i.test(
        text,
      ),
    ]);
  }

  private scorePitfall(item: unknown): number {
    const pearl = this.schemaContractService.readTypedPearl(item);
    const text = this.schemaContractService.canonicalText(item, [
      'content',
      'whyItMatters',
      'trapAvoided',
    ]);
    return this.scoreParts([
      Boolean(pearl.title || pearl.content),
      /\b(?:trap|false|normal|early|miss|delay|reassur|avoid|do not|pitfall)\b/i.test(
        text,
      ),
      Boolean(pearl.whyItMatters),
      Boolean(pearl.trapAvoided),
    ]);
  }

  private scoreRecallPrompt(item: unknown): number {
    const object = this.asObject(item);
    const text = this.textFrom(item);
    return this.scoreParts([
      Boolean(this.cleanString(object.prompt)),
      Boolean(this.cleanString(object.answer)),
      Boolean(this.cleanString(object.explanation)),
      Boolean(this.cleanString(object.linkedConcept)),
      Boolean(this.cleanString(object.sourceSection)),
      Boolean(this.cleanString(object.difficulty)),
      COMPARISON_PATTERN.test(text) || /\b(?:why|what changes|next step|trap|risk)\b/i.test(text),
    ]);
  }

  private scoreSection(
    value: unknown,
    scorer: (item: unknown) => number,
  ): number {
    const items = Array.isArray(value) ? value : this.asArray(value);
    if (!items.length) {
      return 0;
    }

    return this.round(
      items.reduce((sum, item) => sum + scorer(item), 0) / items.length,
    );
  }

  private scoreParts(parts: boolean[]): number {
    return this.round(parts.filter(Boolean).length / Math.max(1, parts.length));
  }

  private asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private asObject(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
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

  private cleanString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
