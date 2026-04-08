import { IsString } from 'class-validator';

export class RequestHintDto {
  @IsString()
  sessionId!: string;
}
