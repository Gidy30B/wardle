import { Injectable, Optional } from '@nestjs/common';
import type { DiagnosisTeachingRule } from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import type { EducationRuleRegistryMetadata } from './education-knowledge-rules.service';
import {
  EducationTeachingRulesService,
  type DifficultyStrategy,
  type EducationTeachingRulePack,
  type ManifestationOption,
  type TeachingUnit,
  type TeachingUnitCategory,
  type TeachingUnitImportance,
} from './education-teaching-rules.service';

const EMPTY_DIFFICULTY_STRATEGY: DifficultyStrategy = {
  targetDifficulty: 'medium',
  revealCoreUnitByClue: 3,
  avoidTooEarly: [],
  allowAlternativeManifestations: true,
};

@Injectable()
export class DiagnosisCurriculumProviderService {
  constructor(
    @Optional()
    private readonly prisma?: PrismaService,
    @Optional()
    private readonly legacyTeachingRulesService: EducationTeachingRulesService = new EducationTeachingRulesService(),
  ) {}

  async getRules(
    registry: EducationRuleRegistryMetadata,
  ): Promise<EducationTeachingRulePack | null> {
    const persistedPack = await this.getPersistedRules(registry);
    if (persistedPack) {
      return persistedPack;
    }

    const legacyPack = this.legacyTeachingRulesService.getRules(registry);
    return legacyPack
      ? {
          ...legacyPack,
          teachingUnits: legacyPack.teachingUnits.map((unit) => ({
            ...unit,
            source: 'legacy_teaching_rules',
          })),
          source: 'legacy_teaching_rules',
        }
      : null;
  }

  async getRulesOrEmpty(
    registry: EducationRuleRegistryMetadata,
  ): Promise<EducationTeachingRulePack> {
    return (await this.getRules(registry)) ?? this.emptyRulePack(registry);
  }

  getManifestationOptions(
    rules: EducationTeachingRulePack | null,
  ): ManifestationOption[] {
    return this.legacyTeachingRulesService.getManifestationOptions(rules);
  }

  getCaseTeachingUnits(input: {
    rules: EducationTeachingRulePack | null;
    difficulty?: string | null;
    count?: number;
  }): TeachingUnit[] {
    return this.legacyTeachingRulesService.getCaseTeachingUnits(input);
  }

  private emptyRulePack(
    registry: EducationRuleRegistryMetadata,
  ): EducationTeachingRulePack {
    return {
      diagnosisKey: registry.canonicalName ?? '',
      teachingUnits: [],
      difficultyStrategy: { ...EMPTY_DIFFICULTY_STRATEGY },
      requiredDifferentials: [],
      requiredPitfalls: [],
      requiredFindings: [],
      requiredInvestigations: [],
      requiredExamMechanisms: [],
      requiredManagementAnchors: [],
      requiredRecallConcepts: [],
    };
  }

  private async getPersistedRules(
    registry: EducationRuleRegistryMetadata,
  ): Promise<EducationTeachingRulePack | null> {
    const diagnosisRegistryId = registry.id;
    if (!this.prisma || !diagnosisRegistryId) {
      return null;
    }

    const rows = await this.prisma.diagnosisTeachingRule.findMany({
      where: {
        diagnosisRegistryId,
        status: { in: ['ACTIVE', 'APPROVED'] },
      },
      orderBy: [{ category: 'asc' }, { stableKey: 'asc' }],
    });

    if (!rows.length) {
      return null;
    }

    return this.rowsToRulePack(registry, rows);
  }

