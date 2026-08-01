import type {
  ProjectionInventory,
  ProjectionInventoryEntry,
} from './compatibility-projection.types';

export const createProjectionInventory = (
  entries: ProjectionInventoryEntry[] = [],
): ProjectionInventory => ({
  inventoryId: 'WEOS-COMPATIBILITY-PROJECTION-INVENTORY',
  inventorySchemaVersion: '1.0.0',
  status: 'STAGE_1_CONTRACT_ONLY',
  entries: [...entries],
  createdAt: '2026-08-02T00:00:00Z',
  recordedAt: '2026-08-02T00:00:00Z',
});

export const inventoryPreservesUnknownWriterRisk = (
  entry: ProjectionInventoryEntry,
): boolean =>
  entry.inventoryCompleteness === 'COMPLETE' || entry.unknownWriterRisk;
