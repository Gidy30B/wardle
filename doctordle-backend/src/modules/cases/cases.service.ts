import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Case as CaseModel, CaseEditorialStatus } from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { EditorialMetricsService } from '../editorial/editorial-metrics.service.js';
import {
  ASSIGNABLE_EDITORIAL_STATUSES,
  isPublishEligibleEditorialStatus,
} from '../editorial/policies/publish-policy.js';
import { AIContentService } from '../ai/ai-content.service';
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
  date: string;
  case: CaseRecord;
};

export type TodayCaseContext = {
  dailyCaseId: string;
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
  ) {}

  async createCase(dto: CreateCaseDto): Promise<CreatedCaseRecord> {
    const now = new Date();
    const date = dto.date ? this.parseDailyDate(dto.date) : now;

    const diagnosis = await this.prisma.diagnosis.findUnique({
      where: { id: dto.diagnosisId },
    });

    if (!diagnosis) {
      throw new NotFoundException(`Diagnosis not found: ${dto.diagnosisId}`);
    }

    const created = dto.date
      ? await this.prisma.case.upsert({
          where: { date },
          update: {
            title: dto.title,
            history: dto.history,
            symptoms: dto.symptoms,
            diagnosisId: dto.diagnosisId,
          },
          create: {
            title: dto.title,
            date,
            difficulty: 'medium',
            history: dto.history,
            symptoms: dto.symptoms,
            diagnosisId: dto.diagnosisId,
          },
          include: {
            diagnosis: true,
          },
        })
      : await this.prisma.case.create({
          data: {
            title: dto.title,
            date,
            difficulty: 'medium',
            history: dto.history,
            symptoms: dto.symptoms,
            diagnosisId: dto.diagnosisId,
          },
          include: {
            diagnosis: true,
          },
        });

    this.logger.log(
      JSON.stringify({
        event: 'cases.case.created',
        caseId: created.id,
        title: created.title,
        date: created.date.toISOString(),
        diagnosisId: created.diagnosisId,
      }),
    );

    if (dto.date) {
      await this.assignDailyCase(dto.date, created.id);
    }

    void this.aiContentService.scheduleCaseContent(created.id, {
      source: 'case_created',
    });

    return this.mapCaseRecord(created);
  }

  async assignDailyCase(date: string, caseId: string): Promise<DailyCaseAssignmentRecord> {
    const normalizedDate = this.parseDailyDate(date);

    const foundCase = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: { diagnosis: true },
    });

    if (!foundCase) {
      throw new NotFoundException(`Case not found: ${caseId}`);
    }

    this.assertCaseEligibleForAssignment(foundCase, 'explicit');

    const dailyCase = await this.prisma.dailyCase.upsert({
      where: { date: normalizedDate },
      update: {
        caseId,
      },
      create: {
        date: normalizedDate,
        caseId,
      },
      include: {
        case: {
          include: {
            diagnosis: true,
          },
        },
      },
    });

    this.logger.log(
      JSON.stringify({
        event: 'cases.daily_case.assigned',
        assignmentMode: 'explicit',
        date: normalizedDate.toISOString(),
        caseId,
        editorialStatus: foundCase.editorialStatus,
      }),
    );

    this.editorialMetrics.recordAssignmentAccepted('explicit');

    return {
      dailyCaseId: dailyCase.id,
      date: dailyCase.date.toISOString().slice(0, 10),
      case: this.mapCaseRecord(dailyCase.case),
    };
  }

  async getTodayCase(): Promise<TodayCaseContext> {
    const today = this.getUtcDateOnly(new Date());

    const existing = await this.prisma.dailyCase.findUnique({
      where: { date: today },
      include: {
        case: true,
      },
    });

    if (existing) {
      if (!this.hasPlayableClueArray(existing.case.clues)) {
        this.logger.warn(
          JSON.stringify({
            event: 'cases.today.invalid_daily_case_removed',
            dailyCaseId: existing.id,
            caseId: existing.caseId,
            date: existing.date.toISOString(),
          }),
        );

        await this.prisma.dailyCase
          .delete({
            where: { id: existing.id },
          })
          .catch((error) => {
            const maybePrismaError = error as { code?: string };
            if (maybePrismaError.code !== 'P2025') {
              throw error;
            }
          });
      } else {
        this.logger.log(
          JSON.stringify({
            event: 'cases.today.existing',
            dailyCaseId: existing.id,
            caseId: existing.caseId,
            date: existing.date.toISOString(),
          }),
        );

        return this.mapTodayCaseContext(existing);
      }
    }

    const selectedCaseId = await this.findLatestPlayableCaseId();

    if (!selectedCaseId) {
      this.logger.warn(
        JSON.stringify({
          event: 'cases.today.no_eligible_case',
          assignmentMode: 'lazy',
          date: today.toISOString(),
          eligibleEditorialStatuses: ASSIGNABLE_EDITORIAL_STATUSES,
        }),
      );
      this.editorialMetrics.recordAssignmentRejected('lazy', null);
      this.editorialMetrics.recordLazyNoEligibleCaseMiss();

      throw new NotFoundException(
        'No playable clue-based cases available to assign for today',
      );
    }

    const selectedCase = await this.prisma.case.findUnique({
      where: { id: selectedCaseId },
    });

    if (!selectedCase) {
      throw new NotFoundException(
        `Playable case disappeared before daily assignment: ${selectedCaseId}`,
      );
    }

    try {
      const created = await this.prisma.dailyCase.create({
        data: {
          date: today,
          caseId: selectedCase.id,
        },
        include: {
          case: true,
        },
      });

      this.logger.log(
        JSON.stringify({
          event: 'cases.today.created',
          assignmentMode: 'lazy',
          dailyCaseId: created.id,
          caseId: created.caseId,
          date: created.date.toISOString(),
          editorialStatus: selectedCase.editorialStatus,
        }),
      );

      this.editorialMetrics.recordAssignmentAccepted('lazy');

      return this.mapTodayCaseContext(created);
    } catch (error) {
      const maybePrismaError = error as { code?: string };
      if (maybePrismaError.code !== 'P2002') {
        throw error;
      }

      const recovered = await this.prisma.dailyCase.findUnique({
        where: { date: today },
        include: {
          case: true,
        },
      });

      if (!recovered) {
        throw error;
      }

      this.logger.warn(
        JSON.stringify({
          event: 'cases.today.race_recovered',
          assignmentMode: 'lazy',
          dailyCaseId: recovered.id,
          caseId: recovered.caseId,
          date: recovered.date.toISOString(),
        }),
      );

      return this.mapTodayCaseContext(recovered);
    }
  }

  private hasPlayableClueArray(value: unknown): boolean {
    return Array.isArray(value) && value.length > 0;
  }

  private async findLatestPlayableCaseId(): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "Case"
      WHERE "editorialStatus" IN (${CaseEditorialStatus.APPROVED}, ${CaseEditorialStatus.READY_TO_PUBLISH})
        AND "clues" IS NOT NULL
        AND jsonb_typeof("clues") = 'array'
        AND jsonb_array_length("clues") > 0
      ORDER BY "date" DESC
      LIMIT 1
    `;

    return rows[0]?.id ?? null;
  }

  async resetTodayCase(): Promise<ResetTodayCaseResult> {
    const today = this.getUtcDateOnly(new Date());
    const date = today.toISOString().slice(0, 10);

    this.logger.log(
      JSON.stringify({
        event: 'cases.daily_case.reset.started',
        date,
        caseId: null,
      }),
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const dailyCase = await tx.dailyCase.findUnique({
        where: { date: today },
        select: {
          id: true,
          caseId: true,
        },
      });

      if (!dailyCase) {
        return {
          date,
          dailyCaseId: null,
          caseId: null,
          dailyCaseDeleted: false,
          caseDeleted: false,
        } satisfies ResetTodayCaseResult;
      }

      await tx.dailyCase.delete({
        where: {
          id: dailyCase.id,
        },
      });

      const caseDeleteResult = await tx.case.deleteMany({
        where: {
          id: dailyCase.caseId,
        },
      });

      return {
        date,
        dailyCaseId: dailyCase.id,
        caseId: dailyCase.caseId,
        dailyCaseDeleted: true,
        caseDeleted: caseDeleteResult.count > 0,
      } satisfies ResetTodayCaseResult;
    });

    this.logger.log(
      JSON.stringify({
        event: 'cases.daily_case.reset.completed',
        date: result.date,
        caseId: result.caseId,
        dailyCaseId: result.dailyCaseId,
        dailyCaseDeleted: result.dailyCaseDeleted,
        caseDeleted: result.caseDeleted,
      }),
    );

    return result;
  }

  async rebuildTodayCase(): Promise<TodayCaseContext> {
    const today = this.getUtcDateOnly(new Date());
    const date = today.toISOString().slice(0, 10);

    this.logger.log(
      JSON.stringify({
        event: 'cases.daily_case.rebuild.started',
        date,
        caseId: null,
      }),
    );

    await this.resetTodayCase();
    const context = await this.getTodayCase();

    this.logger.log(
      JSON.stringify({
        event: 'cases.daily_case.rebuild.completed',
        date: context.date.toISOString().slice(0, 10),
        caseId: context.caseId,
      }),
    );

    return context;
  }

  async getCaseByDate(date: string): Promise<CaseRecord> {
    const dailyCase = await this.prisma.dailyCase.findUnique({
      where: { date: this.parseDailyDate(date) },
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

  async getDiagnosisByName(name: string): Promise<DiagnosisCatalogItem | undefined> {
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

  private mapTodayCaseContext(found: {
    id: string;
    caseId: string;
    date: Date;
    case: CaseModel;
  }): TodayCaseContext {
    return {
      dailyCaseId: found.id,
      caseId: found.caseId,
      date: found.date,
      case: found.case,
    };
  }

  private assertCaseEligibleForAssignment(foundCase: {
    id: string;
    editorialStatus: CaseEditorialStatus | null;
  }, mode: 'explicit' | 'lazy'): void {
    if (isPublishEligibleEditorialStatus(foundCase.editorialStatus)) {
      return;
    }

    this.logger.warn(
      JSON.stringify({
        event: 'cases.daily_case.assignment_ineligible',
        assignmentMode: mode,
        caseId: foundCase.id,
        editorialStatus: foundCase.editorialStatus,
        allowedEditorialStatuses: ASSIGNABLE_EDITORIAL_STATUSES,
      }),
    );

    this.editorialMetrics.recordAssignmentRejected(
      mode,
      foundCase.editorialStatus,
    );

    throw new BadRequestException(
      'Case is not eligible for new assignment until it is APPROVED or READY_TO_PUBLISH',
    );
  }

  private parseDailyDate(value: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new NotFoundException(`Invalid daily case date: ${value}`);
    }

    return this.getUtcDateOnly(parsed);
  }

  private getUtcDateOnly(value: Date): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
}
