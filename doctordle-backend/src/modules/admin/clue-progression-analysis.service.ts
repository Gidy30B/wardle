import { Injectable } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';

export type ClueProgressionSignal =
  | 'premature_lock_in'
  | 'insufficient_discrimination'
  | 'abrupt_giveaway'
  | 'stagnant_progression'
  | 'unresolved_mimic'
  | 'escalation_missing'
  | 'weak_transition'
  | 'weak_elimination'
  | 'premature_mimic_collapse'
  | 'persistent_confusion'
  | 'missing_discriminator_case'
  | 'heuristic_only_discrimination'
  | 'missing_editorial_discriminator'
  | 'weak_editorial_discriminator'
  | 'unresolved_high_risk_mimic'
  | 'weak_discriminator_case'
  | 'unresolved_mimic_generation_needed'
  | 'weak_progression_generation_candidate';

export type DiscriminatorGenerationIntent =
  | 'missing_discriminator_case'
  | 'weak_discriminator_case'
  | 'persistent_confusion_case'
  | 'must_not_miss_separation'
  | 'late_lock_in_repair'
  | 'weak_clue_transition'
  | 'heuristic_only_repair';

export type TargetedDiscriminatorGenerationRequest = {
  caseId?: string;
  diagnosisRegistryId: string;
  mimicDiagnosisId?: string;
  mimicName: string;
  discriminator: string;
  sourceAnnotationId?: string;
  sourceClueOrder?: number;
  sourceClueIndex?: number;
  generationIntent: DiscriminatorGenerationIntent;
  learnerRisk?: string;
  editorialReason?: string;
};

export type ClueProgressionState = {
  clueIndex: number;
  clue: string;
  clueType: string;
  leadingDifferentials: string[];
  confidenceEstimate: number;
  confidenceShift: number;
  remainingMimics: string[];
  collapsedMimics: string[];
  discriminatorSignals: string[];
  ambiguityScore: number;
  prematureLeakFlag: boolean;
  unresolvedAmbiguityFlag: boolean;
  learnerConfusionRisk: 'low' | 'medium' | 'high';
  editorialConcern: string | null;
  progressionQuality: 'strong' | 'watch' | 'weak';
};

export type MimicCollapse = {
  clueIndex: number;
  mimic: string;
  evidence: string;
  confidenceShift: number;
};

export type DiscriminatorEmergence = {
  clueIndex: number;
  signal: string;
  evidence: string;
  strength: 'low' | 'medium' | 'high';
};

export type DifferentialElimination = {
  mimicDiagnosisId?: string;
  mimicName: string;
  relationshipType?: string;
  initialPlausibility: 'low' | 'medium' | 'high';
  finalStatus: 'eliminated' | 'persistent' | 'unresolved' | 'not_applicable';
  eliminatedAtClueIndex?: number;
  eliminatedAtClueOrder?: number;
  eliminatedBy?: string;
  discriminatorUsed?: string;
  eliminationStrength: 'weak' | 'moderate' | 'strong';
  educationalValue: 'low' | 'medium' | 'high';
  prematureCollapseRisk: boolean;
  remainingConfusionRisk: boolean;
  annotationSource: 'editorial' | 'heuristic';
  annotationId?: string;
  editorialConfidence?: 'low' | 'medium' | 'high';
  notes?: string;
};

export type ClueProgressionAnalysis = {
  caseId: string;
  diagnosisRegistryId: string | null;
  analysisVersion: 'heuristic_v1';
  diagnosticStates: ClueProgressionState[];
  mimicCollapses: MimicCollapse[];
  discriminatorEmergences: DiscriminatorEmergence[];
  differentialElimination: DifferentialElimination[];
  targetedGenerationOpportunities: TargetedDiscriminatorGenerationRequest[];
  leadingDifferentials: string[];
  remainingMimics: string[];
  discriminatorSignals: string[];
  editorialSignals: ClueProgressionSignal[];
  likelyLockInClue: number | null;
  confidenceEstimate: number | null;
  ambiguityScore: number;
  prematureLeakFlag: boolean;
  unresolvedAmbiguityFlag: boolean;
  totalMimicsTracked: number;
  eliminatedMimicCount: number;
  unresolvedMimicCount: number;
  persistentConfusionCount: number;
  weakEliminationCount: number;
  explicitDiscriminatorAnnotationCount: number;
  heuristicOnlyEliminationCount: number;
  missingEditorialAnnotationCount: number;
  editorialNotes: string | null;
  generatedAt: string;
};

type ClueInput = {
  type?: unknown;
  value?: unknown;
  order?: unknown;
};

type DifferentialContextLink = {
  diagnosisRegistryId?: string | null;
  displayLabel?: string | null;
  canonicalName?: string | null;
  role?: string | null;
  confidence?: number | null;
  sourceText?: string | null;
};

type DifferentialContextRelationship = {
  targetDiagnosisRegistryId?: string | null;
  relationshipType?: string | null;
  teachingPurpose?: string | null;
  discriminatorSummary?: string | null;
  commonConfusionReason?: string | null;
  learnerPitfall?: string | null;
  strength?: number | null;
  status?: string | null;
  targetDiagnosisRegistry?: {
    displayLabel?: string | null;
    canonicalName?: string | null;
  } | null;
  supportingGraphFact?: { label?: string | null } | null;
  supportingTeachingRule?: { title?: string | null } | null;
};

export type CaseClueDiscriminatorAnnotationInput = {
  id: string;
  caseId?: string;
  clueOrder: number;
  clueIndex?: number | null;
  eliminatedDiagnosisId?: string | null;
  eliminatedDiagnosisName: string;
  discriminator: string;
  reasoning?: string | null;
  eliminationStrength: 'weak' | 'moderate' | 'strong';
  educationalValue: 'low' | 'medium' | 'high';
};

export type CaseClueProgressionInput = {
  caseId: string;
  diagnosisRegistryId?: string | null;
  title?: string | null;
  diagnosisName?: string | null;
  clues?: Prisma.JsonValue | null;
  differentials?: string[] | null;
  explanation?: Prisma.JsonValue | null;
  editorialNotes?: string | null;
  differentialContext?: {
    linkedDifferentials?: DifferentialContextLink[] | null;
    teachingRelationships?: DifferentialContextRelationship[] | null;
  } | null;
  clueDiscriminatorAnnotations?: CaseClueDiscriminatorAnnotationInput[] | null;
};

