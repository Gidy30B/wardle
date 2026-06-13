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
  excludedClueTypes: DiagnosisClueTypeValue[];
  identityConfidence: number;
  metadataConfidence: number;
  confidence: number;
  rationale: string;
  warnings: string[];
};

type KnownMetadata = Pick<
  AiRegistryMetadataSuggestion,
  | 'canonicalName'
  | 'displayLabel'
  | 'aliases'
  | 'specialty'
  | 'subspecialty'
  | 'category'
  | 'bodySystem'
  | 'organSystem'
  | 'difficultyBand'
  | 'rarityBand'
  | 'clinicalSetting'
  | 'ageGroup'
  | 'urgencyLevel'
  | 'preferredClueTypes'
  | 'excludedClueTypes'
>;

const GENERIC_METADATA_VALUES = new Set([
  'general',
  'general medicine',
  'general medical',
  'medicine',
  'unknown',
  'unspecified',
  'n/a',
]);

const ABBREVIATION_KNOWLEDGE: Record<string, Partial<KnownMetadata>> = {
  jia: {
    canonicalName: 'juvenile idiopathic arthritis',
    displayLabel: 'Juvenile Idiopathic Arthritis',
    aliases: ['JIA', 'juvenile idiopathic arthritis', 'juvenile rheumatoid arthritis'],
    specialty: 'Rheumatology',
    subspecialty: 'Pediatric Rheumatology',
    category: 'Inflammatory',
    bodySystem: 'Musculoskeletal',
    organSystem: 'Joints',
    difficultyBand: 'INTERMEDIATE',
    rarityBand: 'COMMON',
    clinicalSetting: 'OUTPATIENT',
    ageGroup: 'PEDIATRIC',
    urgencyLevel: 'ROUTINE',
    preferredClueTypes: ['history', 'exam', 'lab', 'imaging'],
    excludedClueTypes: [],
  },
  chf: {
    canonicalName: 'congestive heart failure',
    displayLabel: 'Congestive Heart Failure',
    aliases: ['CHF', 'heart failure', 'cardiac failure', 'congestive cardiac failure'],
    specialty: 'Cardiology',
    bodySystem: 'Cardiovascular',
    organSystem: 'Heart',
  },
  copd: {
    canonicalName: 'chronic obstructive pulmonary disease',
    displayLabel: 'Chronic Obstructive Pulmonary Disease',
    aliases: ['COPD', 'chronic obstructive pulmonary disease'],
  },
  dka: {
    canonicalName: 'diabetic ketoacidosis',
    displayLabel: 'Diabetic Ketoacidosis',
    aliases: ['DKA', 'diabetic ketoacidosis'],
  },
  siadh: {
    canonicalName: 'syndrome of inappropriate antidiuretic hormone secretion',
    displayLabel: 'Syndrome of Inappropriate Antidiuretic Hormone Secretion',
    aliases: ['SIADH', 'syndrome of inappropriate antidiuretic hormone secretion'],
  },
  itp: {
    canonicalName: 'immune thrombocytopenic purpura',
    displayLabel: 'Immune Thrombocytopenic Purpura',
    aliases: ['ITP', 'immune thrombocytopenia', 'immune thrombocytopenic purpura'],
  },
  ards: {
    canonicalName: 'acute respiratory distress syndrome',
    displayLabel: 'Acute Respiratory Distress Syndrome',
    aliases: ['ARDS', 'acute respiratory distress syndrome'],
  },
  aki: {
    canonicalName: 'acute kidney injury',
    displayLabel: 'Acute Kidney Injury',
    aliases: ['AKI', 'acute renal failure', 'acute kidney injury'],
  },
  ckd: {
    canonicalName: 'chronic kidney disease',
    displayLabel: 'Chronic Kidney Disease',
    aliases: ['CKD', 'chronic renal disease', 'chronic kidney disease'],
  },
  dvt: {
    canonicalName: 'deep vein thrombosis',
    displayLabel: 'Deep Vein Thrombosis',
    aliases: ['DVT', 'deep venous thrombosis', 'deep vein thrombosis'],
  },
  pe: {
    canonicalName: 'pulmonary embolism',
    displayLabel: 'Pulmonary Embolism',
    aliases: ['PE', 'pulmonary embolus', 'pulmonary embolism'],
  },
  nec: {
    canonicalName: 'necrotizing enterocolitis',
    displayLabel: 'Necrotizing Enterocolitis',
    aliases: ['NEC', 'necrotizing enterocolitis'],
  },
  ugib: {
    canonicalName: 'upper gastrointestinal bleeding',
    displayLabel: 'Upper Gastrointestinal Bleeding',
    aliases: ['UGIB', 'upper GI bleed', 'upper gastrointestinal bleeding'],
  },
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
    fallback: {
      canonicalName: string;
      canonicalNormalized?: string;
      displayLabel: string;
    },
  ): AiRegistryMetadataSuggestion {
    const record = this.asRecord(value);
    const warnings = this.stringArray(record.warnings);
    const canonicalName =
      this.stringValue(record.canonicalName) ?? fallback.canonicalName;
    const displayLabel =
      this.stringValue(record.displayLabel) ?? fallback.displayLabel;
    const knowledge = this.findKnownMetadata({
      canonicalName,
      canonicalNormalized: fallback.canonicalNormalized,
      displayLabel,
    });
    const difficultyBand = this.enumValue(
      record.difficultyBand,
      DIAGNOSIS_DIFFICULTY_BANDS,
      warnings,
      'difficultyBand',
    );
    const rarityBand = this.enumValue(
      record.rarityBand,
      DIAGNOSIS_RARITY_BANDS,
      warnings,
      'rarityBand',
    );
    const clinicalSetting = this.enumValue(
      record.clinicalSetting,
      DIAGNOSIS_CLINICAL_SETTINGS,
      warnings,
      'clinicalSetting',
    );
    const ageGroup = this.enumValue(
      record.ageGroup,
      DIAGNOSIS_AGE_GROUPS,
      warnings,
      'ageGroup',
    );
    const urgencyLevel = this.enumValue(
      record.urgencyLevel,
      DIAGNOSIS_URGENCY_LEVELS,
      warnings,
      'urgencyLevel',
    );
    const specialty = this.metadataString(record.specialty, warnings, 'specialty');
    const subspecialty = this.metadataString(
      record.subspecialty,
      warnings,
      'subspecialty',
      { allowNull: true },
    );
    const category = this.metadataString(record.category, warnings, 'category');
    const bodySystem = this.metadataString(
      record.bodySystem,
      warnings,
      'bodySystem',
    );
    const organSystem = this.metadataString(
      record.organSystem,
      warnings,
      'organSystem',
    );
    const rawAliases = this.stringArray(record.aliases);
    const preferredClueTypes = this.enumArray(
      record.preferredClueTypes,
      DIAGNOSIS_CLUE_TYPES,
      warnings,
      'preferredClueTypes',
    );
    const excludedClueTypes = this.enumArray(
      record.excludedClueTypes,
      DIAGNOSIS_CLUE_TYPES,
      warnings,
      'excludedClueTypes',
    );
    const merged = this.applyKnownMetadata(
      {
        canonicalName,
        displayLabel,
        aliases: rawAliases,
        specialty,
        subspecialty,
        category,
        bodySystem,
        organSystem,
        difficultyBand,
        rarityBand,
        clinicalSetting,
        ageGroup,
        urgencyLevel,
        preferredClueTypes,
        excludedClueTypes,
      },
      knowledge,
    );
    const identityConfidence = this.calibratedIdentityConfidence(
      record.identityConfidence ?? record.confidence,
      knowledge,
    );
    const metadataConfidence = this.calibratedMetadataConfidence(
      record.metadataConfidence ?? record.confidence,
      merged,
      warnings,
      knowledge,
    );

    return {
      ...merged,
      aliases: merged.aliases.slice(0, 12),
      identityConfidence,
      metadataConfidence,
      confidence: Math.min(identityConfidence, metadataConfidence),
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

  private metadataString(
    value: unknown,
    warnings: string[],
    field: string,
    options: { allowNull?: boolean } = {},
  ): string | null {
    const text = this.stringValue(value);
    if (!text) {
      return null;
    }
    if (GENERIC_METADATA_VALUES.has(this.normalize(text))) {
      warnings.push(`generic_fallback_avoided:${field}`);
      warnings.push(`metadata_unmapped:${field}:${text}`);
      return null;
    }
    if (options.allowNull && this.normalize(text) === 'null') {
      return null;
    }
    return text;
  }

  private enumValue<T extends readonly string[]>(
    value: unknown,
    allowed: T,
    warnings: string[],
    field: string,
  ): T[number] | null {
    if (typeof value !== 'string') {
      return null;
    }
    if (allowed.includes(value)) {
      return value as T[number];
    }
    const remapped = this.remapEnumValue(value, allowed, field);
    if (remapped) {
      warnings.push(`metadata_remapped:${field}:${value}->${remapped}`);
      return remapped;
    }
    warnings.push(`metadata_unmapped:${field}:${value}`);
    return null;
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
    const result: Array<T[number]> = [];
    for (const item of value) {
      if (typeof item !== 'string') {
        warnings.push(`metadata_unmapped:${field}:${String(item)}`);
        continue;
      }
      if (allowed.includes(item)) {
        result.push(item as T[number]);
        continue;
      }
      const remapped = this.remapEnumValue(item, allowed, field);
      if (remapped) {
        warnings.push(`metadata_remapped:${field}:${item}->${remapped}`);
        result.push(remapped);
      } else {
        warnings.push(`metadata_unmapped:${field}:${item}`);
      }
    }
    const deduped = [...new Set(result)];
    return deduped.length ? deduped : fallback;
  }

  private remapEnumValue<T extends readonly string[]>(
    value: string,
    allowed: T,
    field: string,
  ): T[number] | null {
    const normalized = this.normalize(value);
    const direct = allowed.find((candidate) => this.normalize(candidate) === normalized);
    if (direct) {
      return direct as T[number];
    }

    const maps: Record<string, Record<string, string[]>> = {
      ageGroup: {
        PEDIATRIC: ['pediatric', 'paediatric', 'child', 'children', 'juvenile', 'infant', 'neonate'],
        ADULT: ['adult'],
        GERIATRIC: ['geriatric', 'elderly', 'older adult'],
        ANY: ['any', 'all ages'],
      },
      clinicalSetting: {
        OUTPATIENT: ['outpatient', 'clinic', 'ambulatory', 'primary care'],
        EMERGENCY: ['emergency', 'ed', 'er', 'acute care'],
        INPATIENT: ['inpatient', 'ward', 'hospitalized', 'hospital'],
        ICU: ['icu', 'intensive care', 'critical care'],
        COMMUNITY: ['community'],
      },
      urgencyLevel: {
        ROUTINE: ['routine', 'chronic', 'low', 'non urgent', 'stable'],
        URGENT: ['urgent', 'semi urgent', 'same day'],
        EMERGENT: ['emergent', 'emergency', 'life threatening', 'immediate'],
      },
      difficultyBand: {
        BASIC: ['basic', 'easy', 'introductory'],
        INTERMEDIATE: ['intermediate', 'moderate'],
        ADVANCED: ['advanced', 'hard', 'complex'],
      },
      rarityBand: {
        COMMON: ['common', 'frequent'],
        UNCOMMON: ['uncommon', 'less common'],
        RARE: ['rare'],
      },
      preferredClueTypes: {
        history: ['history', 'historical'],
        symptom: ['symptom', 'symptoms'],
        vital: ['vital', 'vitals', 'vital signs'],
        lab: ['lab', 'labs', 'laboratory', 'blood test'],
        exam: ['exam', 'physical exam', 'examination'],
        imaging: ['imaging', 'xray', 'x ray', 'radiograph', 'ct', 'mri', 'ultrasound'],
      },
      excludedClueTypes: {
        history: ['history', 'historical'],
        symptom: ['symptom', 'symptoms'],
        vital: ['vital', 'vitals', 'vital signs'],
        lab: ['lab', 'labs', 'laboratory', 'blood test'],
        exam: ['exam', 'physical exam', 'examination'],
        imaging: ['imaging', 'xray', 'x ray', 'radiograph', 'ct', 'mri', 'ultrasound'],
      },
    };
    const fieldMap = maps[field] ?? {};
    for (const [target, synonyms] of Object.entries(fieldMap)) {
      if (synonyms.some((synonym) => normalized.includes(this.normalize(synonym)))) {
        return allowed.includes(target) ? (target as T[number]) : null;
      }
    }
    return null;
  }

  private findKnownMetadata(input: {
    canonicalName: string;
    canonicalNormalized?: string;
    displayLabel: string;
  }): Partial<KnownMetadata> | null {
    const candidates = [
      input.canonicalNormalized,
      input.canonicalName,
      input.displayLabel,
    ]
      .map((item) => (item ? this.normalize(item) : null))
      .filter((item): item is string => Boolean(item));

    for (const candidate of candidates) {
      const exact = ABBREVIATION_KNOWLEDGE[candidate];
      if (exact) {
        return exact;
      }
      if (candidate.includes('juvenile idiopathic arthritis')) {
        return ABBREVIATION_KNOWLEDGE.jia;
      }
    }
    return null;
  }

  private applyKnownMetadata(
    value: KnownMetadata,
    knowledge: Partial<KnownMetadata> | null,
  ): KnownMetadata {
    if (!knowledge) {
      return value;
    }
    return {
      canonicalName: knowledge.canonicalName ?? value.canonicalName,
      displayLabel: knowledge.displayLabel ?? value.displayLabel,
      aliases: this.mergeStrings(value.aliases, knowledge.aliases ?? []),
      specialty: knowledge.specialty ?? value.specialty,
      subspecialty:
        knowledge.subspecialty !== undefined
          ? knowledge.subspecialty
          : value.subspecialty,
      category: knowledge.category ?? value.category,
      bodySystem: knowledge.bodySystem ?? value.bodySystem,
      organSystem: knowledge.organSystem ?? value.organSystem,
      difficultyBand: knowledge.difficultyBand ?? value.difficultyBand,
      rarityBand: knowledge.rarityBand ?? value.rarityBand,
      clinicalSetting: knowledge.clinicalSetting ?? value.clinicalSetting,
      ageGroup: knowledge.ageGroup ?? value.ageGroup,
      urgencyLevel: knowledge.urgencyLevel ?? value.urgencyLevel,
      preferredClueTypes:
        knowledge.preferredClueTypes?.length
          ? knowledge.preferredClueTypes
          : value.preferredClueTypes,
      excludedClueTypes:
        knowledge.excludedClueTypes?.length
          ? knowledge.excludedClueTypes
          : value.excludedClueTypes,
    };
  }

  private calibratedIdentityConfidence(
    value: unknown,
    knowledge: Partial<KnownMetadata> | null,
  ): number {
    return Math.max(this.confidence(value), knowledge ? 0.88 : 0);
  }

  private calibratedMetadataConfidence(
    value: unknown,
    metadata: KnownMetadata,
    warnings: string[],
    knowledge: Partial<KnownMetadata> | null,
  ): number {
    const requiredFields: Array<keyof KnownMetadata> = [
      'specialty',
      'category',
      'bodySystem',
      'organSystem',
      'difficultyBand',
      'rarityBand',
      'clinicalSetting',
      'ageGroup',
      'urgencyLevel',
    ];
    const missingCount = requiredFields.filter((field) => !metadata[field]).length;
    const unmappedCount = warnings.filter((warning) =>
      warning.startsWith('metadata_unmapped:'),
    ).length;
    let confidence = Math.max(this.confidence(value), knowledge ? 0.88 : 0);
    confidence -= missingCount * 0.08;
    if (!knowledge) {
      confidence -= unmappedCount * 0.12;
    }
    if (missingCount > 0) {
      warnings.push(`metadata_unmapped:missing_required_fields:${missingCount}`);
    }
    return Math.max(0, Math.min(0.95, confidence));
  }

  private mergeStrings(left: string[], right: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of [...left, ...right]) {
      const normalized = this.normalize(item);
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      result.push(item);
    }
    return result;
  }

  private normalize(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[''`]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private confidence(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 0.5;
    }
    return Math.max(0, Math.min(1, value));
  }
}
