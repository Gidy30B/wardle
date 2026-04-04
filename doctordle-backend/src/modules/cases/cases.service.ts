import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/db/prisma.service';

export type DiagnosisCatalogItem = {
  id: string;
  name: string;
  system: string;
  synonyms: string[];
};

export type CaseRecord = {
  id: string;
  date: string;
  difficulty: 'easy' | 'medium' | 'hard';
  history: string;
  symptoms: string[];
  diagnosis: string;
};

@Injectable()
export class CasesService {
  constructor(private readonly prisma: PrismaService) {}

  async getTodayCase(): Promise<CaseRecord> {
    const today = new Date().toISOString().slice(0, 10);
    return this.getCaseByDate(today);
  }

  async getCaseByDate(date: string): Promise<CaseRecord> {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);

    const found = await this.prisma.case.findFirst({
      where: {
        date: {
          gte: start,
          lte: end,
        },
      },
      include: {
        diagnosis: true,
      },
    });

    if (!found) {
      throw new NotFoundException(`No case found for date ${date}`);
    }

    return {
      id: found.id,
      date: found.date.toISOString().slice(0, 10),
      difficulty: found.difficulty as 'easy' | 'medium' | 'hard',
      history: found.history,
      symptoms: found.symptoms,
      diagnosis: found.diagnosis.name,
    };
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

    return {
      id: found.id,
      date: found.date.toISOString().slice(0, 10),
      difficulty: found.difficulty as 'easy' | 'medium' | 'hard',
      history: found.history,
      symptoms: found.symptoms,
      diagnosis: found.diagnosis.name,
    };
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
    return {
      id: selected.id,
      date: selected.date.toISOString().slice(0, 10),
      difficulty: selected.difficulty as 'easy' | 'medium' | 'hard',
      history: selected.history,
      symptoms: selected.symptoms,
      diagnosis: selected.diagnosis.name,
    };
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
}