type PersistedAnalysis = {
  diagnosticStates: Prisma.JsonValue;
  mimicCollapses: Prisma.JsonValue;
  discriminatorEmergences: Prisma.JsonValue;
  differentialElimination?: Prisma.JsonValue;
  leadingDifferentials: Prisma.JsonValue;
  remainingMimics: Prisma.JsonValue;
  discriminatorSignals: Prisma.JsonValue;
  editorialSignals: Prisma.JsonValue;
  likelyLockInClue: number | null;
  confidenceEstimate: number | null;
  ambiguityScore: number;
  prematureLeakFlag: boolean;
  unresolvedAmbiguityFlag: boolean;
  totalMimicsTracked?: number;
  eliminatedMimicCount?: number;
  unresolvedMimicCount?: number;
  persistentConfusionCount?: number;
  weakEliminationCount?: number;
  explicitDiscriminatorAnnotationCount?: number;
  heuristicOnlyEliminationCount?: number;
  missingEditorialAnnotationCount?: number;
  editorialNotes: string | null;
  analysisVersion: string;
  generatedAt: Date;
};

type ProgressionPrisma = Pick<PrismaClient, 'caseClueProgressionAnalysis'>;

@Injectable()
export class ClueProgressionAnalysisService {
  constructor(private readonly prisma?: PrismaService) {}

  analyze(input: CaseClueProgressionInput): ClueProgressionAnalysis {
    const clues = this.parseClues(input.clues);
    const diagnosis = this.normalizeText(
      input.diagnosisName ?? input.title ?? 'target diagnosis',
    );
    const mimics = this.unique(
      [
        ...(input.differentials ?? []),
        ...this.extractDifferentialNames(input.explanation),
      ].filter((name) => this.normalizeText(name) !== diagnosis),
    ).slice(0, 6);
    const startingMimics = mimics.length ? mimics : ['primary mimic'];
    const states: ClueProgressionState[] = [];
    const mimicCollapses: MimicCollapse[] = [];
    const discriminatorEmergences: DiscriminatorEmergence[] = [];
    let remainingMimics = [...startingMimics];
    let confidence = clues.length ? 0.16 : 0;
    let likelyLockInClue: number | null = null;
    let stagnantTransitionCount = 0;

    clues.forEach((clue, index) => {
      const clueIndex = index + 1;
      const clueText = this.normalizeText(clue.value);
      const previousConfidence = confidence;
      const signals = this.discriminatorSignals(clueText, String(clue.type));
      const mentionsDiagnosis = this.matchesDiagnosis(clueText, diagnosis);
      const abruptGiveaway = mentionsDiagnosis || this.hasGiveawayLanguage(clueText);
      const shift = this.confidenceShift({
        clueText,
        clueType: String(clue.type),
        signals,
        mentionsDiagnosis,
        clueIndex,
      });

      confidence = this.clampUnit(confidence + shift);
      if (likelyLockInClue === null && (confidence >= 0.78 || abruptGiveaway)) {
        likelyLockInClue = clueIndex;
      }

      const collapseCount = this.collapseCount({
        signals,
        shift,
        remainingCount: remainingMimics.length,
      });
      const collapsedMimics = remainingMimics.slice(0, collapseCount);
      remainingMimics = remainingMimics.slice(collapseCount);
      collapsedMimics.forEach((mimic) => {
        mimicCollapses.push({
          clueIndex,
          mimic,
          evidence: clue.value,
          confidenceShift: this.roundUnit(confidence - previousConfidence),
        });
      });
      signals.forEach((signal) => {
        discriminatorEmergences.push({
          clueIndex,
          signal,
          evidence: clue.value,
          strength:
            mentionsDiagnosis || shift >= 0.24
              ? 'high'
              : shift >= 0.12
                ? 'medium'
                : 'low',
        });
      });

      const confidenceShift = this.roundUnit(confidence - previousConfidence);
      if (clueIndex > 1 && confidenceShift < 0.05) {
        stagnantTransitionCount += 1;
      }
      const ambiguityScore = this.ambiguityScore(confidence, remainingMimics.length);
      const prematureLeakFlag = clueIndex <= 2 && confidence >= 0.78;
      const unresolvedAmbiguityFlag =
        clueIndex === clues.length && (remainingMimics.length > 0 || confidence < 0.68);

      states.push({
        clueIndex,
        clue: clue.value,
        clueType: String(clue.type),
        leadingDifferentials: this.leadingDifferentials({
          diagnosis: input.diagnosisName ?? input.title ?? 'Target diagnosis',
          mimics: remainingMimics,
          confidence,
        }),
        confidenceEstimate: this.roundUnit(confidence),
        confidenceShift,
        remainingMimics: [...remainingMimics],
        collapsedMimics,
        discriminatorSignals: signals,
        ambiguityScore,
        prematureLeakFlag,
        unresolvedAmbiguityFlag,
        learnerConfusionRisk:
          ambiguityScore >= 0.68 ? 'high' : ambiguityScore >= 0.36 ? 'medium' : 'low',
        editorialConcern: this.editorialConcern({
          clueIndex,
          cluesTotal: clues.length,
          confidence,
          confidenceShift,
          remainingMimics,
          signals,
          prematureLeakFlag,
        }),
        progressionQuality:
          prematureLeakFlag || confidenceShift < 0.04
            ? 'weak'
            : signals.length || collapsedMimics.length
              ? 'strong'
              : 'watch',
      });
    });

    const finalState = states.at(-1);
    const editorialSignals = this.editorialSignals({
      states,
      likelyLockInClue,
      discriminatorEmergences,
      remainingMimics,
      stagnantTransitionCount,
    });
    const differentialElimination = this.analyzeDifferentialElimination({
      input,
      clues,
      diagnosis,
      mimicCollapses,
      discriminatorEmergences,
    });
    const eliminationSummary =
      this.differentialEliminationSummary(differentialElimination);
    const eliminationSignals =
      this.differentialEliminationSignals(differentialElimination);
    const targetedGenerationOpportunities =
      this.targetedGenerationOpportunities({
        input,
        states,
        differentialElimination,
        likelyLockInClue,
      });
    const combinedEditorialSignals = this.unique([
      ...editorialSignals,
      ...eliminationSignals,
      ...(targetedGenerationOpportunities.some(
        (item) => item.generationIntent === 'weak_clue_transition',
      )
        ? (['weak_progression_generation_candidate'] as const)
        : []),
    ]);

    return {
      caseId: input.caseId,
      diagnosisRegistryId: input.diagnosisRegistryId ?? null,
      analysisVersion: 'heuristic_v1',
      diagnosticStates: states,
      mimicCollapses,
      discriminatorEmergences,
      differentialElimination,
      targetedGenerationOpportunities,
      leadingDifferentials: finalState?.leadingDifferentials ?? [],
      remainingMimics,
      discriminatorSignals: this.unique(
        discriminatorEmergences.map((item) => item.signal),
      ),
      editorialSignals: combinedEditorialSignals,
      likelyLockInClue,
      confidenceEstimate: finalState?.confidenceEstimate ?? null,
      ambiguityScore: finalState?.ambiguityScore ?? 1,
      prematureLeakFlag: states.some((state) => state.prematureLeakFlag),
      unresolvedAmbiguityFlag:
        finalState?.unresolvedAmbiguityFlag ?? clues.length === 0,
      totalMimicsTracked: eliminationSummary.totalMimicsTracked,
      eliminatedMimicCount: eliminationSummary.eliminatedMimicCount,
      unresolvedMimicCount: eliminationSummary.unresolvedMimicCount,
      persistentConfusionCount: eliminationSummary.persistentConfusionCount,
      weakEliminationCount: eliminationSummary.weakEliminationCount,
      explicitDiscriminatorAnnotationCount:
        eliminationSummary.explicitDiscriminatorAnnotationCount,
      heuristicOnlyEliminationCount:
        eliminationSummary.heuristicOnlyEliminationCount,
      missingEditorialAnnotationCount:
        eliminationSummary.missingEditorialAnnotationCount,
      editorialNotes:
        input.editorialNotes ??
        this.notesForSignals(combinedEditorialSignals, likelyLockInClue),
      generatedAt: new Date().toISOString(),
    };
  }

