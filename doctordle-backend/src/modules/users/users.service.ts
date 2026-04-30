import { Injectable, NotFoundException } from '@nestjs/common';
import {
  OrganizationMemberStatus,
  OrganizationRole,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UpdateMySettingsDto } from './dto/update-my-settings.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        organizations: {
          include: {
            organization: true,
          },
          orderBy: [{ createdAt: 'asc' }],
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return toUserProfileDto(user);
  }

  async updateMyProfile(userId: string, payload: UpdateMyProfileDto) {
    await this.assertUserExists(userId);

    await this.prisma.$transaction(async (tx) => {
      const nextIndividualMode =
        payload.individualMode ??
        (payload.organizationId === null
          ? true
          : payload.organizationId
            ? false
            : undefined);

      const nextUserData: Prisma.UserUpdateInput = {
        displayName: payload.displayName,
        trainingLevel: payload.trainingLevel,
        country: payload.country,
      };

      if (typeof nextIndividualMode === 'boolean') {
        nextUserData.individualMode = nextIndividualMode;
      }

      await tx.user.update({
        where: { id: userId },
        data: nextUserData,
      });

      if (payload.organizationId === null || nextIndividualMode === true) {
        await tx.userOrganization.updateMany({
          where: {
            userId,
          },
          data: {
            status: OrganizationMemberStatus.SUSPENDED,
          },
        });
      }

      if (payload.organizationId) {
        await tx.organization.findUniqueOrThrow({
          where: {
            id: payload.organizationId,
          },
        });

        await tx.userOrganization.upsert({
          where: {
            userId_organizationId: {
              userId,
              organizationId: payload.organizationId,
            },
          },
          create: {
            userId,
            organizationId: payload.organizationId,
            role: OrganizationRole.MEMBER,
            status: OrganizationMemberStatus.ACTIVE,
          },
          update: {
            status: OrganizationMemberStatus.ACTIVE,
          },
        });

        await tx.userOrganization.updateMany({
          where: {
            userId,
            organizationId: {
              not: payload.organizationId,
            },
          },
          data: {
            status: OrganizationMemberStatus.SUSPENDED,
          },
        });
      }
    });

    return this.getMyProfile(userId);
  }

  async getMySettings(userId: string) {
    await this.assertUserExists(userId);

    const settings = await this.prisma.userSettings.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    return toUserSettingsDto(settings);
  }

  async updateMySettings(userId: string, payload: UpdateMySettingsDto) {
    await this.assertUserExists(userId);

    const data: Prisma.UserSettingsUpdateInput = {};

    if (typeof payload.showTimer === 'boolean') {
      data.showTimer = payload.showTimer;
    }

    if (typeof payload.hintsEnabled === 'boolean') {
      data.hintsEnabled = payload.hintsEnabled;
    }

    if (typeof payload.autocompleteEnabled === 'boolean') {
      data.autocompleteEnabled = payload.autocompleteEnabled;
    }

    if (payload.difficultyPreference) {
      data.difficultyPreference = payload.difficultyPreference;
    }

    if (typeof payload.spacedRepetitionEnabled === 'boolean') {
      data.spacedRepetitionEnabled = payload.spacedRepetitionEnabled;
    }

    const settings = await this.prisma.userSettings.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        showTimer: payload.showTimer,
        hintsEnabled: payload.hintsEnabled,
        autocompleteEnabled: payload.autocompleteEnabled,
        difficultyPreference: payload.difficultyPreference,
        spacedRepetitionEnabled: payload.spacedRepetitionEnabled,
      },
    });

    return toUserSettingsDto(settings);
  }

  private async assertUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
  }
}

function toUserSettingsDto(settings: {
  showTimer: boolean;
  hintsEnabled: boolean;
  autocompleteEnabled: boolean;
  difficultyPreference: string;
  spacedRepetitionEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    showTimer: settings.showTimer,
    hintsEnabled: settings.hintsEnabled,
    autocompleteEnabled: settings.autocompleteEnabled,
    difficultyPreference: settings.difficultyPreference,
    spacedRepetitionEnabled: settings.spacedRepetitionEnabled,
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt,
  };
}

function toUserProfileDto(user: {
  id: string;
  clerkId: string | null;
  email: string | null;
  displayName: string | null;
  trainingLevel: string | null;
  country: string | null;
  individualMode: boolean;
  role: string;
  organizations: Array<{
    id: string;
    role: OrganizationRole;
    status: OrganizationMemberStatus;
    createdAt: Date;
    updatedAt: Date;
    organization: {
      id: string;
      name: string;
      type: string;
      slug: string | null;
      seatPriceCents: number | null;
      currency: string | null;
      seatLimit: number | null;
      createdAt: Date;
      updatedAt: Date;
    };
  }>;
}) {
  const memberships = user.organizations.map((membership) => ({
    id: membership.id,
    role: membership.role,
    status: membership.status,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt,
    organization: {
      id: membership.organization.id,
      name: membership.organization.name,
      type: membership.organization.type,
      slug: membership.organization.slug,
      seatPriceCents: membership.organization.seatPriceCents,
      currency: membership.organization.currency,
      seatLimit: membership.organization.seatLimit,
      createdAt: membership.organization.createdAt,
      updatedAt: membership.organization.updatedAt,
    },
  }));

  const activeMembership = memberships.find((membership) => membership.status === 'ACTIVE') ?? null;

  return {
    userId: user.id,
    clerkId: user.clerkId,
    email: user.email,
    role: user.role,
    displayName: user.displayName,
    trainingLevel: user.trainingLevel,
    country: user.country,
    individualMode: user.individualMode,
    activeOrganization: activeMembership?.organization ?? null,
    memberships,
  };
}
