import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CaseGeneratorService } from '../case-generator/case-generator.service';
import { AdminGuard } from './admin.guard';

type GenerateCasesBody = {
  count?: number;
  track?: string;
  difficulty?: string;
};

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly caseGenerator: CaseGeneratorService) {}

  @Post('generate-cases')
  async generateCases(@Body() body: GenerateCasesBody = {}) {
    const count = body.count ?? 10;
    if (count > 50) {
      throw new BadRequestException('Max 50 per request');
    }

    return this.caseGenerator.generateBatch({
      count,
      track: body.track,
      difficulty: body.difficulty,
    });
  }
}
