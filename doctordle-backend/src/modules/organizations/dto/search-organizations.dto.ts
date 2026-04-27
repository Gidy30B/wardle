import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SearchOrganizationsDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  query?: string;
}
