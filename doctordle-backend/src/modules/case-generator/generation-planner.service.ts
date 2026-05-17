import { Injectable, Logger } from '@nestjs/common';
import {
  type GenerateBatchOptions,
  type PlannedGenerationDiagnosis,
  type PlannerSelectionDiagnostics,
  type PlannedGenerationSlot,
} from './case-generator.types.js';
import { DiagnosisSelectionService } from './diagnosis-selection.service.js';
import { GenerationDeduplicationService } from './generation-deduplication.service.js';

@Injectable()
export class GenerationPlannerService {
  private readonly logger = new Logger(GenerationPlannerService.name);

  constructor(
    private readonly diagnosisSelectionService: DiagnosisSelectionService,
    private readonly generationDeduplicationService: GenerationDeduplicationService,
  ) {}

  async createShadowPlan(input: {
    batchId: string;
    options: GenerateBatchOptions;
  }): Promise<PlannedGenerationSlot[]> {
    const count = Math.max(0, Math.trunc(input.options.count));
    const reservedRegistryIds =
      this.generationDeduplicationService.createRegistryReservation();
    const selection =
      await this.diagnosisSelectionService.selectDiagnosisCandidates({
      count,
      specialty: input.options.track,
      bodySystem: input.options.bodySystem,
      difficulty: input.options.difficulty,
    });
    const candidates = selection.candidates;
    const slots: PlannedGenerationSlot[] = [];
    let candidateIndex = 0;
    let selectedUnusedCount = 0;
    let selectedRepeatCount = 0;
    let duplicatePrevented = false;

    for (let index = 0; index < count; index += 1) {
      const selected = this.takeNextUniqueCandidate(
        candidates,
        reservedRegistryIds,
        candidateIndex,
      );
      candidateIndex = selected.nextIndex;
      duplicatePrevented = duplicatePrevented || selected.duplicatePrevented;
      if (selected.diagnosis?.existingCaseCount === 0) {
        selectedUnusedCount += 1;
      } else if (selected.diagnosis) {
        selectedRepeatCount += 1;
      }

      const slot: PlannedGenerationSlot = {
        batchId: input.batchId,
        index,
        diagnosis: selected.diagnosis,
        duplicatePrevented: selected.duplicatePrevented,
        selectionStatus: selected.diagnosis ? 'selected' : 'unavailable',
        repeatReason: this.getRepeatReason({
          diagnosis: selected.diagnosis,
          unusedCandidateCount: selection.unusedCandidateCount,
          selectedUnusedCount,
        }),
        existingCaseCount: selected.diagnosis?.existingCaseCount ?? null,
        recentUsePenaltyApplied:
          selected.diagnosis?.recentUsePenaltyApplied ?? false,
        diagnostics: this.buildDiagnostics({
          candidateCount: selection.candidateCount,
          unusedCandidateCount: selection.unusedCandidateCount,
          repeatedCandidateCount: selection.repeatedCandidateCount,
          selectedUnusedCount,
          selectedRepeatCount,
          repeatReason: null,
          existingCaseCountByDiagnosis:
            selection.existingCaseCountByDiagnosis,
          recentUsePenaltyApplied: selection.recentUsePenaltyApplied,
        }),
      };

      slots.push(slot);
    }

    const repeatReason = this.getPlanRepeatReason({
      count,
      selectedRepeatCount,
      unusedCandidateCount: selection.unusedCandidateCount,
      candidateCount: selection.candidateCount,
      duplicatePrevented,
    });
    const diagnostics = this.buildDiagnostics({
      candidateCount: selection.candidateCount,
      unusedCandidateCount: selection.unusedCandidateCount,
      repeatedCandidateCount: selection.repeatedCandidateCount,
      selectedUnusedCount,
      selectedRepeatCount,
      repeatReason,
      existingCaseCountByDiagnosis: selection.existingCaseCountByDiagnosis,
      recentUsePenaltyApplied: selection.recentUsePenaltyApplied,
    });
    const plannedSlots = slots.map((slot) => ({
      ...slot,
      repeatReason:
        slot.diagnosis && slot.diagnosis.existingCaseCount > 0
          ? repeatReason
          : slot.repeatReason,
      diagnostics,
    }));

    for (const slot of plannedSlots) {
      this.logSelectedDiagnosis(slot);
    }

    return plannedSlots;
  }

