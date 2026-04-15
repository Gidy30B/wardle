import { CaseEditorialStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsIn, IsOptional, Max, Min } from 'class-validator';
import {
  EDITORIAL_QUEUE_FILTERS,
  type EditorialQueueFilter,
} from '../../editorial/policies/publish-policy.js';

export class ListEditorialCasesDto {
  @IsOptional()
  @IsEnum(CaseEditorialStatus)
  status?: CaseEditorialStatus;

  @IsOptional()
  @IsIn(EDITORIAL_QUEUE_FILTERS)
  queue?: EditorialQueueFilter;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
