import { Injectable } from '@nestjs/common';
import { PublishTrack } from '@prisma/client';
import { compareWardleDay } from './wardle-day';

export type GameplayParticipationContext =
  | 'CURRENT_DAILY'
  | 'ARCHIVED_DAILY'
  | 'PREMIUM'
  | 'PRACTICE';

export type CompletionParticipationPolicy = {
  context: GameplayParticipationContext;
  xpEligible: boolean;
  streakEligible: boolean;
  leaderboardEligible: boolean;
  learningEligible: boolean;
};

type ResolveCompletionPolicyInput = {
  dailyCase: {
    date: Date;
    track: PublishTrack;
  };
  currentDate?: Date;
};

@Injectable()
export class ParticipationPolicyService {
  resolveCompletionPolicy(
    input: ResolveCompletionPolicyInput,
  ): CompletionParticipationPolicy {
    switch (input.dailyCase.track) {
      case PublishTrack.DAILY:
        return this.resolveDailyPolicy(input);
      case PublishTrack.PREMIUM:
        return this.buildPolicy('PREMIUM', {
          xpEligible: true,
          streakEligible: false,
          leaderboardEligible: false,
        });
      case PublishTrack.PRACTICE:
        return this.buildPolicy('PRACTICE', {
          xpEligible: true,
          streakEligible: false,
          leaderboardEligible: false,
        });
    }
  }

  private resolveDailyPolicy(
    input: ResolveCompletionPolicyInput,
  ): CompletionParticipationPolicy {
    const comparison = compareWardleDay(
      input.dailyCase.date,
      input.currentDate ?? new Date(),
    );

    if (comparison > 0) {
      throw new Error('Future DailyCase cannot resolve participation policy');
    }

    if (comparison === 0) {
      return this.buildPolicy('CURRENT_DAILY', {
        xpEligible: true,
        streakEligible: true,
        leaderboardEligible: true,
      });
    }

    return this.buildPolicy('ARCHIVED_DAILY', {
      xpEligible: true,
      streakEligible: false,
      leaderboardEligible: false,
    });
  }

  private buildPolicy(
    context: GameplayParticipationContext,
    input: Omit<CompletionParticipationPolicy, 'context' | 'learningEligible'>,
  ): CompletionParticipationPolicy {
    return {
      context,
      ...input,
      learningEligible: true,
    };
  }
}
