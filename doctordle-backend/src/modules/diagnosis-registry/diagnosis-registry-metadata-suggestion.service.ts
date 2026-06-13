import { Injectable, NotFoundException } from '@nestjs/common';
import { DiagnosisRegistryCandidateStatus, DiagnosisRegistryStatus } from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import {
  DIAGNOSIS_CLUE_TYPES,
  type DiagnosisAgeGroupValue,
  type DiagnosisClinicalSettingValue,
  type DiagnosisClueTypeValue,
  type DiagnosisDifficultyBandValue,
  type DiagnosisRarityBandValue,
  type DiagnosisUrgencyLevelValue,
} from './diagnosis-registry-taxonomy';
import { normalizeDiagnosisTerm } from './diagnosis-term-normalizer';

type RegistryMetadataSuggestionRow = {
  id: string;
  canonicalName: string;
  canonicalNormalized: string;
  displayLabel: string;
  specialty: string | null;
  subspecialty: string | null;
  category: string | null;
  bodySystem: string | null;
  organSystem: string | null;
  difficultyBand: DiagnosisDifficultyBandValue | null;
  rarityBand: DiagnosisRarityBandValue | null;
  clinicalSetting: DiagnosisClinicalSettingValue | null;
  ageGroup: DiagnosisAgeGroupValue | null;
  urgencyLevel: DiagnosisUrgencyLevelValue | null;
  preferredClueTypes: DiagnosisClueTypeValue[] | null;
  aliases: Array<{ term: string; normalizedTerm: string; active: boolean }>;
  createdRegistryCandidates: Array<{
    sourceRawText: string;
    proposedAliases: unknown;
  }>;
  cases: Array<{
    title: string;
    proposedDiagnosisText: string;
    currentRevision: {
      symptoms: string[];
      differentials: string[];
    } | null;
  }>;
};

export type DiagnosisRegistryMetadataSuggestion = {
  diagnosisRegistryId: string;
  source: 'heuristic';
  aliases: Array<{
    term: string;
    normalizedTerm: string;
    acceptedForMatch: boolean;
    confidence: number;
    rationale: string;
  }>;
  metadata: {
    specialty: string | null;
    subspecialty: string | null;
    category: string | null;
    bodySystem: string | null;
    organSystem: string | null;
    difficultyBand: DiagnosisDifficultyBandValue | null;
    rarityBand: DiagnosisRarityBandValue | null;
    clinicalSetting: DiagnosisClinicalSettingValue | null;
    ageGroup: DiagnosisAgeGroupValue | null;
    urgencyLevel: DiagnosisUrgencyLevelValue | null;
    preferredClueTypes: DiagnosisClueTypeValue[];
  };
  duplicateRisk: {
    canonicalMatches: number;
    aliasMatches: number;
    pendingCandidateMatches: number;
  };
  confidence: number;
  rationale: string[];
};

type PatternSuggestion = {
  tokens: string[];
  metadata: DiagnosisRegistryMetadataSuggestion['metadata'];
  aliases?: string[];
  rationale: string;
};

const PATTERNS: PatternSuggestion[] = [
  {
    tokens: ['sickle cell', 'vaso occlusive', 'acute chest'],
    metadata: {
      specialty: 'Hematology',
      subspecialty: null,
      category: 'Hemoglobinopathy',
      bodySystem: 'Hematologic',
      organSystem: 'Blood',
      difficultyBand: 'INTERMEDIATE',
      rarityBand: 'UNCOMMON',
      clinicalSetting: 'EMERGENCY',
      ageGroup: 'ANY',
      urgencyLevel: 'URGENT',
      preferredClueTypes: ['history', 'symptom', 'lab'],
    },
    aliases: ['Sickle cell disease', 'SCD'],
    rationale: 'Matched sickle-cell hematology terminology',
  },
  {
    tokens: ['copd', 'chronic obstructive pulmonary'],
    metadata: {
      specialty: 'Pulmonology',
      subspecialty: null,
      category: 'Obstructive lung disease',
      bodySystem: 'Respiratory',
      organSystem: 'Lungs',
      difficultyBand: 'BASIC',
      rarityBand: 'COMMON',
      clinicalSetting: 'OUTPATIENT',
      ageGroup: 'ADULT',
      urgencyLevel: 'ROUTINE',
      preferredClueTypes: ['history', 'exam', 'symptom'],
    },
    aliases: ['COPD'],
    rationale: 'Matched obstructive pulmonary disease terminology',
  },
  {
    tokens: ['appendicitis'],
    metadata: {
      specialty: 'General Surgery',
      subspecialty: null,
      category: 'Acute abdomen',
      bodySystem: 'Gastrointestinal',
      organSystem: 'Appendix',
      difficultyBand: 'BASIC',
      rarityBand: 'COMMON',
      clinicalSetting: 'EMERGENCY',
      ageGroup: 'ANY',
      urgencyLevel: 'URGENT',
      preferredClueTypes: ['history', 'exam', 'lab'],
    },
    rationale: 'Matched acute abdominal surgical diagnosis terminology',
  },
  {
    tokens: ['diabetic ketoacidosis', 'dka'],
    metadata: {
      specialty: 'Endocrinology',
      subspecialty: null,
      category: 'Metabolic emergency',
      bodySystem: 'Endocrine',
      organSystem: 'Pancreas',
      difficultyBand: 'INTERMEDIATE',
      rarityBand: 'COMMON',
      clinicalSetting: 'EMERGENCY',
      ageGroup: 'ANY',
      urgencyLevel: 'EMERGENT',
      preferredClueTypes: ['history', 'lab', 'vital'],
    },
    aliases: ['DKA'],
    rationale: 'Matched metabolic emergency terminology',
  },
];

