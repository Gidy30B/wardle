import { Injectable } from '@nestjs/common';
import { EducationSchemaContractService } from './education-schema-contract.service';
import type { EducationRegenerableSection } from './education-section-quality-classifier.service';
import type {
  EducationTeachingRulePack,
  TeachingUnit,
  TeachingUnitCategory,
} from './education-teaching-rules.service';

export type EducationSectionRepairConcept = {
  id: string;
  label: string;
  normalizedLabel: string;
  normalizedText: string;
  source: 'current_section' | 'teaching_rule';
  sourceId?: string;
  required: boolean;
  weak: boolean;
  duplicateOf?: string;
};

export type EducationSectionRepairSpecification = {
  section: EducationRegenerableSection;
  baseEducationId: string;
  baseVersion: number;
  preserve: EducationSectionRepairConcept[];
  repair: EducationSectionRepairConcept[];
  add: EducationSectionRepairConcept[];
  requiredCoverage: EducationSectionRepairConcept[];
  mustNotLose: EducationSectionRepairConcept[];
  maxItems: number;
};

export type EducationSectionConceptChange =
  | 'PRESERVED'
  | 'IMPROVED'
  | 'ADDED'
  | 'CONSOLIDATED'
  | 'WEAKENED'
  | 'LOST';

export type EducationSectionCoverageChange = {
  concept: EducationSectionRepairConcept;
  change: EducationSectionConceptChange;
  matchedProposedIds: string[];
};

export type EducationSectionCoverageComparison = {
  section: EducationRegenerableSection;
  baseEducationId: string;
  baseVersion: number;
  changes: EducationSectionCoverageChange[];
  lost: EducationSectionCoverageChange[];
  weakened: EducationSectionCoverageChange[];
  preserved: EducationSectionCoverageChange[];
  improved: EducationSectionCoverageChange[];
  added: EducationSectionCoverageChange[];
  consolidated: EducationSectionCoverageChange[];
  coverageRegression: boolean;
  coverageRegressionConcepts: Array<{
    id: string;
    label: string;
    source: EducationSectionRepairConcept['source'];
    sourceId?: string;
  }>;
};

type SectionQualityFinding = {
  blockers?: string[];
  warnings?: string[];
};

const SECTION_TEACHING_CATEGORIES: Record<
  EducationRegenerableSection,
  TeachingUnitCategory[]
> = {
  differentials: ['differential_concept'],
  investigations: ['investigation_concept'],
  examPearls: ['exam_mechanism', 'finding_concept'],
  management: ['management_concept'],
};

const SECTION_BASE_MAX_ITEMS: Record<EducationRegenerableSection, number> = {
  differentials: 5,
  investigations: 5,
  examPearls: 5,
  management: 6,
};

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'by',
  'for',
  'from',
  'in',
  'into',
  'of',
  'or',
  'the',
  'to',
  'with',
  'without',
]);

@Injectable()
export class EducationSectionCoverageService {
  constructor(
    private readonly educationSchemaContractService: EducationSchemaContractService = new EducationSchemaContractService(),
  ) {}

  buildRepairSpecification(input: {
    section: EducationRegenerableSection;
    baseEducationId: string;
    baseVersion: number;
    currentSection: unknown;
    teachingRules?: EducationTeachingRulePack | null;
    currentQuality?: SectionQualityFinding | null;
  }): EducationSectionRepairSpecification {
    const currentConcepts = this.extractCurrentConcepts(
      input.section,
      input.currentSection,
    );
    const requiredCoverage = this.extractRequiredConcepts(
      input.section,
      input.teachingRules ?? null,
    );
    const currentFindingCodes = [
      ...(input.currentQuality?.blockers ?? []),
      ...(input.currentQuality?.warnings ?? []),
    ];
    const currentWeak = currentFindingCodes.length > 0;
    const preserve = currentConcepts.filter((concept) => !concept.duplicateOf);
    const repair = preserve
      .filter((concept) => currentWeak || concept.weak)
      .map((concept) => ({ ...concept, weak: true }));
    const add = requiredCoverage.filter(
      (required) =>
        !preserve.some((current) => this.conceptsMatch(current, required)),
    );
    const mustNotLose = this.dedupeConcepts([
      ...preserve,
      ...requiredCoverage,
    ]).filter((concept) => !concept.duplicateOf);
    const maxItems = Math.min(
      8,
      Math.max(
        SECTION_BASE_MAX_ITEMS[input.section],
        Math.min(8, mustNotLose.length + Math.ceil(repair.length / 2)),
      ),
    );

    return {
      section: input.section,
      baseEducationId: input.baseEducationId,
      baseVersion: input.baseVersion,
      preserve,
      repair,
      add,
      requiredCoverage,
      mustNotLose,
      maxItems,
    };
  }

