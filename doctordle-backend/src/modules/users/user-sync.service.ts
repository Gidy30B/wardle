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

  async getOrCreateUser(principal: ClerkPrincipal) {
    return this.prisma.user.upsert(
      {
        where: { clerkId: principal.clerkId },
        create: {
          id: randomUUID(),
          clerkId: principal.clerkId,
          email: principal.email ?? undefined,
          subscriptionTier: 'free',
        },
        update: {
          email: principal.email ?? undefined,
        },
      } as any,
    );
  }
}
