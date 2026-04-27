import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CaseEditorialStatus,
  DiagnosisRegistryStatus,
  Prisma,
  type PrismaClient,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service.js';
import {
  buildDiagnosisRegistryStatusPatch,
} from './diagnosis-registry-status.js';
import { normalizeDiagnosisTerm } from './diagnosis-term-normalizer.js';

type DiagnosisRegistryLinkClient =
  | PrismaService
  | Prisma.TransactionClient
  | PrismaClient;

export type ResolvedDiagnosisRegistryLink = {
  diagnosisId: string;
  diagnosisName: string;
  diagnosisRegistryId: string;
};

export type DiagnosisRegistryLinkInput = {
  diagnosisId?: string | null;
  diagnosisRegistryId?: string | null;
};

export type DiagnosisRegistryIntegrityCollision = {
  normalizedTerm: string;
  ownerCount: number;
};

export type DiagnosisRegistryIntegrityReport = {
  diagnosesWithoutRegistry: number;
  registryRowsWithoutLegacyDiagnosis: number;
  casesWithoutRegistry: number;
  playableCasesWithoutRegistry: number;
  caseRevisionsWithoutRegistry: number;
  caseDiagnosisMismatches: number;
  caseRevisionDiagnosisMismatches: number;
  acceptedAliasCollisions: DiagnosisRegistryIntegrityCollision[];
};

type CountRow = {
  count: bigint | number;
};

type CollisionRow = {
  normalizedTerm: string;
  ownerCount: bigint | number;
};

type DiagnosisRecord = {
  id: string;
  name: string;
};

type DiagnosisRegistryRecord = {
  id: string;
  legacyDiagnosisId: string | null;
  status: DiagnosisRegistryStatus;
};

export async function ensureDiagnosisRegistryLink(
  client: DiagnosisRegistryLinkClient,
  input: DiagnosisRegistryLinkInput,
): Promise<ResolvedDiagnosisRegistryLink> {
  const diagnosisId = input.diagnosisId?.trim() || null;
  const diagnosisRegistryId = input.diagnosisRegistryId?.trim() || null;

  if (!diagnosisId && !diagnosisRegistryId) {
    throw new BadRequestException(
      'Diagnosis linkage requires a diagnosisId or diagnosisRegistryId',
    );
  }

  const prisma = client as any;
  let diagnosis: DiagnosisRecord | null = null;
  let registry: DiagnosisRegistryRecord | null = null;

  if (diagnosisId) {
    diagnosis = (await prisma.diagnosis.findUnique({
      where: { id: diagnosisId },
      select: {
        id: true,
        name: true,
      },
    })) as DiagnosisRecord | null;

    if (!diagnosis) {
      throw new NotFoundException(`Diagnosis not found: ${diagnosisId}`);
    }
  }

  if (diagnosisRegistryId) {
    registry = (await prisma.diagnosisRegistry.findUnique({
      where: { id: diagnosisRegistryId },
      select: {
        id: true,
        legacyDiagnosisId: true,
        status: true,
      },
    })) as DiagnosisRegistryRecord | null;

    if (!registry) {
      throw new NotFoundException(
        `Diagnosis registry entry not found: ${diagnosisRegistryId}`,
      );
    }
  }

  if (diagnosis && registry && registry.legacyDiagnosisId !== diagnosis.id) {
    throw new BadRequestException(
      'Diagnosis and diagnosis registry linkage do not refer to the same canonical diagnosis',
    );
  }

  if (!diagnosis) {
    if (!registry?.legacyDiagnosisId) {
      throw new BadRequestException(
        'Diagnosis registry entry is not linked to a legacy diagnosis yet',
      );
    }

    diagnosis = (await prisma.diagnosis.findUnique({
      where: { id: registry.legacyDiagnosisId },
      select: {
        id: true,
        name: true,
      },
    })) as DiagnosisRecord | null;

    if (!diagnosis) {
      throw new NotFoundException(
        `Legacy diagnosis not found for registry entry: ${registry.id}`,
      );
    }
  }

  const ensuredRegistry = await upsertRegistryForDiagnosis(client, diagnosis);

  if (ensuredRegistry.legacyDiagnosisId !== diagnosis.id) {
    throw new BadRequestException(
      'Resolved diagnosis registry entry is not synchronized with the diagnosis',
    );
  }

  return {
    diagnosisId: diagnosis.id,
    diagnosisName: diagnosis.name,
    diagnosisRegistryId: ensuredRegistry.id,
  };
}