@Injectable()
export class DiagnosisRegistryMetadataSuggestionService {
  constructor(private readonly prisma: PrismaService) {}

  async suggestRegistryMetadata(
    diagnosisRegistryId: string,
  ): Promise<DiagnosisRegistryMetadataSuggestion> {
    const registry = (await this.prisma.diagnosisRegistry.findUnique({
      where: { id: diagnosisRegistryId },
      select: {
        id: true,
        canonicalName: true,
        canonicalNormalized: true,
        displayLabel: true,
        specialty: true,
        subspecialty: true,
        category: true,
        bodySystem: true,
        organSystem: true,
        difficultyBand: true,
        rarityBand: true,
        clinicalSetting: true,
        ageGroup: true,
        urgencyLevel: true,
        preferredClueTypes: true,
        aliases: {
          where: { active: true },
          select: {
            term: true,
            normalizedTerm: true,
            active: true,
          },
        },
        createdRegistryCandidates: {
          where: { status: DiagnosisRegistryCandidateStatus.CREATED },
          select: {
            sourceRawText: true,
            proposedAliases: true,
          },
        },
        cases: {
          take: 5,
          select: {
            title: true,
            proposedDiagnosisText: true,
            currentRevision: {
              select: {
                symptoms: true,
                differentials: true,
              },
            },
          },
        },
      },
    })) as RegistryMetadataSuggestionRow | null;

    if (!registry) {
      throw new NotFoundException('Diagnosis registry entry not found');
    }

    const contextText = this.buildContextText(registry);
    const pattern = PATTERNS.find((candidate) =>
      candidate.tokens.some((token) => contextText.includes(token)),
    );
    const similar = pattern
      ? null
      : await this.findSimilarActiveRegistry(registry);
    const metadata = {
      specialty:
        registry.specialty ?? pattern?.metadata.specialty ?? similar?.specialty ?? null,
      subspecialty:
        registry.subspecialty ??
        pattern?.metadata.subspecialty ??
        similar?.subspecialty ??
        null,
      category:
        registry.category ?? pattern?.metadata.category ?? similar?.category ?? null,
      bodySystem:
        registry.bodySystem ??
        pattern?.metadata.bodySystem ??
        similar?.bodySystem ??
        null,
      organSystem:
        registry.organSystem ??
        pattern?.metadata.organSystem ??
        similar?.organSystem ??
        null,
      difficultyBand:
        registry.difficultyBand ??
        pattern?.metadata.difficultyBand ??
        similar?.difficultyBand ??
        null,
      rarityBand:
        registry.rarityBand ??
        pattern?.metadata.rarityBand ??
        similar?.rarityBand ??
        null,
      clinicalSetting:
        registry.clinicalSetting ??
        pattern?.metadata.clinicalSetting ??
        similar?.clinicalSetting ??
        null,
      ageGroup:
        registry.ageGroup ?? pattern?.metadata.ageGroup ?? similar?.ageGroup ?? null,
      urgencyLevel:
        registry.urgencyLevel ??
        pattern?.metadata.urgencyLevel ??
        similar?.urgencyLevel ??
        null,
      preferredClueTypes:
        this.toClueTypes(registry.preferredClueTypes) ??
        pattern?.metadata.preferredClueTypes ??
        this.toClueTypes(similar?.preferredClueTypes) ??
        ['history', 'symptom'],
    };

    const duplicateRisk = await this.getDuplicateRisk(registry);
    const aliases = this.suggestAliases(registry, pattern);
    const rationale = [
      pattern?.rationale,
      similar ? `Borrowed missing metadata from similar active registry "${similar.canonicalName}"` : null,
      registry.createdRegistryCandidates.length
        ? 'Candidate source text and proposed aliases were used'
        : null,
      registry.cases.length ? 'Linked case inventory was scanned for context' : null,
    ].filter((item): item is string => Boolean(item));

    return {
      diagnosisRegistryId,
      source: 'heuristic',
      aliases,
      metadata,
      duplicateRisk,
      confidence: pattern ? 0.78 : similar ? 0.58 : 0.42,
      rationale: rationale.length
        ? rationale
        : ['No strong pattern matched; review metadata manually before activation'],
    };
  }

