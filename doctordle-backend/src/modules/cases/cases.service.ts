import {
  BadRequestException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Case as CaseModel, PublishTrack } from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { EditorialMetricsService } from '../editorial/editorial-metrics.service.js';
import {
  formatDailyCaseDisplayLabel,
  formatDailyCaseTrackDisplayLabel,
} from '../gameplay/daily-case-labels.js';
import { AIContentService } from '../ai/ai-content.service';
import { DiagnosisRegistryLinkService } from '../diagnosis-registry/diagnosis-registry-link.service.js';
import {
  buildMatchedDiagnosisMappingFields,
  determineDiagnosisWriteMappingMethod,
} from '../diagnosis-registry/diagnosis-mapping-fields.js';
import { CreateCaseDto } from './dto/create-case.dto';

export type DiagnosisCatalogItem = {
  id: string;
  name: string;
  system: string;
  synonyms: string[];
};

export type CaseRecord = {
  id: string;
  title: string;
  date: string;
  difficulty: 'easy' | 'medium' | 'hard';
  history: string;
  symptoms: string[];
  diagnosis: string;
};

export type CreatedCaseRecord = CaseRecord;

export type DailyCaseAssignmentRecord = {
  dailyCaseId: string;
  casePublicNumber: number | null;
  displayLabel: string;
  trackDisplayLabel: string;
  date: string;
  track: PublishTrack;
  sequenceIndex: number;
  case: CaseRecord;
};

export type TodayCaseContext = {
  dailyCaseId: string;
  casePublicNumber: number | null;
  displayLabel: string;
  trackDisplayLabel: string;
  caseId: string;
  date: Date;
  case: CaseModel;
};

export type ResetTodayCaseResult = {
  date: string;
  dailyCaseId: string | null;
  caseId: string | null;
  dailyCaseDeleted: boolean;
  caseDeleted: boolean;
};

@Injectable()
export class CasesService {
  private readonly logger = new Logger(CasesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiContentService: AIContentService,
    private readonly editorialMetrics: EditorialMetricsService,
    private readonly diagnosisRegistryLinkService: DiagnosisRegistryLinkService,
  ) {}

  async createCase(dto: CreateCaseDto): Promise<CreatedCaseRecord> {
    const now = new Date();
    const date = dto.date ? this.parseDailyDate(dto.date) : now;

    const resolvedDiagnosisLink =
      await this.diagnosisRegistryLinkService.resolveForWrite({
        diagnosisId: dto.diagnosisId,
        diagnosisRegistryId: dto.diagnosisRegistryId,
      });
    const diagnosisMappingFields = buildMatchedDiagnosisMappingFields({
      diagnosisName: resolvedDiagnosisLink.diagnosisName,
      proposedDiagnosisText: dto.proposedDiagnosisText,
      method: determineDiagnosisWriteMappingMethod({
        diagnosisRegistryId: dto.diagnosisRegistryId,
      }),
    });

    const created = await this.withPublicNumberRetry(async () => {
      const publicNumber = await this.getNextCasePublicNumber(this.prisma);

      return dto.date
        ? this.prisma.case.upsert({
            where: { date },
            update: {
              title: dto.title,
              history: dto.history,
              symptoms: dto.symptoms,
              diagnosisId: resolvedDiagnosisLink.diagnosisId,
              diagnosisRegistryId: resolvedDiagnosisLink.diagnosisRegistryId,
              ...diagnosisMappingFields,
            },
            create: {
              publicNumber,
              title: dto.title,
              date,
              difficulty: 'medium',
              history: dto.history,
              symptoms: dto.symptoms,
              diagnosisId: resolvedDiagnosisLink.diagnosisId,
              diagnosisRegistryId: resolvedDiagnosisLink.diagnosisRegistryId,
              ...diagnosisMappingFields,
            },
            include: {
              diagnosis: true,
            },
          })
        : this.prisma.case.create({
            data: {
              publicNumber,
              title: dto.title,
              date,
              difficulty: 'medium',
              history: dto.history,
              symptoms: dto.symptoms,
              diagnosisId: resolvedDiagnosisLink.diagnosisId,
              diagnosisRegistryId: resolvedDiagnosisLink.diagnosisRegistryId,
              ...diagnosisMappingFields,
            },
            include: {
              diagnosis: true,
            },
          });
    });

    this.logger.log(
      JSON.stringify({
        event: 'cases.case.created',
        caseId: created.id,
        title: created.title,
        date: created.date.toISOString(),
        diagnosisId: created.diagnosisId,
        diagnosisRegistryId: resolvedDiagnosisLink.diagnosisRegistryId,
      }),
    );

    void this.aiContentService.scheduleCaseContent(created.id, {
      source: 'case_created',
    });

    return this.mapCaseRecord(created);
  }

  async assignDailyCase(
    _date: string,
    _caseId: string,
  ): Promise<DailyCaseAssignmentRecord> {
    throw new GoneException(
      'Legacy daily case assignment has been retired; use DailyCasesService.publishDailyCasesForDate',
    );
  }

