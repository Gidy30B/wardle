import { IsString, MaxLength } from 'class-validator';

export class RestoreCaseRevisionDto {
  @IsString()
  expectedRevisionId!: string;

  @IsString()
  commandIdempotencyKey!: string;

  @IsString()
  @MaxLength(5000)
  changeReason!: string;

  @IsString()
  @MaxLength(5000)
  changeSummary!: string;
}