  private rowsToRulePack(
    registry: EducationRuleRegistryMetadata,
    rows: DiagnosisTeachingRule[],
  ): EducationTeachingRulePack {
    const teachingUnits = rows.map((row) => this.rowToTeachingUnit(row));
    const firstEvidence = this.asObject(rows[0]?.expectedEvidence);
    const firstDifficulty = this.asObject(rows[0]?.difficultyHints);
    const packDifficulty = this.asObject(firstDifficulty?.packDifficultyStrategy);
    const difficultyStrategy = this.toDifficultyStrategy(
      packDifficulty,
      teachingUnits,
    );

    return {
      diagnosisKey: registry.canonicalName ?? registry.displayLabel ?? '',
      teachingUnits,
      difficultyStrategy,
      requiredDifferentials:
        this.stringArray(rows[0]?.requiredDifferentials) ??
        this.manifestationsFor(teachingUnits, 'differential_concept'),
      requiredPitfalls:
        this.stringArray(firstEvidence?.requiredPitfalls) ??
        this.manifestationsFor(teachingUnits, 'pitfall_concept'),
      requiredFindings:
        this.stringArray(firstEvidence?.requiredFindings) ??
        this.manifestationsFor(teachingUnits, 'finding_concept'),
      requiredInvestigations:
        this.stringArray(firstEvidence?.requiredInvestigations) ??
        this.manifestationsFor(teachingUnits, 'investigation_concept'),
      requiredExamMechanisms:
        this.stringArray(firstEvidence?.requiredExamMechanisms) ??
        this.manifestationsFor(teachingUnits, 'exam_mechanism'),
      requiredManagementAnchors:
        this.stringArray(firstEvidence?.requiredManagementAnchors) ??
        this.manifestationsFor(teachingUnits, 'management_concept'),
      requiredRecallConcepts:
        this.stringArray(firstEvidence?.requiredRecallConcepts) ??
        teachingUnits.map((unit) => unit.label),
      source: 'persisted_teaching_rule',
    };
  }

  private rowToTeachingUnit(row: DiagnosisTeachingRule): TeachingUnit {
    const difficultyHints = this.asObject(row.difficultyHints);
    const unitAvoidTooEarly =
      this.stringArray(difficultyHints?.unitAvoidTooEarly) ?? [];
    return {
      id: row.stableKey,
      label: row.title,
      category: this.toTeachingUnitCategory(row.category),
      importance: this.toTeachingUnitImportance(row.importance),
      rationale: row.rationale ?? '',
      acceptableManifestations:
        this.stringArray(row.acceptableManifestations) ?? [],
      appliesToEducation: row.appliesToEducation,
      appliesToCaseGeneration: row.appliesToCaseGeneration,
      ...(unitAvoidTooEarly.length ? { avoidTooEarly: unitAvoidTooEarly } : {}),
      source: 'persisted_teaching_rule',
    };
  }

  private toDifficultyStrategy(
    value: Record<string, unknown> | null,
    teachingUnits: TeachingUnit[],
  ): DifficultyStrategy {
    const targetDifficulty =
      value?.targetDifficulty === 'easy' ||
      value?.targetDifficulty === 'medium' ||
      value?.targetDifficulty === 'hard'
        ? value.targetDifficulty
        : EMPTY_DIFFICULTY_STRATEGY.targetDifficulty;
    const revealCoreUnitByClue =
      typeof value?.revealCoreUnitByClue === 'number'
        ? value.revealCoreUnitByClue
        : EMPTY_DIFFICULTY_STRATEGY.revealCoreUnitByClue;
    const avoidTooEarly = [
      ...(this.stringArray(value?.avoidTooEarly) ?? []),
      ...teachingUnits.flatMap((unit) => unit.avoidTooEarly ?? []),
    ];

    return {
      targetDifficulty,
      ...(revealCoreUnitByClue ? { revealCoreUnitByClue } : {}),
      avoidTooEarly,
      allowAlternativeManifestations:
        typeof value?.allowAlternativeManifestations === 'boolean'
          ? value.allowAlternativeManifestations
          : EMPTY_DIFFICULTY_STRATEGY.allowAlternativeManifestations,
    };
  }

  private manifestationsFor(
    teachingUnits: TeachingUnit[],
    category: TeachingUnitCategory,
  ): string[] {
    return teachingUnits
      .filter((unit) => unit.category === category)
      .flatMap((unit) => unit.acceptableManifestations);
  }

  private toTeachingUnitCategory(value: string): TeachingUnitCategory {
    const allowed: TeachingUnitCategory[] = [
      'differential_concept',
      'finding_concept',
      'exam_mechanism',
      'investigation_concept',
      'pitfall_concept',
      'management_concept',
      'recall_concept',
    ];
    return allowed.includes(value as TeachingUnitCategory)
      ? (value as TeachingUnitCategory)
      : 'recall_concept';
  }

  private toTeachingUnitImportance(value: string): TeachingUnitImportance {
    return value === 'critical' || value === 'high' || value === 'supporting'
      ? value
      : 'supporting';
  }

  private stringArray(value: unknown): string[] | null {
    if (!Array.isArray(value)) {
      return null;
    }
    return value.filter((item): item is string => typeof item === 'string');
  }

  private asObject(value: unknown): Record<string, unknown> | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }
}