  fromPersisted(
    input: CaseClueProgressionInput,
    persisted: PersistedAnalysis | null | undefined,
  ): ClueProgressionAnalysis {
    if (!persisted) {
      return this.analyze(input);
    }

    const differentialElimination = this.objectArray(
      persisted.differentialElimination,
    ).map((item) =>
      this.normalizeDifferentialElimination(item),
    ) as DifferentialElimination[];
    const diagnosticStates = this.objectArray(
      persisted.diagnosticStates,
    ) as ClueProgressionState[];

    return {
      caseId: input.caseId,
      diagnosisRegistryId: input.diagnosisRegistryId ?? null,
      analysisVersion:
        persisted.analysisVersion === 'heuristic_v1'
          ? 'heuristic_v1'
          : 'heuristic_v1',
      diagnosticStates,
      mimicCollapses: this.objectArray(
        persisted.mimicCollapses,
      ) as MimicCollapse[],
      discriminatorEmergences: this.objectArray(
        persisted.discriminatorEmergences,
      ) as DiscriminatorEmergence[],
      differentialElimination,
      targetedGenerationOpportunities: this.targetedGenerationOpportunities({
        input,
        states: diagnosticStates,
        differentialElimination,
        likelyLockInClue: persisted.likelyLockInClue,
      }),
      leadingDifferentials: this.stringArray(persisted.leadingDifferentials),
      remainingMimics: this.stringArray(persisted.remainingMimics),
      discriminatorSignals: this.stringArray(persisted.discriminatorSignals),
      editorialSignals: this.stringArray(
        persisted.editorialSignals,
      ) as ClueProgressionSignal[],
      likelyLockInClue: persisted.likelyLockInClue,
      confidenceEstimate: persisted.confidenceEstimate,
      ambiguityScore: persisted.ambiguityScore,
      prematureLeakFlag: persisted.prematureLeakFlag,
      unresolvedAmbiguityFlag: persisted.unresolvedAmbiguityFlag,
      totalMimicsTracked: persisted.totalMimicsTracked ?? 0,
      eliminatedMimicCount: persisted.eliminatedMimicCount ?? 0,
      unresolvedMimicCount: persisted.unresolvedMimicCount ?? 0,
      persistentConfusionCount: persisted.persistentConfusionCount ?? 0,
      weakEliminationCount: persisted.weakEliminationCount ?? 0,
      explicitDiscriminatorAnnotationCount:
        persisted.explicitDiscriminatorAnnotationCount ?? 0,
      heuristicOnlyEliminationCount:
        persisted.heuristicOnlyEliminationCount ?? 0,
      missingEditorialAnnotationCount:
        persisted.missingEditorialAnnotationCount ?? 0,
      editorialNotes: persisted.editorialNotes,
      generatedAt: persisted.generatedAt.toISOString(),
    };
  }

  async upsertForCase(
    input: CaseClueProgressionInput,
    client: ProgressionPrisma | null = this.prisma ?? null,
  ) {
    if (!client) {
      throw new Error('Prisma client is required to persist progression analysis');
    }
    const analysis = this.analyze(input);
    return client.caseClueProgressionAnalysis.upsert({
      where: { caseId: input.caseId },
      create: this.toPersistence(analysis),
      update: this.toPersistence(analysis),
    });
  }

  private toPersistence(analysis: ClueProgressionAnalysis) {
    return {
      caseId: analysis.caseId,
      diagnosisRegistryId: analysis.diagnosisRegistryId,
      analysisVersion: analysis.analysisVersion,
      diagnosticStates: analysis.diagnosticStates as Prisma.InputJsonValue,
      mimicCollapses: analysis.mimicCollapses as Prisma.InputJsonValue,
      discriminatorEmergences:
        analysis.discriminatorEmergences as Prisma.InputJsonValue,
      differentialElimination:
        analysis.differentialElimination as Prisma.InputJsonValue,
      leadingDifferentials: analysis.leadingDifferentials as Prisma.InputJsonValue,
      remainingMimics: analysis.remainingMimics as Prisma.InputJsonValue,
      discriminatorSignals: analysis.discriminatorSignals as Prisma.InputJsonValue,
      editorialSignals: analysis.editorialSignals as Prisma.InputJsonValue,
      likelyLockInClue: analysis.likelyLockInClue,
      confidenceEstimate: analysis.confidenceEstimate,
      ambiguityScore: analysis.ambiguityScore,
      prematureLeakFlag: analysis.prematureLeakFlag,
      unresolvedAmbiguityFlag: analysis.unresolvedAmbiguityFlag,
      totalMimicsTracked: analysis.totalMimicsTracked,
      eliminatedMimicCount: analysis.eliminatedMimicCount,
      unresolvedMimicCount: analysis.unresolvedMimicCount,
      persistentConfusionCount: analysis.persistentConfusionCount,
      weakEliminationCount: analysis.weakEliminationCount,
      explicitDiscriminatorAnnotationCount:
        analysis.explicitDiscriminatorAnnotationCount,
      heuristicOnlyEliminationCount: analysis.heuristicOnlyEliminationCount,
      missingEditorialAnnotationCount: analysis.missingEditorialAnnotationCount,
      editorialNotes: analysis.editorialNotes,
      generatedAt: new Date(analysis.generatedAt),
    };
  }

