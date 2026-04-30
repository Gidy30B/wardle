import { Injectable } from '@nestjs/common';
import { PublishTrack } from '@prisma/client';
import {
  DiagnosisAutocompleteService,
  type DiagnosisAutocompleteSuggestion,
} from '../diagnosis-registry/diagnosis-autocomplete.service';
import { DailyCasesService } from './daily-cases.service';
import { SessionService } from './session.service';

@Injectable()
export class GameSessionService {
  constructor(
    private readonly sessionService: SessionService,
    private readonly dailyCasesService: DailyCasesService,
    private readonly diagnosisAutocompleteService: DiagnosisAutocompleteService,
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

  async getCompletedLearningLibrary(input: { userId: string; limit?: number }) {
    return this.sessionService.getCompletedLearningLibrary(input);
  }

  async submitGuess(input: {
    sessionId: string;
    userId: string;
    diagnosisRegistryId: string;
    guess?: string;
  }) {
    return this.sessionService.submitGuess(input);
  }

  async autocompleteDiagnoses(input: {
    query: string;
    limit?: number;
  }): Promise<DiagnosisAutocompleteSuggestion[]> {
    return this.diagnosisAutocompleteService.search(input);
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
