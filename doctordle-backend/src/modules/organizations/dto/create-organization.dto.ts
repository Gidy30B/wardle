import { OrganizationType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, MinLength } from 'class-validator';

export class CreateOrganizationDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEnum(OrganizationType)
  type!: OrganizationType;
}
