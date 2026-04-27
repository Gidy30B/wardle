import '../src/core/config/load-env.js';
import { PrismaClient } from '@prisma/client';
import { inferLegacyAliasDecision } from '../src/modules/diagnosis-registry/diagnosis-registry-backfill.js';
import { collectDiagnosisRegistryIntegrityReport } from '../src/modules/diagnosis-registry/diagnosis-registry-link.service.js';
import { normalizeDiagnosisTerm } from '../src/modules/diagnosis-registry/diagnosis-term-normalizer.js';

const prisma = new PrismaClient();

async function main() {
  const reportOnly = process.argv.includes('--report-only');
  const prismaAny = prisma as any;
  const before = await collectDiagnosisRegistryIntegrityReport(prisma);

  if (reportOnly) {
    console.log(
      JSON.stringify(
        {
          reportOnly: true,
          before,
        },
        null,
        2,
      ),
    );
    return;
  }

  const diagnoses = await prisma.diagnosis.findMany({
    include: {
      synonyms: {
        orderBy: {
          term: 'asc',
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  let registryCount = 0;
  let canonicalAliasCount = 0;
  let synonymAliasCount = 0;
  let caseLinkCount = 0;
  let caseRevisionLinkCount = 0;
  const canonicalOwnerByTerm = new Map<string, string>();
  const synonymOwnersByTerm = new Map<string, Set<string>>();

  for (const diagnosis of diagnoses) {
    canonicalOwnerByTerm.set(
      normalizeDiagnosisTerm(diagnosis.name),
      diagnosis.id,
    );
  }

  for (const diagnosis of diagnoses) {
    const canonicalNormalized = normalizeDiagnosisTerm(diagnosis.name);

    for (const synonym of diagnosis.synonyms) {
      const normalizedTerm = normalizeDiagnosisTerm(synonym.term);
      if (!normalizedTerm || normalizedTerm === canonicalNormalized) {
        continue;
      }

      const owners = synonymOwnersByTerm.get(normalizedTerm) ?? new Set<string>();
      owners.add(diagnosis.id);
      synonymOwnersByTerm.set(normalizedTerm, owners);
    }
  }

  const ambiguousAliasTerms = new Map<string, Set<string>>();

  for (const diagnosis of diagnoses) {
    const canonicalNormalized = normalizeDiagnosisTerm(diagnosis.name);

    const registry = await prismaAny.diagnosisRegistry.upsert({
      where: {
        legacyDiagnosisId: diagnosis.id,
      },
      update: {
        canonicalName: diagnosis.name,
        canonicalNormalized,
        displayLabel: diagnosis.name,
        active: true,
      },
      create: {
        legacyDiagnosisId: diagnosis.id,
        canonicalName: diagnosis.name,
        canonicalNormalized,
        displayLabel: diagnosis.name,
        active: true,
      },
      select: {
        id: true,
      },
    });
    registryCount += 1;

    await prismaAny.diagnosisAlias.upsert({
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
        source: 'legacy_canonical',
        active: true,
      },
      create: {
        diagnosisRegistryId: registry.id,
        term: diagnosis.name,
        normalizedTerm: canonicalNormalized,
        kind: 'CANONICAL',
        acceptedForMatch: true,
        rank: 0,
        source: 'legacy_canonical',
        active: true,
      },
    });
    canonicalAliasCount += 1;

    for (const synonym of diagnosis.synonyms) {
      const normalizedTerm = normalizeDiagnosisTerm(synonym.term);
      if (!normalizedTerm || normalizedTerm === canonicalNormalized) {
        continue;
      }

      const owners = new Set<string>(
        synonymOwnersByTerm.get(normalizedTerm) ?? [],
      );
      const canonicalOwnerId = canonicalOwnerByTerm.get(normalizedTerm);
      if (canonicalOwnerId && canonicalOwnerId !== diagnosis.id) {
        owners.add(canonicalOwnerId);
      }

      const ambiguous = owners.size > 1;
      if (ambiguous) {
        ambiguousAliasTerms.set(normalizedTerm, owners);
      }

      const aliasDecision = inferLegacyAliasDecision(synonym.term, ambiguous);

      await prismaAny.diagnosisAlias.upsert({
        where: {
          diagnosisRegistryId_normalizedTerm: {
            diagnosisRegistryId: registry.id,
            normalizedTerm,
          },
        },
        update: {
          term: synonym.term,
          kind: aliasDecision.kind,
          acceptedForMatch: aliasDecision.acceptedForMatch,
          rank: 10,
          source: aliasDecision.source,
          active: true,
        },
        create: {
          diagnosisRegistryId: registry.id,
          term: synonym.term,
          normalizedTerm,
          kind: aliasDecision.kind,
          acceptedForMatch: aliasDecision.acceptedForMatch,
          rank: 10,
          source: aliasDecision.source,
          active: true,
        },
      });
      synonymAliasCount += 1;
    }

    const caseUpdate = await prismaAny.case.updateMany({
      where: {
        diagnosisId: diagnosis.id,
        OR: [
          { diagnosisRegistryId: null },
          { diagnosisRegistryId: { not: registry.id } },
        ],
      },
      data: {
        diagnosisRegistryId: registry.id,
      },
    });
    caseLinkCount += caseUpdate.count;

    const caseRevisionUpdate = await prismaAny.caseRevision.updateMany({
      where: {
        diagnosisId: diagnosis.id,
        OR: [
          { diagnosisRegistryId: null },
          { diagnosisRegistryId: { not: registry.id } },
        ],
      },
      data: {
        diagnosisRegistryId: registry.id,
      },
    });
    caseRevisionLinkCount += caseRevisionUpdate.count;
  }

  const duplicateTerms = [...ambiguousAliasTerms.entries()]
    .map(([normalizedTerm, diagnosisIds]) => ({
      normalizedTerm,
      diagnosisCount: diagnosisIds.size,
    }))
    .sort((left, right) =>
      left.normalizedTerm.localeCompare(right.normalizedTerm),
    );

  const after = await collectDiagnosisRegistryIntegrityReport(prisma);

  console.log(
    JSON.stringify(
      {
        before,
        registryCount,
        canonicalAliasCount,
        synonymAliasCount,
        caseLinkCount,
        caseRevisionLinkCount,
        duplicateNormalizedAliasTerms: duplicateTerms,
        after,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
