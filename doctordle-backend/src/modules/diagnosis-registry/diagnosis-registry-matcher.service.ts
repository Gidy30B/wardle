import { Injectable } from '@nestjs/common';
import { DiagnosisRegistryStatus } from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service.js';
import type { EvaluationResult } from '../diagnostics/services/types.js';
import { normalizeDiagnosisTerm } from './diagnosis-term-normalizer.js';

export type GameplayDiagnosisResolutionMethod = 'SELECTED_ID' | 'UNRESOLVED';

export type GameplayDiagnosisResolutionReason =
  | 'NO_SELECTED_ID'
  | 'INVALID_SELECTED_ID'
  | 'UNUSABLE_SELECTED_ID'
  | 'EXPECTED_DIAGNOSIS_MISSING'
  | 'EXPECTED_DIAGNOSIS_UNUSABLE';

export type ResolveGameplayDiagnosisGuessInput = {
  expectedDiagnosisRegistryId?: string | null;
  submittedDiagnosisRegistryId?: string | null;
  submittedGuessText?: string | null;
};

export type ResolvedGameplayDiagnosisGuess = {
  submittedDiagnosisRegistryId: string | null;
  submittedGuessText: string | null;
  normalizedGuess: string;
  resolvedDiagnosisRegistryId: string | null;
  resolutionMethod: GameplayDiagnosisResolutionMethod;
  resolutionReason?: GameplayDiagnosisResolutionReason;
  isResolvable: boolean;
};

export type GameplayDiagnosisGuessEvaluation = {
  expectedDiagnosisRegistryId: string | null;
  expectedDiagnosisStatus: DiagnosisRegistryStatus | null;
  expectedDiagnosisUsable: boolean;
  resolution: ResolvedGameplayDiagnosisGuess;
  evaluation: EvaluationResult;
  isCorrect: boolean;
};

type DiagnosisRegistryLookupRow = {
  id: string;
  status: DiagnosisRegistryStatus;
  displayLabel?: string | null;
};

