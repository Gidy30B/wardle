import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../core/db/prisma.service';

export type ClerkPrincipal = {
  clerkId: string;
  email?: string | null;
};

@Injectable()
export class UserSyncService {
  constructor(private readonly prisma: PrismaService) {}

  async findByClerkId(clerkId: string) {
    return this.prisma.user.findUnique({
      where: { clerkId },
    });
  }

  async syncUser(principal: ClerkPrincipal) {
    const existingByClerkId = await this.findByClerkId(principal.clerkId);
    if (existingByClerkId) {
      return this.prisma.user.update({
        where: { id: existingByClerkId.id },
        data: {
          email: principal.email ?? undefined,
        },
      });
    }

    const existingById = await this.prisma.user.findUnique({
      where: { id: principal.clerkId },
    });

    if (existingById && !existingById.clerkId) {
      return this.prisma.user.update({
        where: { id: existingById.id },
        data: {
          clerkId: principal.clerkId,
          email: principal.email ?? undefined,
        },
      });
    }

    return this.prisma.user.create({
      data: {
        id: randomUUID(),
        clerkId: principal.clerkId,
        email: principal.email ?? undefined,
        subscriptionTier: 'free',
      },
    });
  }
}