  compare(input: {
    repairSpecification: EducationSectionRepairSpecification;
    proposedSection: unknown;
  }): EducationSectionCoverageComparison {
    const proposedConcepts = this.extractCurrentConcepts(
      input.repairSpecification.section,
      input.proposedSection,
    );
    const proposedUnique = proposedConcepts.filter(
      (concept) => !concept.duplicateOf,
    );
    const changes: EducationSectionCoverageChange[] =
      input.repairSpecification.mustNotLose.map((concept) => {
      const matches = proposedUnique.filter((proposed) =>
        this.conceptsMatch(concept, proposed),
      );
      if (!matches.length) {
        return {
          concept,
          change: 'LOST' as const,
          matchedProposedIds: [],
        };
      }

      const direct = matches.some(
        (match) =>
          match.normalizedLabel === concept.normalizedLabel ||
          match.id === concept.id,
      );
      const consolidated =
        !direct ||
        matches.some((match) =>
          input.repairSpecification.mustNotLose.some(
            (other) =>
              other.id !== concept.id && this.conceptsMatch(other, match),
          ),
        );
      const improved = concept.weak && this.hasSectionContractStrength(
        input.repairSpecification.section,
        matches,
      );

      return {
        concept,
        change: improved
          ? ('IMPROVED' as const)
          : consolidated
            ? ('CONSOLIDATED' as const)
            : ('PRESERVED' as const),
        matchedProposedIds: matches.map((match) => match.id),
      };
      });

    const added: EducationSectionCoverageChange[] = proposedUnique
      .filter(
        (proposed) =>
          !input.repairSpecification.mustNotLose.some((required) =>
            this.conceptsMatch(required, proposed),
          ),
      )
      .map((concept) => ({
        concept,
        change: 'ADDED' as const,
        matchedProposedIds: [concept.id],
      }));
    const allChanges = [...changes, ...added];
    const lost = allChanges.filter((change) => change.change === 'LOST');
    const weakened = allChanges.filter((change) => change.change === 'WEAKENED');
    const coverageRegression = lost.some(
      (change) => change.concept.required || change.concept.source === 'current_section',
    );

    return {
      section: input.repairSpecification.section,
      baseEducationId: input.repairSpecification.baseEducationId,
      baseVersion: input.repairSpecification.baseVersion,
      changes: allChanges,
      lost,
      weakened,
      preserved: allChanges.filter((change) => change.change === 'PRESERVED'),
      improved: allChanges.filter((change) => change.change === 'IMPROVED'),
      added,
      consolidated: allChanges.filter(
        (change) => change.change === 'CONSOLIDATED',
      ),
      coverageRegression,
      coverageRegressionConcepts: lost.map((change) => ({
        id: change.concept.id,
        label: change.concept.label,
        source: change.concept.source,
        sourceId: change.concept.sourceId,
      })),
    };
  }

  private extractCurrentConcepts(
    section: EducationRegenerableSection,
    value: unknown,
  ): EducationSectionRepairConcept[] {
    const items = Array.isArray(value) ? value : [];
    return this.dedupeConcepts(
      items
        .map((item, index) => this.currentConceptFromItem(section, item, index))
        .filter(
          (concept): concept is EducationSectionRepairConcept =>
            concept !== null,
        ),
    );
  }

  private currentConceptFromItem(
    section: EducationRegenerableSection,
    item: unknown,
    index: number,
  ): EducationSectionRepairConcept | null {
    const pearl = this.educationSchemaContractService.readTypedPearl(item);
    const text = this.sectionConceptText(section, item);
    const label = pearl.title ?? this.labelFromText(text);
    const normalizedLabel = this.normalize(label);
    const normalizedText = this.normalize([label, text].join(' '));
    if (!normalizedLabel || !this.hasMeaningfulClinicalSignal(normalizedText)) {
      return null;
    }

    return {
      id: pearl.id ?? `${section}-current-${index + 1}`,
      label,
      normalizedLabel,
      normalizedText,
      source: 'current_section',
      required: false,
      weak: !this.hasSectionContractStrength(section, [
        {
          id: pearl.id ?? `${section}-current-${index + 1}`,
          label,
          normalizedLabel,
          normalizedText,
          source: 'current_section',
          required: false,
          weak: false,
        },
      ]),
    };
  }

  private extractRequiredConcepts(
    section: EducationRegenerableSection,
    teachingRules: EducationTeachingRulePack | null,
  ): EducationSectionRepairConcept[] {
    if (!teachingRules) {
      return [];
    }
    const categories = new Set(SECTION_TEACHING_CATEGORIES[section]);
    const units = teachingRules.teachingUnits.filter(
      (unit) =>
        unit.appliesToEducation &&
        categories.has(unit.category) &&
        (unit.importance === 'critical' || unit.importance === 'high'),
    );
    const fromUnits = units.map((unit) => this.requiredConceptFromUnit(unit));
    const fallbackTerms = this.requiredFallbackTerms(section, teachingRules).map(
      (term, index) =>
        this.requiredConceptFromTerm(
          term,
          `${section}-required-${index + 1}`,
        ),
    );
    return this.dedupeConcepts([...fromUnits, ...fallbackTerms]);
  }

  private requiredConceptFromUnit(unit: TeachingUnit): EducationSectionRepairConcept {
    const label = unit.label;
    const manifestations = unit.acceptableManifestations.join(' ');
    return {
      id: `teaching-rule:${unit.id}`,
      label,
      normalizedLabel: this.normalize(label),
      normalizedText: this.normalize([label, manifestations, unit.rationale].join(' ')),
      source: 'teaching_rule',
      sourceId: unit.id,
      required: true,
      weak: false,
    };
  }