  private analyzeDifferentialElimination(input: {
    input: CaseClueProgressionInput;
    clues: Array<{ type: string; value: string; order: number }>;
    diagnosis: string;
    mimicCollapses: MimicCollapse[];
    discriminatorEmergences: DiscriminatorEmergence[];
  }): DifferentialElimination[] {
    const profiles = this.mimicProfiles(input.input, input.diagnosis);
    const heuristicRecords = profiles.map((profile) => {
      const match = this.findEliminationClue({
        profile,
        clues: input.clues,
        mimicCollapses: input.mimicCollapses,
        discriminatorEmergences: input.discriminatorEmergences,
      });
      const unresolvedKnownDiscriminator =
        profile.discriminators.length > 0 && !match;
      const finalStatus: DifferentialElimination['finalStatus'] = match
        ? 'eliminated'
        : profile.initialPlausibility === 'low' && profile.discriminators.length === 0
          ? 'not_applicable'
          : profile.highRisk
            ? 'persistent'
            : 'unresolved';
      const eliminationStrength = match?.strength ?? 'weak';
      const educationalValue: DifferentialElimination['educationalValue'] =
        match?.knownDiscriminator || profile.relationshipType
          ? profile.highRisk || profile.relationshipType === 'DIFFERENTIAL_DISCRIMINATOR'
            ? 'high'
            : 'medium'
          : 'low';
      const prematureCollapseRisk =
        Boolean(match) && input.clues.length >= 3 && (match?.clueIndex ?? 99) <= 2;
      const remainingConfusionRisk =
        finalStatus === 'persistent' ||
        finalStatus === 'unresolved' ||
        (finalStatus === 'eliminated' && eliminationStrength === 'weak');

      return {
        ...(profile.mimicDiagnosisId
          ? { mimicDiagnosisId: profile.mimicDiagnosisId }
          : {}),
        mimicName: profile.mimicName,
        ...(profile.relationshipType
          ? { relationshipType: profile.relationshipType }
          : {}),
        initialPlausibility: profile.initialPlausibility,
        finalStatus,
        ...(match
          ? {
              eliminatedAtClueIndex: match.clueIndex,
              eliminatedAtClueOrder: match.clueOrder,
              eliminatedBy: match.clueText,
              discriminatorUsed: match.discriminator,
            }
          : {}),
        eliminationStrength,
        educationalValue,
        prematureCollapseRisk,
        remainingConfusionRisk,
        annotationSource: 'heuristic' as const,
        notes: this.eliminationNotes({
          finalStatus,
          unresolvedKnownDiscriminator,
          match,
          highRisk: profile.highRisk,
        }),
      };
    });
    const editorialRecords = (input.input.clueDiscriminatorAnnotations ?? [])
      .filter(
        (annotation) =>
          this.normalizeText(annotation.eliminatedDiagnosisName) !==
          input.diagnosis,
      )
      .map((annotation) => {
        const profile = profiles.find(
          (item) =>
            this.sameMimic(
              item.mimicName,
              item.mimicDiagnosisId,
              annotation.eliminatedDiagnosisName,
              annotation.eliminatedDiagnosisId ?? null,
            ),
        );
        return {
          ...(annotation.eliminatedDiagnosisId
            ? { mimicDiagnosisId: annotation.eliminatedDiagnosisId }
            : profile?.mimicDiagnosisId
              ? { mimicDiagnosisId: profile.mimicDiagnosisId }
              : {}),
          mimicName: annotation.eliminatedDiagnosisName,
          ...(profile?.relationshipType
            ? { relationshipType: profile.relationshipType }
            : {}),
          initialPlausibility: profile?.initialPlausibility ?? 'medium',
          finalStatus: 'eliminated' as const,
          eliminatedAtClueIndex: annotation.clueIndex ?? undefined,
          eliminatedAtClueOrder: annotation.clueOrder,
          eliminatedBy: annotation.discriminator,
          discriminatorUsed: annotation.discriminator,
          eliminationStrength: annotation.eliminationStrength,
          educationalValue: annotation.educationalValue,
          prematureCollapseRisk: false,
          remainingConfusionRisk: annotation.eliminationStrength === 'weak',
          annotationSource: 'editorial' as const,
          annotationId: annotation.id,
          editorialConfidence: this.editorialConfidence(annotation),
          notes: annotation.reasoning ?? undefined,
        } satisfies DifferentialElimination;
      });

    const editorialKeys = new Set(
      editorialRecords.map((item) =>
        this.mimicKey(item.mimicName, item.mimicDiagnosisId ?? null),
      ),
    );
    return [
      ...editorialRecords,
      ...heuristicRecords.filter(
        (item) =>
          !editorialKeys.has(
            this.mimicKey(item.mimicName, item.mimicDiagnosisId ?? null),
          ),
      ),
    ];
  }