  private async findSimilarActiveRegistry(registry: RegistryMetadataSuggestionRow) {
    const token = registry.canonicalNormalized.split(' ').find((part) => part.length > 4);
    if (!token) {
      return null;
    }

    return this.prisma.diagnosisRegistry.findFirst({
      where: {
        id: { not: registry.id },
        status: DiagnosisRegistryStatus.ACTIVE,
        active: true,
        canonicalNormalized: { contains: token },
      },
      select: {
        canonicalName: true,
        specialty: true,
        subspecialty: true,
        category: true,
        bodySystem: true,
        organSystem: true,
        difficultyBand: true,
        rarityBand: true,
        clinicalSetting: true,
        ageGroup: true,
        urgencyLevel: true,
        preferredClueTypes: true,
      },
    });
  }

  private toClueTypes(value: unknown): DiagnosisClueTypeValue[] | null {
    if (!Array.isArray(value)) {
      return null;
    }

    const allowed = new Set<string>(DIAGNOSIS_CLUE_TYPES);
    const values = value.filter(
      (item): item is DiagnosisClueTypeValue =>
        typeof item === 'string' && allowed.has(item),
    );

    return values.length ? values : null;
  }

  private async getDuplicateRisk(registry: RegistryMetadataSuggestionRow) {
    const [canonicalMatches, aliasMatches, pendingCandidateMatches] =
      await Promise.all([
        this.prisma.diagnosisRegistry.count({
          where: {
            id: { not: registry.id },
            canonicalNormalized: registry.canonicalNormalized,
          },
        }),
        this.prisma.diagnosisAlias.count({
          where: {
            diagnosisRegistryId: { not: registry.id },
            active: true,
            normalizedTerm: registry.canonicalNormalized,
          },
        }),
        this.prisma.diagnosisRegistryCandidate.count({
          where: {
            createdRegistryId: { not: registry.id },
            proposedCanonicalNormalized: registry.canonicalNormalized,
            status: {
              in: [
                DiagnosisRegistryCandidateStatus.CANDIDATE,
                DiagnosisRegistryCandidateStatus.NEEDS_REVIEW,
                DiagnosisRegistryCandidateStatus.APPROVED_PENDING_CREATE,
              ],
            },
          },
        }),
      ]);

    return {
      canonicalMatches,
      aliasMatches,
      pendingCandidateMatches,
    };
  }

  private suggestAliases(
    registry: RegistryMetadataSuggestionRow,
    pattern: PatternSuggestion | undefined,
  ): DiagnosisRegistryMetadataSuggestion['aliases'] {
    const existing = new Set(registry.aliases.map((alias) => alias.normalizedTerm));
    const seen = new Set<string>([registry.canonicalNormalized, ...existing]);
    const suggestions: DiagnosisRegistryMetadataSuggestion['aliases'] = [];

    const add = (term: string, confidence: number, rationale: string) => {
      const normalizedTerm = normalizeDiagnosisTerm(term);
      if (!normalizedTerm || seen.has(normalizedTerm)) {
        return;
      }

      seen.add(normalizedTerm);
      suggestions.push({
        term,
        normalizedTerm,
        acceptedForMatch: true,
        confidence,
        rationale,
      });
    };

    for (const candidate of registry.createdRegistryCandidates) {
      if (Array.isArray(candidate.proposedAliases)) {
        for (const alias of candidate.proposedAliases) {
          if (typeof alias === 'string') {
            add(alias, 0.82, 'Proposed by source registry candidate');
          }
        }
      }
      add(candidate.sourceRawText, 0.62, 'Seen in source differential text');
    }

    for (const alias of pattern?.aliases ?? []) {
      add(alias, 0.78, 'Matched diagnosis family abbreviation/synonym');
    }

    const acronym = registry.canonicalName
      .split(/\s+/)
      .filter((part) => /^[A-Za-z]/.test(part))
      .map((part) => part[0].toUpperCase())
      .join('');
    if (acronym.length >= 2 && acronym.length <= 6) {
      add(acronym, 0.48, 'Generated acronym candidate from canonical name');
    }

    return suggestions.slice(0, 8);
  }

  private buildContextText(registry: RegistryMetadataSuggestionRow): string {
    return [
      registry.canonicalName,
      registry.displayLabel,
      registry.canonicalNormalized,
      ...registry.aliases.map((alias) => alias.term),
      ...registry.createdRegistryCandidates.flatMap((candidate) => [
        candidate.sourceRawText,
        ...(Array.isArray(candidate.proposedAliases)
          ? candidate.proposedAliases.filter(
              (alias): alias is string => typeof alias === 'string',
            )
          : []),
      ]),
      ...registry.cases.flatMap((caseRecord) => [
        caseRecord.title,
        caseRecord.proposedDiagnosisText,
        ...(caseRecord.currentRevision?.symptoms ?? []),
        ...(caseRecord.currentRevision?.differentials ?? []),
      ]),
    ]
      .join(' ')
      .toLowerCase();
  }
}