  private requiredConceptFromTerm(
    term: string,
    id: string,
  ): EducationSectionRepairConcept {
    return {
      id,
      label: term,
      normalizedLabel: this.normalize(term),
      normalizedText: this.normalize(term),
      source: 'teaching_rule',
      required: true,
      weak: false,
    };
  }

  private requiredFallbackTerms(
    section: EducationRegenerableSection,
    teachingRules: EducationTeachingRulePack,
  ): string[] {
    if (section === 'differentials') {
      return teachingRules.requiredDifferentials;
    }
    if (section === 'investigations') {
      return teachingRules.requiredInvestigations;
    }
    if (section === 'examPearls') {
      return teachingRules.requiredExamMechanisms;
    }
    return teachingRules.requiredManagementAnchors;
  }

  private sectionConceptText(
    section: EducationRegenerableSection,
    item: unknown,
  ): string {
    if (section === 'differentials') {
      return this.educationSchemaContractService.canonicalText(item, [
        'content',
        'discriminator',
        'trapAvoided',
      ]);
    }
    if (section === 'investigations') {
      return this.educationSchemaContractService.canonicalText(item, [
        'content',
        'whyItMatters',
      ]);
    }
    if (section === 'examPearls') {
      return this.educationSchemaContractService.canonicalText(item, [
        'content',
        'whyItMatters',
        'discriminator',
      ]);
    }
    return this.educationSchemaContractService.canonicalText(item, ['content']);
  }

  private conceptsMatch(
    left: EducationSectionRepairConcept,
    right: EducationSectionRepairConcept,
  ): boolean {
    if (
      left.normalizedLabel &&
      (right.normalizedText.includes(left.normalizedLabel) ||
        left.normalizedText.includes(right.normalizedLabel))
    ) {
      return true;
    }
    const leftTokens = this.tokens(left.normalizedText);
    const rightTokens = this.tokens(right.normalizedText);
    if (!leftTokens.length || !rightTokens.length) {
      return false;
    }
    const hits = leftTokens.filter((token) => rightTokens.includes(token)).length;
    const ratio = hits / Math.min(leftTokens.length, rightTokens.length);
    return hits >= 2 && ratio >= 0.5;
  }

  private dedupeConcepts(
    concepts: EducationSectionRepairConcept[],
  ): EducationSectionRepairConcept[] {
    const result: EducationSectionRepairConcept[] = [];
    for (const concept of concepts) {
      const duplicate = result.find((existing) =>
        this.conceptsMatch(existing, concept),
      );
      if (duplicate) {
        result.push({ ...concept, duplicateOf: duplicate.id });
      } else {
        result.push(concept);
      }
    }
    return result;
  }

  private hasSectionContractStrength(
    section: EducationRegenerableSection,
    concepts: EducationSectionRepairConcept[],
  ): boolean {
    const text = concepts.map((concept) => concept.normalizedText).join(' ');
    if (!text) {
      return false;
    }
    if (section === 'investigations') {
      return /\b(?:positive|negative|elevated|reduced|shows|reveals|demonstrates|finding|result)\b/.test(
        text,
      );
    }
    if (section === 'examPearls') {
      return /\b(?:because|due to|reflects|mechanism|probability|likelihood|distinguish|separates)\b/.test(
        text,
      );
    }
    if (section === 'differentials') {
      return /\b(?:rather than|whereas|unlike|distinguish|mimic|overlap|separator|favors|favours)\b/.test(
        text,
      );
    }
    return /\b(?:when|if|monitor|surveillance|screening|follow|plan|therapy|treat|manage|refer|coordinate)\b/.test(
      text,
    );
  }

  private hasMeaningfulClinicalSignal(text: string): boolean {
    return (
      this.tokens(text).length >= 2 &&
      !/\b(?:supports diagnosis|useful|helpful|important|appropriate management)\b/.test(
        text,
      )
    );
  }

  private labelFromText(text: string): string {
    return text.split(/[.;]/)[0]?.trim().slice(0, 80) || 'Untitled concept';
  }

  private tokens(value: string): string[] {
    return this.normalize(value)
      .split(' ')
      .map((token) => this.stemToken(token))
      .filter((token) => token.length > 2 && !STOPWORDS.has(token));
  }

  private stemToken(token: string): string {
    if (token.endsWith('ies') && token.length > 5) {
      return `${token.slice(0, -3)}y`;
    }
    if (token.endsWith('ing') && token.length > 6) {
      return token.slice(0, -3);
    }
    if (token.endsWith('s') && token.length > 5) {
      return token.slice(0, -1);
    }
    return token;
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .replace(/\bgmfcs\b/g, 'gross motor function classification system')
      .replace(/\bpt\b/g, 'physiotherapy')
      .replace(/\bot\b/g, 'occupational therapy')
      .replace(/orthopedic/g, 'orthopaedic')
      .replace(/long term/g, 'long-term')
      .replace(/[^a-z0-9-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