@Injectable()
export class DiagnosisRegistryMatcherService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluateGameplayGuess(
    input: ResolveGameplayDiagnosisGuessInput,
  ): Promise<GameplayDiagnosisGuessEvaluation> {
    const expectedDiagnosis = await this.lookupExpectedDiagnosis(
      input.expectedDiagnosisRegistryId,
    );
    const resolution = await this.resolveGuess({
      submittedDiagnosisRegistryId: input.submittedDiagnosisRegistryId,
      submittedGuessText: input.submittedGuessText,
    });
    const caseFailureReason = this.getExpectedDiagnosisFailureReason(expectedDiagnosis);

    if (caseFailureReason) {
      const resolutionWithCaseReason = resolution.resolutionReason
        ? resolution
        : {
            ...resolution,
            resolutionReason: caseFailureReason,
          };

      return {
        expectedDiagnosisRegistryId: input.expectedDiagnosisRegistryId?.trim() || null,
        expectedDiagnosisStatus: expectedDiagnosis?.status ?? null,
        expectedDiagnosisUsable: false,
        resolution: resolutionWithCaseReason,
        evaluation: this.buildWrongEvaluation({
          expectedDiagnosisRegistryId: input.expectedDiagnosisRegistryId?.trim() || null,
          expectedDiagnosisUsable: false,
          expectedDiagnosisStatus: expectedDiagnosis?.status ?? null,
          resolution: resolutionWithCaseReason,
        }),
        isCorrect: false,
      };
    }

    const isCorrect =
      resolution.isResolvable &&
      resolution.resolvedDiagnosisRegistryId === expectedDiagnosis!.id;

    return {
      expectedDiagnosisRegistryId: expectedDiagnosis!.id,
      expectedDiagnosisStatus: expectedDiagnosis!.status,
      expectedDiagnosisUsable: true,
      resolution,
      evaluation: isCorrect
        ? this.buildCorrectEvaluation({
            expectedDiagnosisRegistryId: expectedDiagnosis!.id,
            resolution,
          })
        : this.buildWrongEvaluation({
            expectedDiagnosisRegistryId: expectedDiagnosis!.id,
            expectedDiagnosisUsable: true,
            expectedDiagnosisStatus: expectedDiagnosis!.status,
            resolution,
          }),
      isCorrect,
    };
  }

  async resolveGuess(
    input: Omit<ResolveGameplayDiagnosisGuessInput, 'expectedDiagnosisRegistryId'>,
  ): Promise<ResolvedGameplayDiagnosisGuess> {
    const submittedDiagnosisRegistryId =
      input.submittedDiagnosisRegistryId?.trim() || null;
    const submittedGuessText = input.submittedGuessText?.trim() || null;

    if (!submittedDiagnosisRegistryId) {
      return {
        submittedDiagnosisRegistryId: null,
        submittedGuessText,
        normalizedGuess: normalizeDiagnosisTerm(submittedGuessText ?? ''),
        resolvedDiagnosisRegistryId: null,
        resolutionMethod: 'UNRESOLVED',
        resolutionReason: 'NO_SELECTED_ID',
        isResolvable: false,
      };
    }

    return this.resolveSubmittedDiagnosisSelection({
      submittedDiagnosisRegistryId,
      submittedGuessText,
    });
  }

  private async resolveSubmittedDiagnosisSelection(input: {
    submittedDiagnosisRegistryId: string;
    submittedGuessText: string | null;
  }): Promise<ResolvedGameplayDiagnosisGuess> {
    const diagnosisRegistryModel = this.getDiagnosisRegistryModel();
    if (!diagnosisRegistryModel) {
      return {
        submittedDiagnosisRegistryId: input.submittedDiagnosisRegistryId,
        submittedGuessText: input.submittedGuessText,
        normalizedGuess: normalizeDiagnosisTerm(
          input.submittedGuessText ?? input.submittedDiagnosisRegistryId,
        ),
        resolvedDiagnosisRegistryId: null,
        resolutionMethod: 'UNRESOLVED',
        resolutionReason: 'INVALID_SELECTED_ID',
        isResolvable: false,
      };
    }

    const selectedDiagnosis = (await diagnosisRegistryModel.findUnique({
      where: {
        id: input.submittedDiagnosisRegistryId,
      },
      select: {
        id: true,
        status: true,
        displayLabel: true,
      },
    })) as DiagnosisRegistryLookupRow | null;

    const fallbackGuessText = input.submittedGuessText ?? input.submittedDiagnosisRegistryId;

    if (!selectedDiagnosis) {
      return {
        submittedDiagnosisRegistryId: input.submittedDiagnosisRegistryId,
        submittedGuessText: input.submittedGuessText,
        normalizedGuess: normalizeDiagnosisTerm(fallbackGuessText),
        resolvedDiagnosisRegistryId: null,
        resolutionMethod: 'UNRESOLVED',
        resolutionReason: 'INVALID_SELECTED_ID',
        isResolvable: false,
      };
    }

    if (selectedDiagnosis.status !== DiagnosisRegistryStatus.ACTIVE) {
      return {
        submittedDiagnosisRegistryId: input.submittedDiagnosisRegistryId,
        submittedGuessText: input.submittedGuessText,
        normalizedGuess: normalizeDiagnosisTerm(fallbackGuessText),
        resolvedDiagnosisRegistryId: null,
        resolutionMethod: 'UNRESOLVED',
        resolutionReason: 'UNUSABLE_SELECTED_ID',
        isResolvable: false,
      };
    }

    const resolvedGuessText =
      input.submittedGuessText ??
      selectedDiagnosis.displayLabel?.trim() ??
      input.submittedDiagnosisRegistryId;

    return {
      submittedDiagnosisRegistryId: input.submittedDiagnosisRegistryId,
      submittedGuessText: resolvedGuessText,
      normalizedGuess: normalizeDiagnosisTerm(resolvedGuessText),
      resolvedDiagnosisRegistryId: selectedDiagnosis.id,
      resolutionMethod: 'SELECTED_ID',
      isResolvable: true,
    };
  }

  private async lookupExpectedDiagnosis(
    diagnosisRegistryId?: string | null,
  ): Promise<DiagnosisRegistryLookupRow | null> {
    const normalizedId = diagnosisRegistryId?.trim() || null;
    if (!normalizedId) {
      return null;
    }

    const diagnosisRegistryModel = this.getDiagnosisRegistryModel();
    if (!diagnosisRegistryModel) {
      return null;
    }

    return ((await diagnosisRegistryModel.findUnique({
      where: {
        id: normalizedId,
      },
      select: {
        id: true,
        status: true,
      },
    })) as DiagnosisRegistryLookupRow | null);
  }

  private getDiagnosisRegistryModel():
    | {
        findUnique: (args: unknown) => Promise<DiagnosisRegistryLookupRow | null>;
      }
    | null {
    const diagnosisRegistryModel = (this.prisma as any)?.diagnosisRegistry;

    if (
      !diagnosisRegistryModel ||
      typeof diagnosisRegistryModel.findUnique !== 'function'
    ) {
      return null;
    }

    return diagnosisRegistryModel;
  }

  private getExpectedDiagnosisFailureReason(
    expectedDiagnosis: DiagnosisRegistryLookupRow | null,
  ): GameplayDiagnosisResolutionReason | null {
    if (!expectedDiagnosis) {
      return 'EXPECTED_DIAGNOSIS_MISSING';
    }

    if (expectedDiagnosis.status !== DiagnosisRegistryStatus.ACTIVE) {
      return 'EXPECTED_DIAGNOSIS_UNUSABLE';
    }

    return null;
  }

  private buildCorrectEvaluation(input: {
    expectedDiagnosisRegistryId: string;
    resolution: ResolvedGameplayDiagnosisGuess;
  }): EvaluationResult {
    return {
      score: 1,
      label: 'correct',
      signals: {
        registryCorrectnessAuthority: true,
        retrievalMode: 'selected-id-only',
        expectedDiagnosisRegistryId: input.expectedDiagnosisRegistryId,
        expectedDiagnosisUsable: true,
        submittedDiagnosisRegistryId:
          input.resolution.submittedDiagnosisRegistryId ?? undefined,
        resolvedDiagnosisRegistryId:
          input.resolution.resolvedDiagnosisRegistryId ?? undefined,
        diagnosisResolutionMethod: input.resolution.resolutionMethod,
      },
      normalizedGuess: input.resolution.normalizedGuess,
      evaluatorVersion: 'registry:v2',
      retrievalMode: 'selected-id-only',
    };
  }

  private buildWrongEvaluation(input: {
    expectedDiagnosisRegistryId: string | null;
    expectedDiagnosisUsable: boolean;
    expectedDiagnosisStatus: DiagnosisRegistryStatus | null;
    resolution: ResolvedGameplayDiagnosisGuess;
  }): EvaluationResult {
    return {
      score: 0,
      label: 'wrong',
      signals: {
        registryCorrectnessAuthority: true,
        retrievalMode: 'selected-id-only',
        expectedDiagnosisRegistryId: input.expectedDiagnosisRegistryId ?? undefined,
        expectedDiagnosisUsable: input.expectedDiagnosisUsable,
        expectedDiagnosisStatus: input.expectedDiagnosisStatus ?? undefined,
        submittedDiagnosisRegistryId:
          input.resolution.submittedDiagnosisRegistryId ?? undefined,
        resolvedDiagnosisRegistryId:
          input.resolution.resolvedDiagnosisRegistryId ?? undefined,
        diagnosisResolutionMethod: input.resolution.resolutionMethod,
        diagnosisResolutionReason: input.resolution.resolutionReason,
      },
      normalizedGuess: input.resolution.normalizedGuess,
      evaluatorVersion: 'registry:v2',
      retrievalMode: 'selected-id-only',
    };
  }
}
