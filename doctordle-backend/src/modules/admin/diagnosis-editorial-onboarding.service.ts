import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DiagnosisEditorialOnboardingStatus,
  DifferentialResolutionStatus,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';

export type OnboardingStatusAction =
  | 'mark_ready_for_review'
  | 'mark_complete'
  | 'reopen';

type OnboardingAction = {
  id: string;
  label: string;
  targetTab:
    | 'overview'
    | 'teaching-rules'
    | 'editorial-brief'
    | 'education'
    | 'cases'
    | 'graph';
  reason: string;
};

@Injectable()
export class DiagnosisEditorialOnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async getOnboarding(diagnosisRegistryId: string) {
    const diagnosis = await this.prisma.diagnosisRegistry.findUnique({
      where: { id: diagnosisRegistryId },
      select: {
        id: true,
        canonicalName: true,
        displayLabel: true,
        status: true,
        active: true,
        isPlayable: true,
        isGeneratable: true,
        onboardingStatus: true,
        onboardingStartedAt: true,
        onboardingCompletedAt: true,
        education: {
          select: { id: true, editorialStatus: true },
        },
        editorialBrief: {
          select: { id: true, status: true },
        },
        _count: {
          select: {
            teachingRules: true,
            cases: true,
            graphFacts: true,
            graphCandidates: true,
          },
        },
      },
    });

    if (!diagnosis) {
      throw new NotFoundException('Diagnosis registry entry not found');
    }

    const [unresolvedCaseMappings, unresolvedEducationMappings] =
      await Promise.all([
        this.prisma.caseDifferentialMapping.count({
          where: {
            case: { diagnosisRegistryId },
            status: {
              in: [
                DifferentialResolutionStatus.UNRESOLVED,
                DifferentialResolutionStatus.AMBIGUOUS,
              ],
            },
          },
        }),
        this.prisma.educationDifferentialMapping.count({
          where: {
            diagnosisRegistryId,
            status: {
              in: [
                DifferentialResolutionStatus.UNRESOLVED,
                DifferentialResolutionStatus.AMBIGUOUS,
              ],
            },
          },
        }),
      ]);

    const existingAssets = {
      teachingRules: diagnosis._count.teachingRules,
      editorialBrief: diagnosis.editorialBrief ? 1 : 0,
      education: diagnosis.education ? 1 : 0,
      cases: diagnosis._count.cases,
      graphFacts: diagnosis._count.graphFacts,
      graphCandidates: diagnosis._count.graphCandidates,
      unresolvedDifferentials: unresolvedCaseMappings + unresolvedEducationMappings,
    };
    const missingComponents = this.getMissingComponents(existingAssets);
    const recommendedActions = this.getRecommendedActions(existingAssets);
    const totalComponents = 6;
    const completedComponents = totalComponents - missingComponents.length;
    const progress = {
      completedComponents,
      totalComponents,
      percent: Math.max(
        0,
        Math.round((completedComponents / totalComponents) * 100),
      ),
    };
    const onboardingStatus =
      diagnosis.onboardingStatus ?? DiagnosisEditorialOnboardingStatus.NEW;

