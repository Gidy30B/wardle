import { Injectable } from '@nestjs/common';
import {
  DiagnosisEditorialOnboardingStatus,
  DiagnosisRegistryStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';

export type RegistryLifecycleRowSummary = {
  id: string;
  displayLabel: string;
  canonicalName: string;
  canonicalNormalized: string;
  status: DiagnosisRegistryStatus;
  active: boolean;
  isPlayable: boolean;
  isGeneratable: boolean;
  onboardingStatus: DiagnosisEditorialOnboardingStatus | null;
  specialty: string | null;
  bodySystem: string | null;
  category: string | null;
  createdAt: string;
  updatedAt: string;
  notes: string | null;
};

export type RegistryLifecycleTelemetry = {
  summary: {
    totalRegistryRows: number;
    draftRows: number;
    activeRows: number;
    dictionaryVisibleRows: number;
    playableRows: number;
    generatableRows: number;
    candidateCreatedDraftRows: number;
    driftCount: number;
    activationBlockedCount: number;
    missingMetadataCount: number;
    duplicateRiskCount: number;
    descriptiveOrCompositionalCount: number;
  };
  drift: {
    draftButActive: RegistryLifecycleRowSummary[];
    draftButPlayable: RegistryLifecycleRowSummary[];
    draftButGeneratable: RegistryLifecycleRowSummary[];
    activeButInactive: RegistryLifecycleRowSummary[];
    generatableButNotPlayable: RegistryLifecycleRowSummary[];
    playableButNotDictionaryVisible: RegistryLifecycleRowSummary[];
  };
  blockers: {
    missingMetadata: RegistryLifecycleRowSummary[];
    duplicateRisk: RegistryLifecycleRowSummary[];
    descriptiveOrCompositional: RegistryLifecycleRowSummary[];
    activationBlocked: RegistryLifecycleRowSummary[];
  };
};

export type RegistryLifecycleNormalizeResult = {
  repaired: RegistryLifecycleRowSummary[];
  skipped: RegistryLifecycleRowSummary[];
  blockers: RegistryLifecycleRowSummary[];
};

type RegistryLifecycleTelemetryRow = {
  id: string;
  displayLabel: string;
  canonicalName: string;
  canonicalNormalized: string;
  status: DiagnosisRegistryStatus;
  active: boolean;
  isPlayable: boolean;
  isGeneratable: boolean;
  onboardingStatus: DiagnosisEditorialOnboardingStatus | null;
  specialty: string | null;
  bodySystem: string | null;
  category: string | null;
  createdAt: Date;
  updatedAt: Date;
  notes: string | null;
  isDescriptive: boolean;
  isCompositional: boolean;
  createdRegistryCandidates: Array<{ id: string }>;
  aliases: Array<{ normalizedTerm: string; active: boolean }>;
};

const TELEMETRY_SELECT = {
  id: true,
  displayLabel: true,
  canonicalName: true,
  canonicalNormalized: true,
  status: true,
  active: true,
  isPlayable: true,
  isGeneratable: true,
  onboardingStatus: true,
  specialty: true,
  bodySystem: true,
  category: true,
  createdAt: true,
  updatedAt: true,
  notes: true,
  isDescriptive: true,
  isCompositional: true,
  createdRegistryCandidates: {
    select: { id: true },
  },
  aliases: {
    where: { active: true },
    select: { normalizedTerm: true, active: true },
  },
} satisfies Prisma.DiagnosisRegistrySelect;

@Injectable()
export class DiagnosisRegistryLifecycleTelemetryService {
  constructor(private readonly prisma: PrismaService) {}

  async getTelemetry(): Promise<RegistryLifecycleTelemetry> {
    const rows = await this.loadRows();
    return this.buildTelemetry(rows);
  }

  async normalizeAll(): Promise<RegistryLifecycleNormalizeResult> {
    const rows = await this.loadRows();
    return this.normalizeRows(rows);
  }

  async normalizeOne(
    diagnosisRegistryId: string,
  ): Promise<RegistryLifecycleNormalizeResult> {
    const row = (await this.prisma.diagnosisRegistry.findUnique({
      where: { id: diagnosisRegistryId },
      select: TELEMETRY_SELECT,
    })) as RegistryLifecycleTelemetryRow | null;

    if (!row) {
      return { repaired: [], skipped: [], blockers: [] };
    }

    return this.normalizeRows([row]);
  }

  buildTelemetry(
    rows: RegistryLifecycleTelemetryRow[],
  ): RegistryLifecycleTelemetry {
    const duplicateIds = this.getDuplicateRiskIds(rows);
    const drift = {
      draftButActive: rows
        .filter((row) => row.status === DiagnosisRegistryStatus.DRAFT && row.active)
        .map((row) => this.toSummary(row)),
      draftButPlayable: rows
        .filter((row) => row.status === DiagnosisRegistryStatus.DRAFT && row.isPlayable)
        .map((row) => this.toSummary(row)),
      draftButGeneratable: rows
        .filter((row) => row.status === DiagnosisRegistryStatus.DRAFT && row.isGeneratable)
        .map((row) => this.toSummary(row)),
      activeButInactive: rows
        .filter((row) => row.status === DiagnosisRegistryStatus.ACTIVE && !row.active)
        .map((row) => this.toSummary(row)),
      generatableButNotPlayable: rows
        .filter((row) => row.isGeneratable && !row.isPlayable)
        .map((row) => this.toSummary(row)),
      playableButNotDictionaryVisible: rows
        .filter((row) => row.isPlayable && !this.isDictionaryVisible(row))
        .map((row) => this.toSummary(row)),
    };
    const missingMetadata = rows
      .filter((row) => this.hasMissingActivationMetadata(row))
      .map((row) => this.toSummary(row));
    const duplicateRisk = rows
      .filter((row) => duplicateIds.has(row.id))
      .map((row) => this.toSummary(row));
    const descriptiveOrCompositional = rows
      .filter((row) => row.isDescriptive || row.isCompositional)
      .map((row) => this.toSummary(row));
    const activationBlocked = this.uniqueRows([
      ...missingMetadata,
      ...duplicateRisk,
      ...descriptiveOrCompositional,
      ...drift.activeButInactive,
    ]);
    const driftCount = this.uniqueRows(Object.values(drift).flat()).length;

    return {
      summary: {
        totalRegistryRows: rows.length,
        draftRows: rows.filter((row) => row.status === DiagnosisRegistryStatus.DRAFT)
          .length,
        activeRows: rows.filter((row) => row.status === DiagnosisRegistryStatus.ACTIVE)
          .length,
        dictionaryVisibleRows: rows.filter((row) => this.isDictionaryVisible(row))
          .length,
        playableRows: rows.filter((row) => this.isPlayable(row)).length,
        generatableRows: rows.filter((row) => this.isGeneratable(row)).length,
        candidateCreatedDraftRows: rows.filter(
          (row) =>
            row.status === DiagnosisRegistryStatus.DRAFT &&
            row.createdRegistryCandidates.length > 0,
        ).length,
        driftCount,
        activationBlockedCount: activationBlocked.length,
        missingMetadataCount: missingMetadata.length,
        duplicateRiskCount: duplicateRisk.length,
        descriptiveOrCompositionalCount: descriptiveOrCompositional.length,
      },
      drift,
      blockers: {
        missingMetadata,
        duplicateRisk,
        descriptiveOrCompositional,
        activationBlocked,
      },
    };
  }

  async normalizeRows(
    rows: RegistryLifecycleTelemetryRow[],
  ): Promise<RegistryLifecycleNormalizeResult> {
    const repaired: RegistryLifecycleRowSummary[] = [];
    const skipped: RegistryLifecycleRowSummary[] = [];
    const blockers: RegistryLifecycleRowSummary[] = [];

    for (const row of rows) {
      const update = this.getSafeNormalizationUpdate(row);
      if (row.status === DiagnosisRegistryStatus.ACTIVE && !row.active) {
        blockers.push(this.toSummary(row));
        continue;
      }

      if (!Object.keys(update).length) {
        skipped.push(this.toSummary(row));
        continue;
      }

      const updated = (await this.prisma.diagnosisRegistry.update({
        where: { id: row.id },
        data: update,
        select: TELEMETRY_SELECT,
      })) as RegistryLifecycleTelemetryRow;
      repaired.push(this.toSummary(updated));
    }

    return { repaired, skipped, blockers };
  }

  getSafeNormalizationUpdate(
    row: Pick<
      RegistryLifecycleTelemetryRow,
      'status' | 'active' | 'isPlayable' | 'isGeneratable'
    >,
  ): Prisma.DiagnosisRegistryUpdateInput {
    const update: Prisma.DiagnosisRegistryUpdateInput = {};

    if (row.status !== DiagnosisRegistryStatus.ACTIVE) {
      if (row.active) update.active = false;
      if (row.isPlayable) update.isPlayable = false;
      if (row.isGeneratable) update.isGeneratable = false;
      return update;
    }

    if (row.isGeneratable && !row.isPlayable) {
      update.isGeneratable = false;
    }

    return update;
  }

  private async loadRows(): Promise<RegistryLifecycleTelemetryRow[]> {
    return (await this.prisma.diagnosisRegistry.findMany({
      select: TELEMETRY_SELECT,
      orderBy: [{ canonicalName: 'asc' }],
    })) as RegistryLifecycleTelemetryRow[];
  }

  private getDuplicateRiskIds(rows: RegistryLifecycleTelemetryRow[]): Set<string> {
    const byTerm = new Map<string, Set<string>>();
    for (const row of rows) {
      this.addTerm(byTerm, row.canonicalNormalized, row.id);
      for (const alias of row.aliases) {
        this.addTerm(byTerm, alias.normalizedTerm, row.id);
      }
    }

    const ids = new Set<string>();
    for (const rowIds of byTerm.values()) {
      if (rowIds.size > 1) {
        for (const id of rowIds) {
          ids.add(id);
        }
      }
    }

    return ids;
  }

  private addTerm(
    byTerm: Map<string, Set<string>>,
    term: string | null | undefined,
    id: string,
  ) {
    if (!term) return;
    const rows = byTerm.get(term) ?? new Set<string>();
    rows.add(id);
    byTerm.set(term, rows);
  }

  private hasMissingActivationMetadata(row: RegistryLifecycleTelemetryRow) {
    return (
      !row.displayLabel ||
      !row.canonicalName ||
      !row.canonicalNormalized ||
      !row.specialty ||
      (!row.category && !row.bodySystem)
    );
  }

  private isDictionaryVisible(
    row: Pick<RegistryLifecycleTelemetryRow, 'status' | 'active' | 'isPlayable'>,
  ) {
    return (
      row.status === DiagnosisRegistryStatus.ACTIVE &&
      row.active &&
      row.isPlayable
    );
  }

  private isPlayable(
    row: Pick<
      RegistryLifecycleTelemetryRow,
      'status' | 'active' | 'isPlayable'
    >,
  ) {
    return this.isDictionaryVisible(row) && row.isPlayable;
  }

  private isGeneratable(
    row: Pick<
      RegistryLifecycleTelemetryRow,
      'status' | 'active' | 'isPlayable' | 'isGeneratable'
    >,
  ) {
    return this.isPlayable(row) && row.isGeneratable;
  }

  private toSummary(
    row: RegistryLifecycleTelemetryRow,
  ): RegistryLifecycleRowSummary {
    return {
      id: row.id,
      displayLabel: row.displayLabel,
      canonicalName: row.canonicalName,
      canonicalNormalized: row.canonicalNormalized,
      status: row.status,
      active: row.active,
      isPlayable: row.isPlayable,
      isGeneratable: row.isGeneratable,
      onboardingStatus: row.onboardingStatus,
      specialty: row.specialty,
      bodySystem: row.bodySystem,
      category: row.category,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      notes: row.notes,
    };
  }

  private uniqueRows(rows: RegistryLifecycleRowSummary[]) {
    const byId = new Map<string, RegistryLifecycleRowSummary>();
    for (const row of rows) {
      byId.set(row.id, row);
    }
    return [...byId.values()];
  }
}
