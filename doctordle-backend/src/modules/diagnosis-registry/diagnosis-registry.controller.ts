import { Controller, Get } from '@nestjs/common';
import {
  DiagnosisDictionaryPayload,
  DiagnosisRegistryDictionaryService,
} from './diagnosis-registry-dictionary.service.js';
import {
  DiagnosisRegistrySnapshotResponse,
  DiagnosisRegistrySnapshotService,
  DiagnosisRegistryVersionResponse,
} from './diagnosis-registry-snapshot.service.js';

@Controller('diagnosis-registry')
export class DiagnosisRegistryController {
  constructor(
    private readonly diagnosisRegistrySnapshotService: DiagnosisRegistrySnapshotService,
    private readonly diagnosisRegistryDictionaryService: DiagnosisRegistryDictionaryService,
  ) {}

  @Get('version')
  async getVersion(): Promise<DiagnosisRegistryVersionResponse> {
    return this.diagnosisRegistrySnapshotService.getVersion();
  }

  @Get('snapshot')
  async getSnapshot(): Promise<DiagnosisRegistrySnapshotResponse> {
    return this.diagnosisRegistrySnapshotService.getSnapshot();
  }

  @Get('dictionary')
  async getDictionary(): Promise<DiagnosisDictionaryPayload> {
    return this.diagnosisRegistryDictionaryService.getDictionary();
  }
}
