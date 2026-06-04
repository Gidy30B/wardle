import { Injectable } from '@nestjs/common';
import {
  CaseEditorialStatus,
  DiagnosisRegistryStatus,
  type Prisma,
} from '@prisma/client';
import { ASSIGNABLE_EDITORIAL_STATUSES } from '../editorial/policies/publish-policy.js';
import type { GameplayClinicalClue } from '../gameplay/dto/submit-game-guess.dto.js';

export const PLAYABLE_CLUE_TYPES = [
  'history',
  'symptom',
  'vital',
  'lab',
  'exam',
  'imaging',
] as const;

export type PlayableClueType = (typeof PLAYABLE_CLUE_TYPES)[number];

export type ClueValidationReason =
  | 'not_array'
  | 'invalid_clue_shape'
  | 'invalid_clue_type'
  | 'invalid_clue_order'
  | 'invalid_clue_value'
  | 'no_playable_clues';

export type PlayableClueValidationResult = {
  valid: boolean;
  playableClueCount: number;
  clues: GameplayClinicalClue[];
  reasons: ClueValidationReason[];
  invalidClueTypes: string[];
};

type RegistryEligibilityInput = {
  status?: DiagnosisRegistryStatus | null;
  active?: boolean | null;
  isPlayable?: boolean | null;
};

@Injectable()
export class CaseEligibilityPolicyService {
  readonly assignableEditorialStatuses = ASSIGNABLE_EDITORIAL_STATUSES;

  isAssignableEditorialStatus(
    status: CaseEditorialStatus | null | undefined,
  ): boolean {
    return this.assignableEditorialStatuses.some((allowed) => allowed === status);
  }

  isGameplayEditorialStatus(
    status: CaseEditorialStatus | null | undefined,
  ): boolean {
    return (
      this.isAssignableEditorialStatus(status) ||
      status === CaseEditorialStatus.PUBLISHED
    );
  }

  isRegistryPlayable(registry: RegistryEligibilityInput | null | undefined) {
    if (!registry) {
      return false;
    }

    return (
      registry.status === DiagnosisRegistryStatus.ACTIVE &&
      registry.active === true &&
      registry.isPlayable === true
    );
  }

  normalizeClueType(type: unknown, value?: unknown): PlayableClueType | null {
    if (typeof type !== 'string') {
      return null;
    }

    const normalizedType = type.trim().toLowerCase();
    if (this.isPlayableClueType(normalizedType)) {
      return normalizedType;
    }

    if (normalizedType !== 'investigation') {
      return null;
    }

    const normalizedValue =
      typeof value === 'string' ? value.toLowerCase() : '';
    if (
      /\b(endoscopy|ultrasound|x[- ]?ray|radiograph|ct|mri|scan|imaging)\b/.test(
        normalizedValue,
      )
    ) {
      return 'imaging';
    }

    if (
      /\b(lab|blood|serum|urine|test|testing|hba1c|glucose|sodium|potassium|ph|bicarbonate|ketone|wbc|cbc|fbc)\b/.test(
        normalizedValue,
      )
    ) {
      return 'lab';
    }

    return 'imaging';
  }

  validatePlayableClues(
    value: unknown,
    input: { caseId?: string; minimumPlayableClues?: number } = {},
  ): PlayableClueValidationResult {
    const minimumPlayableClues = input.minimumPlayableClues ?? 1;
    const parsed = this.parseUnknownJson(value);
    const reasons = new Set<ClueValidationReason>();
    const invalidClueTypes = new Set<string>();
    const clues: GameplayClinicalClue[] = [];

    if (!Array.isArray(parsed)) {
      return {
        valid: false,
        playableClueCount: 0,
        clues: [],
        reasons: ['not_array', 'no_playable_clues'],
        invalidClueTypes: [],
      };
    }

    for (const [index, entry] of parsed.entries()) {
      if (typeof entry !== 'object' || entry === null) {
        reasons.add('invalid_clue_shape');
        continue;
      }

      const candidate = entry as {
        id?: unknown;
        type?: unknown;
        value?: unknown;
        order?: unknown;
      };
      const normalizedValue = this.normalizeClueValue(candidate.value);
      const normalizedType = this.normalizeClueType(
        candidate.type,
        normalizedValue,
      );

      if (!normalizedType) {
        reasons.add('invalid_clue_type');
        invalidClueTypes.add(String(candidate.type ?? 'missing'));
        continue;
      }

      if (
        typeof candidate.order !== 'number' ||
        !Number.isInteger(candidate.order) ||
        candidate.order < 0
      ) {
        reasons.add('invalid_clue_order');
        continue;
      }

      if (!normalizedValue) {
        reasons.add('invalid_clue_value');
        continue;
      }

      clues.push({
        id:
          typeof candidate.id === 'string' && candidate.id.trim().length > 0
            ? candidate.id
            : `${input.caseId ?? 'case'}-${candidate.order ?? index}`,
        type: normalizedType,
        value: normalizedValue,
        order: candidate.order,
      });
    }

    if (clues.length < minimumPlayableClues) {
      reasons.add('no_playable_clues');
    }

    const orderedClues = clues.sort((left, right) => left.order - right.order);

    return {
      valid:
        orderedClues.length >= minimumPlayableClues &&
        !reasons.has('invalid_clue_type'),
      playableClueCount: orderedClues.length,
      clues: orderedClues,
      reasons: Array.from(reasons),
      invalidClueTypes: Array.from(invalidClueTypes),
    };
  }

  getSchedulerClueExclusionReason(
    value: Prisma.JsonValue | null | undefined,
  ): 'invalid_clue_type' | 'no_playable_clues' | null {
    const validation = this.validatePlayableClues(value);
    if (validation.invalidClueTypes.length > 0) {
      return 'invalid_clue_type';
    }

    if (!validation.valid) {
      return 'no_playable_clues';
    }

    return null;
  }

  private isPlayableClueType(value: string): value is PlayableClueType {
    return PLAYABLE_CLUE_TYPES.some((type) => type === value);
  }

  private parseUnknownJson(value: unknown): unknown {
    if (typeof value !== 'string') {
      return value;
    }

    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  private normalizeClueValue(value: unknown): string | null {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    if (value === null || value === undefined) {
      return null;
    }

    const text = String(value).trim();
    return text.length > 0 ? text : null;
  }
}
