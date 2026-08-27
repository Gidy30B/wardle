import { EducationSchemaContractService } from './education-schema-contract.service';

describe('EducationSchemaContractService', () => {
  const service = new EducationSchemaContractService();

  it('recognizes investigation expected findings and interpretations across valid clinical synonyms', () => {
    const pearl = {
      id: 'pla2r-antibody',
      type: 'INVESTIGATION',
      title: 'PLA2R antibody',
      content:
        'PLA2R antibody testing demonstrates a positive disease-specific signal consistent with primary membranous nephropathy.',
      whyItMatters:
        'A positive result increases the likelihood of primary membranous nephropathy and makes lupus nephritis less likely.',
      managementImplication:
        'Use the result to prioritize secondary-cause review and decide whether biopsy is still needed.',
    };

    expect(service.hasInvestigationExpectedFinding(pearl)).toBe(true);
    expect(service.hasInvestigationInterpretation(pearl)).toBe(true);
  });

  it('does not treat generic investigation usefulness as expected finding or interpretation', () => {
    const pearl = {
      id: 'generic-ct',
      type: 'INVESTIGATION',
      title: 'CT',
      content: 'Order CT because it is useful.',
      whyItMatters: 'It is helpful and supports the diagnosis.',
    };

    expect(service.hasInvestigationExpectedFinding(pearl)).toBe(false);
    expect(service.hasInvestigationInterpretation(pearl)).toBe(false);
  });

  it('recognizes exam mechanisms and diagnostic impact across valid clinical synonyms', () => {
    const pearl = {
      id: 'pitting-edema',
      type: 'EXAM',
      title: 'Pitting edema',
      content:
        'Pitting edema results from reduced plasma oncotic pressure as nephrotic protein loss shifts fluid into tissues.',
      whyItMatters:
        'This finding increases likelihood of nephrotic syndrome and makes isolated dependent swelling less likely.',
      discriminator:
        'Generalized edema with heavy proteinuria rather than isolated venous stasis.',
    };

    expect(service.hasExamMechanism(pearl)).toBe(true);
    expect(service.hasDiagnosticImpact(pearl)).toBe(true);
  });

  it('does not treat generic exam support as mechanism or diagnostic impact', () => {
    const pearl = {
      id: 'generic-murphy',
      type: 'EXAM',
      title: 'Murphy sign',
      content: 'Murphy sign supports the diagnosis.',
      whyItMatters: 'It supports the diagnosis.',
    };

    expect(service.hasExamMechanism(pearl)).toBe(false);
    expect(service.hasDiagnosticImpact(pearl)).toBe(false);
  });
});
