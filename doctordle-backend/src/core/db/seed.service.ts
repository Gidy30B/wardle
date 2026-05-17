import { Injectable, Logger } from '@nestjs/common';
import { DiagnosisRegistryStatus } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { CasesService } from '../../modules/cases/cases.service';
import { normalizeDiagnosisTerm } from '../../modules/diagnosis-registry/diagnosis-term-normalizer';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async seedCases(casesService: CasesService): Promise<void> {
    this.logger.log('Starting database seeding...');
    const today = new Date().toISOString().slice(0, 10);

    // First, seed diagnoses
    const diagnoses = [
      {
        name: 'myocardial infarction',
        system: 'cardiovascular',
      },
      {
        name: 'pneumonia',
        system: 'respiratory',
      },
      {
        name: 'tuberculosis',
        system: 'respiratory',
      },
    ];

    const diagnosisRegistryMap: { [key: string]: string } = {};
    for (const diagnosisData of diagnoses) {
      let diagnosis = await this.prisma.diagnosis.findUnique({
        where: { name: diagnosisData.name },
      });

      if (!diagnosis) {
        diagnosis = await this.prisma.diagnosis.create({
          data: diagnosisData,
        });
        this.logger.log(`Created diagnosis: ${diagnosis.name}`);
      } else {
        this.logger.debug(`Diagnosis already exists: ${diagnosis.name}`);
      }

      const canonicalNormalized = normalizeDiagnosisTerm(diagnosis.name);
      const registry = await this.prisma.diagnosisRegistry.upsert({
        where: {
          canonicalNormalized,
        },
        update: {
          legacyDiagnosisId: diagnosis.id,
          canonicalName: diagnosis.name,
          displayLabel: diagnosis.name,
          status: DiagnosisRegistryStatus.ACTIVE,
          active: true,
          isPlayable: true,
        },
        create: {
          legacyDiagnosisId: diagnosis.id,
          canonicalName: diagnosis.name,
          canonicalNormalized,
          displayLabel: diagnosis.name,
          status: DiagnosisRegistryStatus.ACTIVE,
          active: true,
          isPlayable: true,
        },
        select: {
          id: true,
        },
      });

      diagnosisRegistryMap[diagnosisData.name] = registry.id;
    }

    // Then seed cases against registry diagnoses
    const cases = [
      {
        title: 'Myocardial infarction case',
        id: 'c-2026-04-01',
        date: new Date('2026-04-01'),
        difficulty: 'medium',
        history:
          'A 59-year-old with crushing substernal chest pain radiating to the left arm.',
        symptoms: ['chest pain', 'diaphoresis', 'nausea'],
        diagnosis: 'myocardial infarction',
      },
      {
        title: 'Myocardial infarction case',
        id: `c-${today}`,
        date: new Date(`${today}T00:00:00.000Z`),
        difficulty: 'medium',
        history:
          'A 59-year-old with crushing substernal chest pain radiating to the left arm.',
        symptoms: ['chest pain', 'diaphoresis', 'nausea'],
        diagnosis: 'myocardial infarction',
      },
    ];

    for (const caseData of cases) {
      const createdCase = await casesService.createCase({
        title: caseData.title,
        history: caseData.history,
        symptoms: caseData.symptoms,
        diagnosisRegistryId: diagnosisRegistryMap[caseData.diagnosis],
        date: caseData.date.toISOString().slice(0, 10),
      });

      this.logger.log(`Seeded case lifecycle: ${createdCase.id}`);
    }

    this.logger.log('Database seeding completed');
  }
}