export async function collectDiagnosisRegistryIntegrityReport(
  client: DiagnosisRegistryLinkClient,
): Promise<DiagnosisRegistryIntegrityReport> {
  const prisma = client as any;
  const [
    diagnosesWithoutRegistry,
    registryRowsWithoutLegacyDiagnosis,
    casesWithoutRegistry,
    playableCasesWithoutRegistry,
    caseRevisionsWithoutRegistry,
    caseDiagnosisMismatchRows,
    caseRevisionDiagnosisMismatchRows,
    acceptedAliasCollisionRows,
  ] = await Promise.all([
    prisma.diagnosis.count({
      where: {
        registryEntry: {
          is: null,
        },
      },
    }),
    prisma.diagnosisRegistry.count({
      where: {
        legacyDiagnosisId: null,
      },
    }),
    prisma.case.count({
      where: {
        diagnosisRegistryId: null,
      },
    }),
    prisma.case.count({
      where: {
        diagnosisRegistryId: null,
        editorialStatus: {
          in: [
            CaseEditorialStatus.APPROVED,
            CaseEditorialStatus.READY_TO_PUBLISH,
            CaseEditorialStatus.PUBLISHED,
          ],
        },
      },
    }),
    prisma.caseRevision.count({
      where: {
        diagnosisRegistryId: null,
      },
    }),
    prisma.$queryRaw`
      SELECT COUNT(*)::bigint AS count
      FROM "Case" c
      JOIN "DiagnosisRegistry" dr
        ON dr."id" = c."diagnosisRegistryId"
      WHERE dr."legacyDiagnosisId" IS DISTINCT FROM c."diagnosisId"
    ` as Promise<Array<CountRow>>,
    prisma.$queryRaw`
      SELECT COUNT(*)::bigint AS count
      FROM "CaseRevision" cr
      JOIN "DiagnosisRegistry" dr
        ON dr."id" = cr."diagnosisRegistryId"
      WHERE dr."legacyDiagnosisId" IS DISTINCT FROM cr."diagnosisId"
    ` as Promise<Array<CountRow>>,
    prisma.$queryRaw`
      SELECT
        "normalizedTerm",
        COUNT(DISTINCT "diagnosisRegistryId")::bigint AS "ownerCount"
      FROM "DiagnosisAlias"
      WHERE "active" = true
        AND "acceptedForMatch" = true
      GROUP BY "normalizedTerm"
      HAVING COUNT(DISTINCT "diagnosisRegistryId") > 1
      ORDER BY "normalizedTerm" ASC
    ` as Promise<Array<CollisionRow>>,
  ]);

  return {
    diagnosesWithoutRegistry,
    registryRowsWithoutLegacyDiagnosis,
    casesWithoutRegistry,
    playableCasesWithoutRegistry,
    caseRevisionsWithoutRegistry,
    caseDiagnosisMismatches: toNumber(caseDiagnosisMismatchRows[0]?.count),
    caseRevisionDiagnosisMismatches: toNumber(
      caseRevisionDiagnosisMismatchRows[0]?.count,
    ),
    acceptedAliasCollisions: acceptedAliasCollisionRows.map((row) => ({
      normalizedTerm: row.normalizedTerm,
      ownerCount: toNumber(row.ownerCount),
    })),
  };
}

@Injectable()
export class DiagnosisRegistryLinkService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveForWrite(
    input: DiagnosisRegistryLinkInput,
    client: DiagnosisRegistryLinkClient = this.prisma,
  ): Promise<ResolvedDiagnosisRegistryLink> {
    return ensureDiagnosisRegistryLink(client, input);
  }

  async collectIntegrityReport(
    client: DiagnosisRegistryLinkClient = this.prisma,
  ): Promise<DiagnosisRegistryIntegrityReport> {
    return collectDiagnosisRegistryIntegrityReport(client);
  }
}

