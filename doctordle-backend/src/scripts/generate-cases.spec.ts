import { buildGenerationSummary, parseArgs } from './generate-cases';
import type { GenerateBatchResult } from '../modules/case-generator/case-generator.types';

describe('generate-cases CLI helpers', () => {
  it('parses supported registry-first and filter flags', () => {
    expect(
      parseArgs([
        '--registryFirst=true',
        '--bodySystem=Respiratory',
        '--track=Pulmonology',
        '--count=3',
      ]),
    ).toEqual({
      count: 3,
      registryFirst: true,
      bodySystem: 'Respiratory',
      track: 'Pulmonology',
    });

    expect(
      parseArgs([
        '--registry-first=true',
        '--body-system=Cardiovascular',
        '--track=Cardiology',
        '--count=5',
      ]),
    ).toEqual({
      count: 5,
      registryFirst: true,
      bodySystem: 'Cardiovascular',
      track: 'Cardiology',
    });

    expect(parseArgs(['--registry-first=false'])).toEqual({
      count: 20,
      registryFirst: false,
    });

    expect(parseArgs(['--count=2'])).toEqual({
      count: 2,
      registryFirst: true,
    });
  });

  it('builds a stdout summary with planner diagnostics, created cases, and errors', () => {
    const result: GenerateBatchResult = {
      batchId: 'batch-1',
      requested: 3,
      generated: 3,
      accepted: 1,
      rejected: 1,
      created: 1,
      skipped: 1,
      failed: 1,
      averageQualityScore: 91,
      plannerDiagnostics: [
        {
          batchId: 'batch-1',
          index: 0,
          diagnosis: null,
          duplicatePrevented: false,
          selectionStatus: 'unavailable',
          repeatReason: null,
          existingCaseCount: null,
          recentUsePenaltyApplied: false,
          diagnostics: {
            candidateCount: 0,
            unusedCandidateCount: 0,
            repeatedCandidateCount: 0,
            selectedUnusedCount: 0,
            selectedRepeatCount: 0,
            repeatReason: null,
            existingCaseCountByDiagnosis: {},
            recentUsePenaltyApplied: false,
          },
        },
      ],
      results: [
        {
          index: 0,
          status: 'created',
          caseId: 'case-1',
          answer: 'Asthma',
        },
        {
          index: 1,
          status: 'skipped',
          reason: 'duplicate_answer',
          answer: 'Asthma',
        },
        {
          index: 2,
          status: 'failed',
          error: 'Generation failed',
        },
      ],
    };

    expect(
      buildGenerationSummary({ count: 3, registryFirst: true }, result),
    ).toEqual({
      event: 'generate_cases.completed',
      requested: 3,
      created: 1,
      failed: 1,
      skipped: 1,
      registryFirst: true,
      plannerDiagnostics: result.plannerDiagnostics,
      createdCases: [
        {
          id: 'case-1',
          title: 'Asthma',
        },
      ],
      errors: [
        {
          index: 2,
          error: 'Generation failed',
        },
      ],
      skippedCases: [
        {
          index: 1,
          reason: 'duplicate_answer',
          title: 'Asthma',
        },
      ],
      results: result.results,
    });
  });
});
