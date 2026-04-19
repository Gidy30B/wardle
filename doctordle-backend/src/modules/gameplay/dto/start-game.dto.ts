import { PublishTrack } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class StartGameDto {
  @IsOptional()
  @IsString()
  dailyCaseId?: string;

  @IsOptional()
  @IsBoolean()
  devReplay?: boolean;

  @IsOptional()
  @IsEnum(PublishTrack)
  track?: PublishTrack;

  @IsOptional()
  @IsInt()
  @Min(1)
  sequenceIndex?: number;
}
