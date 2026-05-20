import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  OrganizationMemberStatus,
  OrganizationRole,
  OrganizationType,
  Prisma,
  UserOnboardingStatus,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { RedisCacheService } from '../../core/cache/redis-cache.service';
import { OnboardingOrganizationDto } from './dto/onboarding-organization.dto';
import { OnboardingProfileDto } from './dto/onboarding-profile.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UpdateMySettingsDto } from './dto/update-my-settings.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
  ) {}

  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        primaryOrganization: true,
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

  async getMyOnboarding(userId: string) {
    const profile = await this.getMyProfile(userId);
    return toUserOnboardingDto(profile);
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

      if (payload.organizationId === null || nextIndividualMode === true) {
        nextUserData.primaryOrganization = {
          disconnect: true,
        };
      }

      await tx.user.update({
        where: { id: userId },
        data: nextUserData,
      });

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

        await tx.user.update({
          where: { id: userId },
          data: {
            individualMode: false,
            primaryOrganizationId: payload.organizationId,
          },
        });
      }

      await this.recomputeOnboardingState(tx, userId);
    });

    if (payload.displayName?.trim()) {
      await this.cache.deleteByPrefix('leaderboard:daily:');
      await this.cache.deleteByPrefix('leaderboard:weekly:');
    }

    return this.getMyProfile(userId);
  }

  async saveOnboardingProfile(userId: string, payload: OnboardingProfileDto) {
    const displayName = payload.displayName.trim();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          displayName,
        },
      });

      await this.recomputeOnboardingState(tx, userId, {
        preferOrganizationRequiredAfterProfile: true,
      });
    });

    await this.cache.deleteByPrefix('leaderboard:daily:');
    await this.cache.deleteByPrefix('leaderboard:weekly:');

    return this.getMyOnboarding(userId);
  }

  async completeOnboardingAsIndividual(userId: string) {
    await this.assertUserHasDisplayName(userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        individualMode: true,
        primaryOrganizationId: null,
        onboardingStatus: UserOnboardingStatus.COMPLETE,
        onboardingCompletedAt: new Date(),
      },
    });

    return this.getMyOnboarding(userId);
  }

  async completeOnboardingWithOrganization(
    userId: string,
    payload: OnboardingOrganizationDto,
  ) {
    await this.assertUserHasDisplayName(userId);

    await this.prisma.$transaction(async (tx) => {
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

      await tx.user.update({
        where: { id: userId },
        data: {
          individualMode: false,
          primaryOrganizationId: payload.organizationId,
          onboardingStatus: UserOnboardingStatus.COMPLETE,
          onboardingCompletedAt: new Date(),
        },
      });
    });

    return this.getMyOnboarding(userId);
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

  private async assertUserHasDisplayName(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.displayName?.trim()) {
      throw new BadRequestException('Complete your display name first');
    }
  }

  private async recomputeOnboardingState(
    tx: Prisma.TransactionClient,
    userId: string,
    options: { preferOrganizationRequiredAfterProfile?: boolean } = {},
  ) {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        displayName: true,
        individualMode: true,
        primaryOrganizationId: true,
        onboardingCompletedAt: true,
      },
    });

    if (!user.displayName?.trim()) {
      await tx.user.update({
        where: { id: userId },
        data: {
          onboardingStatus: UserOnboardingStatus.PROFILE_REQUIRED,
          onboardingCompletedAt: null,
        },
      });
      return;
    }

    if (
      options.preferOrganizationRequiredAfterProfile &&
      !user.primaryOrganizationId
    ) {
      await tx.user.update({
        where: { id: userId },
        data: {
          individualMode: false,
          onboardingStatus: UserOnboardingStatus.ORGANIZATION_REQUIRED,
          onboardingCompletedAt: null,
        },
      });
      return;
    }

    if (user.individualMode || user.primaryOrganizationId) {
      await tx.user.update({
        where: { id: userId },
        data: {
          onboardingStatus: UserOnboardingStatus.COMPLETE,
          onboardingCompletedAt: user.onboardingCompletedAt ?? new Date(),
        },
      });
      return;
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        onboardingStatus: UserOnboardingStatus.ORGANIZATION_REQUIRED,
        onboardingCompletedAt: null,
      },
    });
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
  onboardingStatus: UserOnboardingStatus;
  onboardingCompletedAt: Date | null;
  primaryOrganizationId: string | null;
  role: string;
  primaryOrganization: {
    id: string;
    name: string;
    type: OrganizationType;
    slug: string | null;
    seatPriceCents: number | null;
    currency: string | null;
    seatLimit: number | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
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
    onboardingStatus: user.onboardingStatus,
    onboardingCompletedAt: user.onboardingCompletedAt,
    primaryOrganizationId: user.primaryOrganizationId,
    primaryOrganization: user.primaryOrganization
      ? toOrganizationDto(user.primaryOrganization)
      : null,
    activeOrganization:
      (user.primaryOrganization ? toOrganizationDto(user.primaryOrganization) : null) ??
      activeMembership?.organization ??
      null,
    memberships,
  };
}

function toUserOnboardingDto(profile: ReturnType<typeof toUserProfileDto>) {
  return {
    userId: profile.userId,
    email: profile.email,
    displayName: profile.displayName,
    onboardingStatus: profile.onboardingStatus,
    individualMode: profile.individualMode,
    primaryOrganizationId: profile.primaryOrganizationId,
    primaryOrganization: profile.primaryOrganization
      ? {
          id: profile.primaryOrganization.id,
          name: profile.primaryOrganization.name,
          slug: profile.primaryOrganization.slug,
          type: profile.primaryOrganization.type,
        }
      : null,
    memberships: profile.memberships.map((membership) => ({
      organizationId: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      type: membership.organization.type,
      role: membership.role,
      status: membership.status,
    })),
  };
}

function toOrganizationDto(organization: {
  id: string;
  name: string;
  type: OrganizationType | string;
  slug: string | null;
  seatPriceCents: number | null;
  currency: string | null;
  seatLimit: number | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: organization.id,
    name: organization.name,
    type: organization.type,
    slug: organization.slug,
    seatPriceCents: organization.seatPriceCents,
    currency: organization.currency,
    seatLimit: organization.seatLimit,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
  };
}
