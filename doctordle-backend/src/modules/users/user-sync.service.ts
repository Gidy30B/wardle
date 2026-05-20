import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UserOnboardingStatus } from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';

export type ClerkPrincipal = {
  clerkId: string;
  email?: string | null;
  displayName?: string | null;
};

export type SyncedUser = {
  id: string;
  clerkId: string | null;
  email: string | null;
  displayName: string | null;
  subscriptionTier: string;
  lastPlayedAt: Date | null;
  role: string;
};

@Injectable()
export class UserSyncService {
  constructor(private readonly prisma: PrismaService) {}

  async findByClerkId(clerkId: string) {
    return this.prisma.user.findUnique({
      where: { clerkId },
    });
  }

  async syncUser(principal: ClerkPrincipal): Promise<SyncedUser> {
    const existingByClerkId = await this.findByClerkId(principal.clerkId);
    if (existingByClerkId) {
      const shouldFillDisplayName =
        !existingByClerkId.displayName?.trim() && principal.displayName?.trim();
      await this.prisma.user.update({
        where: { id: existingByClerkId.id },
        data: {
          email: principal.email ?? undefined,
          ...(shouldFillDisplayName
            ? {
                displayName: principal.displayName!.trim(),
                individualMode: false,
                onboardingStatus: UserOnboardingStatus.ORGANIZATION_REQUIRED,
                onboardingCompletedAt: null,
              }
            : {}),
        },
      });

      return this.loadSyncedUser(existingByClerkId.id);
    }

    const existingById = await this.prisma.user.findUnique({
      where: { id: principal.clerkId },
    });

    if (existingById && !existingById.clerkId) {
      const shouldFillDisplayName =
        !existingById.displayName?.trim() && principal.displayName?.trim();
      await this.prisma.user.update({
        where: { id: existingById.id },
        data: {
          clerkId: principal.clerkId,
          email: principal.email ?? undefined,
          ...(shouldFillDisplayName
            ? {
                displayName: principal.displayName!.trim(),
                individualMode: false,
                onboardingStatus: UserOnboardingStatus.ORGANIZATION_REQUIRED,
                onboardingCompletedAt: null,
              }
            : {}),
        },
      });

      return this.loadSyncedUser(existingById.id);
    }

    const displayName = principal.displayName?.trim() || undefined;
    const createdUser = await this.prisma.user.create({
      data: {
        id: randomUUID(),
        clerkId: principal.clerkId,
        email: principal.email ?? undefined,
        displayName,
        individualMode: false,
        onboardingStatus: displayName
          ? UserOnboardingStatus.ORGANIZATION_REQUIRED
          : UserOnboardingStatus.PROFILE_REQUIRED,
        subscriptionTier: 'free',
      },
    });

    return this.loadSyncedUser(createdUser.id);
  }

  private async loadSyncedUser(userId: string): Promise<SyncedUser> {
    const rows = await this.prisma.$queryRawUnsafe<SyncedUser[]>(
      `
        SELECT
          "id",
          "clerkId",
          "email",
          "displayName",
          "subscriptionTier",
          "lastPlayedAt",
          "role"
        FROM "User"
        WHERE "id" = $1
        LIMIT 1
      `,
      userId,
    );

    const user = rows[0];
    if (!user) {
      throw new Error(`User ${userId} not found after sync`);
    }

    return user;
  }
}
