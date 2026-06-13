import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DiagnosisRegistryStatus } from '@prisma/client';
import OpenAI from 'openai';
import { getEnv } from '../../core/config/env.validation';
import { PrismaService } from '../../core/db/prisma.service';
import {
  DIAGNOSIS_AGE_GROUPS,
  DIAGNOSIS_CLINICAL_SETTINGS,
  DIAGNOSIS_CLUE_TYPES,
  DIAGNOSIS_DIFFICULTY_BANDS,
  DIAGNOSIS_RARITY_BANDS,
  DIAGNOSIS_URGENCY_LEVELS,
  type DiagnosisAgeGroupValue,
  type DiagnosisClinicalSettingValue,
  type DiagnosisClueTypeValue,
  type DiagnosisDifficultyBandValue,
  type DiagnosisRarityBandValue,
  type DiagnosisUrgencyLevelValue,
} from './diagnosis-registry-taxonomy';

const OPENAI_METADATA_MODEL = 'gpt-4o-mini';
const OPENAI_METADATA_TIMEOUT_MS = 30_000;

type AiMetadataOpenAiClient = Pick<OpenAI, 'chat'>;

export type GenerateAiRegistryMetadataInput = {
  includeAliases?: boolean;
  includeMetadata?: boolean;
};

export type AiRegistryMetadataSuggestion = {
  canonicalName: string;
  displayLabel: string;
  aliases: string[];
  specialty: string;
  subspecialty: string | null;
  category: string;
  bodySystem: string;
  organSystem: string;
  difficultyBand: DiagnosisDifficultyBandValue;
  rarityBand: DiagnosisRarityBandValue;
  clinicalSetting: DiagnosisClinicalSettingValue;
  ageGroup: DiagnosisAgeGroupValue;
  urgencyLevel: DiagnosisUrgencyLevelValue;
  preferredClueTypes: DiagnosisClueTypeValue[];
  excludedClueTypes: DiagnosisClueTypeValue[];
  confidence: number;
  rationale: string;
  warnings: string[];
};

@Injectable()
export class DiagnosisRegistryAiMetadataSuggestionService {
  private readonly logger = new Logger(
    DiagnosisRegistryAiMetadataSuggestionService.name,
  );
  private openaiClient?: AiMetadataOpenAiClient;

  constructor(private readonly prisma: PrismaService) {
    const env = getEnv();
    if (env.OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({
        apiKey: env.OPENAI_API_KEY,
        timeout: OPENAI_METADATA_TIMEOUT_MS,
        maxRetries: 0,
      });
    }
  }

  async generateAiMetadataSuggestion(
    diagnosisRegistryId: string,
    input: GenerateAiRegistryMetadataInput = {},
  ): Promise<{ suggestion: AiRegistryMetadataSuggestion }> {
    if (!this.openaiClient) {
      throw new BadRequestException(
        'OPENAI_API_KEY is required for AI metadata suggestions',
      );
    }

    const context = await this.buildContext(diagnosisRegistryId);
    const request = this.buildPrompt({
      context,
      includeAliases: input.includeAliases ?? true,
      includeMetadata: input.includeMetadata ?? true,
    });
    const completion = await this.openaiClient.chat.completions.create({
      model: OPENAI_METADATA_MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a medical registry editor. Return JSON only. Never activate or mutate records.',
        },
        {
          role: 'user',
          content: request,
        },
      ],
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new BadRequestException('OpenAI returned an empty metadata payload');
    }

    const parsed = this.parseJson(raw);
    const suggestion = this.sanitizeSuggestion(parsed, context.registry);
    this.logger.log({
      event: 'diagnosis_registry.ai_metadata_suggestion.generated',
      diagnosisRegistryId,
      confidence: suggestion.confidence,
      warnings: suggestion.warnings.length,
    });