  async getTodayCase(): Promise<TodayCaseContext> {
    const today = this.getUtcDateOnly(new Date());
    const track = PublishTrack.DAILY;
    const sequenceIndex = 1;

    const existing = await this.prisma.dailyCase.findUnique({
      where: {
        date_track_sequenceIndex: {
          date: today,
          track,
          sequenceIndex,
        },
      },
      include: {
        case: {
          include: {
            diagnosis: true,
            currentRevision: {
              select: {
                id: true,
                date: true,
                publishTrack: true,
              },
            },
          },
        },
      },
    });

    if (!existing) {
      this.logger.warn(
        JSON.stringify({
          event: 'cases.today.missing',
          normalizedDate: today.toISOString(),
          track,
          sequenceIndex,
        }),
      );

      throw new NotFoundException('No daily case has been published for today');
    }

    if (!this.hasPlayableClueArray(existing.case.clues)) {
      this.logger.warn(
        JSON.stringify({
          event: 'cases.today.invalid_daily_case',
          dailyCaseId: existing.id,
          caseId: existing.caseId,
          normalizedDate: today.toISOString(),
          track,
          sequenceIndex,
        }),
      );

      throw new BadRequestException(
        'Published daily case is not playable and was not modified',
      );
    }

    this.logger.log(
      JSON.stringify({
        event: 'cases.today.existing',
        dailyCaseId: existing.id,
        caseId: existing.caseId,
        normalizedDate: today.toISOString(),
        track,
        sequenceIndex,
      }),
    );

    return this.mapTodayCaseContext(existing);
  }

  private hasPlayableClueArray(value: unknown): boolean {
    return Array.isArray(value) && value.length > 0;
  }

  async resetTodayCase(): Promise<ResetTodayCaseResult> {
    throw new GoneException(
      'Legacy daily case reset has been retired; publish or manage daily cases through DailyCasesService',
    );
  }

  async rebuildTodayCase(): Promise<TodayCaseContext> {
    throw new GoneException(
      'Legacy daily case rebuild has been retired; use DailyCasesService.publishDailyCasesForDate',
    );
  }

  async getCaseByDate(date: string): Promise<CaseRecord> {
    const dailyCase = await this.prisma.dailyCase.findUnique({
      where: {
        date_track_sequenceIndex: {
          date: this.parseDailyDate(date),
          track: PublishTrack.DAILY,
          sequenceIndex: 1,
        },
      },
      include: {
        case: {
          include: {
            diagnosis: true,
          },
        },
      },
    });

    if (!dailyCase) {
      throw new NotFoundException(`No daily case found for date ${date}`);
    }

    return this.mapCaseRecord(dailyCase.case);
  }

  async getCaseById(id: string): Promise<CaseRecord> {
    const found = await this.prisma.case.findUnique({
      where: { id },
      include: {
        diagnosis: true,
      },
    });

    if (!found) {
      throw new NotFoundException(`No case found for id ${id}`);
    }

    return this.mapCaseRecord(found);
  }

  async getRandomCase(): Promise<CaseRecord> {
    const cases = await this.prisma.case.findMany({
      include: {
        diagnosis: true,
      },
      orderBy: {
        id: 'asc',
      },
    });

    if (!cases.length) {
      throw new NotFoundException('No cases available');
    }

    const selected = cases[Math.floor(Math.random() * cases.length)];
    return this.mapCaseRecord(selected);
  }

  async listDiagnoses(): Promise<DiagnosisCatalogItem[]> {
    const diagnoses = await this.prisma.diagnosis.findMany({
      include: {
        synonyms: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return diagnoses.map((item) => ({
      id: item.id,
      name: item.name,
      system: item.system ?? 'unknown',
      synonyms: item.synonyms.map((synonym) => synonym.term),
    }));
  }

  async getDiagnosisByName(
    name: string,
  ): Promise<DiagnosisCatalogItem | undefined> {
    const diagnosis = await this.prisma.diagnosis.findUnique({
      where: { name },
      include: {
        synonyms: true,
      },
    });

    if (!diagnosis) {
      return undefined;
    }

    return {
      id: diagnosis.id,
      name: diagnosis.name,
      system: diagnosis.system ?? 'unknown',
      synonyms: diagnosis.synonyms.map((synonym) => synonym.term),
    };
  }

  private mapCaseRecord(found: {
    id: string;
    title: string;
    date: Date;
    difficulty: string;
    history: string;
    symptoms: string[];
    diagnosis: { name: string };
  }): CaseRecord {
    return {
      id: found.id,
      title: found.title,
      date: found.date.toISOString().slice(0, 10),
      difficulty: found.difficulty as 'easy' | 'medium' | 'hard',
      history: found.history,
      symptoms: found.symptoms,
      diagnosis: found.diagnosis.name,
    };
  }

  private async getNextCasePublicNumber(
    client: Pick<PrismaService, 'case'>,
  ): Promise<number> {
    const latest = await client.case.findFirst({
      where: {
        publicNumber: {
          not: null,
        },
      },
      orderBy: {
        publicNumber: 'desc',
      },
      select: {
        publicNumber: true,
      },
    });

    return (latest?.publicNumber ?? 0) + 1;
  }

  private async withPublicNumberRetry<T>(operation: () => Promise<T>) {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (
          attempt >= maxAttempts ||
          !this.isPublicNumberUniqueViolation(error)
        ) {
          throw error;
        }
      }
    }

    throw new Error('Unable to allocate case public number');
  }

  private isPublicNumberUniqueViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = (error as { meta?: { target?: unknown } }).meta?.target;
    return Array.isArray(target) && target.includes('publicNumber');
  }

  private mapTodayCaseContext(found: {
    id: string;
    caseId: string;
    date: Date;
    track: PublishTrack;
    sequenceIndex: number;
    case: CaseModel;
  }): TodayCaseContext {
    return {
      dailyCaseId: found.id,
      casePublicNumber: found.case.publicNumber,
      displayLabel: formatDailyCaseDisplayLabel(found),
      trackDisplayLabel: formatDailyCaseTrackDisplayLabel(found),
      caseId: found.caseId,
      date: found.date,
      case: found.case,
    };
  }

  private parseDailyDate(value: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new NotFoundException(`Invalid daily case date: ${value}`);
    }

    return this.getUtcDateOnly(parsed);
  }

  private getUtcDateOnly(value: Date): Date {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }
}
