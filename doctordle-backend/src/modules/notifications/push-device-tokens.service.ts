import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/db/prisma.service';
import type { RegisterPushDeviceTokenDto } from './dto/register-push-device-token.dto';

@Injectable()
export class PushDeviceTokensService {
  constructor(private readonly prisma: PrismaService) {}

  async registerForUser(userId: string, input: RegisterPushDeviceTokenDto) {
    const now = new Date();
    const token = await this.prisma.pushDeviceToken.upsert({
      where: {
        token: input.token,
      },
      create: {
        userId,
        token: input.token,
        platform: input.platform,
        deviceId: input.deviceId,
        appVersion: input.appVersion,
        lastSeenAt: now,
        disabledAt: null,
      },
      update: {
        userId,
        platform: input.platform,
        deviceId: input.deviceId,
        appVersion: input.appVersion,
        lastSeenAt: now,
        disabledAt: null,
      },
    });

    return {
      token: this.toDto(token),
    };
  }

  async disableForUser(userId: string, token: string) {
    const result = await this.prisma.pushDeviceToken.updateMany({
      where: {
        userId,
        token,
        disabledAt: null,
      },
      data: {
        disabledAt: new Date(),
      },
    });

    return {
      disabled: result.count > 0,
    };
  }

  private toDto(token: {
    id: string;
    userId: string;
    token: string;
    platform: string;
    deviceId: string | null;
    appVersion: string | null;
    lastSeenAt: Date;
    disabledAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: token.id,
      userId: token.userId,
      token: token.token,
      platform: token.platform,
      deviceId: token.deviceId,
      appVersion: token.appVersion,
      lastSeenAt: token.lastSeenAt.toISOString(),
      disabledAt: token.disabledAt?.toISOString() ?? null,
      createdAt: token.createdAt.toISOString(),
      updatedAt: token.updatedAt.toISOString(),
    };
  }
}
