import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../core/db/prisma.service';

export type ClerkPrincipal = {
  clerkId: string;
  email?: string | null;
};

export type SyncedUser = {
  id: string;
  clerkId: string | null;
  email: string | null;
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
      await this.prisma.user.update({
        where: { id: existingByClerkId.id },
        data: {
          email: principal.email ?? undefined,
        },
      });

      return this.loadSyncedUser(existingByClerkId.id);
    }

    const existingById = await this.prisma.user.findUnique({
      where: { id: principal.clerkId },
    });

    if (existingById && !existingById.clerkId) {
      await this.prisma.user.update({
        where: { id: existingById.id },
        data: {
          clerkId: principal.clerkId,
          email: principal.email ?? undefined,
        },
      });

      return this.loadSyncedUser(existingById.id);
    }

    const createdUser = await this.prisma.user.create({
      data: {
        id: randomUUID(),
        clerkId: principal.clerkId,
        email: principal.email ?? undefined,
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
