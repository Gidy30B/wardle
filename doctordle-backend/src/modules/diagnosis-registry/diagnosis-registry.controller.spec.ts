import type { DiagnosisDictionaryPayload } from './diagnosis-registry-dictionary.service';
import { DiagnosisRegistryController } from './diagnosis-registry.controller';

describe('DiagnosisRegistryController', () => {
  it('returns the compact public dictionary payload', async () => {
    const snapshotService = {
      getVersion: jest.fn(),
      getSnapshot: jest.fn(),
    };
    const dictionaryPayload: DiagnosisDictionaryPayload = {
      version: '1:2:3',
      generatedAt: '2026-04-22T09:00:00.000Z',
      items: [
        {
          id: 'dx-1',
          label: 'Appendicitis',
          aliases: ['Acute appendicitis'],
          priority: 80,
        },
      ],
    };
    const dictionaryService = {
      getDictionary: jest.fn().mockResolvedValue(dictionaryPayload),
    };

    const controller = new DiagnosisRegistryController(
      snapshotService as never,
      dictionaryService as never,
    );

    await expect(controller.getDictionary()).resolves.toEqual(dictionaryPayload);
    expect(dictionaryService.getDictionary).toHaveBeenCalledTimes(1);
  });
});
