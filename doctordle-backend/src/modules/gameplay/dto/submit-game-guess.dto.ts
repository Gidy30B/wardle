import { IsString, MinLength } from 'class-validator';

export class SubmitGameGuessDto {
  @IsString()
  sessionId!: string;

  @IsString()
  @MinLength(2)
  guess!: string;
}
