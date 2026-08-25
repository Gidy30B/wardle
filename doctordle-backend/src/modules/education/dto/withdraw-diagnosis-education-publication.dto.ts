import { IsString, MaxLength, MinLength } from 'class-validator';

export class WithdrawDiagnosisEducationPublicationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  rationale!: string;
}
