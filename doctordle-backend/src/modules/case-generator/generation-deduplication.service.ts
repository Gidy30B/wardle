import { Injectable } from '@nestjs/common';

@Injectable()
export class GenerationDeduplicationService {
  createRegistryReservation() {
    return new Set<string>();
  }

  reserveRegistryDiagnosis(input: {
    registryId: string;
    reservedRegistryIds: Set<string>;
  }): boolean {
    if (input.reservedRegistryIds.has(input.registryId)) {
      return false;
    }

    input.reservedRegistryIds.add(input.registryId);
    return true;
  }
}
