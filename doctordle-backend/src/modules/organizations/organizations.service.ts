import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrganizationMemberStatus,
  OrganizationRole,
  OrganizationType,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';

type OrganizationRecord = {
  id: string;
  name: string;
  type: OrganizationType;
  slug: string | null;
  seatPriceCents: number | null;
  currency: string | null;
  seatLimit: number | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async searchOrganizations(query?: string) {
    const normalizedQuery = query?.trim();

    const organizations = await this.prisma.organization.findMany({
      where: normalizedQuery
        ? {
            name: {
              contains: normalizedQuery,
              mode: 'insensitive',
            },
          }
        : undefined,
      orderBy: [{ name: 'asc' }],
      take: 20,
    });

    return organizations.map((organization) => this.toOrganizationDto(organization));
  }

  async createOrganization({
    userId,
    name,
    type,
  }: {
    userId: string;
    name: string;
    type: OrganizationType;
  }) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new BadRequestException('Organization name is required');
    }

    const slug = normalizeOrganizationSlug(trimmedName);
    if (!slug) {
      throw new BadRequestException('Organization name must include letters or numbers');
    }

    const existingOrganization = await this.prisma.organization.findFirst({
      where: {
        OR: [
          { slug },
          {
            name: {
              equals: trimmedName,
              mode: 'insensitive',
            },
          },
        ],
      },
    });

    if (existingOrganization) {
      throw new ConflictException('Organization already exists');
    }

    const membership = await this.prisma
      .$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: {
            name: trimmedName,
            type,
            slug,
          },
        });

        return tx.userOrganization.create({
          data: {
            userId,
            organizationId: organization.id,
            role: OrganizationRole.OWNER,
          },
          include: {
            organization: true,
          },
        });
      })
      .catch((error: unknown) => {
        if (isUniqueConstraintError(error)) {
          throw new ConflictException('Organization already exists');
        }

        throw error;
      });

    return this.toMembershipDto(membership);
  }

  async getUserOrganizations(userId: string) {
    const memberships = await this.prisma.userOrganization.findMany({
      where: {
        userId,
      },
      include: {
        organization: true,
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    return memberships.map((membership) => this.toMembershipDto(membership));
  }

  async joinOrganization(userId: string, organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: {
        id: organizationId,
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const membership = await this.prisma.userOrganization.upsert({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      create: {
        userId,
        organizationId,
      },
      update: {
        status: OrganizationMemberStatus.ACTIVE,
      },
      include: {
        organization: true,
      },
    });

    return this.toMembershipDto(membership);
  }

  private toMembershipDto(membership: {
    id: string;
    role: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    organization: OrganizationRecord;
  }) {
    return {
      id: membership.id,
      role: membership.role,
      status: membership.status,
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
      organization: this.toOrganizationDto(membership.organization),
    };
  }

  private toOrganizationDto(organization: OrganizationRecord) {
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
}

function normalizeOrganizationSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
