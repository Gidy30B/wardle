import { Injectable } from '@nestjs/common';

type OntologyNode = {
  disease: string;
  system: string;
  category: string;
  related: string[];
};

type OntologyScore = {
  score: number;
  reason: string;
};

@Injectable()
export class OntologyService {
  private readonly graph: OntologyNode[] = [
    {
      disease: 'myocardial infarction',
      system: 'cardiovascular',
      category: 'ischemic',
      related: ['unstable angina'],
    },
    {
      disease: 'pneumonia',
      system: 'respiratory',
      category: 'infection',
      related: ['tuberculosis', 'lung abscess'],
    },
    {
      disease: 'tuberculosis',
      system: 'respiratory',
      category: 'infection',
      related: ['pneumonia'],
    },
  ];

  scoreRelationship(guess: string, answer: string): OntologyScore {
    const guessNode = this.findNode(guess);
    const answerNode = this.findNode(answer);

    if (!guessNode || !answerNode) {
      return {
        score: 0,
        reason: 'no_ontology_match',
      };
    }

    if (guessNode.disease === answerNode.disease) {
      return {
        score: 1,
        reason: 'same_disease',
      };
    }

    if (guessNode.related.includes(answerNode.disease)) {
      return {
        score: 0.7,
        reason: 'related_disease',
      };
    }

    if (guessNode.system === answerNode.system) {
      return {
        score: 0.6,
        reason: 'same_system',
      };
    }

    return {
      score: 0,
      reason: 'unrelated',
    };
  }

  private findNode(disease: string): OntologyNode | undefined {
    const normalized = disease.toLowerCase().trim();
    return this.graph.find((node) => node.disease === normalized);
  }
}
