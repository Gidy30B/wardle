import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { CaseSource, Prisma, PublishTrack } from '@prisma/client';
import { stableStringify } from '../editorial-governance/governed-command/index.js';
import type { CaseRevisionSnapshot } from './case-validation.types.js';

export type CaseRevisionMaterialHashInput = Partial<{
  source: CaseSource | null;
  publishTrack: PublishTrack | null;
}> &
  Pick<
    CaseRevisionSnapshot,
    | 'title'
    | 'date'
    | 'difficulty'
    | 'history'
    | 'symptoms'
    | 'labs'
    | 'clues'
    | 'explanation'
    | 'differentials'
    | 'diagnosisId'
    | 'diagnosisRegistryId'
    | 'proposedDiagnosisText'
    | 'diagnosisMappingStatus'
    | 'diagnosisMappingMethod'
    | 'diagnosisMappingConfidence'
    | 'diagnosisEditorialNote'
  >;

export function buildCaseRevisionMaterialHash(
  input: CaseRevisionMaterialHashInput,
): string {
  return createHash('sha256')
    .update(stableStringify(normalizeForMaterialHash(toMaterialHashInput(input))))
    .digest('hex');
}

export function toMaterialHashInput(input: CaseRevisionMaterialHashInput) {
  const material = {
    title: input.title,
    date: input.date,
    difficulty: input.difficulty,
    history: input.history,
    symptoms: input.symptoms,
    labs: input.labs,
    clues: input.clues,
    explanation: input.explanation,
    differentials: input.differentials,
    diagnosisId: input.diagnosisId,
    diagnosisRegistryId: input.diagnosisRegistryId,
    proposedDiagnosisText: input.proposedDiagnosisText,
    diagnosisMappingStatus: input.diagnosisMappingStatus,
    diagnosisMappingMethod: input.diagnosisMappingMethod,
    diagnosisMappingConfidence: input.diagnosisMappingConfidence,
    diagnosisEditorialNote: input.diagnosisEditorialNote,
  };
  if (Object.prototype.hasOwnProperty.call(input, 'source')) {
    Object.assign(material, { source: input.source ?? null });
  }
  if (Object.prototype.hasOwnProperty.call(input, 'publishTrack')) {
    Object.assign(material, { publishTrack: input.publishTrack ?? null });
  }
  return material;
}

export function normalizeForMaterialHash(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForMaterialHash(entry));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        normalizeForMaterialHash(entry),
      ]),
    );
  }
  return value;
}

export function canonicalizeRevisionClues(input: {
  baseClues: Prisma.JsonValue | null;
  proposedClues: Prisma.JsonValue | null;
}): { clues: Prisma.JsonValue | null; materialChange: Record<string, unknown> } {
  if (!Array.isArray(input.proposedClues)) {
    return {
      clues: input.proposedClues,
      materialChange: {
        clueIdentity: 'not_array',
      },
    };
  }

  const baseKeysBySignature = buildBaseClueKeyMap(input.baseClues);
  const usedKeys = new Set<string>();
  const addedKeys: string[] = [];
  let sourceHadGovernedKeys = true;

  const clues = input.proposedClues.map((entry) => {
    if (!isJsonObject(entry)) return entry;
    const explicitKey = stringValue(entry.key);
    const signature = clueSignature(entry);
    const inheritedKey = explicitKey ?? baseKeysBySignature.get(signature);
    const key = inheritedKey ?? `clue-${randomUUID()}`;

    if (!explicitKey && !baseKeysBySignature.has(signature)) {
      addedKeys.push(key);
    }
    if (usedKeys.has(key)) {
      throw new BadRequestException(
        `Duplicate clue key in resulting revision: ${key}`,
      );
    }
    usedKeys.add(key);
    return {
      ...entry,
      key,
    };
  });

  if (Array.isArray(input.baseClues)) {
    sourceHadGovernedKeys = input.baseClues.every(
      (entry) => !isJsonObject(entry) || !!stringValue(entry.key),
    );
  }

  return {
    clues,
    materialChange: {
      clueIdentity: sourceHadGovernedKeys
        ? 'preserved_or_created'
        : 'established_with_legacy_key_uncertainty',
      addedClueKeys: addedKeys,
      duplicateKeysRejected: true,
    },
  };
}

function buildBaseClueKeyMap(value: Prisma.JsonValue | null) {
  const map = new Map<string, string>();
  if (!Array.isArray(value)) return map;
  for (const entry of value) {
    if (!isJsonObject(entry)) continue;
    const key = stringValue(entry.key);
    if (!key) continue;
    map.set(clueSignature(entry), key);
  }
  return map;
}

function clueSignature(entry: Record<string, unknown>): string {
  const { key: _key, ...rest } = entry;
  return stableStringify(normalizeForMaterialHash(rest));
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
