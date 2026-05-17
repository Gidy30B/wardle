import { GenerationDeduplicationService } from './generation-deduplication.service';

describe('GenerationDeduplicationService', () => {
  it('reserves registry diagnoses once per batch plan', () => {
    const service = new GenerationDeduplicationService();
    const reservedRegistryIds = service.createRegistryReservation();

    expect(
      service.reserveRegistryDiagnosis({
        registryId: 'registry-1',
        reservedRegistryIds,
      }),
    ).toBe(true);
    expect(
      service.reserveRegistryDiagnosis({
        registryId: 'registry-1',
        reservedRegistryIds,
      }),
    ).toBe(false);
    expect(
      service.reserveRegistryDiagnosis({
        registryId: 'registry-2',
        reservedRegistryIds,
      }),
    ).toBe(true);
  });
});
