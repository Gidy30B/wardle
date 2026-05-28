import { DiagnosisGraphCandidateType } from '@prisma/client';
import { DiagnosisGraphController } from './diagnosis-graph.controller';

describe('DiagnosisGraphController', () => {
  it('returns only active facts through the graph service boundary', async () => {
    const candidatesService = {
      getActiveGraph: jest.fn().mockResolvedValue([
        {
          id: 'fact-1',
          status: 'ACTIVE',
        },
      ]),
      getActiveFactsByType: jest.fn().mockResolvedValue([]),
    };
    const controller = new DiagnosisGraphController(candidatesService as never);

    await expect(controller.getGraph('registry-1')).resolves.toEqual([
      {
        id: 'fact-1',
        status: 'ACTIVE',
      },
    ]);
    expect(candidatesService.getActiveGraph).toHaveBeenCalledWith('registry-1');
  });

  it('uses typed active fact queries for public mimic, finding, and pitfall endpoints', async () => {
    const candidatesService = {
      getActiveGraph: jest.fn(),
      getActiveFactsByType: jest.fn().mockResolvedValue([]),
    };
    const controller = new DiagnosisGraphController(candidatesService as never);

    await controller.getMimics('registry-1');
    await controller.getFindings('registry-1');
    await controller.getPitfalls('registry-1');

    expect(candidatesService.getActiveFactsByType).toHaveBeenCalledWith(
      'registry-1',
      DiagnosisGraphCandidateType.MIMIC,
    );
    expect(candidatesService.getActiveFactsByType).toHaveBeenCalledWith(
      'registry-1',
      DiagnosisGraphCandidateType.FINDING,
    );
    expect(candidatesService.getActiveFactsByType).toHaveBeenCalledWith(
      'registry-1',
      DiagnosisGraphCandidateType.PITFALL,
    );
  });
});
