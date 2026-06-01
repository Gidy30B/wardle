import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import {
  EducationTeachingRulesService,
  type EducationTeachingRulePack,
  type TeachingUnit,
} from './education-teaching-rules.service';

export type DiagnosisTeachingRuleSeedSummary = {
  diagnosesMatched: number;
  diagnosesSkipped: number;
  rulesUpserted: number;
  skippedDiagnosisKeys: string[];
};

type TeachingRulePrisma = Pick<PrismaClient, 'diagnosisRegistry' | 'diagnosisTeachingRule'>;

@Injectable()
export class DiagnosisTeachingRuleSeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly legacyTeachingRulesService: EducationTeachingRulesService = new EducationTeachingRulesService(),
  ) {}

  async seedLegacyTeachingRules(): Promise<DiagnosisTeachingRuleSeedSummary> {
    return seedLegacyDiagnosisTeachingRules(
      this.prisma,
      this.legacyTeachingRulesService,
    );
  }

  async seedLegacyTeachingRulesForDiagnosis(
    diagnosisRegistryId: string,
  ): Promise<DiagnosisTeachingRuleSeedSummary> {
    return seedLegacyDiagnosisTeachingRulesForDiagnosis(
      this.prisma,
      diagnosisRegistryId,
      this.legacyTeachingRulesService,
    );
  }
}

export async function seedLegacyDiagnosisTeachingRules(
  prisma: TeachingRulePrisma,
  legacyTeachingRulesService: EducationTeachingRulesService = new EducationTeachingRulesService(),
): Promise<DiagnosisTeachingRuleSeedSummary> {
  const summary: DiagnosisTeachingRuleSeedSummary = {
    diagnosesMatched: 0,
    diagnosesSkipped: 0,
    rulesUpserted: 0,
    skippedDiagnosisKeys: [],
  };

  for (const diagnosisKey of legacyTeachingRulesService.getSeedDiagnosisKeys()) {
    const rules = legacyTeachingRulesService.getRules({
      canonicalName: diagnosisKey,
    });
    if (!rules) {
      summary.diagnosesSkipped += 1;
      summary.skippedDiagnosisKeys.push(diagnosisKey);
      continue;
    }

    const registry = await findRegistry(prisma, diagnosisKey);
    if (!registry) {
      summary.diagnosesSkipped += 1;
      summary.skippedDiagnosisKeys.push(diagnosisKey);
      continue;
    }

    summary.diagnosesMatched += 1;
    for (const unit of rules.teachingUnits) {
      await prisma.diagnosisTeachingRule.upsert({
        where: {
          diagnosisRegistryId_stableKey: {
            diagnosisRegistryId: registry.id,
            stableKey: unit.id,
          },
        },
        create: toPersistedRuleCreate(registry.id, rules, unit),
        update: toPersistedRuleUpdate(rules, unit),
      });
      summary.rulesUpserted += 1;
    }
  }

  return summary;
}

export async function seedLegacyDiagnosisTeachingRulesForDiagnosis(
  prisma: TeachingRulePrisma,
  diagnosisRegistryId: string,
  legacyTeachingRulesService: EducationTeachingRulesService = new EducationTeachingRulesService(),
): Promise<DiagnosisTeachingRuleSeedSummary> {
  const registry = await prisma.diagnosisRegistry.findFirst({
    where: { id: diagnosisRegistryId, active: true },
    select: {
      id: true,
      canonicalName: true,
      displayLabel: true,
      aliases: {
        where: { active: true },
        select: { term: true },
      },
    },
  });

  const summary: DiagnosisTeachingRuleSeedSummary = {
    diagnosesMatched: 0,
    diagnosesSkipped: 0,
    rulesUpserted: 0,
    skippedDiagnosisKeys: [],
  };

  if (!registry) {
    summary.diagnosesSkipped = 1;
    summary.skippedDiagnosisKeys = [diagnosisRegistryId];
    return summary;
  }

  const rules = legacyTeachingRulesService.getRules(registry);
  if (!rules) {
    summary.diagnosesSkipped = 1;
    summary.skippedDiagnosisKeys = [registry.canonicalName];
    return summary;
  }

  summary.diagnosesMatched = 1;
  for (const unit of rules.teachingUnits) {
    await prisma.diagnosisTeachingRule.upsert({
      where: {
        diagnosisRegistryId_stableKey: {
          diagnosisRegistryId: registry.id,
          stableKey: unit.id,
        },
      },
      create: toPersistedRuleCreate(registry.id, rules, unit),
      update: toPersistedRuleUpdate(rules, unit),
    });
    summary.rulesUpserted += 1;
  }

  return summary;
}

async function findRegistry(prisma: TeachingRulePrisma, diagnosisKey: string) {
  const normalized = normalize(diagnosisKey);
  return prisma.diagnosisRegistry.findFirst({
    where: {
      active: true,
      OR: [
        { canonicalNormalized: normalized },
        { canonicalName: { equals: diagnosisKey, mode: 'insensitive' } },
        { displayLabel: { equals: diagnosisKey, mode: 'insensitive' } },
        {
          aliases: {
            some: {
              active: true,
              OR: [
                { normalizedTerm: normalized },
                { term: { equals: diagnosisKey, mode: 'insensitive' } },
              ],
            },
          },
        },
      ],
    },
    select: { id: true },
  });
}

function toPersistedRuleCreate(
  diagnosisRegistryId: string,
  rules: EducationTeachingRulePack,
  unit: TeachingUnit,
): Prisma.DiagnosisTeachingRuleCreateInput {
  return {
    diagnosisRegistry: { connect: { id: diagnosisRegistryId } },
    ...toPersistedRuleFields(rules, unit),
  };
}

function toPersistedRuleUpdate(
  rules: EducationTeachingRulePack,
  unit: TeachingUnit,
): Prisma.DiagnosisTeachingRuleUpdateInput {
  return toPersistedRuleFields(rules, unit);
}

function toPersistedRuleFields(
  rules: EducationTeachingRulePack,
  unit: TeachingUnit,
) {
  return {
    stableKey: unit.id,
    title: unit.label,
    category: unit.category,
    importance: unit.importance,
    rationale: unit.rationale,
    acceptableManifestations:
      unit.acceptableManifestations as Prisma.InputJsonValue,
    requiredDifferentials:
      rules.requiredDifferentials as Prisma.InputJsonValue,
    expectedEvidence: {
      requiredPitfalls: rules.requiredPitfalls,
      requiredFindings: rules.requiredFindings,
      requiredInvestigations: rules.requiredInvestigations,
      requiredExamMechanisms: rules.requiredExamMechanisms,
      requiredManagementAnchors: rules.requiredManagementAnchors,
      requiredRecallConcepts: rules.requiredRecallConcepts,
    } satisfies Prisma.InputJsonObject,
    difficultyHints: {
      packDifficultyStrategy: rules.difficultyStrategy,
      unitAvoidTooEarly: unit.avoidTooEarly ?? [],
    } satisfies Prisma.InputJsonObject,
    avoidTooEarly: Boolean(unit.avoidTooEarly?.length),
    appliesToEducation: unit.appliesToEducation,
    appliesToCaseGeneration: unit.appliesToCaseGeneration,
    appliesToGraph: false,
    status: 'ACTIVE',
    source: 'LEGACY_SEED',
    version: 1,
  };
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
