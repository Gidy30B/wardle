import { IsDateString, IsString } from 'class-validator';

export class AssignDailyCaseDto {
  @IsDateString()
  date!: string;

  @IsString()
  caseId!: string;
}
