import type { EditorialCoverageOverview } from '../../api/admin';

export type EditorialCoverageQueue = {
  id: string;
  label: string;
  tone: 'danger' | 'warning' | 'neutral';
  count: number;
  description?: string;
};

const queueDefinitions: Array<Omit<EditorialCoverageQueue, 'count'>> = [
  {
    id: 'needs_review',
    label: 'Needs review',
    tone: 'warning',
    description: 'Pending editorial or graph review work.',
  },
  {
    id: 'high_publication_risk',
    label: 'High publication risk',
    tone: 'danger',
    description: 'Publication blockers or readiness failures.',
  },
  {
    id: 'weak_discriminator_coverage',
    label: 'Weak discriminator coverage',
    tone: 'warning',
    description: 'Missing mimic or distinction support.',
  },
  {
    id: 'unsupported_claims',
    label: 'Unsupported claims',
    tone: 'danger',
    description: 'Claims that need evidence-backed repair.',
  },
  {
    id: 'sparse_diagnosis',
    label: 'Sparse diagnoses',
    tone: 'warning',
    description: 'Not enough brief, teaching, case, or graph data.',
  },
  {
    id: 'draft_heavy',
    label: 'Draft-heavy diagnoses',
    tone: 'warning',
    description: 'Generated drafts waiting for trust review.',
  },
  {
    id: 'escalation_coverage_gaps',
    label: 'Escalation coverage gaps',
    tone: 'danger',
    description: 'Must-not-miss or escalation paths need coverage.',
  },
];

const queueDescriptionById = new Map(
  queueDefinitions.map((queue) => [queue.id, queue.description]),
);

export function buildEditorialQueues(
  diagnoses: EditorialCoverageOverview['weakDiagnoses'],
): EditorialCoverageQueue[] {
  const backendQueues = new Map<string, EditorialCoverageQueue>();
  for (const diagnosis of diagnoses) {
    for (const queue of diagnosisWorkflowQueues(diagnosis)) {
      const existing = backendQueues.get(queue.id);
      backendQueues.set(queue.id, {
        id: queue.id,
        label: queue.label,
        tone: queue.severity === 'blocker' ? 'danger' : 'warning',
        description: queueDescriptionById.get(queue.id),
        count: (existing?.count ?? 0) + 1,
      });
    }
  }

  if (backendQueues.size) {
    return [...backendQueues.values()];
  }

  return queueDefinitions
    .map((queue) => ({
      ...queue,
      count: diagnoses.filter((diagnosis) =>
        diagnosisQueueIds(diagnosis).includes(queue.id),
      ).length,
    }))
    .filter((queue) => queue.count > 0);
}

export function diagnosisQueueIds(
  diagnosis: EditorialCoverageOverview['weakDiagnoses'][number],
): string[] {
  const backendQueueIds = diagnosisWorkflowQueues(diagnosis).map(
    (queue) => queue.id,
  );
  if (backendQueueIds.length) {
    return backendQueueIds;
  }

  const queues: string[] = [];
  if (diagnosis.risk.reviewBacklog > 0 || diagnosis.graph.pendingCandidateCount > 0) {
    queues.push('needs_review');
  }
  if (
    diagnosis.weaknesses.includes('missing_playable_cases') ||
    diagnosis.weaknesses.includes('missing_graph_coverage') ||
    diagnosis.lifecycle.readiness === 'blocked' ||
    !diagnosis.lifecycle.playable
  ) {
    queues.push('high_publication_risk');
  }
  if (
    diagnosis.weaknesses.includes('missing_required_differentials') ||
    diagnosis.weaknesses.includes('weak_differential_breadth') ||
    diagnosis.teaching.discriminatorRuleCount === 0
  ) {
    queues.push('weak_discriminator_coverage');
  }
  if (diagnosis.evidenceCoverage?.coverageBreakdown.hallucinationRiskDraftCount) {
    queues.push('unsupported_claims');
  }
  if (
    diagnosis.teaching.ruleCount === 0 ||
    (!diagnosis.education.version && diagnosis.inventory.caseCount === 0)
  ) {
    queues.push('sparse_diagnosis');
  }
  if (
    (diagnosis.evidenceCoverage?.coverageBreakdown.lowTrustDraftCount ?? 0) +
      (diagnosis.evidenceCoverage?.coverageBreakdown.blockedDraftCount ?? 0) >
    1
  ) {
    queues.push('draft_heavy');
  }
  if (
    diagnosis.evidenceCoverage?.generationHooks.suggestedGenerationPrerequisites.some(
      (item) => item.toLowerCase().includes('escalation'),
    )
  ) {
    queues.push('escalation_coverage_gaps');
  }
  return queues;
}

export function diagnosisWorkflowQueues(
  diagnosis: EditorialCoverageOverview['weakDiagnoses'][number],
) {
  return (
    diagnosis.editorialTriage?.workflowQueues ??
    diagnosis.editorialTriage?.queues ??
    diagnosis.editorialPrioritization?.workflowQueues ??
    diagnosis.editorialPrioritization?.queues ??
    []
  );
}

export function sortDiagnosesByEditorialPriority(
  diagnoses: EditorialCoverageOverview['weakDiagnoses'],
): EditorialCoverageOverview['weakDiagnoses'] {
  return diagnoses
    .map((diagnosis, index) => ({ diagnosis, index }))
    .sort((left, right) => {
      const leftPriority = editorialPriorityScore(left.diagnosis);
      const rightPriority = editorialPriorityScore(right.diagnosis);
      if (rightPriority !== leftPriority) {
        return rightPriority - leftPriority;
      }
      return left.index - right.index;
    })
    .map((item) => item.diagnosis);
}

function editorialPriorityScore(
  diagnosis: EditorialCoverageOverview['weakDiagnoses'][number],
) {
  const triage =
    diagnosis.editorialTriage ?? diagnosis.editorialPrioritization ?? null;
  const priority = triage?.editorialPriority;
  if (typeof priority?.score === 'number') {
    return priority.score;
  }
  const tier = priority?.tier;
  if (tier === 'critical') return 100;
  if (tier === 'high') return 80;
  if (tier === 'medium') return 50;
  if (tier === 'low') return 20;
  return 0;
}
