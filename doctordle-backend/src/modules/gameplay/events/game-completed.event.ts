export type GameCompletedEvent = {
  sessionId: string;
  userId: string;
  dailyCaseId: string;
  difficulty: string;
  score: number;
  attemptsCount: number;
  completedAt: Date;
};
