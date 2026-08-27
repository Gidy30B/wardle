import { EducationEditorialPatternsService } from './education-editorial-patterns.service';

describe('EducationEditorialPatternsService', () => {
  const service = new EducationEditorialPatternsService();

  it('scores contract-compliant investigations and exam pearls using shared semantic checks', () => {
    const scores = service.scoreDraft({
      investigations: [
        {
          id: 'pla2r-antibody',
          type: 'INVESTIGATION',
          title: 'PLA2R antibody',
          content:
            'PLA2R antibody testing demonstrates a positive disease-specific signal consistent with primary membranous nephropathy.',
          whyItMatters:
            'A positive result increases the likelihood of primary membranous nephropathy and makes lupus nephritis less likely.',
          managementImplication:
            'Use the result to prioritize secondary-cause review and decide whether biopsy is still needed.',
        },
      ],
      examPearls: [
        {
          id: 'pitting-edema',
          type: 'EXAM',
          title: 'Pitting edema',
          content:
            'Pitting edema results from reduced plasma oncotic pressure as nephrotic protein loss shifts fluid into tissues.',
          whyItMatters:
            'This finding increases likelihood of nephrotic syndrome and makes isolated dependent swelling less likely.',
          discriminator:
            'Generalized edema with heavy proteinuria rather than isolated venous stasis.',
        },
      ],
    });

    expect(scores.investigation).toBeGreaterThanOrEqual(0.8);
    expect(scores.examPearl).toBe(1);
  });

  it('keeps generic investigation and exam prose low-scoring', () => {
    const scores = service.scoreDraft({
      investigations: [
        {
          id: 'generic-ct',
          type: 'INVESTIGATION',
          title: 'CT',
          content: 'Order CT because it is useful.',
          whyItMatters: 'It is helpful and supports the diagnosis.',
        },
      ],
      examPearls: [
        {
          id: 'generic-murphy',
          type: 'EXAM',
          title: 'Murphy sign',
          content: 'Murphy sign supports the diagnosis.',
          whyItMatters: 'It supports the diagnosis.',
        },
      ],
    });

    expect(scores.investigation).toBeLessThan(0.6);
    expect(scores.examPearl).toBeLessThan(0.6);
  });
});