    return { suggestion };
  }

  sanitizeSuggestion(
    value: unknown,
    fallback: { canonicalName: string; displayLabel: string },
  ): AiRegistryMetadataSuggestion {
    const record = this.asRecord(value);
    const warnings = this.stringArray(record.warnings);
    const difficultyBand = this.enumValue(
      record.difficultyBand,
      DIAGNOSIS_DIFFICULTY_BANDS,
      'INTERMEDIATE',
      warnings,
      'difficultyBand',
    );
    const rarityBand = this.enumValue(
      record.rarityBand,
      DIAGNOSIS_RARITY_BANDS,
      'COMMON',
      warnings,
      'rarityBand',
    );
    const clinicalSetting = this.enumValue(
      record.clinicalSetting,
      DIAGNOSIS_CLINICAL_SETTINGS,
      'OUTPATIENT',
      warnings,
      'clinicalSetting',
    );
    const ageGroup = this.enumValue(
      record.ageGroup,
      DIAGNOSIS_AGE_GROUPS,
      'ANY',
      warnings,
      'ageGroup',
    );
    const urgencyLevel = this.enumValue(
      record.urgencyLevel,
      DIAGNOSIS_URGENCY_LEVELS,
      'ROUTINE',
      warnings,
      'urgencyLevel',
    );

    return {
      canonicalName:
        this.stringValue(record.canonicalName) ?? fallback.canonicalName,
      displayLabel:
        this.stringValue(record.displayLabel) ?? fallback.displayLabel,
      aliases: this.stringArray(record.aliases).slice(0, 12),
      specialty: this.stringValue(record.specialty) ?? 'General Medicine',
      subspecialty: this.stringValue(record.subspecialty),
      category: this.stringValue(record.category) ?? 'General',
      bodySystem: this.stringValue(record.bodySystem) ?? 'General',
      organSystem: this.stringValue(record.organSystem) ?? 'General',
      difficultyBand,
      rarityBand,
      clinicalSetting,
      ageGroup,
      urgencyLevel,
      preferredClueTypes: this.enumArray(
        record.preferredClueTypes,
        DIAGNOSIS_CLUE_TYPES,
        warnings,
        'preferredClueTypes',
        ['history', 'symptom'],
      ),
      excludedClueTypes: this.enumArray(
        record.excludedClueTypes,
        DIAGNOSIS_CLUE_TYPES,
        warnings,
        'excludedClueTypes',
      ),
      confidence: this.confidence(record.confidence),
      rationale:
        this.stringValue(record.rationale) ??
        'AI generated a metadata proposal from registry context.',
      warnings,
    };
  }

  private async buildContext(diagnosisRegistryId: string) {
    const registry = await this.prisma.diagnosisRegistry.findUnique({
      where: { id: diagnosisRegistryId },
      select: {
        id: true,
        canonicalName: true,
        canonicalNormalized: true,
        displayLabel: true,
        status: true,
        active: true,
        isPlayable: true,
        isGeneratable: true,
        onboardingStatus: true,
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
        excludedClueTypes: true,
        aliases: {
          where: { active: true },
          select: { term: true, kind: true, acceptedForMatch: true },
        },
        createdRegistryCandidates: {
          select: {
            sourceRawText: true,
            sourceType: true,
            sourceId: true,
            sourceMappingId: true,
            proposedAliases: true,
          },
          take: 5,
        },
        cases: {
          take: 5,
          select: {
            title: true,
            proposedDiagnosisText: true,
            differentials: true,
            explanation: true,
            currentRevision: {
              select: {
                title: true,
                proposedDiagnosisText: true,
                differentials: true,
                explanation: true,
              },
            },
          },
        },
      },
    });

    if (!registry) {
      throw new NotFoundException('Diagnosis registry entry not found');
    }

    const token = registry.canonicalNormalized
      .split(' ')
      .find((part) => part.length > 2);
    const similarRows = token
      ? await this.prisma.diagnosisRegistry.findMany({
          where: {
            id: { not: registry.id },
            status: DiagnosisRegistryStatus.ACTIVE,
            active: true,
            OR: [
              { canonicalNormalized: { contains: token } },
              { aliases: { some: { normalizedTerm: { contains: token } } } },
            ],
          },
          take: 8,
          select: {
            canonicalName: true,
            displayLabel: true,
            specialty: true,
            category: true,
            bodySystem: true,
            organSystem: true,
            aliases: {
              where: { active: true },
              take: 5,
              select: { term: true },
            },
          },
        })
      : [];

    return {
      registry,
      similarRows,
      allowedValues: {
        difficultyBand: DIAGNOSIS_DIFFICULTY_BANDS,
        rarityBand: DIAGNOSIS_RARITY_BANDS,
        clinicalSetting: DIAGNOSIS_CLINICAL_SETTINGS,
        ageGroup: DIAGNOSIS_AGE_GROUPS,
        urgencyLevel: DIAGNOSIS_URGENCY_LEVELS,
        clueTypes: DIAGNOSIS_CLUE_TYPES,
      },
    };
  }

  private buildPrompt(input: {
    context: Awaited<ReturnType<DiagnosisRegistryAiMetadataSuggestionService['buildContext']>>;
    includeAliases: boolean;
    includeMetadata: boolean;
  }): string {
    return JSON.stringify({
      task:
        'Propose registry metadata and aliases for a draft diagnosis before dictionary activation. Return JSON only with the requested fields.',
      safety: [
        'Do not activate the diagnosis.',
        'Do not mutate the database.',
        'Use only allowed enum values.',
        'If an abbreviation is ambiguous, explain uncertainty in warnings and reduce confidence.',
      ],
      includeAliases: input.includeAliases,
      includeMetadata: input.includeMetadata,
      expectedShape: {
        canonicalName: 'string',
        displayLabel: 'string',
        aliases: ['string'],
        specialty: 'string',
        subspecialty: 'string|null',
        category: 'string',
        bodySystem: 'string',
        organSystem: 'string',
        difficultyBand: input.context.allowedValues.difficultyBand,
        rarityBand: input.context.allowedValues.rarityBand,
        clinicalSetting: input.context.allowedValues.clinicalSetting,
        ageGroup: input.context.allowedValues.ageGroup,
        urgencyLevel: input.context.allowedValues.urgencyLevel,
        preferredClueTypes: input.context.allowedValues.clueTypes,
        excludedClueTypes: input.context.allowedValues.clueTypes,
        confidence: 'number 0..1',
        rationale: 'string',
        warnings: ['string'],
      },
      context: input.context,
    });
  }

  private parseJson(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      throw new BadRequestException('OpenAI returned invalid JSON metadata');
    }
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private stringValue(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed || null;
  }

  private stringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return [
      ...new Set(
        value
          .map((item) => this.stringValue(item))
          .filter((item): item is string => Boolean(item)),
      ),
    ];
  }

  private enumValue<T extends readonly string[]>(
    value: unknown,
    allowed: T,
    fallback: T[number],
    warnings: string[],
    field: string,
  ): T[number] {
    if (typeof value === 'string' && allowed.includes(value)) {
      return value as T[number];
    }
    warnings.push(`Invalid ${field} value was replaced with ${fallback}`);
    return fallback;
  }

  private enumArray<T extends readonly string[]>(
    value: unknown,
    allowed: T,
    warnings: string[],
    field: string,
    fallback: Array<T[number]> = [],
  ): Array<T[number]> {
    if (!Array.isArray(value)) {
      return fallback;
    }
    const result = value.filter(
      (item): item is T[number] =>
        typeof item === 'string' && allowed.includes(item),
    );
    if (result.length !== value.length) {
      warnings.push(`Invalid ${field} values were removed`);
    }
    const deduped = [...new Set(result)];
    return deduped.length ? deduped : fallback;
  }

  private confidence(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 0.5;
    }
    return Math.max(0, Math.min(1, value));
  }
}
