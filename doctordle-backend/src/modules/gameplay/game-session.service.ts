import { Injectable } from '@nestjs/common';
import { SessionService } from './session.service';

@Injectable()
export class GameSessionService {
  constructor(private readonly sessionService: SessionService) {}

  async startGame(input: { userId: string }) {
    return this.sessionService.startGame(input);
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
