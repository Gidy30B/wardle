import { Injectable } from '@nestjs/common';
import {
  DifferentialLinkRole,
  DifferentialResolutionStatus,
  type CaseDifferentialMapping,
  type EducationDifferentialMapping,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';

type LinkCounters = {
  mappingsScanned: number;
  linksCreated: number;
  linksUpdated: number;
  skippedUnresolved: number;
  skippedAmbiguous: number;
  skippedRejected: number;
  errors: number;
};

export type DifferentialLinkBackfillResult = {
  caseMappings: LinkCounters;
  educationMappings: LinkCounters;
};

const EMPTY_COUNTERS: LinkCounters = {
  mappingsScanned: 0,
  linksCreated: 0,
  linksUpdated: 0,
  skippedUnresolved: 0,
  skippedAmbiguous: 0,
  skippedRejected: 0,
  errors: 0,
};

@Injectable()
export class DifferentialLinkService {
  constructor(private readonly prisma: PrismaService) {}

  async syncCaseMapping(mappingId: string) {
    const mapping = await this.prisma.caseDifferentialMapping.findUnique({
      where: { id: mappingId },
    });
    if (!mapping) {
      return null;
    }

    return this.syncCaseMappingRow(mapping);
  }

  async syncEducationMapping(mappingId: string) {
    const mapping = await this.prisma.educationDifferentialMapping.findUnique({
      where: { id: mappingId },
    });
    if (!mapping) {
      return null;
    }

    return this.syncEducationMappingRow(mapping);
  }

  async syncCaseMappingRow(mapping: CaseDifferentialMapping) {
    if (
      mapping.status !== DifferentialResolutionStatus.RESOLVED ||
      !mapping.resolvedDiagnosisRegistryId
    ) {
      await this.prisma.caseDifferentialLink.deleteMany({
        where: { sourceMappingId: mapping.id },
      });
      return { action: 'removed' as const };
    }

    const dedupeKey = this.caseDedupeKey(mapping);
    await this.prisma.caseDifferentialLink.deleteMany({
      where: {
        sourceMappingId: mapping.id,
        dedupeKey: { not: dedupeKey },
      },
    });
    const existing = await this.prisma.caseDifferentialLink.findUnique({
      where: { dedupeKey },
      select: { id: true },
    });
    const saved = await this.prisma.caseDifferentialLink.upsert({
      where: { dedupeKey },
      update: {
        sourceMappingId: mapping.id,
        role: DifferentialLinkRole.DIFFERENTIAL,
        confidence: mapping.confidence,
        sourceText: mapping.rawText,
      },
      create: {
        dedupeKey,
        caseId: mapping.caseId,
        caseRevisionId: mapping.revisionId,
        sourceMappingId: mapping.id,
        diagnosisRegistryId: mapping.resolvedDiagnosisRegistryId,
        role: DifferentialLinkRole.DIFFERENTIAL,
        confidence: mapping.confidence,
        sourceText: mapping.rawText,
      },
    });

    return { action: existing ? 'updated' as const : 'created' as const, link: saved };
  }

  async syncEducationMappingRow(mapping: EducationDifferentialMapping) {
    if (
      mapping.status !== DifferentialResolutionStatus.RESOLVED ||
      !mapping.resolvedDiagnosisRegistryId
    ) {
      await this.prisma.educationDifferentialLink.deleteMany({
        where: { sourceMappingId: mapping.id },
      });
      return { action: 'removed' as const };
    }

    const dedupeKey = this.educationDedupeKey(mapping);
    await this.prisma.educationDifferentialLink.deleteMany({
      where: {
        sourceMappingId: mapping.id,
        dedupeKey: { not: dedupeKey },
      },
    });
    const existing = await this.prisma.educationDifferentialLink.findUnique({
      where: { dedupeKey },
      select: { id: true },
    });
    const saved = await this.prisma.educationDifferentialLink.upsert({
      where: { dedupeKey },
      update: {
        sourceMappingId: mapping.id,
        role: DifferentialLinkRole.TEACHING_DIFFERENTIAL,
        confidence: mapping.confidence,
        sourceText: mapping.rawText,
      },
      create: {
        dedupeKey,
        educationId: mapping.educationId,
        educationRevisionId: mapping.revisionId,
        sourceMappingId: mapping.id,
        diagnosisRegistryId: mapping.resolvedDiagnosisRegistryId,
        role: DifferentialLinkRole.TEACHING_DIFFERENTIAL,
        confidence: mapping.confidence,
        sourceText: mapping.rawText,
      },
    });

    return { action: existing ? 'updated' as const : 'created' as const, link: saved };
  }

  async backfill(): Promise<DifferentialLinkBackfillResult> {
    const result: DifferentialLinkBackfillResult = {
      caseMappings: this.counters(),
      educationMappings: this.counters(),
    };

    for (const mapping of await this.prisma.caseDifferentialMapping.findMany()) {
      await this.scanCaseMapping(result.caseMappings, mapping);
    }

    for (const mapping of await this.prisma.educationDifferentialMapping.findMany()) {
      await this.scanEducationMapping(result.educationMappings, mapping);
    }

    return result;
  }

  async getCoverageForDiagnosis(diagnosisRegistryId: string) {
    const [caseMappings, educationMappings, caseLinks, educationLinks] =
      await Promise.all([
        this.prisma.caseDifferentialMapping.count({
          where: { case: { diagnosisRegistryId } },
        }),
        this.prisma.educationDifferentialMapping.count({
          where: { diagnosisRegistryId },
        }),
        this.prisma.caseDifferentialLink.count({
          where: { case: { diagnosisRegistryId } },
        }),
        this.prisma.educationDifferentialLink.count({
          where: { education: { diagnosisRegistryId } },
        }),
      ]);
    const [unresolvedCaseMappings, unresolvedEducationMappings] = await Promise.all([
      this.prisma.caseDifferentialMapping.count({
        where: {
          case: { diagnosisRegistryId },
          status: {
            in: [
              DifferentialResolutionStatus.AMBIGUOUS,
              DifferentialResolutionStatus.UNRESOLVED,
            ],
          },
        },
      }),
      this.prisma.educationDifferentialMapping.count({
        where: {
          diagnosisRegistryId,
          status: {
            in: [
              DifferentialResolutionStatus.AMBIGUOUS,
              DifferentialResolutionStatus.UNRESOLVED,
            ],
          },
        },
      }),
    ]);

    return {
      totalDifferentials: caseMappings + educationMappings,
      resolvedLinks: caseLinks + educationLinks,
      unresolvedMappings: unresolvedCaseMappings + unresolvedEducationMappings,
    };
  }

  async getLinkedDifferentialsForDiagnosis(diagnosisRegistryId: string) {
    const [caseLinks, educationLinks] = await Promise.all([
      this.prisma.caseDifferentialLink.findMany({
        where: { case: { diagnosisRegistryId } },
        include: {
          diagnosisRegistry: {
            select: { id: true, displayLabel: true, canonicalName: true },
          },
        },
        orderBy: [{ updatedAt: 'desc' }],
        take: 50,
      }),
      this.prisma.educationDifferentialLink.findMany({
        where: { education: { diagnosisRegistryId } },
        include: {
          diagnosisRegistry: {
            select: { id: true, displayLabel: true, canonicalName: true },
          },
        },
        orderBy: [{ updatedAt: 'desc' }],
        take: 50,
      }),
    ]);

    const byDiagnosisId = new Map<
      string,
      {
        diagnosisRegistryId: string;
        displayLabel: string;
        canonicalName: string;
        role: DifferentialLinkRole;
        confidence: number | null;
        sourceText: string;
      }
    >();

    for (const link of [...educationLinks, ...caseLinks]) {
      if (!byDiagnosisId.has(link.diagnosisRegistryId)) {
        byDiagnosisId.set(link.diagnosisRegistryId, {
          diagnosisRegistryId: link.diagnosisRegistryId,
          displayLabel: link.diagnosisRegistry.displayLabel,
          canonicalName: link.diagnosisRegistry.canonicalName,
          role: link.role,
          confidence: link.confidence,
          sourceText: link.sourceText,
        });
      }
    }

    return [...byDiagnosisId.values()];
  }

  async getCaseLinks(caseId: string) {
    return this.prisma.caseDifferentialLink.findMany({
      where: { caseId },
      include: {
        diagnosisRegistry: {
          select: { id: true, displayLabel: true, canonicalName: true },
        },
      },
      orderBy: [{ role: 'asc' }, { sourceText: 'asc' }],
    });
  }

  async getEducationLinks(educationId: string) {
    return this.prisma.educationDifferentialLink.findMany({
      where: { educationId },
      include: {
        diagnosisRegistry: {
          select: { id: true, displayLabel: true, canonicalName: true },
        },
      },
      orderBy: [{ role: 'asc' }, { sourceText: 'asc' }],
    });
  }

  private async scanCaseMapping(
    counters: LinkCounters,
    mapping: CaseDifferentialMapping,
  ) {
    counters.mappingsScanned += 1;
    this.countSkipped(counters, mapping.status);
    if (
      mapping.status !== DifferentialResolutionStatus.RESOLVED ||
      !mapping.resolvedDiagnosisRegistryId
    ) {
      return;
    }
    try {
      const result = await this.syncCaseMappingRow(mapping);
      if (result.action === 'created') counters.linksCreated += 1;
      if (result.action === 'updated') counters.linksUpdated += 1;
    } catch {
      counters.errors += 1;
    }
  }

  private async scanEducationMapping(
    counters: LinkCounters,
    mapping: EducationDifferentialMapping,
  ) {
    counters.mappingsScanned += 1;
    this.countSkipped(counters, mapping.status);
    if (
      mapping.status !== DifferentialResolutionStatus.RESOLVED ||
      !mapping.resolvedDiagnosisRegistryId
    ) {
      return;
    }
    try {
      const result = await this.syncEducationMappingRow(mapping);
      if (result.action === 'created') counters.linksCreated += 1;
      if (result.action === 'updated') counters.linksUpdated += 1;
    } catch {
      counters.errors += 1;
    }
  }

  private countSkipped(counters: LinkCounters, status: DifferentialResolutionStatus) {
    if (status === DifferentialResolutionStatus.UNRESOLVED) {
      counters.skippedUnresolved += 1;
    } else if (status === DifferentialResolutionStatus.AMBIGUOUS) {
      counters.skippedAmbiguous += 1;
    } else if (status === DifferentialResolutionStatus.REJECTED) {
      counters.skippedRejected += 1;
    }
  }

  private caseDedupeKey(mapping: CaseDifferentialMapping) {
    return [
      'case',
      mapping.caseId,
      mapping.revisionId ?? 'current',
      mapping.resolvedDiagnosisRegistryId,
    ].join(':');
  }

  private educationDedupeKey(mapping: EducationDifferentialMapping) {
    return [
      'education',
      mapping.educationId,
      mapping.revisionId ?? 'current',
      mapping.resolvedDiagnosisRegistryId,
    ].join(':');
  }

  private counters(): LinkCounters {
    return { ...EMPTY_COUNTERS };
  }
}
