import { Injectable } from '@nestjs/common';
import { Prisma, ValidationOutcome } from '@prisma/client';
import {
  CASE_VALIDATION_VERSION,
  type CaseRevisionSnapshot,
  type ValidationIssueCounts,
  type ValidationPersistencePayload,
  type ValidationReport,
  type ValidatorResult,
} from './case-validation.types.js';
import { runClueValidator } from './validators/clue.validator.js';
import { runDifferentialValidator } from './validators/differential.validator.js';
import { runDifficultyValidator } from './validators/difficulty.validator.js';
import { runExplanationValidator } from './validators/explanation.validator.js';
import { runStructureValidator } from './validators/structure.validator.js';

@Injectable()
export class CaseValidationService {
  validateSnapshot(snapshot: CaseRevisionSnapshot): ValidationReport {
    const validatorResults: ValidatorResult[] = [
      runStructureValidator(snapshot),
      runClueValidator(snapshot),
      runDifferentialValidator(snapshot),
      runExplanationValidator(snapshot),
      runDifficultyValidator(snapshot),
    ];

    const issues = validatorResults.flatMap((result) => result.issues);
    const issueCounts = this.countIssues(issues);
    const outcome =
      issueCounts.errors > 0
        ? ValidationOutcome.FAILED
        : ValidationOutcome.PASSED;

    return {
      validatorVersion: CASE_VALIDATION_VERSION,
      outcome,
      issueCounts,
      validators: validatorResults.map((result) => ({
        validator: result.validator,
        passed: result.passed,
        issueCounts: this.countIssues(result.issues),
      })),
      issues,
    };
  }

  buildPersistencePayload(
    report: ValidationReport,
  ): ValidationPersistencePayload {
    return {
      summary: {
        validatorVersion: report.validatorVersion,
        outcome: report.outcome,
        issueCounts: report.issueCounts,
        validators: report.validators,
      } satisfies Prisma.InputJsonValue,
      findings: {
        issues: report.issues,
      } satisfies Prisma.InputJsonValue,
    };
  }

  buildExecutionErrorReport(error: unknown): ValidationReport {
    const message =
      error instanceof Error ? error.message : 'Unknown validation error';

    return {
      validatorVersion: CASE_VALIDATION_VERSION,
      outcome: ValidationOutcome.ERROR,
      issueCounts: {
        errors: 1,
        warnings: 0,
        infos: 0,
        total: 1,
      },
      validators: [],
      issues: [
        {
          validator: 'structure',
          severity: 'error',
          code: 'VALIDATION_EXECUTION_ERROR',
          message,
        },
      ],
    };
  }

  private countIssues(
    issues: Array<{ severity: 'error' | 'warning' | 'info' }>,
  ): ValidationIssueCounts {
    return issues.reduce<ValidationIssueCounts>(
      (counts, issue) => {
        if (issue.severity === 'error') {
          counts.errors += 1;
        } else if (issue.severity === 'warning') {
          counts.warnings += 1;
        } else {
          counts.infos += 1;
        }

        counts.total += 1;
        return counts;
      },
      {
        errors: 0,
        warnings: 0,
        infos: 0,
        total: 0,
      },
    );
  }
}