async function upsertRegistryForDiagnosis(
  client: DiagnosisRegistryLinkClient,
  diagnosis: DiagnosisRecord,
): Promise<DiagnosisRegistryRecord> {
  const prisma = client as any;
  const canonicalNormalized = normalizeDiagnosisTerm(diagnosis.name);
  const activeStatusPatch = buildDiagnosisRegistryStatusPatch(
    DiagnosisRegistryStatus.ACTIVE,
  );
  const selectRegistryRecord = {
    id: true,
    legacyDiagnosisId: true,
    status: true,
  } as const;

  let registry = (await prisma.diagnosisRegistry.findUnique({
    where: {
      legacyDiagnosisId: diagnosis.id,
    },
    select: selectRegistryRecord,
  })) as DiagnosisRegistryRecord | null;

  if (registry) {
    const existingByCanonical = (await prisma.diagnosisRegistry.findUnique({
      where: {
        canonicalNormalized,
      },
      select: selectRegistryRecord,
    })) as DiagnosisRegistryRecord | null;

    if (existingByCanonical && existingByCanonical.id !== registry.id) {
      throw new BadRequestException(
        `Diagnosis registry canonical collision for "${diagnosis.name}"`,
      );
    }

    registry = (await prisma.diagnosisRegistry.update({
      where: {
        id: registry.id,
      },
      data: {
        canonicalName: diagnosis.name,
        canonicalNormalized,
        displayLabel: diagnosis.name,
        ...activeStatusPatch,
      },
      select: selectRegistryRecord,
    })) as DiagnosisRegistryRecord;
  } else {
    const existingByCanonical = (await prisma.diagnosisRegistry.findUnique({
      where: {
        canonicalNormalized,
      },
      select: selectRegistryRecord,
    })) as DiagnosisRegistryRecord | null;

    if (existingByCanonical) {
      if (
        existingByCanonical.legacyDiagnosisId &&
        existingByCanonical.legacyDiagnosisId !== diagnosis.id
      ) {
        throw new BadRequestException(
          `Diagnosis registry canonical collision for "${diagnosis.name}"`,
        );
      }

      registry = (await prisma.diagnosisRegistry.update({
        where: {
          id: existingByCanonical.id,
        },
        data: {
          legacyDiagnosisId: diagnosis.id,
          canonicalName: diagnosis.name,
          canonicalNormalized,
          displayLabel: diagnosis.name,
          ...activeStatusPatch,
        },
        select: selectRegistryRecord,
      })) as DiagnosisRegistryRecord;
    } else {
      registry = (await createDiagnosisRegistryRecord({
        prisma,
        diagnosis,
        canonicalNormalized,
        statusPatch: activeStatusPatch,
        selectRegistryRecord,
      })) as DiagnosisRegistryRecord;
    }
  }

  await prisma.diagnosisAlias.upsert({
    where: {
      diagnosisRegistryId_normalizedTerm: {
        diagnosisRegistryId: registry.id,
        normalizedTerm: canonicalNormalized,
      },
    },
    update: {
      term: diagnosis.name,
      kind: 'CANONICAL',
      acceptedForMatch: true,
      rank: 0,
      active: true,
    },
    create: {
      diagnosisRegistryId: registry.id,
      term: diagnosis.name,
      normalizedTerm: canonicalNormalized,
      kind: 'CANONICAL',
      acceptedForMatch: true,
      rank: 0,
      source: 'write_through_canonical',
      active: true,
    },
  });

  return registry;
}

async function createDiagnosisRegistryRecord(input: {
  prisma: any;
  diagnosis: DiagnosisRecord;
  canonicalNormalized: string;
  statusPatch: {
    status: DiagnosisRegistryStatus;
    active: boolean;
  };
  selectRegistryRecord: {
    id: true;
    legacyDiagnosisId: true;
    status: true;
  };
}): Promise<DiagnosisRegistryRecord> {
  try {
    return (await input.prisma.diagnosisRegistry.create({
      data: {
        legacyDiagnosisId: input.diagnosis.id,
        canonicalName: input.diagnosis.name,
        canonicalNormalized: input.canonicalNormalized,
        displayLabel: input.diagnosis.name,
        ...input.statusPatch,
      },
      select: input.selectRegistryRecord,
    })) as DiagnosisRegistryRecord;
  } catch (error) {
    const maybePrismaError = error as { code?: string };
    if (maybePrismaError.code !== 'P2002') {
      throw error;
    }

    const recovered = (await input.prisma.diagnosisRegistry.findUnique({
      where: {
        canonicalNormalized: input.canonicalNormalized,
      },
      select: input.selectRegistryRecord,
    })) as DiagnosisRegistryRecord | null;

    if (!recovered) {
      throw error;
    }

    if (
      recovered.legacyDiagnosisId &&
      recovered.legacyDiagnosisId !== input.diagnosis.id
    ) {
      throw new BadRequestException(
        `Diagnosis registry canonical collision for "${input.diagnosis.name}"`,
      );
    }

    return (await input.prisma.diagnosisRegistry.update({
      where: {
        id: recovered.id,
      },
      data: {
        legacyDiagnosisId: input.diagnosis.id,
        canonicalName: input.diagnosis.name,
        canonicalNormalized: input.canonicalNormalized,
        displayLabel: input.diagnosis.name,
        ...input.statusPatch,
      },
      select: input.selectRegistryRecord,
    })) as DiagnosisRegistryRecord;
  }
}

function toNumber(value: bigint | number | null | undefined): number {
  if (typeof value === 'bigint') {
    return Number(value);
  }

  return value ?? 0;
}