  compareAnswerToPlannedDiagnosis(input: {
    slot: PlannedGenerationSlot;
    aiAnswer: string;
  }): PlannedGenerationSlot {
    const normalizedAiAnswer = normalizeDiagnosis(input.aiAnswer);
    const plannerTerms = input.slot.diagnosis
      ? [
          input.slot.diagnosis.displayLabel,
          input.slot.diagnosis.canonicalName,
          ...input.slot.diagnosis.acceptedAliases,
        ]
      : [];
    const normalizedPlannerDiagnosis = normalizeDiagnosis(
      input.slot.diagnosis?.displayLabel ?? '',
    );
    const matchesPlanner =
      Boolean(normalizedAiAnswer) &&
      plannerTerms.some(
        (term) => normalizeDiagnosis(term) === normalizedAiAnswer,
      );
    const nextSlot: PlannedGenerationSlot = {
      ...input.slot,
      comparison: {
        aiAnswer: input.aiAnswer,
        normalizedAiAnswer,
        normalizedPlannerDiagnosis,
        matchesPlanner,
      },
    };

    this.logger.log(
      JSON.stringify({
        event: 'case.generate.planner_drift',
        batchId: nextSlot.batchId,
        index: nextSlot.index,
        diagnosisRegistryId: nextSlot.diagnosis?.diagnosisRegistryId ?? null,
        plannerDiagnosis: nextSlot.diagnosis?.displayLabel ?? null,
        aiAnswer: input.aiAnswer,
        matchesPlanner,
        duplicatePrevented: nextSlot.duplicatePrevented,
        repeatReason: nextSlot.repeatReason,
        existingCaseCount: nextSlot.existingCaseCount,
        recentUsePenaltyApplied: nextSlot.recentUsePenaltyApplied,
      }),
    );

    return nextSlot;
  }

  private takeNextUniqueCandidate(
    candidates: PlannedGenerationDiagnosis[],
    reservedRegistryIds: Set<string>,
    startIndex: number,
  ): {
    diagnosis: PlannedGenerationDiagnosis | null;
    duplicatePrevented: boolean;
    nextIndex: number;
  } {
    let duplicatePrevented = false;

    for (let index = startIndex; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      const reserved =
        this.generationDeduplicationService.reserveRegistryDiagnosis({
          registryId: candidate.diagnosisRegistryId,
          reservedRegistryIds,
        });

      if (reserved) {
        return {
          diagnosis: candidate,
          duplicatePrevented,
          nextIndex: index + 1,
        };
      }

      duplicatePrevented = true;
    }

    return {
      diagnosis: null,
      duplicatePrevented,
      nextIndex: candidates.length,
    };
  }

  private buildDiagnostics(
    diagnostics: PlannerSelectionDiagnostics,
  ): PlannerSelectionDiagnostics {
    return diagnostics;
  }

  private getRepeatReason(input: {
    diagnosis: PlannedGenerationDiagnosis | null;
    unusedCandidateCount: number;
    selectedUnusedCount: number;
  }): string | null {
    if (!input.diagnosis || input.diagnosis.existingCaseCount === 0) {
      return null;
    }

    if (input.unusedCandidateCount === 0) {
      return 'no_unused_candidates';
    }

    if (input.selectedUnusedCount >= input.unusedCandidateCount) {
      return 'unused_candidates_exhausted';
    }

    return 'least_used_repeat_selected';
  }

  private getPlanRepeatReason(input: {
    count: number;
    selectedRepeatCount: number;
    unusedCandidateCount: number;
    candidateCount: number;
    duplicatePrevented: boolean;
  }): string | null {
    if (input.selectedRepeatCount === 0) {
      return input.duplicatePrevented ? 'duplicate_candidates_skipped' : null;
    }

    if (input.unusedCandidateCount === 0) {
      return 'no_unused_candidates';
    }

    if (input.unusedCandidateCount < input.count) {
      return 'unused_candidates_insufficient';
    }

    if (input.candidateCount < input.count) {
      return 'candidate_pool_insufficient';
    }

    return 'least_used_repeat_selected';
  }

  private logSelectedDiagnosis(slot: PlannedGenerationSlot): void {
    this.logger.log(
      JSON.stringify({
        event: 'case.generate.planner_selected',
        batchId: slot.batchId,
        index: slot.index,
        diagnosisRegistryId: slot.diagnosis?.diagnosisRegistryId ?? null,
        plannerDiagnosis: slot.diagnosis?.displayLabel ?? null,
        selectionStatus: slot.selectionStatus,
        duplicatePrevented: slot.duplicatePrevented,
        repeatReason: slot.repeatReason,
        existingCaseCount: slot.existingCaseCount,
        recentUsePenaltyApplied: slot.recentUsePenaltyApplied,
        diagnostics: slot.diagnostics,
      }),
    );
  }
}

function normalizeDiagnosis(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