    return {
      diagnosis: {
        id: diagnosis.id,
        canonicalName: diagnosis.canonicalName,
        displayLabel: diagnosis.displayLabel,
        status: diagnosis.status,
        active: diagnosis.active,
        isPlayable: diagnosis.isPlayable,
        isGeneratable: diagnosis.isGeneratable,
      },
      onboardingStatus,
      onboardingStartedAt: diagnosis.onboardingStartedAt,
      onboardingCompletedAt: diagnosis.onboardingCompletedAt,
      readiness:
        onboardingStatus === DiagnosisEditorialOnboardingStatus.COMPLETE
            ? 'complete'
            : missingComponents.length === 0
              ? 'ready_for_review'
              : 'in_progress',
      progress,
      missingComponents,
      recommendedActions,
      existingAssets,
    };
  }

  async updateStatus(
    diagnosisRegistryId: string,
    action: OnboardingStatusAction,
  ) {
    const existing = await this.prisma.diagnosisRegistry.findUnique({
      where: { id: diagnosisRegistryId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Diagnosis registry entry not found');
    }

    if (action === 'mark_ready_for_review') {
      await this.prisma.diagnosisRegistry.update({
        where: { id: diagnosisRegistryId },
        data: {
          onboardingStatus:
            DiagnosisEditorialOnboardingStatus.READY_FOR_REVIEW,
          onboardingStartedAt: { set: new Date() },
          onboardingCompletedAt: null,
        },
      });
      return this.getOnboarding(diagnosisRegistryId);
    }

    if (action === 'mark_complete') {
      await this.prisma.diagnosisRegistry.update({
        where: { id: diagnosisRegistryId },
        data: {
          onboardingStatus: DiagnosisEditorialOnboardingStatus.COMPLETE,
          onboardingCompletedAt: new Date(),
        },
      });
      return this.getOnboarding(diagnosisRegistryId);
    }

    if (action === 'reopen') {
      await this.prisma.diagnosisRegistry.update({
        where: { id: diagnosisRegistryId },
        data: {
          onboardingStatus: DiagnosisEditorialOnboardingStatus.NEW,
          onboardingStartedAt: { set: new Date() },
          onboardingCompletedAt: null,
        },
      });
      return this.getOnboarding(diagnosisRegistryId);
    }

    throw new BadRequestException('Invalid onboarding status action');
  }

  private getMissingComponents(assets: {
    teachingRules: number;
    editorialBrief: number;
    education: number;
    cases: number;
    graphFacts: number;
    unresolvedDifferentials: number;
  }) {
    return [
      assets.teachingRules ? null : 'teaching_rules',
      assets.editorialBrief ? null : 'editorial_brief',
      assets.education ? null : 'education',
      assets.cases ? null : 'cases',
      assets.graphFacts ? null : 'graph',
      assets.unresolvedDifferentials ? 'unresolved_differentials' : null,
    ].filter((item): item is string => Boolean(item));
  }

  private getRecommendedActions(assets: {
    teachingRules: number;
    editorialBrief: number;
    education: number;
    cases: number;
    graphFacts: number;
    graphCandidates: number;
    unresolvedDifferentials: number;
  }): OnboardingAction[] {
    const actions: OnboardingAction[] = [];
    if (!assets.teachingRules) {
      actions.push(
        {
          id: 'seed-legacy-teaching-rules',
          label: 'Seed legacy teaching rules',
          targetTab: 'teaching-rules',
          reason: 'No teaching rules exist yet.',
        },
        {
          id: 'generate-teaching-rule-candidates',
          label: 'Generate teaching rule candidates',
          targetTab: 'teaching-rules',
          reason: 'Start a reviewable teaching rule set.',
        },
      );
    }
    if (!assets.editorialBrief) {
      actions.push({
        id: 'generate-editorial-brief',
        label: 'Generate editorial brief draft',
        targetTab: 'editorial-brief',
        reason: 'No editorial brief exists yet.',
      });
    }
    if (!assets.education) {
      actions.push({
        id: 'generate-education-draft',
        label: 'Generate education draft',
        targetTab: 'education',
        reason: 'No education record exists yet.',
      });
    }
    if (!assets.cases) {
      actions.push({
        id: 'generate-targeted-case',
        label: 'Generate targeted case',
        targetTab: 'cases',
        reason: 'No cases are linked to this diagnosis yet.',
      });
    }
    if (assets.unresolvedDifferentials) {
      actions.push({
        id: 'review-unresolved-differentials',
        label: 'Review unresolved differentials',
        targetTab: 'overview',
        reason: `${assets.unresolvedDifferentials} unresolved mappings remain.`,
      } as OnboardingAction);
    }
    if (!assets.graphFacts || assets.graphCandidates) {
      actions.push({
        id: 'review-graph-coverage',
        label: 'Review graph coverage',
        targetTab: 'graph',
        reason: 'Graph readiness needs editorial review.',
      });
    }
    return actions;
  }

  async getSummary() {
    const [
      newlyCreatedDiagnoses,
      diagnosesMissingRules,
      diagnosesMissingEducation,
      readyForReviewDiagnoses,
    ] = await Promise.all([
      this.prisma.diagnosisRegistry.count({
        where: { onboardingStatus: DiagnosisEditorialOnboardingStatus.NEW },
      }),
      this.prisma.diagnosisRegistry.count({
        where: {
          onboardingStatus: { not: null },
          teachingRules: { none: {} },
        },
      }),
      this.prisma.diagnosisRegistry.count({
        where: {
          onboardingStatus: { not: null },
          education: { is: null },
        },
      }),
      this.prisma.diagnosisRegistry.count({
        where: {
          onboardingStatus:
            DiagnosisEditorialOnboardingStatus.READY_FOR_REVIEW,
        },
      }),
    ]);

    return {
      newlyCreatedDiagnoses,
      diagnosesMissingRules,
      diagnosesMissingEducation,
      readyForReviewDiagnoses,
    };
  }
}