  private mimicProfiles(input: CaseClueProgressionInput, diagnosis: string) {
    type MimicProfile = {
      mimicDiagnosisId?: string;
      mimicName: string;
      relationshipType?: string;
      initialPlausibility: DifferentialElimination['initialPlausibility'];
      discriminators: string[];
      highRisk: boolean;
    };
    const profiles = new Map<string, MimicProfile>();
    const add = (profile: MimicProfile) => {
      const normalizedName = this.normalizeText(profile.mimicName);
      if (!normalizedName || normalizedName === diagnosis) {
        return;
      }
      const existing = profiles.get(normalizedName);
      if (!existing) {
        profiles.set(normalizedName, {
          ...profile,
          discriminators: this.unique(profile.discriminators.filter(Boolean)),
        });
        return;
      }
      existing.discriminators = this.unique([
        ...existing.discriminators,
        ...profile.discriminators,
      ]);
      existing.highRisk = existing.highRisk || profile.highRisk;
      existing.initialPlausibility = this.maxPlausibility(
        existing.initialPlausibility,
        profile.initialPlausibility,
      );
      existing.relationshipType ??= profile.relationshipType;
      existing.mimicDiagnosisId ??= profile.mimicDiagnosisId;
    };

    for (const name of input.differentials ?? []) {
      add({
        mimicName: name,
        initialPlausibility: 'medium',
        discriminators: this.explanationDiscriminators(input.explanation, name),
        highRisk: this.isHighRiskMimic(name, null),
      });
    }

    for (const name of this.extractDifferentialNames(input.explanation)) {
      add({
        mimicName: name,
        initialPlausibility: 'medium',
        discriminators: this.explanationDiscriminators(input.explanation, name),
        highRisk: this.isHighRiskMimic(name, null),
      });
    }

    for (const link of input.differentialContext?.linkedDifferentials ?? []) {
      const mimicName = link.displayLabel ?? link.canonicalName;
      if (!mimicName) continue;
      add({
        mimicDiagnosisId: link.diagnosisRegistryId ?? undefined,
        mimicName,
        relationshipType: link.role ?? undefined,
        initialPlausibility:
          typeof link.confidence === 'number' && link.confidence >= 0.72
            ? 'high'
            : typeof link.confidence === 'number' && link.confidence < 0.35
              ? 'low'
              : 'medium',
        discriminators: [
          ...(link.sourceText ? [link.sourceText] : []),
          ...this.explanationDiscriminators(input.explanation, mimicName),
        ],
        highRisk: this.isHighRiskMimic(mimicName, link.role ?? null),
      });
    }

    for (const relationship of input.differentialContext?.teachingRelationships ?? []) {
      const mimicName =
        relationship.targetDiagnosisRegistry?.displayLabel ??
        relationship.targetDiagnosisRegistry?.canonicalName;
      if (!mimicName) continue;
      add({
        mimicDiagnosisId: relationship.targetDiagnosisRegistryId ?? undefined,
        mimicName,
        relationshipType: relationship.relationshipType ?? undefined,
        initialPlausibility:
          relationship.status === 'ACTIVE' || (relationship.strength ?? 0) >= 3
            ? 'high'
            : 'medium',
        discriminators: [
          relationship.discriminatorSummary,
          relationship.commonConfusionReason,
          relationship.learnerPitfall,
          relationship.supportingGraphFact?.label,
          relationship.supportingTeachingRule?.title,
          ...this.explanationDiscriminators(input.explanation, mimicName),
        ].filter((item): item is string => Boolean(item)),
        highRisk: this.isHighRiskMimic(
          mimicName,
          relationship.relationshipType ?? relationship.teachingPurpose ?? null,
        ),
      });
    }

    for (const annotation of input.clueDiscriminatorAnnotations ?? []) {
      add({
        mimicDiagnosisId: annotation.eliminatedDiagnosisId ?? undefined,
        mimicName: annotation.eliminatedDiagnosisName,
        initialPlausibility: 'medium',
        discriminators: [annotation.discriminator],
        highRisk: this.isHighRiskMimic(annotation.eliminatedDiagnosisName, null),
      });
    }

    return [...profiles.values()].slice(0, 8);
  }

  private findEliminationClue(input: {
    profile: {
      mimicName: string;
      discriminators: string[];
    };
    clues: Array<{ type: string; value: string; order: number }>;
    mimicCollapses: MimicCollapse[];
    discriminatorEmergences: DiscriminatorEmergence[];
  }) {
    for (const clue of input.clues) {
      const clueText = this.normalizeText(clue.value);
      const knownMatch = input.profile.discriminators.find((discriminator) =>
        this.textsOverlap(clueText, this.normalizeText(discriminator), 2),
      );
      if (knownMatch) {
        const signals = this.discriminatorSignals(clueText, clue.type);
        return {
          clueIndex: input.clues.indexOf(clue) + 1,
          clueOrder: clue.order,
          clueText: clue.value,
          discriminator: knownMatch,
          knownDiscriminator: true,
          strength:
            signals.length >= 2 ||
            ['lab', 'labs', 'imaging', 'exam'].includes(clue.type.toLowerCase())
              ? ('strong' as const)
              : ('moderate' as const),
        };
      }
    }

    const collapse = input.mimicCollapses.find(
      (item) =>
        this.normalizeText(item.mimic) === this.normalizeText(input.profile.mimicName),
    );
    if (!collapse || input.profile.discriminators.length > 0) {
      return null;
    }
    const clue = input.clues[collapse.clueIndex - 1];
    if (!clue || this.isVagueClue(clue.value)) {
      return clue
        ? {
            clueIndex: collapse.clueIndex,
            clueOrder: clue.order,
            clueText: clue.value,
            discriminator: collapse.evidence,
            knownDiscriminator: false,
            strength: 'weak' as const,
          }
        : null;
    }
    const emergence = input.discriminatorEmergences.find(
      (item) => item.clueIndex === collapse.clueIndex,
    );
    return emergence
      ? {
          clueIndex: collapse.clueIndex,
          clueOrder: clue.order,
          clueText: clue.value,
          discriminator: emergence.signal,
          knownDiscriminator: false,
          strength: 'weak' as const,
        }
      : null;
  }

  private differentialEliminationSummary(items: DifferentialElimination[]) {
    return {
      totalMimicsTracked: items.length,
      eliminatedMimicCount: items.filter((item) => item.finalStatus === 'eliminated')
        .length,
      unresolvedMimicCount: items.filter((item) => item.finalStatus === 'unresolved')
        .length,
      persistentConfusionCount: items.filter(
        (item) => item.remainingConfusionRisk,
      ).length,
      weakEliminationCount: items.filter(
        (item) =>
          item.finalStatus === 'eliminated' &&
          item.eliminationStrength === 'weak',
      ).length,
      explicitDiscriminatorAnnotationCount: items.filter(
        (item) => item.annotationSource === 'editorial',
      ).length,
      heuristicOnlyEliminationCount: items.filter(
        (item) =>
          item.annotationSource === 'heuristic' &&
          item.finalStatus === 'eliminated',
      ).length,
      missingEditorialAnnotationCount: items.filter(
        (item) =>
          item.annotationSource === 'heuristic' &&
          (item.finalStatus !== 'eliminated' ||
            item.educationalValue === 'high' ||
            item.remainingConfusionRisk),
      ).length,
    };
  }

