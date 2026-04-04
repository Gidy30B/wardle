import { Injectable } from '@nestjs/common';
import { MetricsService } from '../../../core/logger/metrics.service';
import { OntologyService } from '../../knowledge/ontology.service';
import { SynonymService } from '../../knowledge/synonym.service';
import { preprocess } from '../pipeline/preprocess';
import { LlmFallbackService } from '../llm/llm-fallback.service';
import { fuzzySimilarity } from '../services/fuzzy';
import { mapLabel, computeScore } from '../services/score';
import { RetrievalService } from '../services/retrieval.service';
import { EvaluationResult, EvaluationSignals } from '../services/types';

@Injectable()
export class EvaluatorV2Service {
  constructor(
    private readonly synonymService: SynonymService,
    private readonly ontologyService: OntologyService,
    private readonly retrievalService: RetrievalService,
    private readonly llmFallbackService: LlmFallbackService,
    private readonly metricsService: MetricsService,
  ) {}

  async evaluate(guess: string, answer: string): Promise<EvaluationResult> {
    const evaluateStart = performance.now();

    const preprocessStart = performance.now();
    const normalizedGuess = await preprocess(guess);
    const normalizedAnswer = await preprocess(answer);
    this.metricsService.recordLayerLatency(
      'preprocess',
      performance.now() - preprocessStart,
    );

    const retrievalStart = performance.now();
    const topCandidates = await this.retrievalService.retrieveTopK(
      normalizedGuess,
      normalizedAnswer,
      5,
    );
    this.metricsService.recordLayerLatency(
      'retrieval',
      performance.now() - retrievalStart,
    );

    const exact = normalizedGuess === normalizedAnswer;
    const synonym = this.synonymService.isExact(normalizedGuess, normalizedAnswer);
    const fuzzy = fuzzySimilarity(normalizedGuess, normalizedAnswer);

    const answerCandidate = topCandidates.find(
      (candidate) =>
        this.synonymService.resolve(candidate.diagnosis) ===
        this.synonymService.resolve(normalizedAnswer),
    );
    const embedding = answerCandidate ? answerCandidate.embeddingSimilarity : 0;

    const ontologyStart = performance.now();
    const ontology = this.ontologyService.scoreRelationship(
      this.synonymService.resolve(normalizedGuess),
      this.synonymService.resolve(normalizedAnswer),
    );
    this.metricsService.recordLayerLatency(
      'ontology',
      performance.now() - ontologyStart,
    );

    const signals: EvaluationSignals = {
      exact,
      synonym,
      fuzzy,
      embedding,
      ontology,
    };

    let score = computeScore(signals);
    let label = mapLabel(score);

    if (score < 0.5 && this.isAmbiguous(topCandidates)) {
      const llmDecision = await this.llmFallbackService.evaluate(
        normalizedGuess,
        normalizedAnswer,
      );

      if (llmDecision) {
        score = Math.max(score, llmDecision.score);
        label = llmDecision.label;
      }
    }

    this.metricsService.recordLayerLatency(
      'evaluate',
      performance.now() - evaluateStart,
    );

    return {
      score,
      label,
      signals,
      normalizedGuess,
      evaluatorVersion: 'v2',
      retrievalMode: topCandidates[0]?.mode ?? 'fallback',
    };
  }

  private isAmbiguous(candidates: Array<{ rerankScore: number }>): boolean {
    if (candidates.length < 2) {
      return false;
    }

    return Math.abs(candidates[0].rerankScore - candidates[1].rerankScore) < 0.08;
  }
}
