import { Controller, ForbiddenException, Get } from '@nestjs/common';
import { PrismaService } from '../core/db/prisma.service';
import { getEnv } from '../core/config/env.validation';

const QA_DIAGNOSES = [
  'appendicitis',
  'acute pancreatitis',
  'diabetic ketoacidosis',
  'ruptured ectopic pregnancy',
  'peptic ulcer disease',
  'nutritional vitamin d deficiency rickets',
  'siadh',
];

@Controller('auth/local-qa')
export class LocalQaController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('diagnoses')
  async listSeededDiagnoses() {
    const env = getEnv();
    if (env.NODE_ENV === 'production' || !env.LOCAL_QA_AUTH_ENABLED) {
      throw new ForbiddenException('Local QA helpers are disabled.');
    }

    const rows = await this.prisma.diagnosisRegistry.findMany({
      where: {
        canonicalNormalized: { in: QA_DIAGNOSES },
      },
      orderBy: { displayLabel: 'asc' },
      select: {
        id: true,
        canonicalNormalized: true,
        displayLabel: true,
        status: true,
      },
    });

    return {
      diagnoses: rows,
      expectedDiagnoses: QA_DIAGNOSES,
    };
  }
}
