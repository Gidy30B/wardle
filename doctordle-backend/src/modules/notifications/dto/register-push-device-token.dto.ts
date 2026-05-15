import { IsIn, IsOptional, IsString } from 'class-validator';

export const PUSH_DEVICE_PLATFORMS = ['android', 'ios', 'web'] as const;

export type PushDevicePlatform = (typeof PUSH_DEVICE_PLATFORMS)[number];

export class RegisterPushDeviceTokenDto {
  @IsString()
  token!: string;

  @IsIn(PUSH_DEVICE_PLATFORMS)
  platform!: PushDevicePlatform;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;
}
