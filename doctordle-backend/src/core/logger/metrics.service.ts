import { Injectable } from '@nestjs/common';

type LayerName = 'preprocess' | 'retrieval' | 'ontology' | 'llm' | 'evaluate';

@Injectable()
export class MetricsService {
  private readonly layerLatencyMs: Record<LayerName, number[]> = {
    preprocess: [],
    retrieval: [],
    ontology: [],
    llm: [],
    evaluate: [],
  };

  private cacheHits = 0;
  private cacheMisses = 0;
  private llmCalls = 0;
  private evaluations = 0;
  private readonly counters = new Map<string, number>();
  private readonly observations = new Map<string, number[]>();

  recordLayerLatency(layer: LayerName, latencyMs: number): void {
    this.layerLatencyMs[layer].push(latencyMs);
  }

  recordCacheHit(hit: boolean): void {
    if (hit) {
      this.cacheHits += 1;
      return;
    }

    this.cacheMisses += 1;
  }

  recordEvaluation(): void {
    this.evaluations += 1;
  }

  recordLlmUsage(): void {
    this.llmCalls += 1;
  }

  increment(metric: string): void {
    const current = this.counters.get(metric) ?? 0;
    this.counters.set(metric, current + 1);
  }

  observe(metric: string, value: number): void {
    const current = this.observations.get(metric) ?? [];
    current.push(value);
    this.observations.set(metric, current);
  }

  snapshot(): {
    cacheHitRate: number;
    llmUsageRate: number;
    avgLayerLatency: Record<LayerName, number>;
  } {
    const totalCache = this.cacheHits + this.cacheMisses;
    const avgLayerLatency = {
      preprocess: this.average(this.layerLatencyMs.preprocess),
      retrieval: this.average(this.layerLatencyMs.retrieval),
      ontology: this.average(this.layerLatencyMs.ontology),
      llm: this.average(this.layerLatencyMs.llm),
      evaluate: this.average(this.layerLatencyMs.evaluate),
    };

    return {
      cacheHitRate: totalCache ? this.cacheHits / totalCache : 0,
      llmUsageRate: this.evaluations ? this.llmCalls / this.evaluations : 0,
      avgLayerLatency,
    };
  }

  private average(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
}