  private differentialEliminationSignals(
    items: DifferentialElimination[],
  ): ClueProgressionSignal[] {
    const signals: ClueProgressionSignal[] = [];
    if (items.some((item) => item.finalStatus === 'unresolved')) {
      signals.push('unresolved_mimic');
      signals.push('missing_discriminator_case');
    }
    if (
      items.some(
        (item) =>
          item.finalStatus === 'eliminated' &&
          item.eliminationStrength === 'weak',
      )
    ) {
      signals.push('weak_elimination');
      signals.push('weak_discriminator_case');
    }
    if (items.some((item) => item.prematureCollapseRisk)) {
      signals.push('premature_mimic_collapse');
    }
    if (items.some((item) => item.remainingConfusionRisk)) {
      signals.push('persistent_confusion');
    }
    if (
      items.some(
        (item) =>
          item.annotationSource === 'heuristic' &&
          item.finalStatus === 'eliminated',
      )
    ) {
      signals.push('heuristic_only_discrimination');
    }
    if (
      items.some(
        (item) =>
          item.annotationSource === 'heuristic' &&
          (item.finalStatus !== 'eliminated' ||
            item.educationalValue === 'high' ||
            item.remainingConfusionRisk),
      )
    ) {
      signals.push('missing_editorial_discriminator');
    }
    if (
      items.some(
        (item) =>
          item.annotationSource === 'heuristic' &&
          item.finalStatus !== 'not_applicable' &&
          item.remainingConfusionRisk,
      )
    ) {
      signals.push('unresolved_mimic_generation_needed');
    }
    if (
      items.some(
        (item) =>
          item.annotationSource === 'editorial' &&
          item.eliminationStrength === 'weak',
      )
    ) {
      signals.push('weak_editorial_discriminator');
    }
    if (
      items.some(
        (item) =>
          item.annotationSource === 'heuristic' &&
          item.finalStatus === 'persistent' &&
          item.educationalValue === 'high',
      )
    ) {
      signals.push('unresolved_high_risk_mimic');
    }
    return signals;
  }

  private targetedGenerationOpportunities(input: {
    input: CaseClueProgressionInput;
    states: ClueProgressionState[];
    differentialElimination: DifferentialElimination[];
    likelyLockInClue: number | null;
  }): TargetedDiscriminatorGenerationRequest[] {
    const diagnosisRegistryId = input.input.diagnosisRegistryId;
    if (!diagnosisRegistryId) {
      return [];
    }

    const opportunities: TargetedDiscriminatorGenerationRequest[] = [];
    const pushOpportunity = (
      item: DifferentialElimination,
      generationIntent: DiscriminatorGenerationIntent,
      editorialReason: string,
      discriminatorOverride?: string,
    ) => {
      const discriminator =
        discriminatorOverride ??
        item.discriminatorUsed ??
        item.eliminatedBy ??
        item.notes ??
        `Explicit discriminator separating ${item.mimicName}`;
      opportunities.push({
        caseId: input.input.caseId,
        diagnosisRegistryId,
        ...(item.mimicDiagnosisId
          ? { mimicDiagnosisId: item.mimicDiagnosisId }
          : {}),
        mimicName: item.mimicName,
        discriminator,
        ...(item.annotationId ? { sourceAnnotationId: item.annotationId } : {}),
        ...(item.eliminatedAtClueOrder
          ? { sourceClueOrder: item.eliminatedAtClueOrder }
          : {}),
        ...(item.eliminatedAtClueIndex
          ? { sourceClueIndex: item.eliminatedAtClueIndex }
          : {}),
        generationIntent,
        learnerRisk: item.remainingConfusionRisk
          ? `${item.mimicName} may remain plausible for learners.`
          : undefined,
        editorialReason,
      });
    };

    for (const item of input.differentialElimination) {
      if (item.finalStatus === 'not_applicable') {
        continue;
      }
      if (item.finalStatus === 'persistent' && item.educationalValue === 'high') {
        pushOpportunity(
          item,
          'must_not_miss_separation',
          'Must-not-miss mimic remains unresolved and needs an explicit teaching case.',
        );
        continue;
      }
      if (item.finalStatus === 'persistent') {
        pushOpportunity(
          item,
          'persistent_confusion_case',
          'Mimic remains a persistent learner-confusion risk across the clue sequence.',
        );
      }
      if (item.finalStatus === 'unresolved') {
        pushOpportunity(
          item,
          'missing_discriminator_case',
          'No explicit clue or annotation currently separates this mimic.',
        );
      }
      if (
        item.finalStatus === 'eliminated' &&
        item.eliminationStrength === 'weak'
      ) {
        pushOpportunity(
          item,
          'weak_discriminator_case',
          'Existing elimination is weak and needs a clearer discriminator pathway.',
        );
      }
      if (
        item.annotationSource === 'heuristic' &&
        item.finalStatus === 'eliminated'
      ) {
        pushOpportunity(
          item,
          'heuristic_only_repair',
          'Elimination is inferred heuristically and should become an editor-governed discriminator.',
        );
      }
      if (item.prematureCollapseRisk) {
        pushOpportunity(
          item,
          'late_lock_in_repair',
          'Mimic collapses too early; generate a draft that delays decisive separation.',
        );
      }
    }

    const weakTransition = input.states.find(
      (state) =>
        state.progressionQuality === 'weak' &&
        !state.prematureLeakFlag &&
        (state.remainingMimics.length || state.discriminatorSignals.length),
    );
    const weakTransitionMimic = weakTransition?.remainingMimics[0];
    if (weakTransition && weakTransitionMimic) {
      opportunities.push({
        caseId: input.input.caseId,
        diagnosisRegistryId,
        mimicName: weakTransitionMimic,
        discriminator:
          weakTransition.discriminatorSignals[0] ??
          `Clue ${weakTransition.clueIndex} needs a clearer transition discriminator`,
        sourceClueIndex: weakTransition.clueIndex,
        sourceClueOrder: weakTransition.clueIndex,
        generationIntent: 'weak_clue_transition',
        learnerRisk: weakTransition.editorialConcern ?? undefined,
        editorialReason:
          'A weak clue transition leaves the reasoning pathway under-specified.',
      });
    }

    return this.dedupeOpportunities(opportunities).slice(0, 8);
  }

