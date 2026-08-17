import type {
  GovernedBatchResolution,
  GovernedCommandContractDefinition,
  GovernedCommandResolutionResult,
} from './governed-command.types';

export const resolveGovernedBatch = (input: {
  contract: GovernedCommandContractDefinition;
  individualCommandResults: GovernedCommandResolutionResult[];
}): GovernedBatchResolution => {
  if (input.contract.batchPolicy === 'PROHIBITED') {
    return {
      status: 'BATCH_PROHIBITED',
      reasons: ['BATCH_PROHIBITED'],
      itemResults: input.individualCommandResults,
      noPartialApplication: true,
    };
  }
  const rejected = input.individualCommandResults.filter(
    (result) => result.status !== 'ELIGIBLE',
  );
  if (input.contract.batchPolicy === 'ATOMIC' && rejected.length > 0) {
    return {
      status: 'BATCH_REJECTED',
      reasons: ['ATOMIC_BATCH_REJECTED'],
      itemResults: input.individualCommandResults,
      noPartialApplication: true,
    };
  }
  if (input.contract.batchPolicy === 'INDEPENDENT_ITEMS') {
    const missingIndependent = input.individualCommandResults.some(
      (result) => !result.reasons.includes('INDEPENDENT_ITEM_RESULT'),
    );
    if (missingIndependent)
      return {
        status: 'BATCH_REJECTED',
        reasons: ['INDEPENDENT_ITEMS_REQUIRE_SEPARATE_RESULTS'],
        itemResults: input.individualCommandResults,
        noPartialApplication: true,
      };
  }
  return {
    status: 'BATCH_ELIGIBLE',
    reasons: [],
    itemResults: input.individualCommandResults,
    noPartialApplication: true,
  };
};
