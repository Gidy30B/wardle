import { Injectable } from '@nestjs/common';
import { PublishTrack } from '@prisma/client';
import { DailyCasesService } from './daily-cases.service';
import { SessionService } from './session.service';

@Injectable()
export class GameSessionService {
  constructor(
    private readonly sessionService: SessionService,
    private readonly dailyCasesService: DailyCasesService,
  ) {}

  async startGame(input: {
    userId: string;
    dailyCaseId?: string;
    devReplay?: boolean;
    track?: PublishTrack;
    sequenceIndex?: number;
  }) {
    return this.sessionService.startGame(input);
  }

  async getTodayCasesForUser(input: { userId: string; date?: string }) {
    return this.dailyCasesService.getTodayCasesForUser(input.userId, input.date);
  }

  async submitGuess(input: {
    sessionId: string;
    guess: string;
    userId: string;
  }) {
    return this.sessionService.submitGuess(input);
  }

  async requestHint(input: { userId: string; sessionId: string }) {
    return this.sessionService.requestHint(input);
  }

  async getSessionState(sessionId: string) {
    return this.sessionService.getSessionState(sessionId);
  }

  async getCaseBySession(sessionId: string) {
    return this.sessionService.getCaseBySession(sessionId);
  }
}