  private dedupeOpportunities(
    opportunities: TargetedDiscriminatorGenerationRequest[],
  ): TargetedDiscriminatorGenerationRequest[] {
    const seen = new Set<string>();
    return opportunities.filter((item) => {
      const key = [
        item.mimicDiagnosisId ?? this.normalizeText(item.mimicName),
        item.generationIntent,
        item.sourceClueIndex ?? 'case',
      ].join(':');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private eliminationNotes(input: {
    finalStatus: DifferentialElimination['finalStatus'];
    unresolvedKnownDiscriminator: boolean;
    match:
      | {
          knownDiscriminator: boolean;
          strength: DifferentialElimination['eliminationStrength'];
        }
      | null;
    highRisk: boolean;
  }) {
    if (input.finalStatus === 'eliminated' && input.match?.knownDiscriminator) {
      return 'Separated by a known teaching discriminator.';
    }
    if (input.finalStatus === 'eliminated' && input.match?.strength === 'weak') {
      return 'Elimination is inferred from a broad clue, not a specific discriminator.';
    }
    if (input.unresolvedKnownDiscriminator) {
      return 'Known discriminator was not explicitly addressed by the clue sequence.';
    }
    if (input.highRisk) {
      return 'Important mimic remains a learner confusion risk.';
    }
    if (input.finalStatus === 'not_applicable') {
      return 'Low-plausibility mimic lacks enough discriminator context to track.';
    }
    return 'Insufficient evidence to claim elimination.';
  }

  private parseClues(value: Prisma.JsonValue | null | undefined) {
    if (!Array.isArray(value)) {
      return [] as Array<{ type: string; value: string; order: number }>;
    }
    return value
      .map((item, index) => {
        const clue = this.asObject(item) as ClueInput | null;
        return {
          type: typeof clue?.type === 'string' ? clue.type : 'clue',
          value: typeof clue?.value === 'string' ? clue.value : '',
          order: typeof clue?.order === 'number' ? clue.order : index,
        };
      })
      .filter((clue) => clue.value.trim().length > 0)
      .sort((left, right) => left.order - right.order);
  }

  private extractDifferentialNames(value: Prisma.JsonValue | null | undefined) {
    const object = this.asObject(value);
    const analysis = object?.differentialAnalysis;
    if (!Array.isArray(analysis)) {
      return [];
    }
    return analysis
      .map((item) => this.asObject(item))
      .map((item) => this.stringValue(item?.diagnosis))
      .filter((item): item is string => Boolean(item));
  }

  private discriminatorSignals(clueText: string, clueType: string) {
    const signals: string[] = [];
    const checks: Array<[string, RegExp]> = [
      ['localizing finding', /\b(rlq|right lower quadrant|mcburney|localized|focal|rebound|guarding)\b/],
      ['inflammatory pattern', /\b(fever|leukocytosis|crp|inflammatory|neutrophil|wbc)\b/],
      ['imaging discriminator', /\b(ct|ultrasound|imaging|appendix|stone|torsion|infarct|consolidation)\b/],
      ['temporal progression', /\b(migrat|progress|worsen|sudden|acute|hours|days)\b/],
      ['escalation signal', /\b(hypotension|shock|sepsis|peritonitis|respiratory failure|altered mental)\b/],
    ];
    checks.forEach(([label, pattern]) => {
      if (pattern.test(clueText)) {
        signals.push(label);
      }
    });
    if (['lab', 'labs', 'imaging', 'exam'].includes(clueType.toLowerCase())) {
      signals.push(`${clueType.toLowerCase()} evidence`);
    }
    return this.unique(signals);
  }

  private confidenceShift(input: {
    clueText: string;
    clueType: string;
    signals: string[];
    mentionsDiagnosis: boolean;
    clueIndex: number;
  }) {
    if (input.mentionsDiagnosis || this.hasGiveawayLanguage(input.clueText)) {
      return input.clueIndex <= 2 ? 0.72 : 0.48;
    }
    let shift = input.signals.length * 0.09;
    if (['lab', 'labs', 'imaging'].includes(input.clueType.toLowerCase())) {
      shift += 0.08;
    }
    if (['history', 'symptom'].includes(input.clueType.toLowerCase())) {
      shift += 0.04;
    }
    if (shift === 0) {
      shift = 0.025;
    }
    return Math.min(0.32, shift);
  }

  private collapseCount(input: {
    signals: string[];
    shift: number;
    remainingCount: number;
  }) {
    if (input.remainingCount === 0) {
      return 0;
    }
    if (input.shift >= 0.45) {
      return Math.max(1, input.remainingCount - 1);
    }
    if (input.shift >= 0.18 || input.signals.length >= 2) {
      return Math.min(2, input.remainingCount);
    }
    if (input.shift >= 0.1 || input.signals.length === 1) {
      return 1;
    }
    return 0;
  }

  private editorialSignals(input: {
    states: ClueProgressionState[];
    likelyLockInClue: number | null;
    discriminatorEmergences: DiscriminatorEmergence[];
    remainingMimics: string[];
    stagnantTransitionCount: number;
  }): ClueProgressionSignal[] {
    const signals: ClueProgressionSignal[] = [];
    if (input.likelyLockInClue !== null && input.likelyLockInClue <= 2) {
      signals.push('premature_lock_in');
    }
    const clinicalDiscriminators = input.discriminatorEmergences.filter(
      (emergence) => !emergence.signal.endsWith(' evidence'),
    );
    if (clinicalDiscriminators.length === 0) {
      signals.push('insufficient_discrimination');
    }
    if (input.states.some((state) => state.confidenceShift >= 0.45)) {
      signals.push('abrupt_giveaway');
    }
    if (input.stagnantTransitionCount >= 2) {
      signals.push('stagnant_progression');
    }
    if (input.remainingMimics.length > 0 || input.states.at(-1)?.ambiguityScore! > 0.45) {
      signals.push('unresolved_mimic');
    }
    if (
      !input.states.some((state) =>
        state.discriminatorSignals.includes('escalation signal'),
      )
    ) {
      signals.push('escalation_missing');
    }
    if (input.states.some((state) => state.clueIndex > 1 && state.confidenceShift <= 0.04)) {
      signals.push('weak_transition');
    }
    return this.unique(signals);
  }

  private editorialConcern(input: {
    clueIndex: number;
    cluesTotal: number;
    confidence: number;
    confidenceShift: number;
    remainingMimics: string[];
    signals: string[];
    prematureLeakFlag: boolean;
  }) {
    if (input.prematureLeakFlag) {
      return 'Case may become solvable before the discriminator is earned.';
    }
    if (input.confidenceShift <= 0.04 && input.clueIndex > 1) {
      return 'This clue adds little new diagnostic information.';
    }
    if (input.clueIndex === input.cluesTotal && input.remainingMimics.length) {
      return 'Mimics remain plausible after the final clue.';
    }
    if (input.signals.length === 0 && input.clueIndex > 2) {
      return 'No clear discriminator emerges at this step.';
    }
    return null;
  }

  private notesForSignals(
    signals: ClueProgressionSignal[],
    lockInClue: number | null,
  ) {
    if (signals.includes('premature_lock_in')) {
      return `Likely lock-in occurs at clue ${lockInClue}; consider delaying giveaway evidence.`;
    }
    if (signals.includes('unresolved_mimic')) {
      return 'One or more mimics remain unresolved after the clue sequence.';
    }
    if (signals.includes('stagnant_progression')) {
      return 'Mid-sequence clues may not advance diagnostic reasoning.';
    }
    return null;
  }

  private leadingDifferentials(input: {
    diagnosis: string;
    mimics: string[];
    confidence: number;
  }) {
    if (input.confidence >= 0.72) {
      return [input.diagnosis, ...input.mimics.slice(0, 2)];
    }
    return [...input.mimics.slice(0, 2), input.diagnosis].filter(Boolean);
  }

  private ambiguityScore(confidence: number, remainingMimics: number) {
    return this.roundUnit(
      this.clampUnit(1 - confidence + Math.min(0.35, remainingMimics * 0.08)),
    );
  }

  private matchesDiagnosis(text: string, diagnosis: string) {
    const terms = diagnosis
      .split(/\s+/)
      .filter((term) => term.length >= 5)
      .map((term) => this.escapeRegExp(term));
    return terms.some((term) => new RegExp(`\\b${term}\\b`).test(text));
  }

  private hasGiveawayLanguage(text: string) {
    return /\b(pathognomonic|diagnostic of|classic for|confirms|confirms the diagnosis)\b/.test(
      text,
    );
  }

  private explanationDiscriminators(
    value: Prisma.JsonValue | null | undefined,
    mimicName: string,
  ) {
    const object = this.asObject(value);
    const analysis = object?.differentialAnalysis;
    if (!Array.isArray(analysis)) {
      return [];
    }
    const normalizedMimic = this.normalizeText(mimicName);
    return analysis.flatMap((item) => {
      const record = this.asObject(item);
      if (
        !record ||
        this.normalizeText(record.diagnosis) !== normalizedMimic
      ) {
        return [];
      }
      return [
        this.stringValue(record.whyPlausibleEarly),
        this.stringValue(record.finalReasonLessLikely),
        ...this.ruleOutStrings(record.ruledOutByClues),
      ].filter((entry): entry is string => Boolean(entry));
    });
  }

  private ruleOutStrings(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        const record = this.asObject(item);
        return (
          this.stringValue(record?.clue) ??
          this.stringValue(record?.reason) ??
          this.stringValue(record?.supports)
        );
      })
      .filter((item): item is string => Boolean(item));
  }

  private maxPlausibility(
    left: DifferentialElimination['initialPlausibility'],
    right: DifferentialElimination['initialPlausibility'],
  ) {
    const rank = { low: 0, medium: 1, high: 2 };
    return rank[right] > rank[left] ? right : left;
  }

  private isHighRiskMimic(name: string, relationshipType: string | null) {
    return (
      /\b(cancer|malign|sepsis|shock|torsion|infarction|embolism|stroke|dissection|meningitis)\b/i.test(
        name,
      ) ||
      /\b(must|important|exclusion|escalation|pitfall)\b/i.test(
        relationshipType ?? '',
      )
    );
  }

  private sameMimic(
    leftName: string,
    leftId: string | null | undefined,
    rightName: string,
    rightId: string | null | undefined,
  ) {
    return (
      (Boolean(leftId) && Boolean(rightId) && leftId === rightId) ||
      this.normalizeText(leftName) === this.normalizeText(rightName)
    );
  }

  private mimicKey(name: string, id: string | null) {
    return id ? `id:${id}` : `name:${this.normalizeText(name)}`;
  }

  private editorialConfidence(annotation: CaseClueDiscriminatorAnnotationInput) {
    if (
      annotation.eliminationStrength === 'strong' &&
      annotation.educationalValue === 'high'
    ) {
      return 'high' as const;
    }
    if (
      annotation.eliminationStrength === 'weak' ||
      annotation.educationalValue === 'low'
    ) {
      return 'low' as const;
    }
    return 'medium' as const;
  }

  private textsOverlap(left: string, right: string, minimumOverlap: number) {
    if (!left || !right) {
      return false;
    }
    if (left.includes(right) || right.includes(left)) {
      return true;
    }
    const leftTokens = new Set(this.meaningfulTokens(left));
    const overlap = this.meaningfulTokens(right).filter((token) =>
      leftTokens.has(token),
    );
    return overlap.length >= minimumOverlap;
  }

  private meaningfulTokens(value: string) {
    const stopWords = new Set([
      'with',
      'without',
      'from',
      'that',
      'this',
      'than',
      'then',
      'when',
      'while',
      'after',
      'before',
      'because',
      'patient',
      'feature',
      'features',
      'typical',
      'pattern',
      'diagnosis',
      'mimic',
    ]);
    return this.normalizeText(value)
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4 && !stopWords.has(token));
  }

