import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { EditorialGuard, SeniorEditorialGuard } from './editorial.guard';

export const EDITORIAL_PERMISSION_KEY = 'editorialPermission';

export type EditorialPermissionLevel = 'editor' | 'senior';

export function EditorialAccess() {
  return applyDecorators(
    SetMetadata(EDITORIAL_PERMISSION_KEY, 'editor' satisfies EditorialPermissionLevel),
    UseGuards(EditorialGuard),
  );
}

export function SeniorEditorialAccess() {
  return applyDecorators(
    SetMetadata(EDITORIAL_PERMISSION_KEY, 'senior' satisfies EditorialPermissionLevel),
    UseGuards(SeniorEditorialGuard),
  );
}
