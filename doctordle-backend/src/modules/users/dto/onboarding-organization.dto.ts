import { Transform } from 'class-transformer';
import { IsUUID } from 'class-validator';

export class OnboardingOrganizationDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsUUID()
  organizationId!: string;
}