  private isVagueClue(value: string) {
    const normalized = this.normalizeText(value);
    return (
      normalized.length < 28 ||
      /\b(tired|unwell|malaise|poor appetite|discomfort|pain|nausea|feels)\b/.test(
        normalized,
      )
    );
  }

  private objectArray(value: Prisma.JsonValue | undefined) {
    return Array.isArray(value)
      ? value.filter((item) => Boolean(this.asObject(item)))
      : [];
  }

  private normalizeDifferentialElimination(value: unknown) {
    const record = this.asObject(value) ?? {};
    return {
      ...record,
      annotationSource:
        record.annotationSource === 'editorial' ? 'editorial' : 'heuristic',
    };
  }

  private stringArray(value: unknown) {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private asObject(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private stringValue(value: unknown) {
    return typeof value === 'string' && value.trim().length ? value.trim() : null;
  }

  private normalizeText(value: unknown) {
    return typeof value === 'string'
      ? value.toLowerCase().replace(/\s+/g, ' ').trim()
      : '';
  }

  private unique<T>(values: T[]) {
    return [...new Set(values)];
  }

  private clampUnit(value: number) {
    return Math.max(0, Math.min(1, value));
  }

  private roundUnit(value: number) {
    return Math.round(this.clampUnit(value) * 100) / 100;
  }

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
